# LaunchPad — Current State

**As of:** 2026-11-17 · **Phase:** 0 (Bootstrap) · **Code written:** scaffold complete locally, uncommitted (steps 1–5, 8–9 of the plan)

This file is the handoff. If you are an agent picking this up, read it before touching anything.
It records what **already exists** — plans describe what should exist, this records what does.
Update it whenever infrastructure changes; never let it drift.

---

## 1. Repositories and hosting

| Thing | Value |
|---|---|
| GitHub repo | `BLAST-Robotics/launchpad` (public), branch `main` |
| Local clone | `C:\coding-project\launchpad` |
| Remote | `origin` → `https://github.com/BLAST-Robotics/launchpad.git` |
| Push access | verified — GitHub account `vrobot-2` can push to the org repo |
| Git identity | `virat2010 <59180983+vrobot-2@users.noreply.github.com>` |
| Vercel project | `launchpad` — `prj_EYUwV7DIrQnmlTki4YjUGjuG1DNM` |
| Vercel scope | `virat2010s-projects` — `team_68n9usmYC2Kr5JzLldEKPFUx` (Hobby, personal) |
| Local link | `.vercel/project.json` (gitignored) |
| Framework setting | none / "Other" — configured later by `vercel.json` |
| Domains attached | **none yet** — no `launchpad.team10989.org` |

## 2. Database

| Thing | Value |
|---|---|
| Provider | Neon, created through the **Vercel Neon integration** (Vercel-managed org) |
| Resource name | `neon-carmine-button` |
| Connected to | project `launchpad`, all environments (production, preview, development) |
| Database | `neondb` (Postgres 18.7, aarch64) |
| Pooled URL | `DATABASE_URL` — `postgresql://neondb_owner:…@…-pooler.…neon.tech/neondb` |
| Direct URL | `DATABASE_URL_UNPOOLED` — required for migrations |
| Connectivity | **verified** 2026-11-17: `select current_database()` → `neondb` |
| `public` schema | migrations 0000 + 0001 applied (second `db:migrate` is a no-op). `user` also has `graduation_year`, `requested_role` (check: student/parent/mentor) and `profile_completed_at` |
| Roster | **29** entries imported into season 2027 (first name, last name, grade only — no phone, email or parent data). Source CSV lives outside the repo; re-run with `bun run db:import-roster <csv>` (idempotent, counts only, never touches claim state). 10 sheet rows skipped (blank name or `Roster?` not TRUE) |
| `neon_auth` schema | 9 tables, created by the Neon Auth integration. **Ignored by LaunchPad.** Do not read, write, or drop it |

Also present from the integration: `POSTGRES_*`, `PG*`, `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`,
`NEON_REALTIME_*`, `VITE_NEON_AUTH_URL`. LaunchPad reads only `DATABASE_URL` / `DATABASE_URL_UNPOOLED`.

**Constraint:** the Neon org is Vercel-managed, so "New project" is disabled in the Neon console.
Create databases only through the Vercel integration. Existing Neon project `neon-bole-bridge`
belongs to **KeySign** — never touch it.

## 3. Environment variables

### `.env.local` (gitignored, 25 vars)
Pulled from Vercel (`vercel env pull`) + appended manually:
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=http://localhost:3000`.

Regenerable: the same four names are stored in Vercel for every environment, so a fresh
`vercel env pull .env.local` restores the file without hand-editing.

### Vercel project env vars

| Name | Production | Preview | Development |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | ✓ | ✓ | ✓ |
| `GOOGLE_CLIENT_SECRET` | ✓ | ✓ | ✓ |
| `BETTER_AUTH_SECRET` | ✓ | ✓ | ✓ |
| `BETTER_AUTH_URL` | `https://launchpad.team10989.org` | *not set* (Better Auth infers from request) | `http://localhost:3000` |

Neon vars are managed by the integration and must not be edited by hand.

## 4. Google

| Thing | Status |
|---|---|
| Google Cloud project | `LaunchPad` (separate from KeySign) ✅ |
| OAuth client | Web application, client ID `635490136381-u96kobh4ie49ljsshn19k89702n84hka` ✅ |
| Authorized JS origins | `http://localhost:3000`, `https://launchpad.team10989.org` |
| Authorized redirect URIs | `http://localhost:3000/api/auth/callback/google`, `https://launchpad.team10989.org/api/auth/callback/google` |
| Scopes | `openid`, `email`, `profile` only — non-sensitive, no verification |
| Audience / publishing | **External**, publishing status **Testing**; only listed test users can sign in |
| Credential validity | **verified** via `oauth2.googleapis.com/token` with a bogus code → `invalid_grant: Malformed auth code` (proves client ID + secret + redirect URI are all correct) |
| Service account + DWD | **not created** — needed in Phase 2, not Phase 0 |
| Workspace domain | `keystonestemai.org`; super admin = team Gmail account |

OAuth redirect path is fixed: `/api/auth/callback/google` (Better Auth default base path `/api/auth`).
Adding a hostname means adding both an origin and a redirect URI in the console.

