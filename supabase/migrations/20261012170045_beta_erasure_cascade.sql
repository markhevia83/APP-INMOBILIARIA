-- This migration deletes no data. Hard Auth deletion will remove this owner's histories atomically.
-- Non-personal monthly budget/reservations remain, so erasure cannot refund usage.
do $$ declare t text; c record; begin
 foreach t in array array['action_reviews','memory_revisions','turn_receipts','goal_revisions','situation_summary_revisions','mutation_receipts','plan_proposals','ai_usage','erasure_requests'] loop
  for c in select conname from pg_constraint where conrelid=format('public.%I',t)::regclass and confrelid='auth.users'::regclass and contype='f' loop
   execute format('alter table public.%I drop constraint %I',t,c.conname);
   execute format('alter table public.%I add constraint %I foreign key(user_id) references auth.users(id) on delete cascade',t,c.conname);
  end loop;
 end loop;
end $$;

create function public.selfia_erasure_preflight(p_user uuid) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare tables text[]:=array['profiles','people','conversations','messages','memories','hypotheses','situations','commitments','onboarding_sessions','profile_items','agenda_events','goals','motivation_feedback','memory_revisions','action_reviews','turn_receipts','goal_revisions','situation_summary_revisions','mutation_receipts','plan_proposals','ai_usage','erasure_requests'];
 t text; n bigint; counts jsonb:='{}'; storage_count bigint:=0; link record;
begin
 if p_user is null then raise exception 'invalid_user';end if;
 if (select count(*) from information_schema.columns where table_schema='public' and column_name='user_id')<>array_length(tables,1) then raise exception 'erasure_schema_review_required';end if;
 if not exists(select 1 from erasure_requests where user_id=p_user and status='pending') then raise exception 'erasure_request_required';end if;
 foreach t in array tables loop
  if not exists(select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attname='user_id' where c.conrelid=format('public.%I',t)::regclass and c.confrelid='auth.users'::regclass and c.contype='f' and c.confdeltype='c' and c.conkey=array[a.attnum]::smallint[]) then raise exception 'erasure_cascade_missing';end if;
  execute format('select count(*) from public.%I where user_id=$1',t) into n using p_user;
  counts:=counts||jsonb_build_object(t,n);
 end loop;
 -- Refuse old cross-owner relationships before any destructive operation.
 for link in
  select src.relname as source_table,dst.relname as target_table,sa.attname as source_column,da.attname as target_column
  from pg_constraint c join pg_class src on src.oid=c.conrelid join pg_class dst on dst.oid=c.confrelid
  join pg_namespace sn on sn.oid=src.relnamespace join pg_namespace dn on dn.oid=dst.relnamespace
  join pg_attribute sa on sa.attrelid=src.oid and sa.attnum=c.conkey[1]
  join pg_attribute da on da.attrelid=dst.oid and da.attnum=c.confkey[1]
  where c.contype='f' and sn.nspname='public' and dn.nspname='public' and array_length(c.conkey,1)=1
   and src.relname=any(tables) and dst.relname=any(tables)
 loop
  execute format('select count(*) from public.%I s join public.%I d on s.%I=d.%I where d.user_id=$1 and s.user_id<>$1',link.source_table,link.target_table,link.source_column,link.target_column) into n using p_user;
  if n>0 then raise exception 'erasure_cross_owner_link_requires_review';end if;
 end loop;
 if to_regclass('storage.objects') is not null then
  execute 'select count(*) from storage.objects t where to_jsonb(t)->>''owner_id''=$1 or to_jsonb(t)->>''owner''=$1' into storage_count using p_user::text;
 end if;
 return jsonb_build_object('user_id',p_user,'counts',counts,'owned_storage_objects',storage_count,'ready_for_auth_delete',storage_count=0);
end $$;
revoke all on function public.selfia_erasure_preflight(uuid) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='service_role') then
 grant execute on function public.selfia_erasure_preflight(uuid) to service_role;
end if;end $$;
