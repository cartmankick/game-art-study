alter table heye.shelf_items add column music_url text, add column artist text;

CREATE OR REPLACE FUNCTION public.depart_shelf(sid smallint, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare mode text:=p->>'action'; entry jsonb; item_id uuid; kind text:=p->>'kind'; label text; url text; performer text; data jsonb; base jsonb;
begin
 if sid is null or sid not in (1,2) then raise exception '请先登录'; end if;
 if mode='shelf-add' then
  if kind is null or kind not in ('book','music','film','other') or jsonb_typeof(p->'items') is distinct from 'array' then raise exception '请选择分类和作品'; end if;
  if jsonb_array_length(p->'items') not between 1 and 30 then raise exception '每次可添加 1–30 项'; end if;
  for entry in select value from jsonb_array_elements(p->'items') loop
   item_id:=(entry->>'id')::uuid; label:=btrim(entry->>'title');
   if label is null or length(label) not between 1 and 150 then raise exception '每项名称请填 1–150 个字'; end if;
   url:=nullif(btrim(entry->>'music_url'),''); performer:=nullif(btrim(entry->>'artist'),'');
   if url is not null and (kind <> 'music' or length(url)>2048 or url !~ '^https://(music[.]163[.]com|y[.]music[.]163[.]com|163cn[.]tv)/[^[:space:]]+$') then raise exception '请输入有效的网易云音乐分享链接'; end if;
   if performer is not null and (url is null or length(performer)>150) then raise exception '音乐分享信息无效'; end if;
   insert into heye.shelf_items(id,kind,title,author,music_url,artist) values(item_id,kind,label,sid,url,performer) on conflict(id) do nothing;
   if not exists(select 1 from heye.shelf_items i where i.id=item_id and i.title=label and i.kind=p->>'kind' and i.author=sid and i.music_url is not distinct from url and i.artist is not distinct from performer) then raise exception '清单内容已变更';end if;
  end loop;
 elsif mode='shelf-check' then
  item_id:=(p->>'id')::uuid;
  if jsonb_typeof(p->'checked') is distinct from 'boolean' or not exists(select 1 from heye.shelf_items where id=item_id) then raise exception '清单项目无效'; end if;
  if (p->>'checked')::boolean then insert into heye.shelf_checks(item,person) values(item_id,sid) on conflict do nothing;
  else delete from heye.shelf_checks where item=item_id and person=sid; end if;
 elsif mode='read' then
  base:=jsonb_build_object('seat',sid,'members',(select jsonb_agg(to_jsonb(m) order by slot) from heye.members m),'tasks','[]'::jsonb,'photos','[]'::jsonb,'activeDays','[]'::jsonb,'history','[]'::jsonb,'more',false);
  if p->>'view'='shelf' then
   select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('people',coalesce(c.people,'[]')) order by i.created desc,i.id),'[]')
    into data from heye.shelf_items i left join (select item,jsonb_agg(person order by person) people from heye.shelf_checks group by item) c on c.item=i.id;
   return base||jsonb_build_object('shelf',data);
  elsif p->>'view'='finished' then
   select coalesce(jsonb_agg(to_jsonb(a) order by a.finished desc,a.id,a.person),'[]') into data from (
    select i.id,i.kind,i.title,c.person,c.finished,i.music_url,i.artist from heye.shelf_checks c join heye.shelf_items i on i.id=c.item
    union all
    select t.id,'task',t.title,case when t.self_task then t.author else 3-t.author end,coalesce((select max(e.created) from heye.events e where e.task_id=t.id and e.kind='done'),t.created),null::text,null::text from heye.tasks t where t.status='done'
    union all select c.id,'event',c.title,0,c.finished,null::text,null::text from heye.countdowns c where c.finished is not null
   ) a;
   return base||jsonb_build_object('finished',data);
  end if;
  raise exception '请选择有效页面';
 else raise exception '不支持此操作'; end if;
 return '{"ok":true}'::jsonb;
end $function$;
