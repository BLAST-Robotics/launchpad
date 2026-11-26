# temp.md — raw state dump (no further work done after this)

Written 2026-11-18. Plain dump of where everything stands. No secrets are recorded here
(a service-account key and a KeySign password were pasted in chat; neither is written to disk by this file).

## Git
- Branch `feat/portal-foundation`, pushed to origin (BLAST-Robotics/launchpad). `main` is still at e8b1c9a.
- Commits on the branch: `38baef6` (portal foundation), `ef4f2bd` (core values videos, KeySign/waivers, admin by email, Groups check).
- STAGED, NOT COMMITTED: the Vercel bundle fix — `package.json` (new `build:api` script; `build` now runs it first), `.gitignore` (`api/_bundle/`), `biome.json` (ignore `api/_bundle`), `api/[...path].ts` (imports `./_bundle/app.js`).
- Untracked on purpose: `.claude/skills/` and `.claude/agents/` (Impeccable install, 61 third-party files). Undecided whether they belong in the repo.
- `temp.md` itself is untracked.
- Pull request link GitHub offered: https://github.com/BLAST-Robotics/launchpad/pull/new/feat/portal-foundation

## Vercel / production
- Project `launchpad` (prj_EYUwV7DIrQnmlTki4YjUGjuG1DNM), scope virat2010s-projects. NOT connected to GitHub (pushes do not deploy). Deployment protection = Vercel Authentication (not public).
- Deployment 1 (dpl_AAhb3chVhdDcLwKmVojjz5sYjGw2) was auto-assigned to PRODUCTION because it was the project's first: https://launchpad-black-ten.vercel.app . SPA loads; API function crashed (`FUNCTION_INVOCATION_FAILED`, Bun `ResolveMessage`: workspace imports `@launchpad/*` not resolvable in the function).
- Fix attempted: bundle the API into one file at build time (`bun build apps/api/src/app.ts --target=bun --outfile=api/_bundle/app.js`), entry imports the bundle. Local test of the bundle: /api/health 200, /api/me 401, /api/groups/status 401.
- Deployment 2 (preview): https://launchpad-7r7g394bh-virat2010s-projects.vercel.app
  - /api/health -> 200 `{"ok":true,"db":"up"}`; /dashboard (SPA fallback) -> 200.
  - /api/me -> 500 (expected 401). /api/groups/status, /api/onboarding/matches, /api/waivers/signing, /api/admin/overview -> 404 (these exist locally and return 401).
  - Runtime logs show repeated: `Bun process exited with exit status: 1` and `error: bun is unable to write files: ReadOnlyFileSystem`; plus Better Auth warning "Base URL is not set" (preview has no BETTER_AUTH_URL; by design it infers from the request).
  - NOT diagnosed: whether the 404s come from Vercel routing or from Elysia (response bodies were not captured); whether the ReadOnlyFileSystem write is the cause of the crash/500. Production domain `launchpad.team10989.org` is NOT attached (team10989.org is in the Vercel account, DNS is third-party; needs a CNAME there).
