# LaunchPad — Current State

**As of:** 2026-11-17 · **Phase:** 0 (Bootstrap) · **Code written:** none

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
| `public` schema | **empty** — zero application tables |
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

## 7. Next actions, in order

1. Scaffold the monorepo exactly as listed in [PHASE-0-PLAN.md](./PHASE-0-PLAN.md) §2–6.
2. Generate and apply the first Drizzle migration to Neon with `DATABASE_URL_UNPOOLED`.
3. Seed the current season row.
4. `bun dev:api` → `/api/health` returns `{ ok: true, db: "up" }`; `/api/me` returns 401.
5. `bun dev:web` → Google sign-in against `http://localhost:3000` succeeds.
6. Commit, push, let Vercel build, then attach `https://launchpad.team10989.org`.
7. Re-verify Google sign-in on the production hostname, tick the Phase 0 exit criterion.
8. Add the CI workflow and the migration drift check.
9. Write `docs/PHASE-0-RUNBOOK.md` and tick ROADMAP Phase 0.

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
