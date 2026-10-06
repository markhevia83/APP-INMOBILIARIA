# SELF-IA continuity cycle

Branch: `selfia-audit-p0-onboarding`. Baseline commit: `b86356135275c005981181421ddd73ae3ca2929d`.

## Behavior

Conversation records a situation and a candidate memory, with its source message. An action is only stored after the user presses **Guardar esta acción**. Unscheduled commitments appear in **Asuntos abiertos**. Scheduling explicitly links the action, situation, goal and source. The six outcome choices record a chronological result and optional next step. Only learning written explicitly in **Qué quiero que SELF-IA recuerde** becomes a confirmed, single-attempt, user-declared memory.

Moving an action requires a future date and leaves it planned for another review. Skipping a review creates no learning. A result alone never completes a goal or resolves a situation automatically.

Memories can be confirmed, corrected, made obsolete or withdrawn. Corrections preserve the same identity and append before/after revisions. Origins show the source message and action. Withdrawn records remain available in a read-only history; no real data is deleted.

Chat, contextual greeting, motivation, discovery and the context endpoint use the same eligibility rules. Candidate, contradicted, rejected, obsolete and withdrawn memories are excluded. Corrected source wording and conversations where a withdrawn/corrected memory was previously used are excluded from prompt history. Legacy denormalized profile/people/hypothesis data is conservatively withheld when a withdrawal exists, because it has no reliable provenance. This may reduce unrelated personalization; it deliberately avoids promising a semantic erase that the old schema cannot prove. New receipts record memory usage by conversation. Revisions and old memory wording are never included in model prompts. A changed memory version invalidates an in-flight turn before persistence.

The map separates current state, activity trend and pending items. Trend compares two 14-day windows with at least two independent actions in each. It is explicitly a trend of recorded activity, not a personal score. **Qué hago hoy** uses the existing real-time discovery endpoint and presents source links and explicit selection/scheduling.

## Security and integrity

- Existing RLS retained. New tables have owner-scoped SELECT/INSERT policies.
- RPCs use SECURITY INVOKER, explicit authentication and user ownership, with EXECUTE revoked from PUBLIC and anon.
- Linked records require the same owner even through direct browser writes.
- Turn persistence and outcome/learning changes are transactional.
- Requests have stable idempotency identifiers; repeated action scheduling cannot duplicate a commitment's agenda event.
- Optimistic versions reject stale memory/outcome updates. Memory rows are locked and version-checked before saving a generated turn.
- No service-role key appears in client code. Existing Supabase version remains pinned.
- Schema snapshot in tests contains metadata only. Test database runs locally in PGlite, with two fabricated users.
- No migration or Edge Function was applied to `hhbipvgusfhpcbdifxyy`. No real user account was created or data modified.
- Production security advisors show the previously known leaked-password protection warning only: [Supabase remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Verification

From `selfia-app`:

```text
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm test:e2e
```

The browser test uses an installed Edge browser by default; set `PLAYWRIGHT_CHANNEL=chrome` to use Chrome. It blocks all external requests and connects the real UI to PostgreSQL/RLS through a local test adapter. It covers action acceptance, linked scheduling, partial outcome, learning, correction/audit, adaptation of the next conversation, withdrawal including prior usage, and structured plan selection. OpenAI and discovery replies are deterministic fixtures. This verifies integration behavior, not live model quality, cloud Auth, or the deployed Edge runtime.

Screenshots are produced under ignored `selfia-app/test-results/`. The database tests also cover transaction rollback, retry duplication, stale edits, moved/skipped outcomes, anonymous denial and cross-user links. The map test covers insufficient evidence, pending decisions and unsafe plan URLs.

## Isolated cloud verification still required

The existing Vercel preview and production use the SAME Supabase project; that project has no development branch. Do not apply the migration or deploy changed functions to that project for testing.

1. Obtain an existing isolated Supabase project with the baseline schema, or create a Supabase development branch after organization/cost confirmation.
2. Apply `supabase/migrations/20261006142249_continuity_cycle.sql` to that isolated project only.
3. Deploy all versioned Edge Functions plus shared files there. Set the OpenAI secret server-side and verify the user-token checks. Functions validate tokens through `getUser`; gateway JWT handling must match the project's current signing-key configuration.
4. Set Vercel PREVIEW-only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the isolated project. Do not enable `VITE_CONTINUITY_READY` against the production project.
5. Create synthetic accounts only there, run the live cycle, verify denial between users and run security advisors on the isolated database.
6. Check a preview deployment with the matching commit and live model responses. Only then consider a separate production rollout.

Without an isolated backend, this branch's new writes and calls are blocked; existing reads/login remain available. Production aliases and main remain unchanged.

## Limits

Memory withdrawal excludes attributable context and conservatively excludes untraceable legacy personalization; it does not delete historical records. Some older relationships have no provenance until the user explicitly reconnects them. The cloud migration, Edge runtime and live AI responses remain unverified until the isolated environment is available. This branch is a reviewable implementation, not approval to publish to production.

