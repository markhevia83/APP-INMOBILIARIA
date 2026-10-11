-- New declarations carry explicit independent provenance; legacy unknown sources stay excluded.
alter table public.profile_items add column provenance jsonb not null default '{}'::jsonb;
create function public.selfia_declare_profile_item(p_request uuid,p_content text) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare receipt public.mutation_receipts; item public.profile_items;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if p_request is null or nullif(trim(p_content),'') is null or length(p_content)>4000 then raise exception 'invalid_input'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into receipt from public.mutation_receipts where user_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.operation<>'profile_declaration' or receipt.payload is distinct from jsonb_build_object('content',trim(p_content)) then raise exception 'request_conflict'; end if;
  return receipt.response;
 end if;
 insert into public.profile_items(user_id,category,content,epistemic_type,user_validation,confidence,active,provenance)
 values(auth.uid(),'declared_trait',trim(p_content),'user_declared','confirmed',1,true,jsonb_build_object('origin','explicit_profile_declaration','request_id',p_request,'memory_dependencies','[]'::jsonb,'declared_at',clock_timestamp())) returning * into item;
 insert into public.mutation_receipts(user_id,request_id,operation,payload,response) values(auth.uid(),p_request,'profile_declaration',jsonb_build_object('content',trim(p_content)),to_jsonb(item));
 return to_jsonb(item);
end $$;

-- Proposals are created only by the authenticated server, immutable to browser clients.
create table public.plan_proposals (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 payload jsonb not null, timezone text not null, local_date date not null,
 checked_at timestamptz not null default now(), expires_at timestamptz not null,
 source_evidence jsonb not null,
 check (expires_at>checked_at and expires_at<=checked_at+interval '30 minutes')
);
alter table public.plan_proposals enable row level security;
create policy plan_proposals_read on public.plan_proposals for select to authenticated using ((select auth.uid())=user_id);
grant select on public.plan_proposals to authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant select,insert on public.plan_proposals to service_role'; end if; end $$;

create function public.selfia_schedule_plan(p_proposal uuid,p_start timestamptz,p_request uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare proposal public.plan_proposals; receipt public.mutation_receipts; signature jsonb; event jsonb;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if p_request is null then raise exception 'request_required'; end if;
 signature=jsonb_build_object('proposal',p_proposal,'start',p_start);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into receipt from public.mutation_receipts where user_id=auth.uid() and request_id=p_request;
 if found then
  if receipt.operation<>'plan' or receipt.payload is distinct from signature then raise exception 'request_conflict'; end if;
  return receipt.response;
 end if;
 select * into proposal from public.plan_proposals where id=p_proposal and user_id=auth.uid();
 if not found then raise exception 'plan_not_found'; end if;
 if proposal.expires_at<=clock_timestamp() or proposal.checked_at>clock_timestamp() or proposal.local_date<>(clock_timestamp() at time zone proposal.timezone)::date then raise exception 'plan_expired_refresh'; end if;
 if p_start is null or p_start<clock_timestamp()+interval '30 minutes' or (p_start at time zone proposal.timezone)::date<>proposal.local_date then raise exception 'plan_date_or_margin_invalid'; end if;
 -- Timed venues/events remain unavailable until source correspondence is independently verified.
 if proposal.payload->>'timing_kind'<>'flexible' or proposal.payload->>'requires_opening_hours'<>'false' or proposal.source_evidence->>'kind'<>'web_citation' or proposal.source_evidence->>'url' is distinct from proposal.payload->>'source_url' then raise exception 'plan_requires_source_verification'; end if;
 event=public.selfia_create_agenda(gen_random_uuid(),jsonb_build_object('title',proposal.payload->>'title','notes',concat_ws(E'\n\n',proposal.payload->>'description',proposal.payload->>'why',proposal.payload->>'when'),'life_area',case when proposal.payload->>'category'='social' then 'friends' else 'self' end,'event_kind','leisure','scheduled_start',p_start,'source_url',proposal.payload->>'source_url'));
 insert into public.mutation_receipts(user_id,request_id,operation,payload,response) values(auth.uid(),p_request,'plan',signature,event);
 return event;
end $$;
revoke all on function public.selfia_declare_profile_item(uuid,text),public.selfia_schedule_plan(uuid,timestamptz,uuid) from public,anon;
grant execute on function public.selfia_declare_profile_item(uuid,text),public.selfia_schedule_plan(uuid,timestamptz,uuid) to authenticated;
