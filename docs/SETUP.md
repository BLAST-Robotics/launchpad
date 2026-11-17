# LaunchPad — Setup

What exists, what to create, and what only you can do.
Status legend: ✅ exists · ⬜ to create · 🔒 only you can do

---

## 1. Known environment

| Thing | Value / status |
|---|---|
| Team | Blast Robotics, FRC Team 10989 |
| Nonprofit | Keystone STEM Alliance |
| Team site | Vercel project `10989-blast` (Astro) → `team10989.org` ✅ |
| Workspace domain | `keystonestemai.org` ✅ |
| Google Groups | "BLAST Robotics Students", "BLAST Robotics Parents" ✅ (need exact emails) |
| KeySign | `esignapp` (Next.js), production on Vercel + Neon, **no Google auth in prod** ✅ |
| Attendance | LancerLogin — adopted/experimental, **not built yet** ⬜ |
| Slack | one workspace ✅ (need name + channel IDs) |
| Discord | team server ✅ (need webhook URLs) |
| Chrome instance | personal Gmail · team Gmail · Vercel (personal) · Slack · Google Groups · KeySign · LancerLogin |
| Workspace super admin | **team Gmail** — owns DWD and the Admin SDK impersonation target |
| Vercel account | **personal Gmail** — fine for now; move to a team-owned account before graduation |
| Primary host | `launchpad.team10989.org` (308 redirect from `launchpad.keystonestemai.org`) |
| Drive / Drive API | runs as the **team account**, never the personal one |

Everything below is created inside accounts you already have.

---

## 2. Accounts and credentials

Status as of **2026-11-17**; exact values and verification evidence in [STATE.md](./STATE.md).

| # | Account | Status | Note |
|---|---|---|---|
| 1 | Neon | ✅ done | Created through the Vercel Neon integration and connected to `launchpad`; `DATABASE_URL` + `DATABASE_URL_UNPOOLED` in `.env.local` and Vercel |
| 2 | Vercel | ✅ done | Project `launchpad` created and linked; CLI authenticated as `virat2010` |
| 3 | Google Cloud | 🟡 partial | Project `LaunchPad` and the Web OAuth client exist. **Service account + DWD are Phase 2** |
| 4 | Slack | ⬜ to create | Phase 4 |
| — | GitHub | ✅ done | `BLAST-Robotics/launchpad`; push access verified |

**No `VERCEL_TOKEN` is needed.** The CLI is logged in on this machine and `vercel link` is done,
so `vercel` commands work directly.

**Secrets I generate myself:** `BETTER_AUTH_SECRET` (done), `KEYSIGN_TOKEN_SECRET`,
`KEYSIGN_WEBHOOK_SECRET`, `INTERNAL_SERVICE_SECRET`, `LANCER_SERVICE_SECRET`, calendar feed token.

**Secrets still to provide:** the Slack bot token + signing secret (Phase 4), and the Google
service account JSON (Phase 2). Everything for Phase 0 is already in place.

Never put a secret in the repo or in a chat message — `launchpad/.env.local` (gitignored) or the
Vercel environment variables.

---

## 3. Google Cloud project

The OAuth client (Phase 0) is already made. The service account and DWD are Phase 2 and are the
only console work left.

1. ✅ Create project `LaunchPad` (done 2026-11-17).
2. ⬜ **Phase 2** — enable **Admin SDK API**, **Google Drive API**, **Google Calendar API**.
3. ⬜ **Phase 2** — create service account `launchpad-bot@<project>.iam.gserviceaccount.com`,
   download a JSON key, enable **Domain-wide delegation**.
4. ✅ Create the **OAuth client** (Web application) — done:
   - Authorized JS origins: `http://localhost:3000`, `https://launchpad.team10989.org`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`,
     `https://launchpad.team10989.org/api/auth/callback/google`
   - Audience: **External**, scopes `openid email profile` only → no verification needed.
   - Publishing status is **Testing**: add every person who needs to sign in as a test user, or
     publish the app.
5. ⬜ **Phase 2** — Workspace Admin console → Security → API controls → Domain-wide delegation →
   add the service account **client ID** with these scopes:

```
https://www.googleapis.com/auth/admin.directory.group
https://www.googleapis.com/auth/admin.directory.group.member
https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/drive
https://www.googleapis.com/auth/calendar
```

6. Impersonate the **team Gmail account** for Admin SDK, Drive and Calendar calls, so everything the bot creates is owned by the team rather than by a personal account. A dedicated `launchpad-bot@keystonestemai.org` user is a cleaner long-term target, but the team account works today and is one less account to create; switching later is a one-line change in `google_objects` config.

