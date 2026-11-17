# Phase 0 — Build Plan (file inventory)

Companion to [ROADMAP.md](./ROADMAP.md) Phase 0 and [ARCHITECTURE.md](./ARCHITECTURE.md) §4–5.
Scope: **a deployed URL that signs a person in with Google and shows their name, email and roles.**

Estimates are for one person driving an agent, including writing, typechecking, and the first
round of fixing. Sizes are source lines, excluding generated migration SQL beyond the first
revision.

---

## 1. Total at a glance

| Area | Files | ≈ lines | ≈ time |
|---|---|---|---|
| Root config + Vercel entry + CI | 8 | 250 | 2 h 05 |
| `packages/shared` | 6 | 240 | 1 h 15 |
| `packages/db` | 12 | 800 | 2 h 30 |
| `apps/api` | 9 | 420 | 2 h 00 |
| `apps/web` | 14 | 560 | 2 h 30 |
| Docs / runbook | 1 | 200 | 0 h 30 |
| Neon + Vercel + domain wiring, deploy, verify | — | — | 1 h 30 |
| **Total** | **50** | **≈ 2 470** | **≈ 12 h** |

Nothing here is speculative: every file below is either required by Vercel/Better Auth,
or is a table already specified in ARCHITECTURE.md §5.

---

## 2. Root

| File | Purpose | ≈ lines | ≈ time |
|---|---|---|---|
| `package.json` | Bun workspaces (`apps/*`, `packages/*`), scripts: `dev`, `dev:api`, `dev:web`, `build`, `typecheck`, `lint`, `test`, `db:generate`, `db:migrate`, `db:studio`, `db:check`. No runtime deps at the root. | 40 | 10 m |
| `tsconfig.base.json` | Shared compiler options: `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `target: ES2022`, `verbatimModuleSyntax`. Each package extends it. | 25 | 5 m |
| `vercel.json` | `bunVersion: "1.x"`, `installCommand: bun install`, `buildCommand: bun run build`, `outputDirectory: apps/web/dist`, SPA fallback rewrite. No cron yet (Phase 2). | 25 | 15 m |
| `.env.example` | Names only, no values: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SENTRY_DSN` (optional). Documents which are required in production. | 30 | 10 m |
| `.gitignore` | Extend the existing two lines: `node_modules/`, `dist/`, `*.tsbuildinfo`, `coverage/`. Keep `.env*` and `.vercel`. Drizzle `meta/` stays committed. | 15 | 5 m |
| `api/[...path].ts` | Vercel catch-all entry. Imports the Elysia app and exports its fetch handler as a Web-standard default export, so `/api/*` on Vercel is the same app `bun dev` runs. ~15 lines of code, but the highest-risk file: Vercel's Bun runtime + Web handler signature has to be confirmed on the first deploy. | 20 | 20 m |
| `scripts/check-migrations.ts` | CI guard: runs `drizzle-kit check` and fails if `migrations/` is out of sync with the schema, so a schema edit can never ship without its SQL. | 45 | 25 m |
| `.github/workflows/ci.yml` | On push/PR: `bun install --frozen-lockfile`, `typecheck`, `lint`, `test`, `db:check`. No deploy job — Vercel's Git integration handles that. | 60 | 35 m |

**Notes**
- `package.json` workspaces must be declared before any package, or Bun resolves `@launchpad/db` from the registry and fails.
- The Vercel entry deliberately lives at the root, not inside `apps/api`, because Vercel only auto-detects the `api/` directory at the project root.

---

## 3. `packages/shared` — constants and contracts

No database access, no framework imports. Safe to import from both the API and the browser.

