-- Erase the memory content/versions, retaining content-free provenance for exclusion.
-- Source conversations/results are separate records, disclosed in the confirmation UI.
create schema if not exists selfia_private;
revoke all on schema selfia_private from public,anon;
grant usage on schema selfia_private to authenticated;

create function public.selfia_protect_erased_memory() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then
  if current_user in ('authenticated','anon') then raise exception 'use_memory_erasure'; end if;
  return old;
 end if;
 if old.structured_data ? 'erased_at' and
 (new.content,new.status,new.user_validation,new.structured_data) is distinct from
 (old.content,old.status,old.user_validation,old.structured_data) then raise exception 'memory_erased'; end if;
 return new;
end $$;
create trigger protect_erased_memory before update or delete on public.memories
for each row execute function public.selfia_protect_erased_memory();
revoke all on function public.selfia_protect_erased_memory() from public,anon;
grant execute on function public.selfia_protect_erased_memory() to authenticated;

-- Privilege elevation is restricted to erasing immutable owner-only histories.
-- No owner parameter, dynamic SQL, external access, or bypass of the Auth identity check.
create function selfia_private.erase_memory(p_id uuid,p_expected timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare m public.memories; uid uuid=auth.uid();
begin
 if uid is null then raise exception 'unauthorized'; end if;
 select * into m from public.memories where id=p_id and user_id=uid for update;
 if not found then raise exception 'memory_not_found'; end if;
 if m.structured_data ? 'erased_at' then return jsonb_build_object('id',p_id,'erased',true); end if;
 if m.updated_at is distinct from p_expected then raise exception 'memory_changed_reload'; end if;
 -- Existing audit/summary triggers first invalidate dependent summaries atomically.
 update public.memories set content='',status='do_not_store',user_validation='rejected',
  structured_data=jsonb_strip_nulls(jsonb_build_object('review_id',m.structured_data->>'review_id','erased_at',clock_timestamp())),
  updated_at=clock_timestamp() where id=p_id and user_id=uid;
 delete from public.memory_revisions where memory_id=p_id and user_id=uid;
 update public.situations set summary=null where user_id=uid and id in (select situation_id from public.situation_summary_revisions where memory_id=p_id and user_id=uid);
 update public.situation_summary_revisions set summary=null where user_id=uid and situation_id in (select situation_id from public.situation_summary_revisions where memory_id=p_id and user_id=uid);
 update public.action_reviews set learning=null,next_step=null where id::text=m.structured_data->>'review_id' and user_id=uid;
 -- Recommendations are derived context without complete dependency attribution.
 -- Retain rating/type metadata, erase their cached prose on explicit memory deletion.
 update public.motivation_feedback set content='Propuesta retirada tras eliminar un recuerdo.',video_query=null where user_id=uid;
 return jsonb_build_object('id',p_id,'erased',true);
end $$;
revoke all on function selfia_private.erase_memory(uuid,timestamptz) from public,anon;
grant execute on function selfia_private.erase_memory(uuid,timestamptz) to authenticated;
create function public.selfia_erase_memory(p_id uuid,p_expected timestamptz) returns jsonb
language sql security invoker set search_path='' as $$ select selfia_private.erase_memory(p_id,p_expected) $$;
revoke all on function public.selfia_erase_memory(uuid,timestamptz) from public,anon;
grant execute on function public.selfia_erase_memory(uuid,timestamptz) to authenticated;
