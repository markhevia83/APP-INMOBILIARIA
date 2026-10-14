-- Additive migration. Apply to an isolated test database first.
alter table public.agenda_events add column situation_id uuid references public.situations(id),
 add column goal_id uuid references public.goals(id),
 add column commitment_id uuid references public.commitments(id),
 add column source_message_id uuid references public.messages(id);
alter table public.commitments add column goal_id uuid references public.goals(id),
 add column source_message_id uuid references public.messages(id);
alter table public.situations add column source_message_id uuid references public.messages(id);
alter table public.goals add column situation_id uuid references public.situations(id);
alter table public.memories add column source_event_id uuid references public.agenda_events(id);
create unique index agenda_commitment_once on public.agenda_events(commitment_id) where commitment_id is not null;

create table public.action_reviews(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 event_id uuid not null references public.agenda_events(id),
 status text not null check(status in ('done','partially_done','not_done','moved','no_longer_relevant','skipped_review')),
 result_note text, learning text, next_step text,
 rescheduled_start timestamptz, request_id uuid not null,
 created_at timestamptz not null default now(),
 unique(user_id,request_id)
);
create table public.memory_revisions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 memory_id uuid not null references public.memories(id),
 action text not null, before_data jsonb not null, after_data jsonb not null,
 created_at timestamptz not null default now()
);
create index reviews_owner_event on public.action_reviews(user_id,event_id,created_at);
create index revisions_owner_memory on public.memory_revisions(user_id,memory_id,created_at);
alter table public.action_reviews enable row level security;
alter table public.memory_revisions enable row level security;
grant select,insert on public.action_reviews,public.memory_revisions to authenticated;
create policy reviews_read on public.action_reviews for select to authenticated using ((select auth.uid())=user_id);
create policy reviews_append on public.action_reviews for insert to authenticated with check ((select auth.uid())=user_id);
create policy revisions_read on public.memory_revisions for select to authenticated using ((select auth.uid())=user_id);
create policy revisions_append on public.memory_revisions for insert to authenticated with check ((select auth.uid())=user_id);

-- Enforce ownership of linked records even on direct browser writes.
create function public.selfia_check_links() returns trigger language plpgsql security invoker set search_path=public as $$
declare k text; t text; v uuid;
begin
 foreach k in array array['situation_id','goal_id','commitment_id','source_message_id','source_event_id','event_id','memory_id','conversation_id'] loop
  v := nullif(to_jsonb(new)->>k,'')::uuid;
  if v is not null then
   t := case k when 'situation_id' then 'situations' when 'goal_id' then 'goals' when 'commitment_id' then 'commitments'
    when 'source_message_id' then 'messages' when 'source_event_id' then 'agenda_events' when 'event_id' then 'agenda_events' when 'memory_id' then 'memories' when 'conversation_id' then 'conversations' end;
   execute format('select id from public.%I where id=$1 and user_id=$2',t) into v using v,new.user_id;
   if v is null then raise exception 'linked_record_not_found' using errcode='42501'; end if;
  end if;
 end loop;
 return new;
end $$;
create trigger message_links before insert or update on public.messages for each row execute function public.selfia_check_links();
create trigger agenda_links before insert or update on public.agenda_events for each row execute function public.selfia_check_links();
create trigger commitment_links before insert or update on public.commitments for each row execute function public.selfia_check_links();
create trigger goal_links before insert or update on public.goals for each row execute function public.selfia_check_links();
create trigger situation_links before insert or update on public.situations for each row execute function public.selfia_check_links();
create trigger memory_links before insert or update on public.memories for each row execute function public.selfia_check_links();
create trigger review_links before insert on public.action_reviews for each row execute function public.selfia_check_links();
create trigger revision_links before insert on public.memory_revisions for each row execute function public.selfia_check_links();

