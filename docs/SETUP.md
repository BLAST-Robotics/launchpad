# LaunchPad — Setup

What exists, what to create, and what only you can do.
Status legend: ✅ exists · ⬜ to create · 🔒 only you can do

---

## 1. Known environment

| Thing | Value / status |
|---|---|
| Team | Blast Robotics, FRC Team 10989 |
| Nonprofit | Keystone STEM Alliance |
| Team site | `10989website` (Astro) → `team10989.org` ✅ |
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

I cannot read your Chrome session or log in as you. I need either a token pasted into a local untracked file, or you run one CLI login. Nothing else.

| # | Account | Create | What I need | Who |
|---|---|---|---|---|
| 1 | Neon | reuse existing project, new database | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | you (2 min) |
| 2 | Vercel | new project in your personal account | `VERCEL_TOKEN` (account → settings → tokens) | you (2 min) |
| 3 | Google Cloud | **new project** — KeySign has none to share | `GOOGLE_SA_JSON`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | you (15 min) |
| 4 | Slack | new app in the team workspace | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | you (10 min) |
| — | GitHub | existing account, `gh` already authenticated | — | done |

**Secrets I generate myself:** `BETTER_AUTH_SECRET`, `KEYSIGN_TOKEN_SECRET`, `KEYSIGN_WEBHOOK_SECRET`, `INTERNAL_SERVICE_SECRET`, `LANCER_SERVICE_SECRET`, calendar feed token.

**Secrets you paste:** the 7 above. Never into chat, never into the repo — into `launchpad/.env.local` (gitignored) and the Vercel dashboard.

Total: **3 new accounts, ~30 minutes, no payment methods.**

---

## 3. Google Cloud project

Only you can do these; the console steps are quick but the DWD screen has no API.

1. 🔒 Create project `launchpad` under `keystonestemai.org`'s organization.
2. Enable **Admin SDK API**, **Google Drive API**, **Google Calendar API**.
3. Create a **service account** `launchpad-bot@<project>.iam.gserviceaccount.com`, download a JSON key. Enable **Domain-wide delegation** on it.
4. Create an **OAuth client** (Web application):
   - Authorized JavaScript origin: `https://launchpad.team10989.org` (or the final domain)
   - Authorized redirect URI: `https://<domain>/api/auth/callback/google`
   - Audience: **External**, scopes `openid email profile` only → no verification needed.
5. 🔒 Workspace Admin console → Security → API controls → Domain-wide delegation → add the service account **client ID** with these scopes:

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

Fill this in exactly; I seed `google_objects` from it and verify each entry against the real API before anything is written.

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

1. Create the Vercel project from the monorepo, root `apps/web`.
2. Env vars: the 7 secrets + generated ones, per environment.
3. Cron: `GET /api/internal/cron/reconcile` daily.
4. Domain: attach `launchpad.team10989.org` (or whatever you choose) — DNS at the `team10989.org` registrar.
5. Migrations: run once in the deploy step; never concurrently.

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

## 8. What I need to start Phase 0, in order

1. `VERCEL_TOKEN` + the Neon database URLs → I scaffold, deploy, and you get a login screen.
2. The inventory in §4 → I seed and verify Google objects.
3. Nothing else. Phases 0–1 need no Google, no Slack, no KeySign.
