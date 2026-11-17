# LaunchPad — Architecture

Blast Robotics (FRC 10989) · Keystone STEM Alliance
Status: design agreed, nothing built yet.

Related documents: [ROADMAP.md](./ROADMAP.md) · [SETUP.md](./SETUP.md) · [DECISIONS.md](./DECISIONS.md)

---

## 1. What LaunchPad is

A single web portal that owns team **identity, roster, roles, waivers, events and announcements**, and drives the external systems that actually enforce access: Google Groups, the Team Shared Drive, Google Calendar, Slack, Discord, and (later) the shop attendance system.

LaunchPad is not an attendance system and not an e-signature system. It *is* the source of truth for "who is on the team, what are they allowed to do, and have they signed what they must sign".

### In scope for v1

- Google sign-up, roster claiming, role assignment
- Guardian ↔ student linking
- Waiver pipeline (KeySign) and automatic provisioning (Groups, Drive, badge)
- Student / parent / mentor / admin dashboards
- Manual attendance entry with an adapter for a future attendance system
- Event creation → Google Calendar + Slack + Discord
- Announcements → Slack + Discord
- Alumni transition without data loss

### Explicitly out of scope

- Email of any kind (no Resend, no SMTP, no magic links)
- Building or forking an attendance system
- Any multi-signer / envelope e-signature work
- File storage (signed PDFs and team files live in the Shared Drive)
- Queue infrastructure (no Upstash, no Redis, no workers)
- Native apps, realtime/websockets, in-app chat

---

## 2. System context

```
                    ┌──────────────────────────────┐
                    │   LaunchPad (single Vercel   │
   Google SSO ─────▶│   project)                   │
   (students,       │                              │
    parents,        │   React SPA  +  Elysia API   │
    mentors)        │        │                     │
                    └────────┼─────────────────────┘
                             │
              ┌──────────────┼───────────────┬──────────────┐
              │              │               │              │
        ┌─────▼─────┐  ┌─────▼─────┐   ┌─────▼─────┐  ┌─────▼─────┐
        │   Neon    │  │  Google   │   │   Slack   │  │  Discord  │
        │ Postgres  │  │ Workspace │   │  (bot)    │  │ (webhook) │
        │ (Drizzle) │  │ Groups    │   │           │  │           │
        └───────────┘  │ Drive     │   └───────────┘  └───────────┘
                       │ Calendar  │
                       └─────▲─────┘
                             │ service account + DWD
        ┌───────────┐        │              ┌──────────────────┐
        │  KeySign  │────────┘              │ LancerLogin      │
        │ (separate │  webhook → LaunchPad   │ (future, not yet │
        │  Vercel)  │  LaunchPad → KeySign   │  built)          │
        └───────────┘                        └──────────────────┘
```

### Systems of record

| Domain | Master | Direction |
|---|---|---|
| People, roster, guardians, roles, subteams | **LaunchPad** | → Google Groups, → attendance, → badge |
| Seasons / archives | **LaunchPad** | — |
| Waiver definitions and requirement rules | **LaunchPad** | → KeySign (document + fields) |
| Signatures | **KeySign** | → LaunchPad (webhook, evidence copy in Drive) |
| Events / meetings | **LaunchPad** | → Google Calendar, Slack, Discord, attendance |
| Announcements | **LaunchPad** | → Slack, Discord |
| Group membership, Drive ACLs, calendar events | **Google** (enforced) | LaunchPad computes desired state |
| Attendance hours | Attendance system | → LaunchPad (push + daily reconcile) |

---

## 3. Deployment topology

One Vercel project. The SPA and the API share an origin.

```
Vercel project "launchpad"
├── /                → static build of apps/web (React SPA, SPA fallback rewrite)
├── /api/*           → Elysia app (Bun runtime, fetch handler)
└── cron: daily      → GET /api/internal/cron/reconcile
```

- **Why one project:** session cookies and CORS disappear as a problem. No `api.` subdomain.
- **Why no queue:** the only async work is Google provisioning, which is four API calls. It runs post-response via `after()` inside the KeySign webhook handler, with a manual retry button and the daily reconcile as the safety net.
- **Cold starts:** acceptable. Slack slash commands are acknowledged immediately (`200` first, work after) so the 3-second limit is never in play.