create function public.selfia_memory_audit() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if (old.content,old.status,old.user_validation) is distinct from (new.content,new.status,new.user_validation) then
  insert into public.memory_revisions(user_id,memory_id,action,before_data,after_data)
  values(new.user_id,new.id,case when new.status='do_not_store' then 'dontuse' when new.status='obsolete' then 'obsolete'
   when old.content is distinct from new.content then 'correct' else 'confirm' end,
   jsonb_build_object('content',old.content,'status',old.status,'user_validation',old.user_validation),
   jsonb_build_object('content',new.content,'status',new.status,'user_validation',new.user_validation));
 end if;
 return new;
end $$;
create trigger memory_audit after update on public.memories for each row execute function public.selfia_memory_audit();

create function public.selfia_revise_memory(p_id uuid,p_action text,p_content text,p_expected timestamptz) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare m public.memories;
begin
 select * into m from public.memories where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'memory_not_found'; end if;
 if m.updated_at is distinct from p_expected then raise exception 'memory_changed_reload'; end if;
 if p_action not in ('confirm','correct','obsolete','dontuse') then raise exception 'invalid_action'; end if;
 if m.status in ('obsolete','do_not_store') then raise exception 'memory_inactive'; end if;
 if p_action='correct' and (nullif(trim(p_content),'') is null or length(p_content)>4000) then raise exception 'invalid_content'; end if;
 update public.memories set content=case when p_action='correct' then trim(p_content) else content end,
 status=case when p_action in ('confirm','correct') then 'confirmed' when p_action='obsolete' then 'obsolete' else 'do_not_store' end,
 user_validation=case when p_action='correct' then 'corrected' when p_action='confirm' then 'confirmed' when p_action='dontuse' then 'rejected' else user_validation end,
 updated_at=clock_timestamp() where id=p_id returning * into m;
 return to_jsonb(m);
end $$;

-- One transaction records outcome, updates commitment and creates a user-declared memory.
-- Rescheduling preserves the action and leaves it available for a future review.
create function public.selfia_review_action(p_event uuid,p_status text,p_result text,p_learning text,p_next text,p_rescheduled timestamptz,p_request uuid,p_expected timestamptz) returns jsonb
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
 if e.commitment_id is not null and p_status<>'skipped_review' then
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

