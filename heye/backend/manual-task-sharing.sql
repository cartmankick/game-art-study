-- Retire the automatic sender. Manual sharing uses the phone's clipboard.
select cron.unschedule(jobid)
from cron.job
where jobname = 'heye-wechat-delivery' and username = current_user;

alter table heye.tasks disable trigger task_wechat;

-- Keep the original implementation for rollback and retain the authenticated
-- unbind operation for devices that still have the old settings page open.
alter function public.depart_wechat(jsonb) set schema heye;
revoke execute on function heye.depart_wechat(jsonb) from service_role;

create function public.depart_wechat(p jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  account jsonb;
  secret_to_remove uuid;
begin
  account := public.depart_access(
    jsonb_build_object('action','session','session',p->>'session'),false,''
  );
  if account ? 'error' then return account; end if;
  if p->>'action' = 'status' then
    return jsonb_build_object('enabled',false);
  elsif p->>'action' = 'unbind' then
    delete from heye.wechat_bindings
    where seat = (account->>'seat')::smallint
    returning secret_id into secret_to_remove;
    delete from vault.secrets where id = secret_to_remove;
    return jsonb_build_object('enabled',false);
  end if;
  return jsonb_build_object('error','提醒方式已更新，请刷新后从任务详情复制微信提醒。','status',410);
end $$;

revoke all on function public.depart_wechat(jsonb) from public, anon, authenticated;
grant execute on function public.depart_wechat(jsonb) to service_role;
