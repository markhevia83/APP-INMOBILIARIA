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

The six Edge entrypoints also pass Deno's type checker. To repeat the local runtime authentication test from the repository root with Deno installed:

```text
deno check --no-lock supabase/functions/selfia-chat/index.ts supabase/functions/selfia-context/index.ts supabase/functions/selfia-daily/index.ts supabase/functions/selfia-motivation/index.ts supabase/functions/selfia-discover/index.ts supabase/functions/selfia-onboarding/index.ts
deno test --no-lock --allow-read=supabase/functions --allow-env=SUPABASE_URL,SUPABASE_ANON_KEY supabase/tests/auth-runtime.test.ts
```

This test loads the actual handlers and Supabase client in Deno. All six reject missing sessions, invalid tokens and a publishable key presented as a user token. It checks preflight and unsupported methods, and fails on any database or model request. Auth responses are local fixtures; Deno has no network permission. It verifies runtime guards without claiming live Supabase Auth or deployed Edge verification.

## Isolated cloud verification

The initial Vercel preview shared the production Supabase project. Do not apply the migration or deploy changed functions to that production project for testing. The new isolated configuration below supersedes that initial preview configuration.

1. Obtain an existing isolated Supabase project with the baseline schema, or create a Supabase development branch after organization/cost confirmation.
2. Apply `supabase/migrations/20261006142249_continuity_cycle.sql` to that isolated project only.
3. Deploy all versioned Edge Functions plus shared files there. Set the OpenAI secret server-side and verify the user-token checks. Functions validate tokens through `getUser`; gateway JWT handling must match the project's current signing-key configuration.
4. Set Vercel PREVIEW-only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the isolated project. Do not enable `VITE_CONTINUITY_READY` against the production project.
5. Create synthetic accounts only there, run the live cycle, verify denial between users and run security advisors on the isolated database.
6. Check a preview deployment with the matching commit and live model responses. Only then consider a separate production rollout.

On 2026-10-06, the authorized branch creation was rejected because the organization is on the Free plan. After separate confirmation of the quoted $0/month project cost, **SELF-IA Pruebas** (`tleqdegnzeukonbbrrzk`, eu-west-1) was created instead. No production data was copied. The baseline was restored from the seven existing schema migrations, then the continuity migration was applied. All six functions are ACTIVE, using their checked custom user-token authentication.

Only the safe Git branch's Vercel PREVIEW variables point to this new project. Deployment `dpl_GTQtaNbRymr3TjTNrDudT5wiYgZQ`, commit `e6924be7873e061517f79e66d824e4fad1fc445b`, is READY at https://self-ia-mobile-6ko8isymo-self-ia.vercel.app . Its target is preview (null in the API); production configuration and aliases were not changed.

`pnpm test:cloud` passes against real Supabase Auth, PostgREST/RLS, RPCs and deployed Edge guards with two synthetic accounts. It covers transaction retries, links between situation/action/goal, partial outcome, explicit learning, correction/audit, withdrawal, stale edits and cross-user isolation. Its initial turn is a declared fixture sent directly to the persistence RPC, not a generated model response. Local ignored files `.verification-tools/cloud-public.json` and `cloud-users.json` supply the explicitly allowed test URL and synthetic credentials; the harness refuses production and never prints tokens/passwords. Each attempt uses unique markers and preserves test records.

With the user's explicit approval, an OpenAI key named SELF-IA Pruebas was created with restricted Responses permissions and a seven-day expiry (2026-10-13). It was saved only as OPENAI_API_KEY in the isolated project's encrypted secret manager. Its value was never added to client code, repository files or logs.

`pnpm test:live` passes with real model responses: conversation → recorded situation → explicitly accepted proposed action → schedule → partial result → declared learning → memory correction → next conversation using the corrected learning → withdrawal → later conversation excluding the withdrawn memory. The test verifies usage receipts, retained selected situation/goal links and denial of another user's selected links. Live discovery returns two structured plans with HTTPS source links. This is finite synthetic coverage, not a guarantee for every model response.

The live tests found and fixed two integration problems: legacy instructions described commitment as already accepted rather than a UI proposal; and selected links were incorrectly rejected after memory source text was filtered. The prompt now distinguishes proposals from acceptance and requires situation continuity. Explicitly selected links are owner-validated before source filtering and remain authoritative over model-generated identifiers. Test-project chat version 6 contains these fixes; production functions remain unchanged.

A standalone browser check was intercepted by Vercel Authentication, and automatic approval rejected a shareable bypass link. No protection was disabled. The in-app browser could access the preview using its existing access. A real synthetic login, action scheduling, partial review, learning creation, memory correction, source/before/after audit and withdrawal all passed against the test backend. Before the key was configured, failed chat visibly preserved input and displayed the missing-key error. Temporary test tabs are closed after verification.

