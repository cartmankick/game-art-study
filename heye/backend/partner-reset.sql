create table heye.partner_reset (
  seat smallint primary key references heye.access_profiles(seat) check (seat=2),
  token_hash bytea not null,
  expires timestamptz not null
);
alter table heye.partner_reset enable row level security;
revoke all on heye.partner_reset from public, anon, authenticated;
grant select, insert, update, delete on heye.partner_reset to service_role;

create function public.depart_partner_reset(p jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  pw text := coalesce(p->>'registration','');
  ticket text := coalesce(p->>'token','');
  secret_hash text;
  hits integer;
begin
  if p->>'action'='issue' then
    if not exists (select from heye.sessions where seat=1 and expires>now()
      and token_hash=extensions.digest(coalesce(p->>'session',''),'sha256')) then
      return jsonb_build_object('error','请先用创建者账号登录。','status',403);
    end if;
    insert into heye.login_limit as l(network,period,attempts) values('owner-reset',now(),1)
    on conflict(network) do update set
      attempts=case when l.period<now()-interval '10 minutes' then 1 else l.attempts+1 end,
      period=case when l.period<now()-interval '10 minutes' then now() else l.period end
    returning attempts into hits;
    if hits>10 then return jsonb_build_object('error','请在十分钟后再试。','status',429); end if;
    select pass_hash into strict secret_hash from heye.access_profiles where seat=1;
    if octet_length(pw) not between 8 and 64 or extensions.crypt(pw,secret_hash) is distinct from secret_hash then
      return jsonb_build_object('error','创建者个人注册码不正确。','status',403);
    end if;
    if not exists(select from heye.access_profiles where seat=2) then
      return jsonb_build_object('error','伙伴还没有注册。','status',409);
    end if;
    ticket:=encode(extensions.gen_random_bytes(32),'hex');
    insert into heye.partner_reset values(2,extensions.digest(ticket,'sha256'),now()+interval '15 minutes')
    on conflict(seat) do update set token_hash=excluded.token_hash,expires=excluded.expires;
    return jsonb_build_object('token',ticket);
  elsif p->>'action'='redeem' then
    if octet_length(pw) not between 8 and 64 then
      return jsonb_build_object('error','新注册码需要 8–64 字节。','status',400);
    end if;
    if ticket !~ '^[a-f0-9]{64}$' or not exists(select from heye.partner_reset where seat=2
      and expires>clock_timestamp() and token_hash=extensions.digest(ticket,'sha256') for update) then
      return jsonb_build_object('error','链接已使用、过期或无效，请向创建者索取新链接。','status',403);
    end if;
    if exists(select from heye.invitation where extensions.crypt(pw,invite_hash)=invite_hash) then
      return jsonb_build_object('error','请使用与共享邀请码不同的个人注册码。','status',400);
    end if;
    delete from heye.partner_reset where seat=2;
    update heye.access_profiles set pass_hash=extensions.crypt(pw,extensions.gen_salt('bf',10)) where seat=2;
    delete from heye.sessions where seat=2;
    return jsonb_build_object('ok',true);
  end if;
  return jsonb_build_object('error','请求无效。','status',400);
end $$;
revoke all on function public.depart_partner_reset(jsonb) from public, anon, authenticated;
grant execute on function public.depart_partner_reset(jsonb) to service_role;
