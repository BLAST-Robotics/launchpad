# LaunchPad — Roadmap

Blast Robotics (FRC 10989)
See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design and [SETUP.md](./SETUP.md) for the accounts and credentials.

Effort is calendar time for one person working with an agent, not billable hours. Order is deliberate: every phase ends with something usable, and no phase depends on the unbuilt attendance system.

---

## Phase 0 — Bootstrap

**Goal:** a deployed URL that signs people in.

- [ ] Neon project + database, Drizzle schema committed, migrations applied
- [ ] Vercel project: SPA + API on one origin
- [ ] Better Auth + Google OAuth (`openid email profile`)
- [ ] `/health`, Sentry, structured logging with IDs only
- [ ] `seasons` table with the current season seeded
- [ ] CI: typecheck, lint, test, migration check

**Exit:** you log in with your Google account and see your name and email on screen, in production.

---

## Phase 1 — Roster and claiming

**Goal:** a real roster, and students can claim themselves.

- [ ] `roster_entries` CRUD for admins (table + bulk paste import)
- [ ] Claim screen: "Are you …?" with email auto-match, then manual pick
- [ ] Guardian claiming: parent links to a student, before or after the student claims
- [ ] Role assignment: `pending → student/parent`, admin grants `mentor` / `admin`
- [ ] Unclaim (admin), with `audit_log`
- [ ] Student / parent / mentor dashboard shells with navigation

**Exit:** 10 real students and 3 parents can log in and land on the right dashboard. A wrong claim is fixed in one click.

---

## Phase 2 — Waivers and provisioning

**Goal:** the pipeline that makes the portal worth having.

- [ ] `waiver_documents` + `waiver_signatures`, derived `waiver_current()`
- [ ] Google service account + DWD, `google_objects` seeded and **verified**
- [ ] Desired-state engine + `provisioning_state`
- [ ] Groups sync (Admin SDK), Drive permission sync, badge stub
- [ ] KeySign: service endpoint, webhook, metadata passthrough (see SETUP)
- [ ] Waiver request flow: mentor activates → link → student/guardian signs → webhook
- [ ] "Needs attention" admin view with Retry
- [ ] Daily reconcile cron

**Exit:** a student signs a real waiver and appears in the correct Google Groups and Drive folders within a minute, with the PDF in the Shared Drive. Removing them from the roster reverses it.

---

## Phase 3 — Dashboards and attendance

**Goal:** the portal answers "am I eligible / how many hours do I have".

- [ ] Student dashboard: waiver status, hours, subteams, events, links
- [ ] Parent dashboard: sibling selector, missing-signature banner, contact notes
- [ ] Mentor dashboard: roster, waiver toggles, role changes, attendance overrides
- [ ] `AttendanceProvider`: `manual` + `csv`
- [ ] Hours summary per season, per member

**Exit:** a parent with two students can switch between them and see accurate status. Mentors enter hours by hand without touching a spreadsheet.

---

## Phase 4 — Calendar and communications

**Goal:** one place to schedule, one place to announce.

- [ ] `events` CRUD, audience by role/subteam
- [ ] Google Calendar push (service account, `sendUpdates: none`)
- [ ] `.ics` feed with a revocable token
- [ ] Slack app: manifest, slash commands (`/launchpad meeting`, `announce`, `merit`), ack-then-work
- [ ] Discord mirror via webhook per channel
- [ ] `deliveries` table + per-channel retry
- [ ] Portal announcement list

**Exit:** a mentor schedules a meeting in Slack and it appears on the calendar, in the portal, and in Discord, with delivery status visible.

---

## Phase 5 — Alumni and lifecycle

**Goal:** graduation is a button, not a cleanup project.

- [ ] `status → alumni`: group swap to the parents group, badge off, read-only view
- [ ] Season rollover: archive roster, carry forward active members
- [ ] `archived` for duplicates, never deletion
- [ ] Audit log browser for admins
- [ ] Retention view: who is inactive, who never signed

**Exit:** converting a test student to alumni removes student access and adds parents-group membership, and every file they touched is still intact.

---

## Phase 6 — Attendance integration (later)

Only once the attendance system exists.

- [ ] Implement `AttendanceProvider` against the HTTP contract
- [ ] Attendance pushes into LaunchPad on scan
- [ ] Nightly reconcile, drift report
- [ ] Badge control becomes real instead of a stub

**Exit:** shop check-ins appear on the student dashboard without anyone typing anything.

---

## Ongoing / after v1

- Parent notification preferences (in-app only; no email by design)
- Merit leaderboard and reports
- Mobile-friendly PWA pass
- Multi-team support — **not planned**; the schema has seasons, not teams

---

## Known risks and mitigations

| Risk | Mitigation |
|---|---|
| Google DWD approval stalls | Start it in Phase 0/1; everything before Phase 2 works without it |
| KeySign changes take longer than expected | Waiver pipeline has a manual fallback: mentor marks signed + uploads PDF, until the webhook lands |
| Attendance system never gets built | v1 is complete without it; `manual` provider is a legitimate end state |
| Claim mistakes grant wrong access | One-click unclaim + audit log; group change is reversible in seconds |
| Vercel function duration on bulk provisioning | Provision per user, not in bulk; retry individually |
| Someone graduates mid-season | Status is independent of season; alumni transition works any time |

---

## Definition of done for v1

1. A new student can self-serve from sign-up to shop-ready.
2. A parent can see both children and what is missing.
3. A mentor can run the roster without a spreadsheet.
4. An alumni transition revokes access and keeps the archive.
5. Nothing depends on an external scheduler, an email provider, or an unbuilt system.
