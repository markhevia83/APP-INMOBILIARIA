-- Index confirmed foreign-key paths; retain existing indexes and all rows.
create index if not exists action_reviews_event_link on public.action_reviews(event_id);
create index if not exists agenda_events_goal_link on public.agenda_events(goal_id);
create index if not exists agenda_events_situation_link on public.agenda_events(situation_id);
create index if not exists agenda_events_message_link on public.agenda_events(source_message_id);
create index if not exists commitments_goal_link on public.commitments(goal_id);
create index if not exists goal_revisions_goal_link on public.goal_revisions(goal_id);
create index if not exists goals_situation_link on public.goals(situation_id);
create index if not exists memories_event_link on public.memories(source_event_id);
create index if not exists memory_revisions_memory_link on public.memory_revisions(memory_id);
create index if not exists plan_proposals_owner_expiry on public.plan_proposals(user_id,expires_at);
create index if not exists situation_summary_revisions_memory_link on public.situation_summary_revisions(memory_id);
create index if not exists situation_summary_revisions_situation_link on public.situation_summary_revisions(situation_id);
create index if not exists situation_summary_revisions_message_link on public.situation_summary_revisions(source_message_id);
create index if not exists situation_summary_revisions_owner on public.situation_summary_revisions(user_id);
create index if not exists situations_message_link on public.situations(source_message_id);
create index if not exists turn_receipts_conversation_link on public.turn_receipts(conversation_id);