### Monorepo layout (when code starts)

```
apps/web        React 19 + Vite + TanStack Router/Query + Tailwind + shadcn/ui
apps/api        Elysia on Bun, exports the App type for Eden Treaty
packages/db     Drizzle schema + migrations
packages/shared Zod contracts, role/permission constants, adapter interfaces
```

---

## 4. Identity and auth

**Provider:** Better Auth, Google OAuth, external audience. Only `openid`, `email`, `profile` — non-sensitive scopes, so no Google verification and no 100-user test cap.

**Sign-up is open.** Anyone with a Google account can create a LaunchPad account. An account with no claim has no permissions and sees only the claim screen. The security boundary is the *claim*, not registration.

### Roles

`roles` is an array on the user (a mentor can also be a parent).

| Role | Granted by | Can |
|---|---|---|
| `pending` | default on sign-up | claim a roster entry, edit own profile |
| `student` | claiming a roster entry | own dashboard, subteam docs, events, waivers |
| `parent` | claiming a student as guardian | sibling selector, guardian status, contact notes |
| `mentor` | admin | roster, attendance overrides, sign-offs, events |
| `admin` | admin | everything, role changes, mappings, audit log |

`status` is separate: `active | alumni | archived`.

**Effective permissions** = union of `roles` statements, then downgraded if `status = alumni`:

```
effective(user) = user.status === 'alumni' ? ALUMNI_STATEMENTS : union(statements[role] for role in user.roles)
```

Alumni keep read-only access to their own history and team announcements. They lose parent capabilities (sibling selector, guardian records) even if they remain linked as a guardian.

### Claim flow

```
Google sign-in
   │
   ├─ email matches a roster entry's email_hint ──▶ auto-claim, role=student
   │
   └─ no match ──▶ "Which one are you?" screen
                     ├─ pick a student name  → claim  → role=student
                     ├─ "I'm a parent" → pick student name → guardian link
                     └─ "none of these" → request mentor/admin invite
```

Rules:

- `roster_entries.claimed_by_user_id` is `UNIQUE` — one student per entry, enforced by the database.
- A guardian link is `guardian_links(user_id, roster_entry_id)` and is valid whether or not the student has claimed yet. If the student later claims, the link already resolves.
- Adding a guardian to a roster entry that is already claimed is allowed; a student may have several guardians.
- Any admin can unclaim a user from a roster entry in one click, recorded in `audit_log`.
- No email verification, no approval queue, no invite-only signup.

### Session model

Better Auth sessions in Neon, HTTP-only cookie, same origin. No SSO bridge to KeySign or to the attendance system — those authenticate with service tokens.

---

## 5. Data model

Everything is Postgres via Drizzle. All tables carry `created_at` / `updated_at`.

### Identity and roster

```
seasons            id, name, starts_on, ends_on, is_current
users              id, name, email (unique), google_sub, roles[], status,
                   roster_entry_id, last_login_at
roster_entries     id, season_id, first_name, last_name, grade,
                   email_hint, claimed_by_user_id UNIQUE, status
guardian_links     id, user_id, roster_entry_id, relationship, phone, notes
subteams           id, season_id, name, slug, mentor_id, google_group_email
subteam_members    id, subteam_id, roster_entry_id, is_lead
```

`roster_entries.status`: `unclaimed | claimed | alumni | archived`.

### Waivers

```
waiver_documents   id, season_id, title, version, audience_roles[],
                   pdf_drive_id, keysign_document_id, is_required, active_from
waiver_signatures  id, waiver_document_id, user_id, keysign_signature_id,
                   signed_at, pdf_drive_id, signer_role
```

`internal_waiver` is **never a column**. It is a query:

```
waiver_current(user) = for every active required waiver_document whose
                       audience_roles intersects effective_roles(user):
                       a signature row exists for that user and document
```

Signatures are append-only and reference an immutable document version. Changing a waiver creates a new `waiver_documents` row; the old rows and their signatures remain.

### Attendance

