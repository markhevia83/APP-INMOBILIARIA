-- Aggregates only; no identifiers, prompts, context or account email addresses.
create or replace function public.selfia_operations_snapshot() returns jsonb
language sql security invoker set search_path=public as $$
select jsonb_build_object(
 'checked_at',clock_timestamp(),
 'month',(date_trunc('month',clock_timestamp() at time zone 'UTC'))::date,
 'budget',coalesce((select to_jsonb(b) from ai_monthly_budget b where month=(date_trunc('month',clock_timestamp() at time zone 'UTC'))::date),jsonb_build_object('cap_microusd',75000000,'spent_microusd',0,'held_microusd',0,'blocked',false,'uncertain_usage',false)),
 'daily_capacity',jsonb_build_object(
  'units_limit',1000,'calls_limit',200,
  'units_used',(select coalesce(sum(reserved_units),0) from ai_usage where last_attempt_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC'),
  'calls_used',(select coalesce(sum(attempts),0) from ai_usage where last_attempt_at>=date_trunc('day',clock_timestamp() at time zone 'UTC') at time zone 'UTC'),
  'reset_at',(date_trunc('day',clock_timestamp() at time zone 'UTC')+interval '1 day') at time zone 'UTC'
 ),
 'recent',jsonb_build_object(
  'requests',(select count(*) from ai_usage where last_attempt_at>=clock_timestamp()-interval '20 minutes'),
  'failures',(select count(*) from ai_usage where last_attempt_at>=clock_timestamp()-interval '20 minutes' and status='failed'),
  'stale_in_progress',(select count(*) from ai_usage where status='in_progress' and lease_until<clock_timestamp()),
  'p95_duration_ms',(select percentile_cont(0.95) within group(order by duration_ms) from ai_usage where last_attempt_at>=clock_timestamp()-interval '20 minutes' and duration_ms is not null)
 ),
 'uncertain_reservations',(select count(*) from ai_cost_reservations where uncertain and month=(date_trunc('month',clock_timestamp() at time zone 'UTC'))::date),
 'unsettled_reservations',(select count(*) from ai_cost_reservations where settled_at is null and created_at<clock_timestamp()-interval '3 minutes')
);
$$;
revoke all on function public.selfia_operations_snapshot() from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function public.selfia_operations_snapshot() to service_role;end if;end $$;
