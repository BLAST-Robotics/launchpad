# LaunchPad — Current State

**As of:** 2026-11-18 · **Phase:** 0 (Bootstrap), deployed · **Code:** `feat/portal-foundation` @ `43b9452`, live in production

This file is the handoff. If you are an agent picking this up, read it before touching anything.
It records what **already exists** — plans describe what should exist, this records what does.
Update it whenever infrastructure changes; never let it drift.

---

## 1. Repositories and hosting

| Thing | Value |
|---|---|
| GitHub repo | `BLAST-Robotics/launchpad` (public); product code on `feat/portal-foundation`, `main` is docs-only |
| Local clone | `C:\coding-project\launchpad` |
| Remote | `origin` → `https://github.com/BLAST-Robotics/launchpad.git` |
| Push access | verified — GitHub account `vrobot-2` can push to the org repo |
| Git identity | `virat2010 <59180983+vrobot-2@users.noreply.github.com>` |
| Vercel project | `launchpad` — `prj_EYUwV7DIrQnmlTki4YjUGjuG1DNM` |
| Vercel scope | `virat2010s-projects` — `team_68n9usmYC2Kr5JzLldEKPFUx` (Hobby, personal) |
| Git connection | **connected** 2026-11-18 → pushes build previews automatically; a push to `main` would build production |
| Local link | `.vercel/project.json` (gitignored) |
| Framework setting | none / "Other" — `vercel.json` supplies build + rewrites |
| Function | `api/index.ts` → `api/_bundle/app.js`, built by `bun run build:api` (D-024) |
| Production domain | **live**: `https://launchpad.team10989.org` (public, no Vercel Authentication) |
| Preview protection | Vercel Authentication — `*.vercel.app` URLs need `vercel curl` |

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
| `public` schema | **19 tables**, migrations 0000–0004 applied (verified 2026-11-18; second `db:migrate` is a no-op). `user` also has `graduation_year`, `requested_role`, `profile_completed_at`, `roles[]`, `status`, `roster_entry_id` |
| Roster | **29** entries imported into season 2027, **28 unclaimed**; 1 real user; 0 sessions; 1 waiver document; 0 signatures. Source CSV lives outside the repo; re-run with `bun run db:import-roster <csv>` (idempotent, counts only, never touches claim state) |
| Shared with dev | one Neon database for dev, preview and production — be careful with test writes |
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

Also present: `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_WORKSPACE_ADMIN_EMAIL`, `ADMIN_EMAILS`,
`WAIVERS_ASSUMED_SIGNED`, `KEYSIGN_SIGNING_URL` (stored sensitive, unreadable after saving).
**Missing:** `KEYSIGN_WEBHOOK_SECRET`.

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
| Service account + DWD | key created and stored in `GOOGLE_SERVICE_ACCOUNT_JSON` (`launchpad@lauchpad-515005.iam.gserviceaccount.com`). DWD **not authorized**; Groups readonly admin role not assigned yet, so Groups/Drive calls report `not_connected` |
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
- Migrations 0000–0004 applied; `public` has 19 tables; `db:check` clean.
- Org repo accepts pushes from `vrobot-2`; Vercel auto-builds a preview from a push to `feat/portal-foundation` (verified 2026-11-18, deployment built commit `43b9452`).
- Google OAuth client credentials and the localhost redirect URI are accepted by Google.
- **Production works** (`https://launchpad.team10989.org`, commit `43b9452`): `/api/health` → `{ok:true,db:"up"}`, `/api/me`, `/api/groups/status`, `/api/onboarding/matches`, `/api/admin/overview`, `/api/waivers/signing` and `/api/core-values/mine` → 401 envelope, `/api/auth/ok` → `{ok:true}`, `/api/auth/get-session` → `null`, `/dashboard` and `/login` → SPA HTML 200.
- Vercel CLI works for: `project create`, `link`, `env add/ls/pull`, `integration resource connect`, `git connect`, `deploy --prebuilt`, `promote`, `logs`, `curl`, `alias ls`.
- Vercel MCP returns `403 forbidden` for scope `virat2010s-projects` — **use the CLI**.

