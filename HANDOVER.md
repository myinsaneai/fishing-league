# Fishing League: handover for a new working session

Read this file and `README.md` first. The README holds the requirements, data model and phase plan. This file holds everything else: decisions, how we work, how the code is laid out, traps already hit, and what is next. The repo is the source of truth, so clone it instead of asking for files to be pasted.

## 1. Snapshot (as of the "Registration" commit, `c33dba6`)
- **What:** website for fishing competitions in New Zealand. English only, mobile-friendly. Roles: guest, participant, organiser, admin, superadmin.
- **Repo:** https://github.com/myinsaneai/fishing-league (public). Local path on the developer's machine: `C:\React\fishing-league` (Windows, PowerShell, VS Code).
- **Live:** https://fishing-league-nz.web.app (Firebase Hosting site `fishing-league-nz`). The old default address `fishing-league-93bd0.web.app` still exists.
- **Firebase project:** `fishing-league-93bd0`, Blaze plan. **Firestore is in `nam5` (US) and cannot be moved.** Cloud Functions run in **`us-central1`** (next to Firestore). `REGION` in `functions/index.js` and the region in `src/firebase.js` must always agree. The app does not use the Realtime Database.
- **People:** the developer (Alexei) speaks Russian but wants **English for technical discussion**. A client reviews each step and asks for changes through him. The client's own spec was in Russian and has been translated into the README requirements. Russian-specific terms (ranks, "mormyshka") were rejected: NZ context only.
- **Design:** the "Console" look (dark green `#17352A` header, primary `#2F6B52`, background `#F2F4F3`, accent `#7FD1A8`, IBM Plex Sans). Design prototypes live on a private Claude design canvas: https://claude.ai/artifact/AHjuyjmUhhug4DLEuUMbqg (only the developer can open it). The code is now the design reference.

## 2. How we work (please keep doing this)
1. The assistant builds changes in a clone of the repo, runs `npm test`, the build and `npm audit`, and delivers a **zip of only the changed files** plus a short summary.
2. The developer unzips over the project (overwriting), runs `npm test`, deploys (`firebase deploy --only ...`), tests on a phone, then commits and pushes.
3. The assistant then **verifies the pushed commit on a fresh `git clone`**: files identical to what was sent, clean `npm ci`, build, tests, audit, no secrets tracked.
4. Style: concise English, plain words, commands for **PowerShell**, at most one question per reply, state assumptions instead of asking when a sensible default exists. Mention anything not verified live (rules, email, schedulers).
5. Earlier mix-ups came from a zip saved in the wrong place. When something "doesn't change", check the file on disk (`Select-String -Path ... -Pattern ...`) before debugging.

**Saving tokens in a new session:** do not print or rewrite whole files. Use `git clone`, `grep`, and small targeted edits (Python `str.replace` with an assert that the old text exists). Re-use the test helpers already in `tests/`. Do not repeat the README back.

## 3. Stack
- Frontend: React 18, Vite 8, React Router 7, Firebase web SDK 13, plain CSS in `src/styles.css`. No UI library.
- Functions: Node 22, `firebase-admin` 14 (**modular API only**: `getAuth()`, `getFirestore()`; `admin.auth()` no longer exists), `firebase-functions` 7 (v2 style).
- Tests: Vitest 5 + jsdom + Testing Library (`npm test`), and `node --test` for functions (`cd functions && npm test`). Currently 148 app tests and 25 function tests, all passing. `npm audit` is clean (an `overrides` entry pins `@grpc/grpc-js`).
- Env: `.env.local` holds `VITE_FIREBASE_*` and optional `VITE_MAPS_EMBED_KEY`. Anything `VITE_` is public. Real secrets only ever go in Functions.

