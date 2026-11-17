# LaunchPad — Decision log

Short form ADRs. Each entry is a decision that constrains the build; "why" is the part that matters when someone revisits it in a year. Reversals are kept, not deleted, because a reversal usually means a constraint was misunderstood.

---

### D-001 — One Vercel project, SPA and API on the same origin
**Status:** accepted
**Why:** Better Auth sessions are cookies. Splitting web and API across origins means CORS and cookie flags on every request, forever. Same-origin removes the entire category.
**Rejected:** `web.vercel.app` + `api.vercel.app`; separate backend host.

### D-002 — No queue, no external scheduler
**Status:** accepted (replaces an earlier QStash/outbox-worker design)
**Why:** the only async work is Google provisioning — four API calls per person. It runs post-response with `after()`, has a manual Retry, and a daily cron repairs drift. Upstash, Redis and worker containers are infrastructure for a problem this app does not have.
**Rejected:** Upstash QStash, BullMQ, Vercel cron every minute (Hobby allows daily).
**Consequence:** no exactly-once semantics; every step must be idempotent, which it is by construction (desired-state diff).

### D-003 — No email anywhere
**Status:** accepted
**Why:** stated requirement. Removes Resend, domain verification, DNS records, magic links, and one whole delivery channel.
**Consequence:** parents receive updates only through the portal and Discord. `parents@` group membership does **not** deliver messages — it grants Drive access and marks community status.

### D-004 — Google OAuth, external audience, basic scopes, open sign-up
**Status:** accepted
**Why:** `openid email profile` are non-sensitive, so an External app needs no verification and has no 100-user cap. Internal audience would exclude parents on personal Gmail.
**Rejected:** invitation-only signup, email magic links, Internal-only audience.
**Consequence:** registration is not a security boundary; claims are.

### D-005 — Access comes from claiming a roster entry
**Status:** accepted
**Why:** open signup needs *some* gate. Claiming produces a natural, understandable one ("Are you Student Student?") with a database-level uniqueness guarantee.
**Mechanism:** `roster_entries.claimed_by_user_id UNIQUE`; email auto-match when available; admin one-click unclaim; `audit_log` records it.
**Rejected:** mentor approval queue, email verification, invite codes.

### D-006 — LaunchPad is the roster master
**Status:** accepted (reversed: earlier draft made the attendance system master)
**Why:** the attendance system is experimental and unbuilt. Making it authoritative would block every other feature on it, and it only needs members in order to scan badges.
**Consequence:** LaunchPad pushes roster to the attendance system when that exists. Until then, nothing depends on it.

### D-007 — No fork, no plugin, no shared database for the attendance system
**Status:** accepted
**Why:** a fork inherits a release/verification pipeline forever; a plugin is only worth it against upstream Community Edition, which is not what is being built. The real need is a three-endpoint HTTP contract.
**Consequence:** `AttendanceProvider` interface with `manual` and `csv` shipped in v1; `attendance_system` later.
**Contract:** `roster/sync`, `badge`, `hooks/attendance`, bearer service token, no cross-system foreign keys.

### D-008 — KeySign stays a separate service
**Status:** accepted
**Why:** it already works, already stores signatures, and already runs on Neon. Folding it in would reimplement PDF stamping and audit trails for no user-visible gain.
**Changes required:** service-token create endpoint, completion webhook (HMAC + retry), metadata passthrough, two-field waiver template.
**Rejected:** rebuilding e-signature inside LaunchPad, envelope/multi-signer model.

### D-009 — No multi-signer work; one document, two fields
**Status:** accepted
**Why:** KeySign already supports multiple signature fields on one PDF with one shareable link. "Student and guardian both sign" is a template change, not a feature. Either signer may complete it on the same screen, in either order.
**Rejected:** envelope ordering, separate signing sessions per signer.

### D-010 — Files live in the Shared Drive
**Status:** accepted
**Why:** no object storage to pay for or secure, and Shared Drive ownership is team-level, so alumni transitions cannot orphan or delete a student's uploads.
**Consequence:** no R2/Blob in v1. Signed PDFs are Drive files referenced by ID. Evidence copies live in a dedicated folder, never in the app filesystem.

### D-011 — Drive and group access are granted to groups, never individuals
**Status:** accepted
**Why:** one membership change propagates everywhere; 40 students × 6 folders becomes 40 calls, not 240; the Workspace console stays legible to whoever inherits this.
**Consequence:** `google_objects` maps role/subteam → group → folder. If folders are currently shared with people, they are switched to group grants in Phase 2.