The test project's security advisor reports the leaked-password protection warning, with no database/RLS lints: [remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Production aliases and main remain unchanged.

## Limits

### Mobile follow-through (2026-10-08)

The founder preview was subsequently configured against the existing production backend by a separate change (161ad6f). Its advanced continuity RPCs remain disabled against production. Do not use that preview to validate the new cycle. A separate `selfia-continuity-preview` branch mirrors the reviewed safe-branch commit and has PREVIEW-only configuration for SELF-IA Pruebas; it contains no copied real data. Keep founder preview configuration and production deployment unchanged.

Paused goals now remain visible and can be resumed; completed/abandoned goals remain in a closed-goals section and can be reopened explicitly. Evolution counts each action once using its most recent review, including moved actions whose agenda status returns to planned. Historical corrections replace the displayed result rather than double-counting an action. Legacy outcomes without review records are retained in the summary.

Local build, three database/logic tests and the complete 390px mobile integration test pass, including pause recovery, closing/reopening a goal and the outcome summary. The local browser adapter now handles goal PATCH requests and explicitly enables continuity only for its synthetic backend. The model is simulated in this UI test. Current published UI verification is blocked by the desktop browser tool's Windows sandbox startup error; this does not establish a deployment error. The API-key expiry remains 2026-10-13.

Today's repeat of `test:cloud` stopped at synthetic Auth sign-in because this machine could not connect to the isolated Supabase host within ten seconds (`UND_ERR_CONNECT_TIMEOUT`), before any app-data operation. Earlier cloud/live passes remain historical evidence; they do not establish current network availability. Do not claim today's published end-to-end verification until browser access and this connection are restored.

Retrying with `node --dns-result-order=ipv4first` restored the connection: cloud Auth/guards, full RPC persistence cycle, correction/withdrawal and two-user isolation all pass. The complete live-model cycle also passes again, including corrected learning in the next conversation, exclusion after withdrawal, selected links and two structured discovery plans. Both cloud/live scripts now prefer IPv4 to make this verification reproducible on this machine without changing system network settings. The isolated preview is READY; its browser inspection still remains pending because of the separate desktop-tool startup failure.

Memory withdrawal excludes attributable context and conservatively excludes untraceable legacy personalization; it does not delete historical records. Some older relationships have no provenance until the user explicitly reconnects them. Local integration, cloud persistence, deployed access guards, published browser persistence and a synthetic live model/discovery cycle are verified. The test key expires on 2026-10-13. This branch is a reviewable implementation, not approval to publish to production.

# Astra interactive repairs — 2026-10-08

The independent mobile walkthrough completed the full cycle with the real model. It exposed four issues: duplicate subjects when continuing a goal, accepted unscheduled actions hidden from Compromisos, learning provenance showing the initial conversation instead of the review declaration, and result correction starting with an empty form.

Repairs preserve an explicitly selected goal's subject in both context loading and the owner-scoped transaction. Legacy goals recover a subject only from one unique existing action link; similar titles are never merged. Goal creation offers an explicit subject selector, and chat provides a separate new-subject entry point. No existing subjects or real data are deleted.

Accepted unscheduled actions appear in Compromisos/Mi semana with a direct route from the chat confirmation. Result review opens the prior values and distinguishes correction from another attempt. Corrections append a linked review, preserve the previous version, and retire its active learning transactionally; already withdrawn memories stay withdrawn. Source/history shows the original review declaration, result/context and next step, using Spanish labels. Goal status and progress changes now have owner-scoped append-only history; earlier changes are not retrospectively invented. The greeting no longer exposes a long email identifier. Mobile chat spacing prevents the sticky composer covering action controls.

Validation completed before publishing the frontend:

- Four Node/PGlite tests pass, including three repeated goal continuations, a separate subject, legacy-link recovery, result correction/replay, stale correction, memory supersession, goal audit and two-user/anonymous denial.
- The 390 × 844 browser cycle passes, including direct discovery of unscheduled actions, prefilled correction, new-attempt reset, origin text, goal-history display and repeated goal continuation. Model output is simulated in this local browser test; SQL and RLS execute in PGlite.
- Real isolated Supabase cloud tests pass for all six authentication guards, owner isolation, correction/replay, withdrawn-memory preservation, goal audit and continuity.
- The real model cycle passes for corrected-memory use, withdrawal exclusion, structured plans with HTTPS sources and cross-owner selected-link denial.
- Vite build passes. Supabase security advisors report only the pre-existing leaked-password protection warning.

Migration `20261008143624_astra_continuity_repairs.sql` and updated functions were applied only to `tleqdegnzeukonbbrrzk`. Production `hhbipvgusfhpcbdifxyy` and main remain untouched. Independent rechecking of the published repaired preview remains a separate validation step.
