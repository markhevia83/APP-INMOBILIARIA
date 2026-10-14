-- Audit F01/F03/F04/F06/F10. Additive; no existing rows deleted.
create or replace function public.selfia_correct_review(p_review uuid,p_event uuid,p_status text,p_result text,p_learning text,p_next text,p_rescheduled timestamptz,p_request uuid,p_expected timestamptz) returns jsonb
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
 if e.commitment_id is not null then
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

create or replace function public.selfia_schedule_commitment(p_commitment uuid,p_start timestamptz,p_area text,p_kind text,p_goal uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c public.commitments; e public.agenda_events;
begin
 select * into c from public.commitments where id=p_commitment and user_id=auth.uid() for update;
 if not found then raise exception 'commitment_not_found'; end if;
 select * into e from public.agenda_events where commitment_id=c.id and user_id=auth.uid();
 if found then
  if e.scheduled_start is distinct from p_start or e.life_area is distinct from p_area or e.event_kind is distinct from p_kind or e.goal_id is distinct from coalesce(p_goal,c.goal_id) then raise exception 'schedule_conflict_use_review'; end if;
  return to_jsonb(e);
 end if;
 if c.status not in ('pending','postponed') then raise exception 'commitment_closed'; end if;
 if p_start is null or p_start<=now() then raise exception 'future_date_required'; end if;
 insert into public.agenda_events(user_id,title,notes,life_area,event_kind,scheduled_start,status,source,situation_id,goal_id,commitment_id,source_message_id)
 values(auth.uid(),c.what,c.why,p_area,p_kind,p_start,'planned','commitment',c.situation_id,coalesce(p_goal,c.goal_id),c.id,c.source_message_id) returning * into e;
 update public.commitments set due_at=p_start,updated_at=clock_timestamp() where id=c.id;
 return to_jsonb(e);
end $$;


create table public.mutation_receipts (
 user_id uuid not null references auth.users(id), request_id uuid not null,
 operation text not null, payload jsonb not null, response jsonb not null,
 created_at timestamptz not null default now(), primary key(user_id,request_id)
);
alter table public.mutation_receipts enable row level security;
create policy mutation_receipts_owner on public.mutation_receipts for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
grant select,insert on public.mutation_receipts to authenticated;

create function public.selfia_create_agenda(p_request uuid,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare saved public.mutation_receipts; e public.agenda_events; start_at timestamptz;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if p_request is null or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into saved from public.mutation_receipts where user_id=auth.uid() and request_id=p_request;
 if found then
  if saved.operation<>'agenda' or saved.payload is distinct from p_payload then raise exception 'request_conflict'; end if;
  return saved.response;
 end if;
 start_at=(p_payload->>'scheduled_start')::timestamptz;
 if start_at is null or start_at<=now() then raise exception 'future_date_required'; end if;
 if nullif(trim(p_payload->>'title'),'') is null or length(p_payload->>'title')>300 or length(coalesce(p_payload->>'notes',''))>8000 then raise exception 'invalid_input'; end if;
 if p_payload->>'source_url' is not null and p_payload->>'source_url' !~ '^https://' then raise exception 'invalid_source'; end if;
 if p_payload->>'situation_id' is not null and not exists(select 1 from public.situations where id=(p_payload->>'situation_id')::uuid and user_id=auth.uid()) then raise exception 'situation_not_found'; end if;
 if p_payload->>'goal_id' is not null and not exists(select 1 from public.goals where id=(p_payload->>'goal_id')::uuid and user_id=auth.uid() and (situation_id is null or p_payload->>'situation_id' is null or situation_id=(p_payload->>'situation_id')::uuid)) then raise exception 'goal_context_conflict'; end if;
 insert into public.agenda_events(user_id,title,notes,life_area,event_kind,scheduled_start,perceived_difficulty,status,source,situation_id,goal_id,source_url)
 values(auth.uid(),trim(p_payload->>'title'),p_payload->>'notes',coalesce(p_payload->>'life_area','other'),coalesce(p_payload->>'event_kind','obligation'),start_at,(p_payload->>'perceived_difficulty')::smallint,'planned','user',(p_payload->>'situation_id')::uuid,(p_payload->>'goal_id')::uuid,p_payload->>'source_url') returning * into e;
 insert into public.mutation_receipts(user_id,request_id,operation,payload,response) values(auth.uid(),p_request,'agenda',p_payload,to_jsonb(e));
 return to_jsonb(e);
end $$;

-- Serialize each user's onboarding and persist every multi-write operation atomically.
alter table public.onboarding_sessions add column revision integer not null default 0;
alter table public.onboarding_sessions add column initial_situation_id uuid;
create function public.selfia_onboarding_transition(p_request uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare saved public.mutation_receipts; s public.onboarding_sessions; cid uuid; result jsonb; draft jsonb; covered jsonb;
 dims text[]=array['priorities','enjoyment','distress','boundaries','decisions','conflict','change','concerns','aspirations','people','style']; idx integer; target text;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if p_request is null or p_action not in ('start','answer','validate','skip','complete','checkpoint') or jsonb_typeof(p_payload)<>'object' then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'onboarding',0));
 select * into saved from public.mutation_receipts where user_id=auth.uid() and request_id=p_request;
 if found then
  if saved.operation<>p_action or saved.payload is distinct from p_payload then raise exception 'request_conflict'; end if;
  return saved.response;
 end if;
 if p_payload->>'session_id' is not null then
  select * into s from public.onboarding_sessions where user_id=auth.uid() and id=(p_payload->>'session_id')::uuid for update;
  if not found then raise exception 'session_not_found'; end if;
 else
  select * into s from public.onboarding_sessions where user_id=auth.uid() and status in ('in_progress','review') order by started_at desc limit 1 for update;
 end if;
 if p_action='start' then
  if s.id is null then
   insert into public.conversations(user_id,kind,title) values(auth.uid(),'onboarding','Conocernos') returning id into cid;
   insert into public.onboarding_sessions(user_id,conversation_id,current_dimension) values(auth.uid(),cid,dims[1]) returning * into s;
   insert into public.profiles(user_id,onboarding_status) values(auth.uid(),'in_progress') on conflict(user_id) do update set onboarding_status='in_progress',updated_at=clock_timestamp();
  end if;
 elsif p_action='checkpoint' then
  if exists(select 1 from public.profiles where user_id=auth.uid() and onboarding_status in ('completed','skipped')) then raise exception 'onboarding_already_finished'; end if;
  cid=(p_payload->>'conversation_id')::uuid;
  if not exists(select 1 from public.conversations where id=cid and user_id=auth.uid()) then raise exception 'conversation_not_found'; end if;
  if p_payload->>'situation_id' is not null and not exists(select 1 from public.situations where id=(p_payload->>'situation_id')::uuid and user_id=auth.uid()) then raise exception 'situation_not_found'; end if;
  if s.id is null then
   insert into public.onboarding_sessions(user_id,conversation_id,initial_situation_id) values(auth.uid(),cid,(p_payload->>'situation_id')::uuid) returning * into s;
  else
   update public.onboarding_sessions set conversation_id=cid,initial_situation_id=(p_payload->>'situation_id')::uuid,revision=revision+1 where id=s.id returning * into s;
  end if;
  insert into public.profiles(user_id,onboarding_status) values(auth.uid(),'in_progress') on conflict(user_id) do update set onboarding_status='in_progress',updated_at=clock_timestamp();
 elsif p_action='answer' then
  if s.id is null or s.status<>'in_progress' or s.current_dimension is null then raise exception 'session_not_in_progress'; end if;
  if (p_payload->>'expected_revision')::integer is distinct from s.revision then raise exception 'session_changed_reload'; end if;
  if nullif(trim(p_payload->>'content'),'') is null or length(p_payload->>'content')>12000 then raise exception 'invalid_input'; end if;
  idx=array_position(dims,s.current_dimension);
  if idx is null then raise exception 'invalid_dimension'; end if;
  draft=s.draft_profile||jsonb_build_object(s.current_dimension,coalesce(s.draft_profile->s.current_dimension,'[]'::jsonb)||jsonb_build_array(trim(p_payload->>'content')));
  covered=s.dimensions_covered||jsonb_build_array(s.current_dimension);
  insert into public.messages(user_id,conversation_id,role,content) values(auth.uid(),s.conversation_id,'user',trim(p_payload->>'content'));
  update public.onboarding_sessions set status=case when idx=11 then 'review' else 'in_progress' end,current_dimension=dims[idx+1],draft_profile=draft,dimensions_covered=covered,turn_count=turn_count+1,revision=revision+1 where id=s.id returning * into s;
  if idx=11 then insert into public.profiles(user_id,onboarding_status,base_profile) values(auth.uid(),'review',draft) on conflict(user_id) do update set onboarding_status='review',base_profile=draft,updated_at=clock_timestamp(); end if;
 else
  target=case when p_action='skip' then 'skipped' else 'completed' end;
  if p_action in ('validate','complete') and s.id is null then raise exception 'session_not_found'; end if;
  if p_action='complete' and not exists(select 1 from public.messages where conversation_id=s.conversation_id and user_id=auth.uid() and role='assistant') then raise exception 'initial_conversation_required'; end if;
  if s.id is not null and s.status not in ('in_progress','review') then raise exception 'session_closed'; end if;
  if p_action='validate' and (jsonb_typeof(p_payload->'profile')<>'object' or s.status<>'review' or (p_payload->>'expected_revision')::integer is distinct from s.revision) then raise exception 'invalid_profile_or_version'; end if;
  insert into public.profiles(user_id,onboarding_status,base_profile,validated_at) values(auth.uid(),target,coalesce(p_payload->'profile','{}'),case when target='completed' then now() end)
  on conflict(user_id) do update set onboarding_status=target,base_profile=case when p_action='validate' then excluded.base_profile else public.profiles.base_profile end,validated_at=excluded.validated_at,updated_at=clock_timestamp();
  if s.id is not null then
   update public.onboarding_sessions set status=target,completed_at=now(),draft_profile=case when p_action='validate' then p_payload->'profile' else draft_profile end,revision=revision+1 where id=s.id returning * into s;
   if p_action='validate' then update public.conversations set status='closed',ended_at=now() where id=s.conversation_id and user_id=auth.uid(); end if;
  end if;
 end if;
 result=jsonb_build_object('status',coalesce(s.status,target),'session_id',s.id,'conversation_id',s.conversation_id,'situation_id',s.initial_situation_id,'revision',s.revision,'current_dimension',s.current_dimension,'draft_profile',s.draft_profile,'progress',jsonb_build_object('covered',s.dimensions_covered,'total',11));
 insert into public.mutation_receipts(user_id,request_id,operation,payload,response) values(auth.uid(),p_request,p_action,p_payload,result);
 return result;
end $$;
revoke all on function public.selfia_create_agenda(uuid,jsonb),public.selfia_onboarding_transition(uuid,text,jsonb) from public,anon;
grant execute on function public.selfia_create_agenda(uuid,jsonb),public.selfia_onboarding_transition(uuid,text,jsonb) to authenticated;

create function public.selfia_save_onboarding_turn(p_conversation uuid,p_request uuid,p_content text,p_turn jsonb,p_situation uuid,p_goal uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare result jsonb; checkpoint jsonb;
begin
 result=public.selfia_save_turn(p_conversation,p_request,p_content,p_turn,p_situation,p_goal);
 checkpoint=public.selfia_onboarding_transition(p_request,'checkpoint',jsonb_build_object('conversation_id',result->>'conversation_id','situation_id',result->'situation'->>'id'));
 return result||jsonb_build_object('onboarding',checkpoint);
end $$;
revoke all on function public.selfia_save_onboarding_turn(uuid,uuid,text,jsonb,uuid,uuid) from public,anon;
grant execute on function public.selfia_save_onboarding_turn(uuid,uuid,text,jsonb,uuid,uuid) to authenticated;

create or replace function public.selfia_review_action(p_event uuid,p_status text,p_result text,p_learning text,p_next text,p_rescheduled timestamptz,p_request uuid,p_expected timestamptz) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare e public.agenda_events; r public.action_reviews; mid uuid;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 select * into e from public.agenda_events where id=p_event and user_id=auth.uid() for update;
 if not found then raise exception 'event_not_found'; end if;
 select * into r from public.action_reviews where user_id=auth.uid() and request_id=p_request;
 if found then
  if r.event_id<>p_event or r.status<>p_status or r.result_note is distinct from nullif(trim(p_result),'') or r.learning is distinct from nullif(trim(p_learning),'') or r.next_step is distinct from nullif(trim(p_next),'') or r.rescheduled_start is distinct from p_rescheduled then raise exception 'request_conflict'; end if;
  return jsonb_build_object('review',to_jsonb(r),'replayed',true);
 end if;
 if e.updated_at is distinct from p_expected then raise exception 'event_changed_reload'; end if;
 if p_status not in ('done','partially_done','not_done','moved','no_longer_relevant','skipped_review') then raise exception 'invalid_status'; end if;
 if length(coalesce(p_result,''))>4000 or length(coalesce(p_learning,''))>4000 or length(coalesce(p_next,''))>4000 then raise exception 'input_too_long'; end if;
 if p_status='moved' and (p_rescheduled is null or p_rescheduled<=now()) then raise exception 'future_date_required'; end if;
 if p_status<>'moved' and p_rescheduled is not null then raise exception 'unexpected_date'; end if;
 if p_status='skipped_review' and (nullif(trim(p_learning),'') is not null or nullif(trim(p_result),'') is not null or nullif(trim(p_next),'') is not null) then raise exception 'skipped_review_has_no_learning'; end if;
 insert into public.action_reviews(user_id,event_id,status,result_note,learning,next_step,rescheduled_start,request_id)
 values(auth.uid(),p_event,p_status,nullif(trim(p_result),''),nullif(trim(p_learning),''),nullif(trim(p_next),''),p_rescheduled,p_request) returning * into r;
 update public.agenda_events set status=case when p_status='moved' then 'planned' else p_status end,
 scheduled_start=coalesce(p_rescheduled,scheduled_start), completion_reason=nullif(trim(p_result),''),
 reviewed_at=now(),updated_at=clock_timestamp() where id=p_event;
 if e.commitment_id is not null then
  update public.commitments set status=case p_status when 'done' then 'done' when 'not_done' then 'not_done'
   when 'no_longer_relevant' then 'obsolete' when 'moved' then 'postponed' else 'pending' end,
   due_at=coalesce(p_rescheduled,due_at),updated_at=clock_timestamp()
   where id=e.commitment_id and user_id=auth.uid();
 end if;
 if nullif(trim(p_learning),'') is not null then
  insert into public.memories(user_id,memory_type,content,life_area,status,user_validation,source_message_id,source_event_id,structured_data)
  values(auth.uid(),'action_learning',trim(p_learning),e.life_area,'confirmed','confirmed',e.source_message_id,e.id,
  jsonb_build_object('review_id',r.id,'epistemic_type','user_declared','scope','single_attempt','next_step',nullif(trim(p_next),''))) returning id into mid;
 end if;
 return jsonb_build_object('review',to_jsonb(r),'memory_id',mid,'replayed',false);
end $$;


create function public.selfia_begin_conversation(p_request uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare conversation public.conversations;
begin
 if auth.uid() is null or p_request is null then raise exception 'unauthorized'; end if;
 insert into public.conversations(id,user_id,kind,title) values(p_request,auth.uid(),'general','Sesión SELF-IA') on conflict(id) do nothing;
 select * into conversation from public.conversations where id=p_request and user_id=auth.uid();
 if not found then raise exception 'request_conflict'; end if;
 return to_jsonb(conversation);
end $$;
revoke all on function public.selfia_begin_conversation(uuid) from public,anon;
grant execute on function public.selfia_begin_conversation(uuid) to authenticated;