---

## 4. Google objects inventory (the one thing I really need from you)

Fill this in only if API discovery is blocked. **Status:** this block is a fallback. Once the Phase 2
service account + DWD exist, the verify script enumerates groups (`admin.directory.groups.list`,
`members.list`) and Shared Drives (`drives.list`, `files.list` with `supportsAllDrives`) and seeds
`google_objects` itself — no hand-typed IDs.

Final hostname is **decided**: `launchpad.team10989.org` (308 redirect from
`launchpad.keystonestemai.org`).

```
Students group email:        ____________________________
Parents group email:         ____________________________
Mentors group email:         ____________________________  (or "uses students group")
Admins group email:          ____________________________  (or "none")

Subteams (name → group email, may be blank if not created):
  ____________________________ → ____________________________
  ____________________________ → ____________________________

Shared Drive ID (from the URL /drive/u/0/folders/<ID> or shared drives page):
  ____________________________

Folders inside that drive:
  Team docs / root:          ____________________________
  Signed waivers:            ____________________________
  Subteam folder (each):     ____________________________

Google Calendar (create new, or existing calendar ID):  ____________________
Slack channel IDs:  announcements ______  mentors ______
Discord webhook URLs:  announcements ______  meetings ______
Final hostname:  ____________________________
```

Notes:

- Group membership is what grants Drive access. If the folders are currently shared with individuals, tell me — we switch them to group grants in Phase 2, which is also when alumni handling starts working automatically.
- If a group name is just a display name, I need the email (`something@keystonestemai.org`), not "BLAST Robotics Students".

---

## 5. KeySign changes (I'll do these — listed so they're agreed)

| Change | Why | Size |
|---|---|---|
| Service-token auth on a create-request endpoint | LaunchPad creates the signing document without a KeySign user | ~1 route |
| `document.completed` webhook, HMAC + retry | LaunchPad learns about completion | ~1 route + emitter |
| Metadata passthrough (`launchpad_waiver_id`, `launchpad_user_id`, `season`) | Webhook can identify the waiver without name matching | schema field |
| Waiver template with two fields: `Student`, `Parent/Guardian` | Existing multi-field support, one link, one screen | config only |

No multi-signer/envelope work. No Google auth added to KeySign. KeySign's database stays its own; LaunchPad reads nothing from it except the webhook payload and the PDF URL.

---

## 6. Deployment

Actual state: the Vercel project exists and is linked; build configuration arrives with
`vercel.json` (see `PHASE-0-PLAN.md` §2). Remaining steps:

1. `vercel.json`: `bunVersion: "1.x"`, `installCommand: bun install`, `buildCommand: bun run build`,
   `outputDirectory: apps/web/dist`, SPA fallback rewrite. The API is the root `api/[...path].ts`
   catch-all, so **do not** set a framework preset or a root directory.
2. Env vars: already set in Vercel for all three environments (see `STATE.md` §3).
3. Cron: `GET /api/internal/cron/reconcile` daily — **Phase 2**, not yet configured.
4. Domain: attach `launchpad.team10989.org` to the `launchpad` project, then add a 308 redirect
   from `launchpad.keystonestemai.org`. DNS for `team10989.org` is on the same Vercel account
   (project `10989-blast`), so this is a project-level operation.
5. Migrations: run once from the deploy step with `DATABASE_URL_UNPOOLED`; never concurrently.

---

## 7. Verification checklist (Phase 2 exit)

- [ ] `google_objects` verify reads every entry back from Google with no errors
- [ ] Test student joins the parents group on alumni transition and leaves the students group
- [ ] Test student gains exactly the intended Drive folder access, no more
- [ ] Removing a group in the console is repaired by the next reconcile
- [ ] KeySign webhook rejects a bad signature and is idempotent on replay
- [ ] A failed provisioning step shows "Needs attention" and Retry succeeds
- [ ] Badge call is a logged no-op while no attendance system exists

---

## 8. Current blockers

Nothing is blocked. Neon, Vercel, GitHub, and the Google OAuth client are all done, so Phase 0 is
pure implementation. See [STATE.md](./STATE.md) §7 for the ordered next actions.

The only future dependencies:

- **Phase 2:** the Google service account JSON key and DWD authorization (console, ~15 min).
- **Phase 4:** the Slack app and channel IDs, Discord webhook URLs.
- **Phase 2:** the inventory in §4, if API discovery cannot be used.