### D-012 — Alumni are added to the parents group but get the alumni app role
**Status:** accepted
**Why:** they should keep receiving community updates and parent-level Drive access, but must not keep shop access or student permissions.
**Consequence:** Google layer and app layer are deliberately different. Alumni lose the sibling selector, guardian record editing and emergency contacts even if they are still a guardian. Group membership is not authority.
**Never:** delete. `status: alumni | archived`, files untouched.

### D-013 — React 19 + shadcn/ui, not Preact
**Status:** accepted
**Why:** shadcn is Radix-based and Radix on `preact/compat` is a predictable source of subtle bugs. The bundle saving is irrelevant on an authenticated dashboard.
**Rejected:** Vite + Preact via `preact/compat`.

### D-014 — Two auth systems, one thin bridge, no SSO
**Status:** accepted
**Why:** LaunchPad uses Google; KeySign uses its own admin login; the attendance system uses kiosk credentials. Bridging them would mean session federation for no user benefit.
**Consequence:** service tokens between systems, nothing else. "Double auth" here means two independent systems, not two factors.

### D-015 — LaunchPad owns calendar delivery in v1
**Status:** accepted (reversed: earlier draft reused the attendance system's calendar/Discord delivery)
**Why:** that system does not exist yet. Depending on it would block Phase 4. Calendar insert + one webhook is small.
**Consequence:** when the attendance system lands, it consumes meetings from LaunchPad rather than duplicating delivery.

### D-016 — KeySign gets no Google project of its own
**Status:** accepted (new fact: KeySign production has no Google auth configured)
**Why:** there is nothing to federate. LaunchPad creates its own Google Cloud project for the service account and OAuth client; KeySign stays username/password for admins and link-based for signers.
**Consequence:** no shared OAuth client, no shared project, no SSO assumptions anywhere.

### D-017 — Single team, seasons instead of tenants
**Status:** accepted
**Why:** one team, one Workspace, one Drive. `seasons` handles rollover and history, which is the real requirement.
**Rejected:** `team_id` on every table, multi-tenant routing.

### D-018 — Minimal security, kept where it prevents silent damage
**Status:** accepted
**Kept:** server-side permission checks, admin-only role changes, `audit_log` on every admin mutation, HMAC on webhooks, no PII in logs, Zod at boundaries, secrets only in env.
**Accepted:** open signup, no email verification, no 2FA, claim mistakes possible and correctable, default rate limits.
**Why:** nonprofit, small roster, trusted population. The goal is to avoid invisible mistakes, not to defend against a determined attacker.

### D-019 — `google_objects` instead of hardcoded IDs
**Status:** accepted
**Why:** group emails, folder IDs and calendar IDs change, and hardcoding them makes every change a code deploy. One table, seeded by a verify script, visible in the admin UI with a **Verify** button that reads the real object back.
**Rejected:** env vars per group, constants in source.

### D-020 — Slack is ack-then-work; Discord is one-way webhook
**Status:** accepted
**Why:** Slack's 3-second acknowledgement limit rules out doing real work in the request. Discord only needs mirroring, so a webhook URL is enough — no bot, no OAuth, no intents.
**Rejected:** Slack socket mode, Discord bot for v1.

---

## Open decisions (need input)

| # | Question | Blocks |
|---|---|---|
| O-1 | Exact group emails for students/parents (and whether mentors/admins have their own) | Phase 2 |
| O-2 | Shared Drive ID + folder IDs per subteam, and whether folders are currently individual ACLs | Phase 2 |
| O-3 | ~~Which Workspace account to impersonate~~ **answered: team Gmail** (dedicated `launchpad-bot@` later if wanted) | — |
| O-4 | ~~Final hostname~~ **answered: `launchpad.team10989.org`**, 308 redirect from `launchpad.keystonestemai.org` | — |
| O-5 | Slack channel IDs and Discord webhook URLs | Phase 4 |

## Answered constraints

- **Workspace super admin:** team Gmail. Owns DWD and the Admin SDK impersonation target.
- **Vercel account:** personal account (`virat2010`), authenticated. Fine for now; transfer to a team-owned account before graduation if the project should outlive the builder.
- **Drive / Groups operations:** run as the team account, never a personal one.
- **O-1 / O-2 can be discovered, not typed:** once the service account + DWD exist, LaunchPad's verify script lists groups (`admin.directory.groups.list`, `members.list`) and Shared Drives (`drives.list`, `files.list` with `supportsAllDrives`). The inventory in SETUP.md is a fallback, not a prerequisite.