| File | Purpose | ≈ lines | ≈ time |
|---|---|---|---|
| `package.json` | Name `@launchpad/shared`, `"type": "module"`, `exports` map to `./src/index.ts` (consumed as source by Bun and Vite; no build step). Deps: `zod`. | 15 | 5 m |
| `tsconfig.json` | Extends base, `include: src`. | 10 | 3 m |
| `src/roles.ts` | `Role` = `pending \| student \| parent \| mentor \| admin`; `MemberStatus` = `active \| alumni \| archived`; `ROLE_PERMISSIONS` map; `effectiveRoles(user)` implementing the alumni downgrade from ARCHITECTURE §6; `desiredGroups()` as a pure function so Phase 2 starts from a tested core. | 90 | 25 m |
| `src/contracts.ts` | Zod schemas + inferred types for `HealthResponse`, `MeResponse` (id, name, email, roles, status, rosterEntryId), `SeasonSummary`. These are the shapes the web app reads, so the API cannot drift silently. | 70 | 20 m |
| `src/attendance.ts` | `AttendanceProvider` interface (`list`, `ingest`, `capabilities`) plus `ManualEntry` / `CsvImport` types. Only the interface in Phase 0 — implementations are Phase 3, so the seam exists before LancerLogin does. | 45 | 15 m |
| `src/index.ts` | Barrel re-export of the three modules. | 10 | 3 m |

---

## 4. `packages/db` — Drizzle schema, client, migrations

| File | Purpose | ≈ lines | ≈ time |
|---|---|---|---|
| `package.json` | `@launchpad/db`; deps `drizzle-orm`, `postgres`; devDeps `drizzle-kit`. Exports `./src/index.ts` and `./schema`. | 20 | 5 m |
| `tsconfig.json` | Extends base, `include: src, drizzle.config.ts`. | 10 | 3 m |
| `drizzle.config.ts` | Reads `DATABASE_URL_UNPOOLED` (Neon direct connection — migrations must not go through PgBouncer), `dialect: postgresql`, `schema: ./src/schema/index.ts`, `out: ./migrations`, `strict: true`, `verbose: true`. | 25 | 10 m |
| `src/client.ts` | Single `postgres()` client + `drizzle()` instance. `max: 1` on Vercel, `prepare: false` for PgBouncer compatibility, `ssl: require`, `globalThis` cache so hot reload does not leak pools. Also exports `closeDb()`. | 35 | 15 m |
| `src/schema/columns.ts` | `timestamps` helper (`created_at`, `updated_at` with `$onUpdate`), `uuidPk()` helper. Every table uses them — this is the one place the ARCHITECTURE rule "all tables carry created_at / updated_at" is enforced. | 20 | 5 m |
| `src/schema/auth.ts` | Better Auth's required tables: `user`, `session`, `account`, `verification`, plus `user.roles` (array), `user.status`, `user.roster_entry_id`, `user.google_sub`, `user.last_login_at`. Table names and column names must match Better Auth's defaults exactly or the adapter silently returns nothing. | 85 | 30 m |
| `src/schema/roster.ts` | `seasons`, `roster_entries` (with `claimed_by_user_id UNIQUE`), `guardian_links`, `subteams`, `subteam_members`, all FKs and the indexes the claim screen needs (`roster_entries (season_id, last_name)`, unique `(season_id, email_hint)` where present). | 115 | 35 m |
| `src/schema/waivers.ts` | `waiver_documents`, `waiver_signatures`. Append-only by convention: no `updated_at` on signatures. Unique `(waiver_document_id, user_id)` so a duplicate webhook is a no-op. | 60 | 20 m |
| `src/schema/attendance.ts` | `attendance_records` with `source`, `direction`, `happened_at`, `minutes`, `raw jsonb`, `recorded_by`, index `(roster_entry_id, happened_at)`. | 45 | 15 m |
| `src/schema/comms.ts` | `events`, `announcements`, `deliveries` (unique `(announcement_id, channel)`, status enum, `error`). | 70 | 20 m |
| `src/schema/google.ts` | `google_objects` (unique `(kind, key)`), `provisioning_state` (unique `user_id`), `audit_log` (append-only, `before`/`after` jsonb). | 65 | 20 m |
| `src/schema/index.ts` | Barrel for all schema modules plus Drizzle `relations()` for user↔roster↔guardian and season↔subteam. Relations are needed before Phase 1 relational queries. | 40 | 15 m |
| `migrations/0000_*.sql` + `meta/` | Generated by `drizzle-kit generate`, committed. First revision only for Phase 0; reviewed by hand for constraint names and cascade behaviour. | 280 | 20 m |