## 4. Repo map
`src/`
- `main.jsx` (provider order: Placeholders > Auth > Clubs > Events > Registrations > App), `App.jsx` (header, routes, guards), `store.jsx` (user, demo role switcher, club joining, **evidence demo**), `auth.jsx`, `SignIn.jsx`, `Modal.jsx`.
- Data providers: `eventsStore.jsx`, `clubsStore.jsx`, `registrations.jsx` (my registrations + per-event lists), `placeholders.jsx`.
- Screens: `pages.jsx` (Catalog, EventPage, MyPage, Manage, Admin tabs), `events.jsx` (event form), `clubs.jsx` (list, page, form), `approvals.jsx`, `cleanup.jsx` (Admin → Clubs & events: delete for good), `deletion.jsx` (the confirmation dialog, also used by the Users sheet), `roles.jsx` (admin Users sheet), `placeholderSettings.jsx`, `avatarEditor.jsx`.
- Evidence: `evidence.jsx` (hooks `useMyEvidence`, `useEventEvidence`, `sendEvidence`, `reviewEvidence`, `EvidencePhoto`, `PhotoLocation`, `EvidenceDrop` = the drop area on My page, which reads the GPS before shrinking), `exif.js` (reads GPS from the original photo; used by My page before `toPhoto`).
- Helpers: `data.js` (regions, districts, statuses, date formatting), `time.js` (New Zealand clock), `maps.jsx`, `imageTools.js` + `ImageDrop.jsx` (photo pipeline), `Cover.jsx`, `Avatar.jsx`, `Status.jsx`, `ErrorBoundary.jsx`, `moderation.js`.

`functions/`: `index.js` (exports), `users.js` (listUsers, updateUser), `registration.js` (registerForEvent, cancelRegistration, confirmAttendance, setRegistrationStatus, fillSpots, remind), `evidence.js` (submitEvidence, reviewEvidence), `deletion.js` (deleteEvent, deleteClub, deleteUser), `emails.js`. Also `onEventUpdated` (trigger) and `sendReminders` (daily 08:00 NZ).

Root: `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc`, `tests/` (14 files), `README.md`.

Routes: `/`, `/event/new`, `/event/:id`, `/event/:id/edit`, `/clubs`, `/clubs/new`, `/clubs/:id`, `/clubs/:id/edit`, `/me`, `/manage`, `/admin`.

## 5. What is built (details are in the README)
Google and email sign-in; roles via custom claims; superadmin bootstrap (done, removed); admin Users sheet (role, enable/disable, delete); permanent deletion of clubs, events and users with their data and pictures (Admin → Clubs & events, Users); clubs and events with photos, Google Maps location, Sea/Freshwater type (required, no "Other"), Tournament/Seminar type, start and end on a NZ clock, wider NZ regions and districts, approvals (pending, approved, rejected) with an Approvals tab, superadmin-managed placeholder pictures, own profile picture, basic/advanced event search with a separate Create event button, photo handling (15 MB in, resized JPEG out), real registration with spots limit, waitlist and server-checked closing time, organiser applications table with contacts and CSV, My page with confirm/cancel and reliability line.

## 6. Decisions already made
- Clubs and events start **pending** and need an admin/superadmin to approve; admin-created items are auto-approved; owner edits to approved items keep them live. Legacy clubs without a status are approved from the Approvals tab.
- "Other" exists for discipline, species, waterbody, scoring method, division and reasons. **Not** for fishing type, status, format, role, region. Club membership uses "Independent".
- Deleting is permanent and cascades (see README, "Deleting data"). It only happens through the delete functions, behind a dry-run preview and a typed DELETE. Do not add `deleteDoc` calls in the browser for clubs or events: the rules refuse admins, and a raw delete would orphan registrations, evidence and pictures. A user who owns events or clubs is deleted only together with them.
- Public participant list = names (plus team and club). Phone and email are private (organiser, admins, the person).
- Registration: account required; closes when the event starts, or when it ends if the organiser chooses; cancelling allowed until the start; the browser never writes registrations (functions only).
- Emails go to the `mail` collection and are sent by the Firebase **Trigger Email from Firestore** extension (SMTP). **Not yet installed.** No Telegram.
- Facebook and Microsoft sign-in were discussed and **deferred**.
- Times are always on a New Zealand clock. Photos: covers 16:9 up to 1280x720, avatars square up to 512x512, full photos up to 4 MP, all JPEG, Storage rules cap uploads at 2 MB as a safety net.

