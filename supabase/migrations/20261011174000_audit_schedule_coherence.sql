-- Keep the same objective and subject across action and agenda. No data deleted.
create or replace function public.selfia_schedule_commitment(p_commitment uuid,p_start timestamptz,p_area text,p_kind text,p_goal uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare c public.commitments; e public.agenda_events; g public.goals;
begin
 select * into c from public.commitments where id=p_commitment and user_id=auth.uid() for update;
 if not found then raise exception 'commitment_not_found'; end if;
 select * into e from public.agenda_events where commitment_id=c.id and user_id=auth.uid();
 if found then
  if e.scheduled_start is distinct from p_start or e.life_area is distinct from p_area or e.event_kind is distinct from p_kind or e.goal_id is distinct from coalesce(p_goal,c.goal_id) then raise exception 'schedule_conflict_use_review'; end if;
  return to_jsonb(e);
 end if;
 if p_goal is not null then
  if c.goal_id is not null and c.goal_id<>p_goal then raise exception 'goal_context_conflict'; end if;
  select * into g from public.goals where id=p_goal and user_id=auth.uid() for update;
  if not found or g.situation_id is not null and g.situation_id is distinct from c.situation_id then raise exception 'goal_context_conflict'; end if;
  if c.goal_id is null then update public.commitments set goal_id=p_goal where id=c.id and user_id=auth.uid(); end if;
  if g.situation_id is null and c.situation_id is not null then update public.goals set situation_id=c.situation_id,updated_at=clock_timestamp() where id=g.id and user_id=auth.uid(); end if;
 end if;
 if c.status not in ('pending','postponed') then raise exception 'commitment_closed'; end if;
 if p_start is null or p_start<=now() then raise exception 'future_date_required'; end if;
 insert into public.agenda_events(user_id,title,notes,life_area,event_kind,scheduled_start,status,source,situation_id,goal_id,commitment_id,source_message_id)
 values(auth.uid(),c.what,c.why,p_area,p_kind,p_start,'planned','commitment',c.situation_id,coalesce(p_goal,c.goal_id),c.id,c.source_message_id) returning * into e;
 update public.commitments set due_at=p_start,updated_at=clock_timestamp() where id=c.id;
 return to_jsonb(e);
end $$;