- Email + password sign-up works locally (D-021): sign-up → `/api/me` (`profileComplete:false`, `roles:["pending"]`) → `GET /api/onboarding/matches` (max 3, no claimant) → `POST /api/onboarding` (student claim → `roles:["student"]`; repeat → 409). Account linking is off, so a password account and a Google account with the same email do not merge (`account_not_linked`).

## 7. Next actions, in order

Done and verified 2026-11-18: the API is deployed and green in production on
`https://launchpad.team10989.org` (commit `43b9452`). `typecheck` / `lint` / `test` (100 pass,
16 skip) / `db:check` are green. The read-only-FS crash and the nested-path 404s are fixed
(D-024).

1. Sign in once with a Google account in `ADMIN_EMAILS` on the production domain — that is what creates the first admin (D-023).
2. Browser pass of the newer pages: `/waivers`, `/core-values`, `/admin/*`, dashboard status cards, onboarding skip.
3. Human-side credentials: publish the Google OAuth app, set `KEYSIGN_WEBHOOK_SECRET`, register the core-values Drive folder, grant the service account the Groups readonly role.
4. Merge `feat/portal-foundation` → `main` once the browser pass is done, so production builds from `main`.
5. Confirm CI is green on GitHub; write `docs/PHASE-0-RUNBOOK.md`; tick ROADMAP Phase 0 only for what the production checks above actually demonstrate.

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
- **Preview URLs are protected.** Vercel Authentication answers `curl` and `Invoke-WebRequest` with an HTML protection page; use `vercel curl <preview-url><path>` for real HTTP checks. The production domain is not protected.
- **`vercel logs <url>` takes no `--yes`** (it errors on unknown options) and prints JSON lines; filter by request id.
- **`error: bun is unable to write files: ReadOnlyFileSystem` does not mean a write.** On the Vercel Bun runtime it surfaced for a failed dynamic module import; fix the import, not the filesystem (D-024).

## Waivers, dues and e-sign (added 2026-11-18)

- `roster_entries.dues_status` (paid | unpaid | unknown) comes from the coordination sheet via `bun run db:import-roster <csv>`. Import: 29 updated, dues paid 14 / unpaid 15.
- `waiver_signatures.source` (keysign | self_reported); unique triple (document, user, source). Migrations 0002 and 0003, both idempotent.
- One active `Team waiver 2027` document seeded with `bun run db:seed-waiver`.
- `WAIVERS_ASSUMED_SIGNED=true` (D-022). `KEYSIGN_SIGNING_URL` is set (`https://esign.team10989.org/s/teamhandout2627`, doc `29da6d87-…`); `KEYSIGN_WEBHOOK_SECRET` is still unset, so the `/waivers` page falls back to the signing link and `/api/webhooks/keysign` answers 401. Contract in `docs/KEYSIGN-INTEGRATION.md`.
- Pages: `/waivers`, `/waivers/done`, `/core-values` (six FIRST values; see the later section).
- Google Groups membership check: built, not connected (see the section below).

## Google Groups membership check (built, not connected)

`GET /api/groups/status` and the dashboard "Team Google Group" row exist and are tested with a fake client. They report `not_connected` until `GOOGLE_SERVICE_ACCOUNT_JSON` and `GOOGLE_WORKSPACE_ADMIN_EMAIL` are set and `google_objects` has `students` / `parents` group rows. See SETUP.md, "Connecting Google Groups". Not exercised against real Google. No admin-wide mismatch report yet.

## Core values videos, Groups and KeySign (latest)

- **Core values videos:** `/core-values` (student upload, straight to the Team Shared Drive) and `/admin/core-values` (review). Table `core_value_submissions` (migration 0004). Needs the service-account key and a registered folder: see docs/SETUP.md, "Core values videos". Until then the page shows the backup Google Form.
- **Groups check:** works with or without domain-wide delegation; with `GOOGLE_WORKSPACE_ADMIN_EMAIL` unset it acts as the service account itself (docs/SETUP.md, option A).
- **`google_objects`:** the two group rows (`group` / `students`, `group` / `parents`) are registered. Use `bun run db:set-google-object -- <kind> <key> <externalId> [email] [label]` for the rest.
- **KeySign:** the document ID is stored on the seeded waiver row; `KEYSIGN_SIGNING_URL` (the public signing link) is still needed.

