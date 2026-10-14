-- Authenticated export uses a single SQL snapshot. No real records are deleted.
create function public.selfia_export_data() returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 select jsonb_build_object('user_id',auth.uid(),'exported_at',now(),'data',jsonb_build_object('profiles',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profiles t where t.user_id=auth.uid()),'profile_items',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.profile_items t where t.user_id=auth.uid()),'people',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.people t where t.user_id=auth.uid()),'hypotheses',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.hypotheses t where t.user_id=auth.uid()),'conversations',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.conversations t where t.user_id=auth.uid()),'messages',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.messages t where t.user_id=auth.uid()),'situations',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.situations t where t.user_id=auth.uid()),'goals',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.goals t where t.user_id=auth.uid()),'commitments',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.commitments t where t.user_id=auth.uid()),'agenda_events',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.agenda_events t where t.user_id=auth.uid()),'action_reviews',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.action_reviews t where t.user_id=auth.uid()),'memories',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.memories t where t.user_id=auth.uid()),'memory_revisions',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.memory_revisions t where t.user_id=auth.uid()),'turn_receipts',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.turn_receipts t where t.user_id=auth.uid()),'goal_revisions',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.goal_revisions t where t.user_id=auth.uid()),'situation_summary_revisions',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.situation_summary_revisions t where t.user_id=auth.uid()),'onboarding_sessions',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.onboarding_sessions t where t.user_id=auth.uid()),'motivation_feedback',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.motivation_feedback t where t.user_id=auth.uid()),'mutation_receipts',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.mutation_receipts t where t.user_id=auth.uid()),'plan_proposals',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.plan_proposals t where t.user_id=auth.uid()),'ai_usage',(select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.ai_usage t where t.user_id=auth.uid()))) into result;
 return result;
end $$;
create table public.erasure_requests(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),request_id uuid not null,
 status text not null default 'pending' check(status in ('pending','processing','completed','blocked')),
 created_at timestamptz not null default now(),completed_at timestamptz,
 unique(user_id,request_id)
);
create unique index erasure_one_pending on public.erasure_requests(user_id) where status in ('pending','processing');
alter table public.erasure_requests enable row level security;
create policy erasure_owner_read on public.erasure_requests for select to authenticated using((select auth.uid())=user_id);
create policy erasure_owner_request on public.erasure_requests for insert to authenticated with check((select auth.uid())=user_id and status='pending' and completed_at is null);
grant select,insert on public.erasure_requests to authenticated;
create function public.selfia_request_erasure(p_request uuid) returns jsonb language plpgsql security invoker set search_path=public as $$
declare saved public.erasure_requests;
begin
 if auth.uid() is null or p_request is null then raise exception 'unauthorized'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'erasure',0));
 select * into saved from public.erasure_requests where user_id=auth.uid() and (request_id=p_request or status in ('pending','processing')) order by created_at desc limit 1;
 if found then return to_jsonb(saved); end if;
 insert into public.erasure_requests(user_id,request_id) values(auth.uid(),p_request) returning * into saved;
 return to_jsonb(saved);
end $$;
revoke all on function public.selfia_export_data(),public.selfia_request_erasure(uuid) from public,anon;
grant execute on function public.selfia_export_data(),public.selfia_request_erasure(uuid) to authenticated;
