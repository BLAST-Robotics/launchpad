# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
LaunchPad is the operations portal for FRC Team 10989 (Blast Robotics, part of the Keystone STEM Alliance). Three audiences, in priority order when choices conflict:

1. **Students, grades 6–12, mostly on phones** (primary). Many are minors. They sign in, claim their roster spot, and check what the team needs from them, often at practice, between tasks. Some are under 13 or have no Google account, so email + password sign-up is a first-class path, not a fallback.
2. **Parents and guardians, on phones.** They arrive from a message link to link their child, and later to sign waivers and read updates.
3. **Mentors and admins, mostly on a laptop.** Adults who approve access, run the roster, and read the activity record.

## Product Purpose
One place for a robotics team's people records: who is on the team this season, what role each person holds, and (in later phases) what each person has signed, plus the Google Groups, Drive, Calendar, Slack and Discord access that follows from it. Success is a student or parent getting into the right place in under a minute without asking anyone, and an admin never having to hand-edit a spreadsheet to know who is on the team.

## Positioning
LaunchPad owns the roster. Access comes from claiming a roster entry ("Are you …?" for students, "Is this your kid?" for parents), not from an invite email or an admin typing addresses. Waiver status is always computed from signatures and roles, never stored as a flag. A generic school or team-management tool does not model seasons, alumni archiving, or a roster-claim gate this way.

## Operating Context
- A single team, modelled by seasons. The current season is 2027; grade 12 graduates at the end of it.
- The roster is imported from the team's own coordination sheet. Only first name, last name and grade are stored from it.
- Sign-up is open: Google, or email + password with no verification. The app sends no email of any kind.
- Admins are made with a command-line script. There is no in-app path to become admin.
- Help when stuck is a human: write to **admin@team10989.org**. The app never sends mail from that address and must not imply it will reply automatically.

## Capabilities and Constraints
- Roles: pending, student, parent, mentor, admin. New accounts start as pending. A claimed roster entry makes a student; a linked child makes a parent; mentors always wait for admin approval.
- Claiming is protected by a database uniqueness rule: one student per roster entry. An already-claimed entry shows "ask an admin to fix this".
- Account linking between a password account and a Google account with the same email is deliberately off. Users who hit that must be told plainly and sent to the help contact.
- Signatures are append-only, alumni are archived and never deleted, and no Google ID is ever hardcoded in source.
- Undecided: password reset beyond "ask an admin"; waiver signing and attendance are future phases; how a parent without a student on the roster is handled.

## Brand Commitments
Name: Blast Robotics, Team 10989; the product is called LaunchPad. The team's own artwork is the source of truth for identity (BLAST wordmark, shuttle with "10989", and the isometric LaunchPad mark). Copies live in `apps/web/public/brand/` and `apps/web/public/logo-mark.svg`. Do not redraw or approximate the wordmark or shuttle.

## Evidence on Hand
- A real roster of 29 students for the 2027 season, imported locally. It is personal data about minors: never use real names in screenshots, copy, tests or examples.
- The team's graphic assets (13 PNGs) from their shared Drive folder.
- Absent and not to be invented: testimonials, member counts as marketing claims, awards, sponsors, response-time promises for the help contact.

## Product Principles
1. **The student on a phone decides every tie.** If adult-admin convenience and a 12-year-old's first minute conflict, the child wins.
2. **Plain words for the person, not the database.** "Roster entry", "pending" and "claim" are system terms; say what the person is doing instead.
3. **Never leave anyone stuck without a human.** Every failure state names a next step and the help contact.
4. **Access is earned by claiming, not by signing up.** Open registration is not a security boundary, so the claim step must be clear, quick and honest about what happens next.
5. **Treat the roster as sensitive.** Minimise what is shown, stored and logged; return only the closest few matches, never the list.

## Accessibility & Inclusion
Readable by a sixth grader. WCAG AA contrast and full keyboard operation. Touch targets at least 44px, usable one-handed on a phone. Do not rely on color alone for status or errors. No time-limited steps in onboarding.
