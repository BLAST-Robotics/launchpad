# LaunchPad

Team operating system for **Blast Robotics, FRC Team 10989** (Keystone STEM Alliance).

One portal that owns identity, roster, roles, waivers, events and announcements, and drives the systems that enforce access: Google Groups, the Team Shared Drive, Google Calendar, Slack, Discord, and eventually the shop attendance system.

Nothing is built yet. This repository currently holds the design.

## Documents

| File | What it covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, data model, provisioning, waiver pipeline, security posture |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phases 0–6, exit criteria, risks |
| [docs/SETUP.md](docs/SETUP.md) | Accounts, credentials, Google DWD, group/folder inventory, KeySign changes |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decision log with rationale and reversals; open questions |

## Shape of the thing

- **Frontend:** React 19, Vite, TanStack Router + Query, Tailwind, shadcn/ui
- **API:** Elysia on Bun, one Vercel project with the SPA (same origin), Eden Treaty for end-to-end types
- **Data:** Neon Postgres + Drizzle, migrations committed
- **Auth:** Better Auth + Google OAuth, open sign-up, access by claiming a roster entry
- **Google:** service account + domain-wide delegation; groups are the only ACL primitive
- **Waivers:** KeySign (separate app) creates the document, LaunchPad receives the webhook
- **Comms:** Slack bot for mentors, Discord webhooks for mirrors, no email anywhere
- **Jobs:** inline post-response work plus one daily reconcile cron; no queue

## Deliberately absent

Email, queues, object storage, websockets, a rebuilt attendance system, a multi-signer e-signature envelope, and any dependency on software that does not exist yet.

## Next step

Phase 0 needs two things: a Vercel token and the Neon database URLs. See [docs/SETUP.md](docs/SETUP.md) §8.