```
attendance_records id, roster_entry_id, source, direction, happened_at,
                   session_ref, minutes, raw, recorded_by
```

`source`: `manual | csv | attendance_system`. Manual entries record `recorded_by` and are overridable by mentors; imported entries are replaced wholesale per reconcile.

### Events and communications

```
events             id, title, description, starts_at, ends_at, location,
                   audience_roles[], google_calendar_event_id, created_by
announcements      id, title, body, audience_roles[], created_by, published_at
deliveries         id, announcement_id, channel, status, external_ref, error
```

`deliveries` is per-channel and per-recipient-group so a Slack failure never blocks Discord.

### Google mapping and operations

```
google_objects     id, kind, key, external_id, email, label, verified_at
                   kind: group | shared_drive | folder | calendar
provisioning_state id, user_id, desired jsonb, applied jsonb,
                   last_error, last_attempt_at
audit_log          id, actor_user_id, action, entity, entity_id,
                   before jsonb, after jsonb, created_at
```

`google_objects` means no group email, folder ID, or calendar ID is ever hardcoded. Admins see the mapping in the UI with a **Verify** action that reads the real object back from Google.

---

## 6. Provisioning

Desired state is computed from the user, never stored as a hand-maintained flag.

```
desired_groups(user):
  status = alumni        → [parents]
  role parent            → [parents]
  role student/mentor    → [students] + [subteam groups for subteam_members]
  role admin             → [students, mentors]

desired_drive(user):
  group memberships above, expanded through google_objects folder ACLs
  (Drive permissions are granted to groups, never to individuals)

desired_badge(user):
  status = active AND waiver_current(user) AND role in (student, mentor, admin)
```

Apply is a diff against `provisioning_state.applied`:

1. Group membership add/remove (Admin SDK)
2. Drive permission on each mapped folder (only if the *group* mapping changed)
3. Badge enable/disable (attendance system, or no-op while absent)

Each step is idempotent and records its result. Failures leave the diff in place and surface in the admin dashboard as **"Needs attention"** with a **Retry** button.

**Triggers:** KeySign webhook (waiver signed), role change, status change, subteam change, claim, daily reconcile.

**Reconcile (daily cron):** read actual group memberships from Google, compare to desired, log drift, re-apply. Also repairs manual changes made directly in the Workspace console.

### Why group-based ACLs

One group membership change propagates to every folder that group can see. 40 students × 6 folders becomes 40 calls, not 240, and the Workspace console stays readable for the person who inherits this project.

---

## 7. Waiver pipeline (KeySign)

KeySign (the existing e-signature app) stays a separate deployment with its own database. LaunchPad integrates over HTTP.

```
Mentor activates waiver version
        │
        ▼
LaunchPad creates a KeySign document
  - PDF from Drive
  - fields: Student signature, Parent/Guardian signature
  - metadata: launchpad_waiver_id, launchpad_user_id, season
        │
        ▼
User opens the shared link (one screen, both signers)
        │
        ▼
KeySign fires document.completed (HMAC)
        │
        ▼
LaunchPad verifies, stores signature row + Drive file ID,
recomputes waiver_current, then runs provisioning in `after()`
```

**KeySign auth reality:** production KeySign uses its own username/password admin login and has **no Google identity configured**. There is nothing to federate and no shared Google project to inherit, so:

- LaunchPad gets its **own Google Cloud project** for the service account and OAuth client.
- The only bridge between the two apps is the service token below. No SSO, no shared session, no shared user table.
- KeySign's admin login is irrelevant to the student/guardian signing flow, which is link-based and unauthenticated by design.

**Required KeySign changes (small, deliberate):**

1. **Service-token auth** on a create-request endpoint, so LaunchPad can create a document without a KeySign user session. Current routes are cookie-session only, and prod has no OAuth path to borrow.
2. **Outbound webhook** on completion: `document.completed`, HMAC-SHA256 over the raw body, `X-KeySign-Signature` + timestamp, retried with backoff.
3. **Metadata passthrough** on documents and signatures so the webhook can identify the LaunchPad waiver without name matching.

No multi-signer work. KeySign already supports multiple fields on one PDF, so "student and guardian both sign" is a template with two fields and one link.

