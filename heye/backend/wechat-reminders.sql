-- The notification key stays in Vault. Cron dispatches committed outbox rows
-- using a fixed HTTPS endpoint. No shared HTTP request queue contains the key.
create extension if not exists http with schema extensions;
create extension if not exists pg_cron;

create table heye.wechat_bindings (
  seat smallint primary key references heye.members(slot),
  secret_id uuid not null unique references vault.secrets(id),
  last_test_id bigint,
  last_test_at timestamptz
);
alter table heye.wechat_bindings enable row level security;
revoke all on heye.wechat_bindings from public, anon, authenticated;
grant select, insert, update, delete on heye.wechat_bindings to service_role;

create table heye.wechat_outbox (
  id bigint generated always as identity primary key,
  seat smallint not null references heye.wechat_bindings(seat) on delete cascade,
  secret_id uuid not null,
  kind text not null check(kind in ('todo','review','done','returned','test')),
  created timestamptz not null default now(),
  started timestamptz,
  status text not null default 'pending' check(status in ('pending','sending','accepted','failed','unknown'))
);
create index wechat_pending on heye.wechat_outbox(id) where status='pending';
alter table heye.wechat_outbox enable row level security;
revoke all on heye.wechat_outbox from public, anon, authenticated;
grant select,insert on heye.wechat_outbox to service_role;
grant usage on sequence heye.wechat_outbox_id_seq to service_role;

create function heye.enqueue_wechat(recipient smallint, kind text)
returns bigint language sql security invoker set search_path='' as $$
  insert into heye.wechat_outbox(seat,secret_id,kind)
    select b.seat,b.secret_id,$2 from heye.wechat_bindings b where b.seat=$1
    returning id;
$$;
revoke all on function heye.enqueue_wechat(smallint,text) from public, anon, authenticated;
grant execute on function heye.enqueue_wechat(smallint,text) to service_role;

create function heye.notify_task_wechat()
returns trigger language plpgsql security invoker set search_path='' as $$
declare recipient smallint;
begin
  if new.self_task then return new; end if;
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  recipient := case when new.status='review' then new.author else 3-new.author end;
  perform heye.enqueue_wechat(recipient,new.status);
  return new;
exception when others then
  -- Task writes and points survive a notification failure. Never log the SendKey.
  raise warning 'Could not enqueue task reminder (SQLSTATE %)',sqlstate;
  return new;
end $$;
revoke all on function heye.notify_task_wechat() from public, anon, authenticated;
grant execute on function heye.notify_task_wechat() to service_role;
create trigger task_wechat after insert or update of status on heye.tasks
for each row execute function heye.notify_task_wechat();

