# Fishing League

A website for fishing competitions in New Zealand. Organisers publish events, anglers register and take part, and results are scored from photo evidence. English only, mobile-friendly, hosted on Firebase.

**Status:** clickable prototype with mock data (React + Vite). Firebase integration is the next step (see [Implementation plan](#implementation-plan)).

## Contents
1. [Goals](#goals)
2. [Users and permissions](#users-and-permissions)
3. [Requirements](#requirements)
4. [Screens and design](#screens-and-design)
5. [Architecture](#architecture)
6. [Data model](#data-model)
7. [Implementation plan](#implementation-plan)
8. [Getting started](#getting-started)
9. [Secrets and configuration](#secrets-and-configuration)
10. [Open decisions](#open-decisions)

## Goals
- Make it easy to find a competition (filters, clear status, free spots) and register in one or two taps.
- Give organisers one place to create events, manage applications, collect evidence and publish scores.
- Reduce no-shows without taking payment: waitlist, attendance confirmation and a reliability record.
- Keep personal data private: public pages show names only.

## Users and permissions

| Role | Can do |
|---|---|
| **Guest** | Browse the catalog, event pages, public participant names and clubs. Sign in to register. |
| **Participant** | Everything a guest can, plus: register, join a waitlist, cancel, confirm attendance, join clubs, send evidence photos, use **My page**. |
| **Organiser** | Everything a participant can, plus: create and edit own events, upload the regulation, manage applications and statuses, review evidence, enter scores, export lists, belong to a club. |
| **Admin** | Everything an organiser can, plus: approve organiser requests and events, set participant/organiser roles, manage clubs and content. |
| **Superadmin** | Everything, plus: grant or remove admin and superadmin roles. The first superadmin was set once with a temporary Cloud Function (since removed); more are added on the Admin page. |

Organisers are real people with their own accounts. They can belong to a club; participants can also associate themselves with one or more clubs. **My page** exists for participants and organisers (organisers get a Managing tab).

Authentication: **Google** and **email + password**.

## Requirements

Priority: **MVP** = first release, **Later** = after the MVP is live.

### Accounts and roles
- Sign in with Google or email/password; password reset by email. (MVP)
- Role stored as a Firebase custom claim (`participant`, `organiser`, `admin`, `superadmin`). Admins can set participant/organiser; only superadmins manage admins and superadmins; nobody can change their own role. (MVP)
- New organisers are approved by an admin before they can publish events. (MVP)

### Event catalog (home page)
- Public list of event cards: name, date, waterbody and region, discipline, format, organiser/club, status badge, spots filled. (MVP)
- Filters: fishing type (sea/freshwater), discipline, region (then district), date range, status, format (individual/team), text search. (MVP)
- Statuses: *Registration open*, *Waitlist*, *Finished* (and *Cancelled*). (MVP)
- Disciplines: Fly, Spin, Surfcasting, Boat, Kayak, **Other** (with a short custom label). (MVP)
- Fishing type: **Sea fishing** or **Freshwater fishing**, required on every event, with no "Other"; it has its own filter in the catalog. (MVP)

### Event page
- Approval: organisers' new events are saved as drafts or submitted for approval (pending). Only approved (published) events are public; drafts, pending and rejected events are visible to their organiser and admins. A rejected event is edited and resubmitted. (MVP)
- Event photo: optional, 16:9, JPEG/PNG/WebP up to 2 MB (same drop area and rules as clubs). Shown on catalog cards and the event page. (MVP)
- Regions: the 16 regional-council regions plus Chatham Islands, each with districts and well-known fishing areas (for example Manawatū-Whanganui → Ruapehu, Manawatū, Horowhenua). The list lives in `src/data.js`. (MVP)
- Description and rules, regulation download (PDF/Doc), schedule, meeting-point map, entry fee, spots counter, public list of registered names. (MVP)
- Register / join waitlist / cancel button that reflects the user's current state. (MVP)
- Results tab with the final scores. (MVP)

### Registration
- Registration requires an account (Google makes it one or two taps). (MVP)
- Form: name (from the account), phone, club (optional, or *Independent*), team name for team events, acceptance of the regulation. (MVP)
- Confirmation email on registration. (MVP)
- Spots limit enforced on the server with a transaction; when full, new entries join a **waitlist**; when someone cancels or is disqualified the first waitlisted entry is promoted automatically and emailed. (MVP)
- Reminder email 2-3 days before the start with "I'm coming" / "Can't come" links. (MVP)

### Participation (My page)
- Profile, clubs (join/leave several), upcoming and past events with status. (MVP)
- Attendance confirmation for events starting within 3 days. (MVP)
- Reliability record: attended vs registered events. (Later)
- Send evidence: choose event, species (list with **Other**), upload photo(s); the photo goes to the event's organiser. (MVP)

### Organiser tools
- Event builder: name, description, fishing type (sea or freshwater), discipline (+Other), format, region, waterbody (+Other, with map pin), date/time, fee, participant limit, regulation upload, scoring method, divisions. (MVP)
- Applications table: live list, accept / waitlist / on site / disqualified, bulk accept, search and filter. (MVP)
- Export the participant list: CSV (MVP), Excel and PDF (Later).
- Evidence queue: view photos, enter weight/length/points, approve or reject with a reason. (MVP)
- Scores: ranking computed from approved catches, publish to the Results tab. (MVP)
- Team management for team events: captain registers the team and adds members. (Later)

### Clubs
- Organisers, admins and superadmins can create a club; the creator becomes its owner. The owner and admins can edit it. (MVP)
- Club profile: name, tagline, description, optional cover image, region and town, fishing type (sea and/or freshwater), disciplines, public contact email, website, Facebook/Instagram link, founded year, meeting details. (MVP)
- Cover image: optional, 16:9, JPEG/PNG/WebP, up to 2 MB. The browser trims it to 16:9 and shrinks it to at most 1280x720 before upload. (MVP)
- Signed-in users can join or leave clubs; membership is stored on their profile (`clubIds`). (MVP)
- Approval: a new club is pending and visible only to its owner and admins until approved; owners of rejected clubs edit and save to resubmit. Clubs made before approvals existed show up in the Approvals tab to be marked approved. (MVP)
- Later: member counts, club co-admins, join-by-approval, club logo, list of the club's events, archive/delete.

### Admin tools
- Approvals tab: new clubs and events wait for an admin or superadmin to approve or reject them (a reason is required when rejecting). Approved items can be revoked later. Items created by admins are approved automatically. (MVP)
- Users sheet: name and email, sign-in method (Google/Email), role, status, last sign-in, with search and filters; edit role and status in the user's row. (MVP)
- Manage clubs and the discipline/species lists; review frequently used **Other** labels and promote them to real categories. (Later)

### Where "Other" is offered
Discipline, target species, waterbody, scoring method, division, and reasons (evidence rejection, disqualification, cancellation). "Other" always comes with a short text field. Club uses **Independent** and "My club isn't listed" instead. Fishing type (Sea / Freshwater), status, format, role and region are closed lists.

### Notifications
- Email only (no Telegram for now): registration confirmation, waitlist promotion, 2-3 day reminder, organiser alert on new registration, evidence reviewed. (MVP)

### Non-functional
- **Mobile-first:** header menu becomes a bottom bar on phones, tables become cards, registration is a bottom sheet, filters collapse. (MVP)
- **Accessibility:** keyboard operable, visible focus, labelled inputs, contrast AA. (MVP)
- **Privacy:** public pages show names only; phone and email are visible to the event's organiser and admins only. Handle personal data in line with the New Zealand Privacy Act 2020 (to be reviewed before launch).
- **Time zones:** store UTC, display in Pacific/Auckland.
- **Security:** Firestore and Storage rules enforce roles; no secrets in the client or the repo.
- **Cost:** Firebase Blaze plan, staying within the free tier at expected volume.

## Screens and design
Visual direction: "Console" look, chosen from five options (dark green header, light grey background, green accents, IBM Plex Sans).

- Colours: header `#17352A`, primary `#2F6B52`, background `#F2F4F3`, accent `#7FD1A8`.
- Header menu: **Events**, **Clubs**, **My page** (signed in), **Manage** (organiser/admin), **Admin** (admin). Shared footer.
- Screens: Event catalog (home), Event page, Registration sheet, My page, Organiser console (Applications / Evidence / Scores), Clubs, Admin queue. Still to design: Event builder, Club page, Admin user management.

## Architecture
- **Frontend:** React 18, Vite 8, React Router 7, plain CSS.
- **Firebase:** Authentication, Firestore, Storage, Cloud Functions (2nd gen), Hosting.
- **Rule of thumb:** reads come straight from Firestore; anything that must be atomic or private (registration, waitlist, roles, emails) goes through Cloud Functions.

Planned folders:
```
src/
  app/          routes, layout, route guards
  features/     events, registration, evidence, clubs, admin
  lib/          firebase.js, hooks, formatting
functions/      Cloud Functions
firestore.rules, storage.rules, firestore.indexes.json
```

### Cloud Functions
| Function | Purpose |
|---|---|
| `registerForEvent` (callable) | Transaction: check limit, create registration as *Accepted* or *Waitlist*, update counters, send confirmation. |
| `cancelRegistration` (callable) | Remove entry, promote the first waitlisted person, send emails. |
| `onRegistrationChange` (trigger) | Promote from the waitlist when a spot frees up (status changes by the organiser too). |
| `confirmAttendance` (callable/HTTP) | "I'm coming" / "Can't come" links from the reminder email. |
| `sendReminders` (scheduled, daily) | Email people whose event starts in 2-3 days. |
| `listUsers` (callable, admin+) | Returns all users with sign-in methods, role, status and last sign-in for the Admin Users sheet. |
| `updateUser` (callable, admin+) | Changes a user's role and/or status (active/disabled). Admins manage participants and organisers; only superadmins touch admins and superadmins; nobody edits themselves. Disabling or downgrading revokes the user's sessions. |

Email is sent from Functions through the Firebase *Trigger Email* extension or a provider API (to be chosen); the provider key is stored as a Functions secret.

## Data model
Firestore collections (draft):

```
users/{uid}                     displayName, email, role, clubIds[], organiserStatus, createdAt
clubs/{clubId}                  name, tagline, description, region, town, waterTypes[], disciplines[], email,
                                website, social, founded, meetings, coverUrl, ownerId, ownerName, createdAt, updatedAt,
                                status (pending | approved | rejected), rejectionReason, reviewedBy, reviewedByName, reviewedAt
events/{eventId}                name, description, waterType (Sea | Freshwater), discipline, disciplineOther,
                                format, region, district, waterbody, meetingPoint, startsAt (timestamp), fee, limit,
                                clubId, status (draft | pending | published | rejected | cancelled), rejectionReason, reviewedBy, reviewedByName, reviewedAt, coverUrl, ownerId, ownerName,
                                createdAt, updatedAt, counts{accepted, waitlist} (added by Functions with registration)
events/{eventId}/registrations/{uid}          name, status, teamName, clubId, createdAt   (public)
events/{eventId}/registrationPrivate/{uid}    phone, email                                (owner, organiser, admin only)
events/{eventId}/evidence/{id}                userId, photoPath, species, speciesOther, status, weight, reason, reviewedBy
```
Contact details live in a separate private subcollection because Firestore rules cannot hide single fields on a document. Multi-filter catalog queries need composite indexes (`firestore.indexes.json`). Storage paths: `events/{eventId}/cover`, `clubs/{clubId}/cover`, `events/{eventId}/regulation.pdf`, `evidence/{eventId}/{uid}/{file}` with size and type limits.

## Implementation plan

**Phase 0 - Prototype (done).** Clickable React app with mock data: catalog with filters, event page with registration and waitlist, My page with evidence upload, organiser console, clubs, admin queue, mobile layout.

**Phase 1 - Foundation**
- [x] Switch `@vitejs/plugin-react` to v6 so a clean `npm ci` works with Vite 8.
- [x] Add `.env.example` and this README. (ESLint and Prettier still to do.)
- [x] Create the Firebase project and Hosting site (`fishing-league-nz`).
- [ ] Run the app against the emulators locally.
- *Done when:* a fresh clone installs, builds and runs against the emulators.

**Phase 2 - Auth and roles**
- [x] Google and email sign-in, password reset, sign-out.
- [x] `users` document on first sign-in; user management functions; route guards for Manage and Admin.
- *Done when:* each role sees the right menu and cannot open other roles' pages.

**Phase 3 - Events and catalog**
- [ ] Events in Firestore: organiser event builder with photo, drafts/published/cancelled, wider NZ regions and districts (built; to be verified live). Regulation PDF upload is still to do.
- [ ] Event page from live data; regulation download.
- *Done when:* the catalog and event page work for guests on desktop and phone.

**Phase 4 - Registration**
- [ ] `registerForEvent` and `cancelRegistration` with transactions; waitlist promotion trigger.
- [ ] Private contact details; public names-only list.
- [ ] Confirmation emails.
- *Done when:* two people racing for the last spot never both get it; cancelling promotes the next person.

**Phase 5 - Organiser tools**
- [ ] Event builder with regulation upload and Other options; draft, submit, publish.
- [ ] Applications table, status changes, bulk accept, CSV export.
- *Done when:* an approved organiser can run an event end to end.

**Phase 6 - Evidence and scoring**
- [ ] Photo upload to Storage; evidence queue; approve with weight/points, reject with reason.
- [ ] Scores and the Results tab.
- *Done when:* approved catches produce a correct ranking visible to everyone.

**Phase 7 - My page, clubs and admin**
- [ ] Clubs: create/edit with cover image, join/leave (Firestore + Storage).
- [ ] My page from live data, attendance confirmation, club membership.
- [ ] Admin moderation queue, user and role management, club management.

**Phase 8 - Notifications**
- [ ] Reminder schedule and attendance links; organiser alerts; evidence-reviewed emails.

**Phase 9 - Hardening and launch**
- [ ] Firestore and Storage rules with automated tests on the emulator.
- [ ] Accessibility pass, mobile QA, performance check.
- [ ] Privacy review, terms and privacy pages, custom domain, production deploy.

**Later:** reliability record, Excel/PDF export, team management, promote popular "Other" labels, public club pages.

### Testing
Vitest + Testing Library for components, Firebase emulator tests for rules and functions, a short Playwright smoke test of the main flows.

## Getting started
```
npm install
npm run dev        # http://localhost:5173
npm run build
```
Requires a current Node.js LTS (Vite needs Node 20.19+ or 22.12+). The prototype has a **Demo role** dropdown in the header to switch between Guest, Participant, Organiser and Admin. Data is in memory and resets on refresh.

## Firebase setup
- **Project ID:** `fishing-league-93bd0`. **Hosting site:** `fishing-league-nz` (https://fishing-league-nz.web.app).
- **Firestore:** Standard edition, locked mode, location `asia-southeast1` (Singapore). The location cannot be changed later.
- **Cloud Functions:** Node 22, region `asia-southeast1` (same region as Firestore). Requires the Blaze plan.
- **Authentication:** Google and Email/Password enabled; `fishing-league-nz.web.app` added under Authorized domains.
- **Config:** copy `.env.example` to `.env.local` and fill in the web app config from Project settings.
- **Deploy:**
```
npm run build
firebase deploy --only hosting
firebase deploy --only functions,firestore:rules
```
- **Superadmins:** the first one was created with a one-off function that has been removed. To add more, the person signs in once, then a superadmin sets their role on the Admin page.

## Secrets and configuration
- Copy `.env.example` to `.env.local` and fill in the Firebase web config. `.env.local` is git-ignored.
- Variables starting with `VITE_` are bundled into the browser, so they must never contain real secrets. The Firebase web config is not secret; access is protected by security rules.
- Real secrets (service-account keys, email provider key) are never committed. Use `firebase functions:secrets:set NAME` for Functions.
- If a secret is ever committed, revoke or rotate it immediately.

## Open decisions
- Exact scoring methods and tie-break rules.
- Club creation is open to organisers and above for now; add an approval step if abuse appears.
- Email provider (Firebase Trigger Email extension or a provider API) and the sender domain.
- Whether participants must be 18+ or need a guardian for juniors.
- Retention period for evidence photos and personal data.