-- User acceptance is separate from model suggestions. Unscheduled commitments stay visible.
create function public.selfia_schedule_commitment(p_commitment uuid,p_start timestamptz,p_area text,p_kind text,p_goal uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c public.commitments; e public.agenda_events;
begin
 select * into c from public.commitments where id=p_commitment and user_id=auth.uid() for update;
 if not found then raise exception 'commitment_not_found'; end if;
 if c.status not in ('pending','postponed') then raise exception 'commitment_closed'; end if;
 if p_start is null or p_start<=now() then raise exception 'future_date_required'; end if;
 select * into e from public.agenda_events where commitment_id=c.id and user_id=auth.uid();
 if found then return to_jsonb(e); end if;
 insert into public.agenda_events(user_id,title,notes,life_area,event_kind,scheduled_start,status,source,situation_id,goal_id,commitment_id,source_message_id)
 values(auth.uid(),c.what,c.why,p_area,p_kind,p_start,'planned','commitment',c.situation_id,coalesce(p_goal,c.goal_id),c.id,c.source_message_id) returning * into e;
 update public.commitments set due_at=p_start,updated_at=clock_timestamp() where id=c.id;
 return to_jsonb(e);
end $$;

revoke all on function public.selfia_revise_memory(uuid,text,text,timestamptz) from public,anon;
revoke all on function public.selfia_review_action(uuid,text,text,text,text,timestamptz,uuid,timestamptz) from public,anon;
revoke all on function public.selfia_schedule_commitment(uuid,timestamptz,text,text,uuid) from public,anon;
grant execute on function public.selfia_revise_memory(uuid,text,text,timestamptz),
 public.selfia_review_action(uuid,text,text,text,text,timestamptz,uuid,timestamptz),
 public.selfia_schedule_commitment(uuid,timestamptz,text,text,uuid) to authenticated;

-- Included after continuity_cycle; assembled into the same migration before commit.
create table public.turn_receipts(
 user_id uuid not null references auth.users(id),request_id uuid not null,
 conversation_id uuid not null references public.conversations(id),response jsonb not null,
 memory_ids uuid[] not null default array[]::uuid[],
 primary key(user_id,request_id)
);
alter table public.turn_receipts enable row level security;
grant select,insert on public.turn_receipts to authenticated;
create trigger receipt_links before insert on public.turn_receipts for each row execute function public.selfia_check_links();
create policy receipts_read on public.turn_receipts for select to authenticated using ((select auth.uid())=user_id);
create policy receipts_append on public.turn_receipts for insert to authenticated with check ((select auth.uid())=user_id);

create function public.selfia_save_turn(p_conversation uuid,p_request uuid,p_content text,p_turn jsonb,p_situation uuid,p_goal uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare msg uuid; sid uuid; response jsonb; cid uuid; s public.situations; mids uuid[];
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 select id into cid from public.conversations where id=p_conversation and user_id=auth.uid() for update;
 if not found then raise exception 'conversation_not_found'; end if;
 select r.response into response from public.turn_receipts r where user_id=auth.uid() and request_id=p_request;
 if found then return response; end if;
 if nullif(trim(p_content),'') is null or length(p_content)>12000 or nullif(trim(p_turn->>'reply'),'') is null then raise exception 'invalid_turn'; end if;
 if p_goal is not null and not exists(select 1 from public.goals where id=p_goal and user_id=auth.uid()) then raise exception 'goal_not_found'; end if;
 if p_situation is not null and not exists(select 1 from public.situations where id=p_situation and user_id=auth.uid()) then raise exception 'situation_not_found'; end if;
 select coalesce(array_agg(value::uuid),array[]::uuid[]) into mids from jsonb_array_elements_text(coalesce(p_turn->'context_memory_ids','[]'::jsonb));
 perform id from public.memories where id=any(mids) and user_id=auth.uid() order by id for share;
 if exists(select 1 from unnest(mids) mid where not exists(select 1 from public.memories where id=mid and user_id=auth.uid() and status in ('confirmed','update') and user_validation in ('confirmed','corrected') and updated_at=nullif(p_turn->'context_memory_versions'->>mid::text,'')::timestamptz)) then raise exception 'memory_context_changed'; end if;
 insert into public.messages(user_id,conversation_id,role,content) values(auth.uid(),cid,'user',p_content) returning id into msg;
 insert into public.messages(user_id,conversation_id,role,content) values(auth.uid(),cid,'assistant',p_turn->>'reply');
 sid:=coalesce(p_situation,nullif(p_turn->'situation'->>'situation_id','')::uuid);
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

create function public.selfia_accept_action(p_message uuid,p_what text,p_why text,p_situation uuid,p_goal uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c public.commitments;
begin
 if auth.uid() is null or not exists(select 1 from public.messages where id=p_message and user_id=auth.uid() and role='user') then raise exception 'source_not_found'; end if;
 if nullif(trim(p_what),'') is null or length(p_what)>1000 then raise exception 'invalid_action'; end if;
 perform id from public.messages where id=p_message and user_id=auth.uid() for update;
 select * into c from public.commitments where user_id=auth.uid() and source_message_id=p_message and what=trim(p_what);
 if found then return to_jsonb(c); end if;
 insert into public.commitments(user_id,what,why,situation_id,goal_id,source_message_id)
 values(auth.uid(),trim(p_what),nullif(trim(p_why),''),p_situation,p_goal,p_message) returning * into c;
 return to_jsonb(c);
end $$;
revoke all on function public.selfia_save_turn(uuid,uuid,text,jsonb,uuid,uuid),public.selfia_accept_action(uuid,text,text,uuid,uuid) from public,anon;
grant execute on function public.selfia_save_turn(uuid,uuid,text,jsonb,uuid,uuid),public.selfia_accept_action(uuid,text,text,uuid,uuid) to authenticated;