create function public.depart_wechat(p jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  identity_result jsonb;
  recipient smallint;
  operation text := p->>'action';
  send_key text;
  binding heye.wechat_bindings%rowtype;
  delivery text;
begin
  identity_result := public.depart_access(jsonb_build_object('action','session','session',p->>'session'),false,'');
  if identity_result ? 'error' then return identity_result; end if;
  recipient := (identity_result->>'seat')::smallint;
  if operation is null or operation not in ('status','bind','test','unbind') then
    return jsonb_build_object('error','无法识别此操作。','status',400);
  end if;
  -- Serializes initial setup and replacement even when the member has no binding yet.
  if operation <> 'status' then perform pg_advisory_xact_lock(81239443,recipient::integer); end if;
  select * into binding from heye.wechat_bindings where seat=recipient;
  if operation='unbind' then
    delete from heye.wechat_bindings where seat=recipient;
    delete from vault.secrets where id=binding.secret_id;
    return jsonb_build_object('enabled',false);
  elsif operation='bind' then
    send_key := btrim(coalesce(p->>'sendkey',''));
    if send_key !~ '^SCT[A-Za-z0-9]{8,128}$' then
      return jsonb_build_object('error','请输入 Server酱 Turbo 的 SCT SendKey。','status',400);
    end if;
    -- Rebinding cancels unsent messages and invalidates the old credential reference.
    delete from heye.wechat_bindings where seat=recipient;
    delete from vault.secrets where id=binding.secret_id;
    insert into heye.wechat_bindings(seat,secret_id) values(recipient,vault.create_secret(send_key));
    return jsonb_build_object('enabled',true);
  elsif operation='test' then
    if binding.secret_id is null then
      return jsonb_build_object('error','请先绑定自己的 SendKey。','status',409);
    end if;
    if binding.last_test_at>now()-interval '1 minute' then
      return jsonb_build_object('error','一分钟内可以发送一次测试。','status',429);
    end if;
    update heye.wechat_bindings set last_test_id=heye.enqueue_wechat(recipient,'test'),last_test_at=now()
    where seat=recipient;
    return jsonb_build_object('enabled',true,'delivery','pending');
  end if;

  if binding.last_test_id is not null then
    select case
      when o.status='sending' and o.started < now()-interval '2 minutes' then 'unknown'
      when o.status='sending' then 'pending' else o.status end
      into delivery from heye.wechat_outbox o where o.id=binding.last_test_id and o.seat=recipient;
    delivery := coalesce(delivery,'unknown');
  end if;
  return jsonb_strip_nulls(jsonb_build_object('enabled',binding.secret_id is not null,'delivery',delivery));
end $$;
revoke all on function public.depart_wechat(jsonb) from public, anon, authenticated;
grant execute on function public.depart_wechat(jsonb) to service_role;

-- Called at the top level so a claim can commit before contacting the provider.
-- A crash after a claim leaves the outcome unknown; the request is not replayed.
create procedure heye.deliver_wechat()
language plpgsql security invoker as $$
declare
  notice_row heye.wechat_outbox%rowtype;
  send_key text;
  title_text text;
  reply extensions.http_response;
  outcome text;
begin
  delete from heye.wechat_outbox where created < now()-interval '7 days';
  update heye.wechat_outbox set status='unknown' where status='sending' and started<now()-interval '2 minutes';
  for i in 1..12 loop
    select * into notice_row from heye.wechat_outbox where status='pending'
      order by id limit 1 for update skip locked;
    if not found then return; end if;
    update heye.wechat_outbox set status='sending',started=clock_timestamp() where id=notice_row.id;
    commit;
    -- Recheck under a lock after claiming, so a completed unbind/rebind cancels delivery.
    select v.decrypted_secret into send_key from heye.wechat_bindings b
      join vault.decrypted_secrets v on b.secret_id=v.id
      where b.seat=notice_row.seat and b.secret_id=notice_row.secret_id for share of b;
    if found then
      title_text := case notice_row.kind
        when 'todo' then '出发 · 伙伴给你布置了新任务'
        when 'review' then '出发 · 伙伴提交了任务，等你确认'
        when 'done' then '出发 · 伙伴已确认你完成的任务'
        when 'returned' then '出发 · 伙伴请你补充任务'
        when 'test' then '出发 · 微信提醒测试'
      end;
      begin
        perform set_config('http.curlopt_timeout_ms','4000',true);
        select * into reply from extensions.http_post(
          ('https://sctapi.ftqq.com/'||send_key||'.send')::varchar,
          jsonb_build_object('title',title_text,'channel','9','noip','1',
            'desp','[打开出发](https://cartmankick.github.io/game-art-study/heye/)')::text::varchar,
          'application/json'::varchar
        );
        outcome := case when reply.status >= 500 then 'unknown'
          when reply.status not between 200 and 299 then 'failed'
          when reply.content::jsonb->>'code'='0' then 'accepted' else 'failed' end;
      exception when others then outcome := 'unknown';
      end;
      send_key := null;
      update heye.wechat_outbox set status=outcome where id=notice_row.id;
    end if;
    commit;
  end loop;
end $$;
revoke all on procedure heye.deliver_wechat() from public, anon, authenticated, service_role;
select cron.schedule('heye-wechat-delivery','* * * * *','call heye.deliver_wechat()');