---

## 8. Attendance adapter

Attendance is not built yet, so LaunchPad defines an interface and ships the simple implementations.

```
AttendanceProvider
  listHours(rosterEntryId, from, to)
  pushMember(member)          // upsert identity into the attendance system
  setBadge(rosterEntryId, enabled)
```

| Implementation | When | Notes |
|---|---|---|
| `manual` | v1 | mentors type hours; `recorded_by` required |
| `csv` | v1 | one-off import/sync from whatever exists today |
| `attendance_system` | later | HTTP contract, service token |

The future contract, for reference:

```
POST /internal/roster/sync     LaunchPad → attendance   upsert by launchpad_id
POST /internal/badge           LaunchPad → attendance   { enabled }
POST /hooks/attendance         attendance → LaunchPad   { launchpad_id, direction, at, session }
```

Bearer service token, no shared database, no cross-system foreign keys.

---

## 9. Communications

No email. Delivery is Slack, Discord, and the portal itself.

```
announcement / event
        │
        ├─▶ Slack  (bot: channels, slash commands, ephemeral confirmations)
        ├─▶ Discord (one-way webhook per channel; no bot, no OAuth)
        └─▶ Portal (always, regardless of channel failures)
```

- **Slack** handles mentor workflows: `/launchpad announce`, `/launchpad meeting`, `/launchpad merit @user`. Ack immediately, do the work after.
- **Discord** is a mirror only. One webhook URL per target channel, stored in `google_objects`-style config.
- **Google Calendar** is owned by LaunchPad for v1: events are inserted with the service account, `sendUpdates: none`. An `.ics` feed is generated from the database behind a revocable token, so no Google secret URL is exposed.

Deliveries are recorded per channel so a failed Discord webhook is visible and retryable without re-announcing.

---

## 10. Alumni lifecycle

Never delete. Archive.

```
status → alumni
  Google:  remove students + subteam groups  →  add parents group
  Badge:   disabled
  Drive:   no change to files; access becomes whatever the parents group grants
  App:     read-only own history + announcements; no guardian capabilities
  Season:  roster_entries.status → alumni, kept for reports
```

Because the Drive is a **Shared Drive** (team-owned), a departure never touches file ownership. Nothing a student uploaded disappears, and no transfer step is needed.

`archived` is reserved for data that must be hidden entirely (e.g. a mistaken duplicate account); it hides the user but still deletes nothing.

---

## 11. Security posture

Deliberately minimal, but the parts that prevent silent damage are kept:

**Kept**
- Every permission check is server-side; the client only renders.
- `admin` is never self-service.
- One admin action per row in `audit_log`.
- Webhooks (KeySign) and service calls (attendance) use a shared secret + HMAC, not a query param.
- No student PII in application logs; errors log IDs, not names or emails.
- Search params and form bodies validated with Zod at the boundary.
- Service account JSON and OAuth secrets live in Vercel env vars only.

**Accepted risks (documented, not accidental)**
- Open sign-up: anyone can create an account; claims are the control.
- No email verification.
- No 2FA.
- Claims can be wrong; an admin can unclaim, and the audit log shows who did what.
- No rate limiting beyond Vercel's defaults.

---

## 12. Environments

| Env | Database | Google | Notes |
|---|---|---|---|
| Local | Neon branch | optional: real service account, test group | `bun dev` |
| Preview | Neon branch per PR | disabled by default | no Google writes |
| Production | Neon main | real | cron enabled |

- Drizzle migrations generated and committed; applied once by the deploy step, never concurrently.
- `google_objects` is seeded from a script that lists/validates real groups and folders — never by typing IDs into source.

---

## 13. Open questions tracked in SETUP.md

1. Exact group email addresses for "BLAST Robotics Students" and "BLAST Robotics Parents".
2. Shared Drive ID and the per-subteam folder IDs.
3. Which Google account owns the Workspace (for DWD). LaunchPad gets its own GCP project — KeySign production has no Google project to share.
4. Slack workspace name + target channel IDs.
5. Discord channel webhook URLs.
6. Whether `team10989.org` or a subdomain will host LaunchPad.
