-- USD micro-units; aggregate budget and anonymous reservations contain no user identifiers.
create table public.ai_monthly_budget (
 month date primary key, cap_microusd bigint not null default 75000000 check(cap_microusd=75000000),
 spent_microusd bigint not null default 0 check(spent_microusd>=0),
 held_microusd bigint not null default 0 check(held_microusd>=0),
 warning_80 boolean not null default false, blocked boolean not null default false,
 uncertain_usage boolean not null default false
);
create table public.ai_cost_reservations (
 id uuid primary key default gen_random_uuid(),month date not null references public.ai_monthly_budget(month),
 reserved_microusd bigint not null check(reserved_microusd between 1 and 75000000),
 charged_microusd bigint check(charged_microusd>=0), uncertain boolean not null default false,
 created_at timestamptz not null default now(),settled_at timestamptz
);
alter table public.ai_monthly_budget enable row level security;
alter table public.ai_cost_reservations enable row level security;
revoke all on public.ai_monthly_budget,public.ai_cost_reservations from public,anon,authenticated;
create index ai_cost_reservations_month on public.ai_cost_reservations(month);
create function public.selfia_reserve_ai_cost(p_user uuid,p_request uuid,p_endpoint text,p_units integer,p_microusd bigint) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare period date:=(date_trunc('month',clock_timestamp() at time zone 'UTC'))::date;
 budget public.ai_monthly_budget; usage_result jsonb; reservation uuid; attempt integer;
begin
 if p_microusd not between 1 and 75000000 or p_microusd is null then raise exception 'invalid_cost';end if;
 -- Same lock order as the capacity guard; serializes reservations across all accounts.
 perform pg_advisory_xact_lock(hashtextextended('selfia_ai_budget',0));
 insert into public.ai_monthly_budget(month) values(period) on conflict do nothing;
 select * into budget from public.ai_monthly_budget where month=period for update;
 if budget.blocked or budget.spent_microusd+budget.held_microusd+p_microusd>budget.cap_microusd then
  return jsonb_build_object('allowed',false,'reason','monthly_budget');
 end if;
 usage_result:=public.selfia_reserve_ai_usage(p_user,p_request,p_endpoint,p_units);
 if not (usage_result->>'allowed')::boolean then return usage_result;end if;
 select attempts into attempt from public.ai_usage where user_id=p_user and request_id=p_request;
 insert into public.ai_cost_reservations(month,reserved_microusd) values(period,p_microusd) returning id into reservation;
 update public.ai_monthly_budget set held_microusd=held_microusd+p_microusd,
 warning_80=warning_80 or spent_microusd+held_microusd+p_microusd>=cap_microusd*0.8 where month=period;
 return jsonb_build_object('allowed',true,'reservation_id',reservation,'attempt',attempt);
end $$;
create function public.selfia_settle_ai_cost(p_reservation uuid,p_actual_microusd bigint) returns void
language plpgsql security invoker set search_path=public as $$
declare item public.ai_cost_reservations; charge bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended('selfia_ai_budget',0));
 select * into item from public.ai_cost_reservations where id=p_reservation for update;
 if not found then raise exception 'reservation_not_found';end if;
 if item.settled_at is not null then return;end if;
 if p_actual_microusd<0 then raise exception 'invalid_cost';end if;
 -- Missing usage/timeouts consume the full estimate. A lease expiry never releases money.
 charge:=coalesce(p_actual_microusd,item.reserved_microusd);
 update public.ai_cost_reservations set charged_microusd=charge,uncertain=p_actual_microusd is null,settled_at=clock_timestamp() where id=item.id;
 update public.ai_monthly_budget set held_microusd=held_microusd-item.reserved_microusd,
 spent_microusd=spent_microusd+charge,
 uncertain_usage=uncertain_usage or p_actual_microusd is null,
 blocked=blocked or charge>item.reserved_microusd or spent_microusd+held_microusd-item.reserved_microusd+charge>=cap_microusd,
 warning_80=warning_80 or spent_microusd+held_microusd-item.reserved_microusd+charge>=cap_microusd*0.8
 where month=item.month;
end $$;
revoke all on function public.selfia_reserve_ai_cost(uuid,uuid,text,integer,bigint),public.selfia_settle_ai_cost(uuid,bigint) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
 grant select,insert,update on public.ai_monthly_budget,public.ai_cost_reservations to service_role;
 grant execute on function public.selfia_reserve_ai_cost(uuid,uuid,text,integer,bigint),public.selfia_settle_ai_cost(uuid,bigint) to service_role;
end if;end $$;