- Vercel env var NAMES present: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL (production = https://launchpad.team10989.org), Neon integration vars (DATABASE_URL, DATABASE_URL_UNPOOLED, POSTGRES_*, PG*, NEON_*), GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_WORKSPACE_ADMIN_EMAIL, WAIVERS_ASSUMED_SIGNED, KEYSIGN_SIGNING_URL, ADMIN_EMAILS. Production/preview copies of the new ones are stored as sensitive (unreadable after saving). MISSING: KEYSIGN_WEBHOOK_SECRET.
- Google OAuth app audience is still "Testing" (only listed test users can sign in) — must be published before real users can sign in.
- Dev and prod share ONE Neon database. All migrations 0000–0004 are applied. DB now: roster 29 entries, 1 claimed (belongs to the real user), 1 real user, 0 sessions, 1 waiver document seeded, google_objects has the two group rows (students, parents).

## Built (in the two commits)
- Monorepo: apps/api (Elysia + Better Auth), apps/web (React 19, Vite, Tailwind 4), packages/db (Drizzle + Neon), packages/shared (Zod + pure logic). 100 tests pass, typecheck and lint clean.
- Auth: Google + email/password sign-up (no verification, no email ever sent; D-021). Account linking OFF. Admin role only via Google sign-in for addresses in env ADMIN_EMAILS (D-023); password sign-up blocked for those addresses; roles are merged not replaced.
- Onboarding: role (student/parent/mentor), name, grad year, fuzzy roster match ("Are you…?"/"Is this your kid?"); admins can skip.
- Roster import (first name, last name, grade, dues status only) from the team sheet; dues: 14 paid / 15 unpaid.
- Admin area /admin: overview, members, roster, activity, core values review. db:make-admin, db:set-google-object, db:seed-waiver, db:import-roster scripts.
- Waivers: derived status; WAIVERS_ASSUMED_SIGNED=true (everyone shows "Signed (assumed for now)", D-022); /waivers iframe page; POST /api/webhooks/keysign (HMAC); manual "I already filled out the form"; KEYSIGN_SIGNING_URL = https://esign.team10989.org/s/teamhandout2627 (resolves to KeySign doc 29da6d87-0dd0-4668-ac4e-b24f0c405cfe, stored on the seeded waiver row as data).
- Core values: six FIRST values page, ≥1 min video check, direct-to-Drive resumable upload, only Drive file ID stored, admin review. Needs a Shared Drive folder registered (see below); otherwise shows the backup Google Form https://forms.gle/K4HXuNn25voa6sid6 .
- Groups check: /api/groups/status; group addresses in google_objects; shows "not connected" until Google side is set up.
- Branding: Blast fire gradient, Unbounded + Outfit fonts (self-hosted), isometric LaunchPad mark, brand assets in apps/web/public/brand/, logo-mark.svg, logo-poc.svg, logo-loading.svg (animated), stack.html (tower game). apps/web/PRODUCT.md, DESIGN.md, .impeccable/design.json.
- Login page reworked from a design critique (24/40 before; detector 0 findings after). Critique snapshot in .impeccable/critique/.

## NOT built / open
- KeySign sign-in for admins + season-waiver dropdown + signature counts (fully specified earlier; KeySign source is read-only at C:/coding-project/esignapp: login POST /api/auth/login -> token, GET /api/documents, GET /api/documents/[id]/signatures).
- "Update all mds" was requested; NOT done. Docs that exist: AGENTS.md, docs/{STATE,ROADMAP,DECISIONS,SETUP,ARCHITECTURE,PHASE-0-PLAN,KEYSIGN-INTEGRATION}.md, apps/web/{PRODUCT,DESIGN}.md. ROADMAP checkboxes must only be ticked when demonstrated in production (not yet).
- Production API broken/unverified (see Vercel section). Admin-by-email, onboarding, waivers, groups, core values routes are unverified on Vercel.
- Browser pass of the newer pages (waivers, core values, dashboard status cards, admin pages, welcome skip) never done; real Google sign-in, real Drive upload, real KeySign webhook never exercised.

## To do by a human
1. Publish the Google OAuth app (or add test users). 2. Attach launchpad.team10989.org + CNAME at the DNS host. 3. Set KEYSIGN_WEBHOOK_SECRET (same value on KeySign's side). 4. Create a Shared Drive folder for core values videos, add launchpad@lauchpad-515005.iam.gserviceaccount.com as Content manager, then `bun run db:set-google-object -- folder core-values <folderId> "" "Core values videos"`. 5. Workspace super admin: assign the service account a read-only Groups admin role (or authorize domain-wide delegation: Client ID 112866933254254589481, scope https://www.googleapis.com/auth/admin.directory.group.member.readonly). 6. Turn WAIVERS_ASSUMED_SIGNED off once the webhook works. 7. Rotate the service-account key (it appeared in chat) and change the KeySign admin password (it appeared in chat); delete the key JSON from Downloads. 8. Decide whether .claude/skills + .claude/agents are committed. 9. First admin: sign in with Google using an address in ADMIN_EMAILS (no admin exists until then); `bun run db:make-admin -- <email>` also works.

## Local environment
- Dev servers possibly still running: API :3000, web :5173, static previews :8766 / :8767 (python http.server on apps/web/public). Closing the session stops them.
- `.env.local` (gitignored) holds app vars + GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_WORKSPACE_ADMIN_EMAIL, KEYSIGN_SIGNING_URL, ADMIN_EMAILS.
- Scratchpad (not in repo): C:\Users\vivaa\AppData\Local\Temp\claude\2539db4026713b0b\c997a242-ac5e-4742-a03a-eeea753143e1\scratchpad — contains roster.csv (real student data, do not commit), branding PNG downloads, generator scripts, preview-url.txt.
- Vercel CLI: C:/Users/vivaa/AppData/Roaming/npm/vercel.cmd (authenticated as virat2010). Gotcha: first deploy of a project becomes production.

## Misc facts
- Help contact in the product: admin@team10989.org (human mailbox; the app sends no email).
- Group addresses: team10989-students@team10989.org, team10989-parents@team10989.org (stored in google_objects, not in source).
- Plan usage when last checked was ~91% on the 5-hour limit (resets on the hour boundary shown by get_usage); weekly ~16%.
- Decisions added this session: D-021 (email+password sign-up, no verification), D-022 (assumed-signed waivers), D-023 (admins by env email, Google-only).