## 7. Traps already hit (do not repeat)
- **Never define a component inside another component.** It remounts on every render and inputs lose focus after each keystroke. Use module-level helpers like `Field`.
- Adding a field to clubs or events means touching **five places**: the form's `blank`/`from...`/`to...Data`, `validate...`, the rules' `hasOnly` list and validation, the README data model, and tests. A script that compares written keys to the rules' allow-list caught a missing field once.
- Firestore rules cannot hide single fields, hence the separate private registration record. Rules `get()` costs a read.
- The assistant's container shell is `sh`, not bash: no brace expansion or `<( )`.
- Appending to a file without a trailing newline glued a comment onto `.env.example` once.
- Custom-claim role changes reach a person's token within an hour (or at next sign-in).
- First deploy of a Firestore trigger can fail with an Eventarc permission message; wait a few minutes and redeploy.
- Google sign-in is blocked inside Messenger/Facebook in-app browsers: the sign-in sheet explains this.

## 8. Not verified live
Deletion (added later): `db.recursiveDelete`, Storage `getFiles`/`deleteFiles` from the functions, the 300 s timeout and the waitlist promotion after a user is deleted have only run against fakes. Try it first on a throw-away club, event and user (with a photo and a registration), then check in the console that the Firestore documents, the Storage folders and the Authentication entry are really gone.

Evidence (added after the snapshot above): `submitEvidence` reads the stored file with the Admin SDK (`getStorage().bucket()`), the new Storage rule uses a cross-service `firestore.get` on the registration, and the Firestore evidence rule is used by queries filtered on `userId`; none of this has run against real Firebase yet. Whether a phone includes GPS when a photo is picked in a browser depends on the phone (iPhone: Options → Location; many Android browsers strip it), so test with real photos.

No Firebase emulator has ever been run, so **Firestore and Storage rules are only checked by reading and by key cross-checks**, not by rules tests. Also unverified live: email sending (extension not installed), the daily reminder, the event trigger, and the Google Maps keyless embed. Consider adding emulator-based rules tests (needs Java and the emulator download).

## 9. Next steps
1. **Evidence photos: built** (real upload, organiser review, photo location link). **Scoring still to do:** the Scores tab only sums approved weights per person; the public Results tab, the scoring-method choice (total weight, biggest fish, number of fish, manual points) and tie-breaks need a decision. Smaller evidence follow-ups: email the person when a photo is reviewed, photo time vs event time check, a way to withdraw a photo, clean-up of uploads whose record was never made.
2. Install the email extension and test the emails; add emails for approve/reject.
3. Regulation PDF/Doc upload for events (the button was removed until built).
4. Admin Users sheet and others: pagination if lists grow (users list is capped at 5000; all events load at once).
5. Smaller: Excel/PDF export, team member management, club co-admins and member counts, privacy and terms pages, custom domain, accessibility and mobile QA pass, Facebook/Microsoft sign-in, rules tests with the emulator.
6. README tidy-up: two `### Registration` headings, and the phase checklist is partly out of date.

## 10. Starter prompt for the new thread
> Continue the Fishing League project (React + Vite + Firebase, NZ fishing competitions). Repo: https://github.com/myinsaneai/fishing-league (public). First clone it and read `README.md` and `HANDOVER.md`; do not ask me to paste files. Follow the working agreement in section 2 of HANDOVER.md (zip of changed files, tests, then verify my commit on a fresh clone). Keep replies concise and avoid reprinting large files. First task: <describe it>. 
