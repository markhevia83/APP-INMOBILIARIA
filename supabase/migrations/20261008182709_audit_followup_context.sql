-- Additive changes only: original summaries and their sources remain traceable.
alter table public.agenda_events add column source_url text;
alter table public.agenda_events add constraint agenda_source_https check(source_url is null or source_url ~ '^https://[^[:space:]]+$');
alter table public.situations add column summary_needs_review boolean not null default false;
create table public.situation_summary_revisions(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 situation_id uuid not null references public.situations(id),memory_id uuid not null references public.memories(id),
 summary text,source_message_id uuid references public.messages(id),created_at timestamptz not null default now()
);
alter table public.situation_summary_revisions enable row level security;
grant select,insert on public.situation_summary_revisions to authenticated;
create policy summary_history_read on public.situation_summary_revisions for select to authenticated using((select auth.uid())=user_id);
create policy summary_history_append on public.situation_summary_revisions for insert to authenticated with check((select auth.uid())=user_id);
create trigger summary_history_links before insert on public.situation_summary_revisions for each row execute function public.selfia_check_links();
create function public.selfia_invalidate_summary() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if (old.content,old.status,old.user_validation) is distinct from (new.content,new.status,new.user_validation)
 and (new.status in ('obsolete','do_not_store') or new.user_validation in ('rejected','corrected')) then
  insert into public.situation_summary_revisions(user_id,situation_id,memory_id,summary,source_message_id)
  select s.user_id,s.id,new.id,s.summary,s.source_message_id from public.situations s
  where s.user_id=new.user_id and not s.summary_needs_review and (
   exists(select 1 from public.agenda_events a where a.id=new.source_event_id and a.user_id=new.user_id and a.situation_id=s.id)
   or exists(select 1 from public.messages sm where sm.id=s.source_message_id and sm.user_id=new.user_id and (
    exists(select 1 from public.messages mm where mm.id=new.source_message_id and mm.user_id=new.user_id and mm.conversation_id=sm.conversation_id)
    or exists(select 1 from public.turn_receipts t where t.user_id=new.user_id and t.conversation_id=sm.conversation_id and new.id=any(t.memory_ids))
   )));
  update public.situations s set summary_needs_review=true where s.user_id=new.user_id and exists(
   select 1 from public.situation_summary_revisions h where h.user_id=new.user_id and h.situation_id=s.id and h.memory_id=new.id);
 end if;
 return new;
end $$;
create trigger memory_summary_invalidation after update on public.memories for each row execute function public.selfia_invalidate_summary();
create function public.selfia_refresh_summary_flag() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 if new.source_message_id is distinct from old.source_message_id then new.summary_needs_review=false; end if;
 return new;
end $$;
create trigger summary_fresh_source before update on public.situations for each row execute function public.selfia_refresh_summary_flag();
-- Mark existing dependent summaries; preserve their exact prior text in owner-only history.
insert into public.situation_summary_revisions(user_id,situation_id,memory_id,summary,source_message_id)
select distinct s.user_id,s.id,m.id,s.summary,s.source_message_id from public.situations s join public.memories m on m.user_id=s.user_id
where (m.status in ('obsolete','do_not_store') or m.user_validation in ('rejected','corrected')) and (
 exists(select 1 from public.agenda_events a where a.id=m.source_event_id and a.user_id=m.user_id and a.situation_id=s.id)
 or exists(select 1 from public.messages sm where sm.id=s.source_message_id and sm.user_id=s.user_id and (
  exists(select 1 from public.messages mm where mm.id=m.source_message_id and mm.user_id=m.user_id and mm.conversation_id=sm.conversation_id)
  or exists(select 1 from public.turn_receipts t where t.user_id=s.user_id and t.conversation_id=sm.conversation_id and m.id=any(t.memory_ids))
 )));
update public.situations s set summary_needs_review=true where exists(select 1 from public.situation_summary_revisions h where h.user_id=s.user_id and h.situation_id=s.id);
revoke all on function public.selfia_invalidate_summary(),public.selfia_refresh_summary_flag() from public,anon;
grant execute on function public.selfia_invalidate_summary(),public.selfia_refresh_summary_flag() to authenticated;