**Deliberately absent**
- No `internal_waiver` column (derived query, Phase 2).
- No `attendance_provider` config table (env/config, Phase 3).
- No `neon_auth.*` interaction. The Neon Auth integration created that schema; LaunchPad ignores it. It is not dropped now because dropping another integration's schema is not reversible in one step.

---

## 5. `apps/api` — Elysia + Better Auth

| File | Purpose | ≈ lines | ≈ time |
|---|---|---|---|
| `package.json` | `@launchpad/api`; deps `elysia`, `better-auth`, `@launchpad/db`, `@launchpad/shared`, `drizzle-orm`; dev script `bun --watch src/index.ts`. Exports `./src/app.ts` for the Vercel entry. | 25 | 5 m |
| `tsconfig.json` | Extends base, needs `types: ["bun-types"]`. | 15 | 5 m |
| `src/env.ts` | Zod-validated `process.env` parsed once at module load: `DATABASE_URL`, `BETTER_AUTH_SECRET` (min 32), `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NODE_ENV`. Throws with the missing variable names, never their values. In dev, merged from `.env.local`. | 45 | 15 m |
| `src/auth.ts` | `betterAuth({...})`: Drizzle adapter (`provider: "pg"`, our schema), Google provider with `scope: ["openid","email","profile"]`, `account.accountLinking` for the same verified email, `user.additionalFields` for roles/status/rosterEntryId, cookie settings (same-site lax, secure in prod, 30-day session, 5-minute cookie cache). Exports `auth` and `Auth` type. | 70 | 35 m |
| `src/app.ts` | Builds the Elysia app: request-id plugin, structured logger (method, path, status, duration, request id — **no** emails or tokens), `/api/auth/*` mounted to `auth.handler`, `/api/me`, `/api/health`, error boundary that returns a JSON envelope and logs the stack only server-side. Exports `createApp()` so tests can build an isolated instance. | 100 | 40 m |
| `src/routes/health.ts` | `GET /api/health`: `select 1` against Postgres with a 2 s timeout, returns `{ ok, db, version, commit }`. 503 when the DB is unreachable — so the first deploy's health check is meaningful. | 40 | 15 m |
| `src/routes/me.ts` | `GET /api/me`: resolves the session, joins `user` → `roster_entries` → current `season`, returns the `MeResponse` contract. 401 when unauthenticated (not a redirect — the SPA owns navigation). | 55 | 20 m |
| `src/index.ts` | Dev/prod server for `bun dev`: `Bun.serve({ fetch: app.fetch, port: 3000 })`, logs the bound URL, installs `SIGINT`/`SIGTERM` → `closeDb()`. Imports `./env` first so a bad environment fails at boot, not at first request. | 30 | 10 m |
| `src/observability.ts` | `initSentry()` gated on `SENTRY_DSN`, `beforeSend` that strips cookies/headers, plus `logEvent()` helper. One module so Sentry can be swapped for OTel without touching routes. | 55 | 20 m |
| `test/health.test.ts` | Builds the app with `createApp()`, asserts `/api/health` shape, asserts `/api/me` returns 401 without a cookie, asserts no stack trace leaks in the error envelope. `bun test`. | 60 | 20 m |

**Auth flow (what Phase 0 actually proves)**
1. Browser hits `/api/auth/sign-in/social` with `provider: "google"`.
2. Google returns to `/api/auth/callback/google` (registered redirect URI on the same origin).
3. Better Auth creates `user` + `account` + `session`; `roles` defaults to `["pending"]`.
4. SPA calls `/api/me`; dashboard renders name, email, roles, season.

No roster matching, no claim flow, no groups — those are Phase 1 and 2.

---

## 6. `apps/web` — React SPA

