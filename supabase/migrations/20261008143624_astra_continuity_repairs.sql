-- Additive repairs; apply only to the isolated test project until preview verification.
alter table public.action_reviews add column supersedes_id uuid references public.action_reviews(id);
create unique index action_review_corrected_once on public.action_reviews(supersedes_id) where supersedes_id is not null;
create function public.selfia_check_review_correction() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if new.supersedes_id is not null and not exists(select 1 from public.action_reviews where id=new.supersedes_id and user_id=new.user_id and event_id=new.event_id) then
  raise exception 'linked_record_not_found' using errcode='42501';
 end if;
 return new;
end $$;
create trigger review_correction_links before insert on public.action_reviews for each row execute function public.selfia_check_review_correction();

create table public.goal_revisions(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 goal_id uuid not null references public.goals(id), before_data jsonb not null, after_data jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
alter table public.goal_revisions enable row level security;
grant select,insert on public.goal_revisions to authenticated;
create policy goal_revisions_read on public.goal_revisions for select to authenticated using ((select auth.uid())=user_id);
create policy goal_revisions_append on public.goal_revisions for insert to authenticated with check ((select auth.uid())=user_id);
create index goal_revisions_owner_goal on public.goal_revisions(user_id,goal_id,created_at);
create trigger goal_revision_links before insert on public.goal_revisions for each row execute function public.selfia_check_links();
create function public.selfia_goal_audit() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
 if (old.status,old.progress_state,old.situation_id) is distinct from (new.status,new.progress_state,new.situation_id) then
  insert into public.goal_revisions(user_id,goal_id,before_data,after_data)
  values(new.user_id,new.id,jsonb_build_object('status',old.status,'progress_state',old.progress_state,'situation_id',old.situation_id),
   jsonb_build_object('status',new.status,'progress_state',new.progress_state,'situation_id',new.situation_id));
 end if;
 return new;
end $$;
create trigger goal_audit after update on public.goals for each row execute function public.selfia_goal_audit();
create or replace function public.selfia_save_turn(p_conversation uuid,p_request uuid,p_content text,p_turn jsonb,p_situation uuid,p_goal uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare msg uuid; sid uuid; response jsonb; cid uuid; s public.situations; mids uuid[]; g public.goals; linked uuid[];
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 select id into cid from public.conversations where id=p_conversation and user_id=auth.uid() for update;
 if not found then raise exception 'conversation_not_found'; end if;
 select r.response into response from public.turn_receipts r where user_id=auth.uid() and request_id=p_request;
 if found then return response; end if;
 if nullif(trim(p_content),'') is null or length(p_content)>12000 or nullif(trim(p_turn->>'reply'),'') is null then raise exception 'invalid_turn'; end if;
 if p_goal is not null then
  select * into g from public.goals where id=p_goal and user_id=auth.uid() for update;
  if not found then raise exception 'goal_not_found'; end if;
 end if;
 if p_situation is not null and not exists(select 1 from public.situations where id=p_situation and user_id=auth.uid()) then raise exception 'situation_not_found'; end if;
 select coalesce(array_agg(value::uuid),array[]::uuid[]) into mids from jsonb_array_elements_text(coalesce(p_turn->'context_memory_ids','[]'::jsonb));
 perform id from public.memories where id=any(mids) and user_id=auth.uid() order by id for share;
 if exists(select 1 from unnest(mids) mid where not exists(select 1 from public.memories where id=mid and user_id=auth.uid() and status in ('confirmed','update') and user_validation in ('confirmed','corrected') and updated_at=nullif(p_turn->'context_memory_versions'->>mid::text,'')::timestamptz)) then raise exception 'memory_context_changed'; end if;
 insert into public.messages(user_id,conversation_id,role,content) values(auth.uid(),cid,'user',p_content) returning id into msg;
 insert into public.messages(user_id,conversation_id,role,content) values(auth.uid(),cid,'assistant',p_turn->>'reply');
 -- Resolve explicit goal links before model suggestions; never merge by title similarity.
 sid:=coalesce(p_situation,g.situation_id);
 if sid is null and p_goal is not null then
  select array_agg(distinct situation_id) into linked from (
   select situation_id from public.commitments where goal_id=p_goal and user_id=auth.uid()
   union select situation_id from public.agenda_events where goal_id=p_goal and user_id=auth.uid()
  ) links where situation_id is not null;
  if cardinality(linked)=1 then sid:=linked[1]; end if;
 end if;
 sid:=coalesce(sid,nullif(p_turn->'situation'->>'situation_id','')::uuid);
 if p_turn->'situation'->>'action'='create' and sid is null then
  insert into public.situations(user_id,title,summary,life_area,status,source_message_id)
  values(auth.uid(),p_turn->'situation'->>'title',p_turn->'situation'->>'summary',p_turn->>'life_area','open',msg)
  returning * into s;
 elsif p_turn->'situation'->>'action' in ('create','update') and sid is not null then
  update public.situations set summary=p_turn->'situation'->>'summary',updated_at=clock_timestamp(),source_message_id=msg
   where id=sid and user_id=auth.uid() returning * into s;
  if not found then raise exception 'situation_not_found'; end if;
 elsif sid is not null then
  select * into s from public.situations where id=sid and user_id=auth.uid();
  if not found then raise exception 'situation_not_found'; end if;
 end if;
 if p_goal is not null and g.situation_id is null and s.id is not null then
  update public.goals set situation_id=s.id,updated_at=clock_timestamp() where id=p_goal and user_id=auth.uid();
 end if;
 if nullif(trim(p_turn->'memory'->>'content'),'') is not null then
  insert into public.memories(user_id,memory_type,content,source_message_id,life_area,status,user_validation,structured_data)
  values(auth.uid(),'conversation_note',p_turn->'memory'->>'content',msg,p_turn->>'life_area','candidate','unreviewed',
   jsonb_build_object('epistemic_type','reported_event','scope','single_conversation'));
 end if;
 response:=jsonb_build_object('conversation_id',cid,'reply',p_turn->>'reply','intervention',p_turn->>'intervention',
 'situation',case when s.id is null then null else to_jsonb(s) end,'life_area',p_turn->>'life_area',
 'commitment',case when (p_turn->'commitment'->>'create')::boolean then p_turn->'commitment' else null end,
 'source_message_id',msg,'goal_id',p_goal);
 insert into public.turn_receipts(user_id,request_id,conversation_id,response,memory_ids) values(auth.uid(),p_request,cid,response,mids);
 return response;
end $$;

create function public.selfia_correct_review(p_review uuid,p_event uuid,p_status text,p_result text,p_learning text,p_next text,p_rescheduled timestamptz,p_request uuid,p_expected timestamptz) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare e public.agenda_events; r public.action_reviews; mid uuid; previous public.action_reviews;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 select * into e from public.agenda_events where id=p_event and user_id=auth.uid() for update;
 if not found then raise exception 'event_not_found'; end if;
 select * into r from public.action_reviews where user_id=auth.uid() and request_id=p_request;
 if found then
  if r.supersedes_id is distinct from p_review or r.event_id<>p_event or r.status<>p_status or r.result_note is distinct from nullif(trim(p_result),'') or r.learning is distinct from nullif(trim(p_learning),'') or r.next_step is distinct from nullif(trim(p_next),'') or r.rescheduled_start is distinct from p_rescheduled then raise exception 'request_conflict'; end if;
  return jsonb_build_object('review',to_jsonb(r),'replayed',true);
 end if;
 select * into previous from public.action_reviews where id=p_review and event_id=p_event and user_id=auth.uid();
 if not found then raise exception 'review_not_found'; end if;
 if exists(select 1 from public.action_reviews where event_id=p_event and user_id=auth.uid() and (created_at,id)>(previous.created_at,previous.id)) then raise exception 'review_changed_reload'; end if;
 if e.updated_at is distinct from p_expected then raise exception 'event_changed_reload'; end if;
 if p_status not in ('done','partially_done','not_done','moved','no_longer_relevant','skipped_review') then raise exception 'invalid_status'; end if;
 if length(coalesce(p_result,''))>4000 or length(coalesce(p_learning,''))>4000 or length(coalesce(p_next,''))>4000 then raise exception 'input_too_long'; end if;
 if p_status='moved' and (p_rescheduled is null or p_rescheduled<=now()) then raise exception 'future_date_required'; end if;
 if p_status<>'moved' and p_rescheduled is not null then raise exception 'unexpected_date'; end if;
 if p_status='skipped_review' and (nullif(trim(p_learning),'') is not null or nullif(trim(p_result),'') is not null or nullif(trim(p_next),'') is not null) then raise exception 'skipped_review_has_no_learning'; end if;
 insert into public.action_reviews(user_id,event_id,status,result_note,learning,next_step,rescheduled_start,request_id,supersedes_id)
 values(auth.uid(),p_event,p_status,nullif(trim(p_result),''),nullif(trim(p_learning),''),nullif(trim(p_next),''),p_rescheduled,p_request,p_review) returning * into r;
 update public.agenda_events set status=case when p_status='moved' then 'planned' else p_status end,
 scheduled_start=coalesce(p_rescheduled,scheduled_start), completion_reason=nullif(trim(p_result),''),
 reviewed_at=now(),updated_at=clock_timestamp() where id=p_event;
 if e.commitment_id is not null and p_status<>'skipped_review' then
  update public.commitments set status=case p_status when 'done' then 'done' when 'not_done' then 'not_done'
   when 'no_longer_relevant' then 'obsolete' when 'moved' then 'postponed' else 'pending' end,
   due_at=coalesce(p_rescheduled,due_at),updated_at=clock_timestamp()
   where id=e.commitment_id and user_id=auth.uid();
 end if;
 -- Exclude superseded learning without deleting its evidence or correction history.
 update public.memories set status='obsolete',updated_at=clock_timestamp()
 where user_id=auth.uid() and structured_data->>'review_id'=p_review::text and status not in ('obsolete','do_not_store');
 if nullif(trim(p_learning),'') is not null then
  insert into public.memories(user_id,memory_type,content,life_area,status,user_validation,source_message_id,source_event_id,structured_data)
  values(auth.uid(),'action_learning',trim(p_learning),e.life_area,'confirmed','confirmed',e.source_message_id,e.id,
  jsonb_build_object('review_id',r.id,'epistemic_type','user_declared','scope','single_attempt','next_step',nullif(trim(p_next),''))) returning id into mid;
 end if;
 return jsonb_build_object('review',to_jsonb(r),'memory_id',mid,'replayed',false);
end $$;

revoke all on function public.selfia_correct_review(uuid,uuid,text,text,text,text,timestamptz,uuid,timestamptz) from public,anon;
grant execute on function public.selfia_correct_review(uuid,uuid,text,text,text,text,timestamptz,uuid,timestamptz) to authenticated;
