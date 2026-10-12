-- Apply only to isolated tests until independent verification. Existing rows remain intact.
-- RLS protects row ownership; linked sources must have the same owner too.
create trigger profile_item_owner_links before insert or update on public.profile_items
for each row execute function public.selfia_check_links();
create trigger onboarding_owner_links before insert or update on public.onboarding_sessions
for each row execute function public.selfia_check_links();
