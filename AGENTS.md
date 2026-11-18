# AGENTS.md

Instructions for any coding agent working in this repository. Read this file, then
[docs/STATE.md](docs/STATE.md), then the relevant section of
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## What this is

LaunchPad is the operations portal for **FRC Team 10989 (Blast Robotics / Keystone STEM Alliance)**:
identity, roster, waivers, roles, events, announcements, and the Google Groups / Shared Drive /
Calendar / Slack / Discord provisioning that follows from them.

**Single team. No multi-tenancy.** Seasons are how time is modelled.

## Read order

| File | Purpose |
|---|---|
| `docs/STATE.md` | What already exists, verified facts, gotchas, next action |
| `docs/PHASE-0-PLAN.md` | File-by-file plan for the current phase |
| `docs/ARCHITECTURE.md` | Data model, provisioning rules, integrations |
| `docs/DECISIONS.md` | Decision log, including reversals and open questions |
| `docs/ROADMAP.md` | Phases and exit criteria |
| `docs/SETUP.md` | Accounts, credentials, Google objects inventory |

If `STATE.md` and a plan disagree, `STATE.md` wins — it is the measured truth.

## Commands (once the scaffold lands)

```bash
bun install
bun run dev:api          # Elysia on http://localhost:3000
bun run dev:web          # Vite on http://localhost:5173, proxying /api to 3000
bun run typecheck
bun run lint
bun test
bun run db:generate      # drizzle-kit generate -> migrations/
bun run db:migrate       # applies with DATABASE_URL_UNPOOLED
bun run db:check         # fails when migrations drift from schema
```

Until those scripts exist, `docs/PHASE-0-PLAN.md` is the specification; do not invent a
different build tool, package manager, or directory layout.

## Non-negotiables

These come from explicit product decisions. Changing one requires a `DECISIONS.md` entry, not a
code review comment.

1. **No outbound email, ever.** No Resend, no SMTP, no magic links, no invite emails, no
   verification emails. Identity is Google OAuth **or** email + password sign-up (D-021:
   unverified, and the account gets no access until a roster claim or admin action). If a flow
   seems to need email, redesign the flow.
2. **No queue or scheduler infrastructure.** Inline post-response work, plus one daily cron.
   Do not add Inngest, QStash, Trigger.dev, BullMQ, or a worker process.
3. **No object storage.** No S3/R2/Blob for documents. PDFs live in the Team Shared Drive and are
   referenced by Google file ID.
4. **Never hardcode a Google ID.** No group email, folder ID, calendar ID, or Slack channel ID in
   source. They live in `google_objects` and are read through a lookup.
5. **Waiver status is derived, never a column.** No `internal_waiver`, no `is_cleared`, no
   `waiver_ok` field. Compute it from active `waiver_documents` ∩ effective roles ∩
   `waiver_signatures`.
6. **Signatures are append-only.** New waiver version = new `waiver_documents` row. Never update or
   delete a signature row.
7. **Alumni are archived, never deleted.** Status changes, files are untouched, the Google account
   moves to the parents group, badge off, app role downgraded.
8. **One PDF, two fields.** Waivers are a single KeySign document with `Student` and
   `Parent/Guardian` fields. No envelopes, no multi-signer orchestration, no KeySign auth changes
   beyond the documented service token + webhook.
9. **LaunchPad owns the roster.** Do not make anything depend on LancerLogin. Attendance enters
   through the `AttendanceProvider` interface (`manual`, `csv` now).
10. **No purchases.** No paid plans, seats, add-ons, or upgrades, on any account.

## Conventions

- **TypeScript strict**, `noUncheckedIndexedAccess`. No `any` in exported signatures; `unknown` +
  Zod at every boundary (request body, webhook payload, environment).
- **Database naming:** `snake_case` tables and columns; `camelCase` in TypeScript via explicit
  column names. Every table has `created_at` / `updated_at` through the shared helper.
- **IDs:** UUID primary keys generated in Postgres. External IDs (Google, KeySign, Slack) are
  stored as text and never used as primary keys.
- **Enums:** Postgres enums for closed sets that appear in the data model (`role`, `status`,
  `source`, `direction`, `channel`, `google_object_kind`); text + check for values that are still
  moving.
- **Time:** `timestamptz` everywhere, UTC in the database, ISO 8601 over the wire.
- **API:** routes compose shared Zod contracts from `packages/shared`; the web app never defines
  a response shape the API does not export.
- **Migrations:** generated and committed. Never edit an applied migration; add a new one. Apply
  with the unpooled URL, once, never concurrently.
- **Logging:** structured, IDs only. No emails, names, tokens, cookies, or Google payload dumps.

## Verification

`ok: true` from a tool call proves nothing on its own. After a change:

1. `bun run typecheck` and `bun test` pass.
2. The affected route or query returns the expected **shape and absence** of data (a write that
   changes nothing, or a 200 with an empty array, is a failure to investigate).
3. Migration: `db:check` is clean and `db:migrate` is a no-op on the second run.
4. Anything touching auth is exercised unauthenticated (401) and authenticated.

## When you finish

- Update `docs/STATE.md` if infrastructure, env vars, or verified facts changed.
- Update `docs/DECISIONS.md` for any reversal or new constraint, with the reason.
- Tick the corresponding `ROADMAP.md` checkboxes only when the exit criterion is demonstrated in
  production, not when the code merges.