## 5. Local toolchain

| Tool | Version / path |
|---|---|
| Bun | 1.2.17 — `bun` on PATH |
| Node | 22.14.0 (`C:\Program Files\nodejs`) |
| npm | 10.9.2 — global prefix `C:\Users\vivaa\AppData\Roaming\npm` |
| Vercel CLI | 65.16.0, authenticated as `virat2010` |
| OS / shell | Windows 11, PowerShell 5.1 |
| Editor agent | OpenCode, workspace `C:\coding-project` |

## 6. Verified facts (don't re-litigate without new evidence)

- Neon pooled + unpooled URLs connect and authenticate.
- `public` schema contains zero tables.
- Org repo accepts pushes from `vrobot-2`.
- Google OAuth client credentials and the localhost redirect URI are accepted by Google.
- Vercel CLI works for: `project create`, `link`, `env add/ls/pull`, `integration resource connect`.
- Vercel MCP returns `403 forbidden` for scope `virat2010s-projects` — **use the CLI**.

- Email + password sign-up works locally (D-021): sign-up → `/api/me` (`profileComplete:false`, `roles:["pending"]`) → `GET /api/onboarding/matches` (max 3, no claimant) → `POST /api/onboarding` (student claim → `roles:["student"]`; repeat → 409). Account linking is off, so a password account and a Google account with the same email do not merge (`account_not_linked`).

## 7. Next actions, in order

Done and verified locally 2026-11-17: monorepo scaffold, first migration applied to Neon
(second run is a no-op), season 2027 seeded, `typecheck` / `lint` / `test` / `db:check` green,
`/api/health` → `{ok:true,db:"up"}`, `/api/me` → 401 envelope. Fixed: Better Auth adapter needs
singular model names mapped to our plural table exports (`SCHEMA_MISMATCH`).

1. `bun run dev` → Google sign-in against `http://localhost:5173` (needs a listed OAuth test user); confirm one user/account/session and `/dashboard`.
2. Commit, push, let Vercel build; confirm `/api/health` on the preview.
3. Attach `https://launchpad.team10989.org`; re-verify Google sign-in there.
4. Confirm CI is green on GitHub.
5. Write `docs/PHASE-0-RUNBOOK.md`; tick ROADMAP Phase 0 only after production verification.

## 8. Gotchas that will waste an hour if forgotten

- **PowerShell + Vercel CLI:** the CLI writes normal progress output to **stderr**, so PowerShell
  raises `NativeCommandError` and the shell reports exit code 1 even on success. Read the text,
  not the exit code.
- **PATH in this session:** `vercel` was installed after the shell started. Prefix commands with
  `$env:Path += ";C:\Users\vivaa\AppData\Roaming\npm"` or call `vercel.cmd` by full path.
- **`vercel env pull` overwrites `.env.local`.** All four app vars exist in Vercel, so this is safe now
  — but never keep a value only in `.env.local`.
- **Never migrate through the pooled URL.** PgBouncer + `postgres.js` prepared statements fail
  intermittently. Use `DATABASE_URL_UNPOOLED` and set `prepare: false` on the pooled client.
- **Preview deployments cannot complete Google OAuth** until their hostname is registered as a
  redirect URI. Test auth on `localhost` or on the production domain, not on a `*.vercel.app` URL.
- **Don't enable a Vercel "framework preset".** The project is a static build plus root `api/`
  functions; `vercel.json` supplies `outputDirectory` and the SPA rewrite.
- **`neon_auth` exists.** Any tool that lists tables will show 9 extra ones. They are not ours.

## Waivers, dues and e-sign (added 2026-11-18)

- `roster_entries.dues_status` (paid | unpaid | unknown) comes from the coordination sheet via `bun run db:import-roster <csv>`. Import: 29 updated, dues paid 14 / unpaid 15.
- `waiver_signatures.source` (keysign | self_reported); unique triple (document, user, source). Migrations 0002 and 0003, both idempotent.
- One active `Team waiver 2027` document seeded with `bun run db:seed-waiver`.
- `WAIVERS_ASSUMED_SIGNED=true` (D-022). `KEYSIGN_SIGNING_URL` and `KEYSIGN_WEBHOOK_SECRET` are unset: the `/waivers` page says e-sign is not connected and the webhook answers 401. Contract in `docs/KEYSIGN-INTEGRATION.md`.
- Pages: `/waivers`, `/waivers/done`, `/core-values` (values list is EMPTY: the assignment document was not found in Drive; fill `apps/web/src/content/core-values.ts`).
- Not built: Google Groups membership check (needs the service account + DWD, Phase 2).

## Google Groups membership check (built, not connected)

`GET /api/groups/status` and the dashboard "Team Google Group" row exist and are tested with a fake client. They report `not_connected` until `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_WORKSPACE_ADMIN_EMAIL` are set and `google_objects` has `students` / `parents` group rows. See SETUP.md, "Connecting Google Groups". Not exercised against real Google. No admin-wide mismatch report yet.