| File | Purpose | ≈ lines | ≈ time |
|---|---|---|---|
| `package.json` | `@launchpad/web`; deps `react@19`, `react-dom@19`, `@tanstack/react-router`, `@tanstack/react-query`, `better-auth` (client), `@launchpad/shared`; devDeps `vite`, `@vitejs/plugin-react`, `tailwindcss@4`, `@tailwindcss/vite`, `typescript`. | 30 | 10 m |
| `tsconfig.json` | DOM lib, `jsx: react-jsx`, paths for `@/*`. | 20 | 5 m |
| `vite.config.ts` | React + Tailwind v4 plugins, `server.proxy` `/api` → `http://localhost:3000` so dev is same-origin, `build.outDir: "dist"`, sourcemaps. | 35 | 15 m |
| `index.html` | Title, `lang="en"`, theme-color, one `<div id="root">`, module entry. No inline script, no third-party font. | 25 | 5 m |
| `src/main.tsx` | Creates the router + `QueryClientProvider`, mounts React 19 root, imports `styles.css`. | 30 | 10 m |
| `src/router.tsx` | Code-based TanStack Router (file-based routing's Vite plugin is extra build surface for four routes): `/` login, `/dashboard`, `/auth/error`, 404. Route context carries the session. | 50 | 20 m |
| `src/routes/root.tsx` | Layout and auth gate: calls `/api/me` once via React Query, shows a skeleton while loading, redirects to `/` when 401, renders `<Outlet/>`. | 65 | 25 m |
| `src/routes/index.tsx` | Login screen: product name, one-line explanation, "Continue with Google" button, signed-in state that redirects to `/dashboard`, error surface for `?error=`. | 80 | 30 m |
| `src/routes/dashboard.tsx` | Phase 0 proof screen: name, email, roles as pills, member status, current season, sign-out, a "what's next" empty state naming roster claiming. This is the acceptance criterion rendered. | 80 | 30 m |
| `src/routes/auth-error.tsx` | Maps Better Auth error codes (`access_denied`, `state_mismatch`, `account_not_linked`) to plain sentences with a retry link. | 45 | 15 m |
| `src/lib/api.ts` | Thin typed `fetch` wrapper with `credentials: "same-origin"`, JSON envelope parsing, `ApiError` class. Eden Treaty is deferred: it would couple the web build to the API's Elysia types before the route surface is stable. | 55 | 20 m |
| `src/lib/auth.ts` | Better Auth browser client (`createAuthClient`) + `useSession()` / `signInWithGoogle()` / `signOut()` hooks. | 40 | 15 m |
| `src/components/ui.tsx` | Button, Card, Pill, Spinner — the four primitives Phase 0 needs. shadcn/ui proper arrives with the Phase 1 tables, so we do not hand-copy 15 component files twice. | 90 | 25 m |
| `src/styles.css` | Tailwind v4 `@import "tailwindcss"`, `@theme` block for team colors, dark-mode variables, focus-visible ring defaults. | 60 | 20 m |
| `public/favicon.svg` | Placeholder mark; no binary assets in the repo. | 10 | 5 m |

---

## 7. Docs

| File | Purpose | ≈ lines | ≈ time |
|---|---|---|---|
| `docs/PHASE-0-RUNBOOK.md` | Ordered execution log: commands run, env vars set in Vercel, the Google OAuth client's authorized origins/redirect URIs, migration procedure, rollback, and the exact verification checklist. This is what makes Phase 1 startable by someone else — and it is where the Phase 0 exit criteria get ticked off. | 200 | 30 m |

---

## 8. Build order

Each step ends in something runnable, so a failure is localized.

| # | Step | Output | ≈ time |
|---|---|---|---|
| 1 | Root workspace, tsconfig, `.gitignore`, `.env.example` | `bun install` succeeds, no packages yet | 30 m |
| 2 | `packages/shared` | `bun run typecheck` green | 1 h 15 |
| 3 | `packages/db` schema + first migration | `drizzle-kit generate` produces SQL; applied to Neon; `select * from seasons` empty but present | 2 h 30 |
| 4 | `apps/api` env, auth, health, me | `bun dev:api`, `/api/health` → `{ok:true}`, `/api/me` → 401 | 2 h 00 |
| 5 | `apps/web` shell, login, dashboard | `bun dev:web`, Google sign-in works against localhost | 2 h 30 |
| 6 | `vercel.json` + `api/[...path].ts` + first preview deploy | preview URL serves the SPA and `/api/health` | 45 m |
| 7 | Google OAuth client: add preview + production redirect URIs | sign-in works on the deployed URL | 20 m |
| 8 | Attach `launchpad.team10989.org`, 308 from `launchpad.keystonestemai.org` | production URL is the canonical hostname | 25 m |
| 9 | CI workflow + migration check | red/green on GitHub, first green run | 35 m |
| 10 | Runbook + Phase 0 checkbox update | docs committed | 30 m |

---

## 9. Verification (definition of done)

- [ ] `GET /api/health` on production returns `200` with `db: "up"` and the deployed commit SHA.
- [ ] `GET /api/me` without a cookie returns `401` with a JSON envelope and no stack trace.
- [ ] Google sign-in on the production hostname creates exactly one `user`, one `account`, one `session`.
- [ ] `/dashboard` shows the signed-in name, email, `roles: ["pending"]`, and the seeded season.
- [ ] Signing out clears the cookie; a second sign-in reuses the same `user` row (no duplicate by email).
- [ ] `bun run typecheck`, `bun run lint`, `bun test`, `bun run db:check` all pass locally and in CI.
- [ ] Re-running `bun run db:migrate` against the already-migrated DB is a no-op.
- [ ] No secret value appears in the client bundle: `grep` the built assets for `postgresql://`, the auth secret, and the Google client secret.

**Explicitly not verified in Phase 0:** roster claiming, Google Groups/Drive, waivers, KeySign, Slack, Discord, attendance. Those are Phases 1–4; Phase 0 only has to not paint them into a corner.

---

## 10. Risks and open decisions

| Risk | Impact | Mitigation |
|---|---|---|
| Vercel Bun runtime + Elysia fetch handler mismatch | Blocks deploy (step 6) | Fall back to `@elysiajs/node` with a Node-style handler; costs ~1 h, changes only `api/[...path].ts` |
| Better Auth + Google requires an exact redirect URI per environment | Sign-in fails on preview but works locally, or vice versa | Register `http://localhost:3000`, the stable preview alias, and the production hostname in one OAuth client; never use the rotating preview URL |
| PgBouncer vs `postgres.js` prepared statements | Intermittent `prepared statement already exists` | `prepare: false` from commit one, migrations on `DATABASE_URL_UNPOOLED` |
| Neon Auth integration owns `neon_auth` and may add middleware assumptions | Confusion, not breakage | Ignore the schema; no code reads it. Revisit if Neon Auth is adopted or removed |
| Google OAuth consent screen is in "Testing" | Only listed test users can sign in | Add all Phase 0 testers; publish the app before Phase 1 |
| No email at all means no password reset, no invite | A locked-out user needs an admin action | Accepted in DECISIONS; Phase 1 adds admin "reset session" / edit-claim |
| `BETTER_AUTH_SECRET` rotation | All sessions invalidated | Treated as acceptable; document the rotation in the runbook |

**Decisions this plan makes that are not yet in DECISIONS.md** (worth logging when the phase lands):

- Code-based TanStack Router, not file-based — four routes do not justify a codegen plugin.
- Eden Treaty deferred until the route surface stabilises; typed `fetch` + shared Zod contracts now.
- shadcn/ui deferred to Phase 1; four hand-written primitives now.
- Sentry is wired but optional (`SENTRY_DSN` absent = no-op), so the deploy does not depend on a third account.
- Migrations run manually from the runbook in Phase 0; automated single-runner migration lands with CI in Phase 1.
