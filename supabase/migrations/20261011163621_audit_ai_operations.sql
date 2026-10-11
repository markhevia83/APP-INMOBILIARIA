-- Operational metadata only: no prompts, replies, passwords, email addresses or API keys.
create table public.ai_usage (
 user_id uuid not null references auth.users(id),request_id uuid not null,endpoint text not null,
 status text not null check(status in ('in_progress','completed','failed')),attempts integer not null,
 reserved_units integer not null,created_at timestamptz not null default now(),last_attempt_at timestamptz not null default now(),
 lease_until timestamptz not null,model text,input_tokens integer,output_tokens integer,web_search_calls integer,
 duration_ms integer,http_status integer,error_code text,primary key(user_id,request_id)
);
alter table public.ai_usage enable row level security;
create policy ai_usage_owner_read on public.ai_usage for select to authenticated using((select auth.uid())=user_id);
grant select on public.ai_usage to authenticated;
create index ai_usage_budget_day on public.ai_usage(last_attempt_at);
create function public.selfia_reserve_ai_usage(p_user uuid,p_request uuid,p_endpoint text,p_units integer) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare existing public.ai_usage; active integer; spent integer; calls integer;
begin
 if p_user is null or p_request is null or p_units not between 1 and 200 or p_endpoint not in ('chat','daily','discover','motivation') then raise exception 'invalid_usage_request'; end if;
 perform pg_advisory_xact_lock(hashtextextended('selfia_ai_budget',0));
 select * into existing from public.ai_usage where user_id=p_user and request_id=p_request;
 if found then
  if existing.endpoint<>p_endpoint then raise exception 'request_conflict'; end if;
  if existing.status='in_progress' and existing.lease_until>clock_timestamp() or existing.status='completed' and (p_endpoint<>'chat' or exists(select 1 from public.turn_receipts where user_id=p_user and request_id=p_request)) then return jsonb_build_object('allowed',false,'reason','request_already_running_or_completed'); end if;
  if existing.attempts>=3 then return jsonb_build_object('allowed',false,'reason','retry_limit'); end if;
 end if;
 select count(*) into active from public.ai_usage where status='in_progress' and lease_until>clock_timestamp();
 if active>=10 or (select count(*) from public.ai_usage where user_id=p_user and status='in_progress' and lease_until>clock_timestamp())>=2 then return jsonb_build_object('allowed',false,'reason','concurrency_limit'); end if;
 select coalesce(sum(reserved_units),0),coalesce(sum(attempts),0) into spent,calls from public.ai_usage where last_attempt_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC';
 if spent+p_units>1000 or calls>=200 then return jsonb_build_object('allowed',false,'reason','global_daily_budget'); end if;
 if (select coalesce(sum(attempts),0) from public.ai_usage where user_id=p_user and last_attempt_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC')>=40 then return jsonb_build_object('allowed',false,'reason','user_daily_limit'); end if;
 insert into public.ai_usage(user_id,request_id,endpoint,status,attempts,reserved_units,lease_until)
 values(p_user,p_request,p_endpoint,'in_progress',1,p_units,clock_timestamp()+interval '2 minutes')
 on conflict(user_id,request_id) do update set status='in_progress',attempts=ai_usage.attempts+1,reserved_units=ai_usage.reserved_units+p_units,last_attempt_at=clock_timestamp(),lease_until=clock_timestamp()+interval '2 minutes';
 return jsonb_build_object('allowed',true);
end $$;
revoke all on function public.selfia_reserve_ai_usage(uuid,uuid,text,integer) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
 execute 'grant select,insert,update on public.ai_usage to service_role';
 execute 'grant execute on function public.selfia_reserve_ai_usage(uuid,uuid,text,integer) to service_role';
end if;end $$;
