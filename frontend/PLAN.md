# Frontend plan (Member 3)

Scope: everything the Room browser app must do per **Room SRS v1.0** and the **Team Roles** guide (Member 3 page).
Requirement IDs (FR-, SEC-, NFR-, AT-) refer to the SRS.

We work through the phases in order. A phase is done only when every box in it is checked and the
"Done when" line holds. Do not start the next phase early; if something blocks, note it under
**Blockers** and move to the next unblocked item inside the same phase.

## Working rules

- One branch per phase: `feat/frontend-<phase-name>`. Merge only with typecheck, tests and build green.
- Backend endpoints from Members 1, 2 and 4 may not exist yet. Build against **typed contracts plus mocks**
  (Phase 1), then switch each endpoint to the real backend as it lands. No UI waits on backend work.
- Contract changes are agreed with the owning member first (auth: 1, rooms/events/media: 2,
  transcript/results: 4, security policy: 5). Security-sensitive changes get Member 5 review.
- Security rules that apply to every phase:
  - Render all user, ASR and LLM text as plain React text. Never use `dangerouslySetInnerHTML`. (SEC-02)
  - Access token lives in memory only. Never put tokens in localStorage, URLs or logs. (SEC-04)
  - No secrets in `VITE_*` variables. (SEC-08)
  - Validate everything the app receives: API responses, WebSocket events and localStorage contents. (SEC-01)
- Accessibility rules that apply to every phase: works at 360 px width, fully keyboard-operable,
  visible focus, labelled controls, status never shown by color alone. (NFR-05)
- Pin every new dependency to an exact version.

## Phase 0: Foundation ✅

- [x] Pin dependencies; add Tailwind 4, React Router 8, Vitest, Testing Library
- [x] Theme tokens in `src/index.css`; split the prototype into shell, pages and components
- [x] Health check context; route and health tests
- [ ] Commit and merge `feat/frontend-foundation`

## Scope note (2026-11-07)

Member 3 owns **UI and UX only**: screens, components, states, accessibility and visual design.
Screens use typed view models plus clearly labelled sample data (`features/*/sampleData.ts`, a
"SAMPLE DATA" badge on screen). Whoever wires the backend replaces the sample data with real calls.
Data plumbing items below (API client, auth token store, event channel, cache module) need an
owner agreed with the team; they stay listed so nothing is lost.

## Dashboard (UI) ✅

- [x] `/dashboard` route, top bar link
- [x] Stat tiles: debates, completed, average score, time debating (stats are not in the SRS; confirm with team)
- [x] Start a debate: topic 5–200 with counter, optional description ≤2,000, duration slider 2–30 (default 10), invite code + copy
- [x] Join with invite code: empty, invalid, expired and full states
- [x] Recent debates: status as text badges, scores or evaluation state, ties shown as ties, empty state
- [x] Shared `Button`, `TextField`, `TextAreaField`, `CharCount` components; tests for validation, join errors, markup-as-text
- [ ] Link "Full history" once the history page exists; open waiting room after join/create once it exists

## Debate room (UI) ✅

- [x] `/room/:sessionId` route (preview at `/room/sample`), linked from a successful join on the dashboard
- [x] Header: topic, live/reconnecting state, server-driven countdown with progress bar, final-minute warning,
      screen-reader milestones only (FR-10)
- [x] Speaker cards: initials, speaking animation, muted, reconnecting, disconnected with grace countdown (FR-12)
- [x] Controls: mute with `aria-pressed`, microphone picker, end debate; blocked-microphone guidance (FR-09)
- [x] Live transcript: speaker labels, timestamps, provisional vs final, unknown speaker, overlapping speech,
      auto-scroll with "New text below", degraded warning, plain-text rendering (FR-14, FR-15, SEC-02)
- [x] End confirmation dialog: focus trap, Escape, focus return (FR-11)
- [x] Ended screen per end reason (timer, user end, disconnect, service failure); transcript UI cleared (FR-17)
- [x] Sample-data scenario switcher; tests for timer expiry, grace expiry, confirm/cancel, mute, blocked mic
- [ ] Link to result page once it exists; real wiring (LiveKit, event channel) by the integration owner

## Phase 1: Contracts, API client and mocks

- [ ] Add `zod`. Write schemas and types for every SRS page 8 endpoint and for the event envelope
      (`event_id`, `session_id`, `type`, `sequence`, `server_time`, payload) (INT-01, INT-02)
- [ ] Transcript segment schema (FR-14) and result schema (FR-21, FR-22, FR-24) from Member 4's contract
- [ ] `apiClient`: JSON only, `credentials: "include"`, CSRF header on mutations, response validation,
      typed errors mapped from 400/401/403/404/409/413/429/503 to user-facing messages (no internals shown)
- [ ] Mock backend with MSW for dev and tests, including a fake event stream
- [ ] `VITE_USE_MOCKS` switch so the app runs with no backend

Done when: the app runs on mocks alone, and tests cover client error mapping and schema rejection.

## Phase 2: Accounts (FR-01, FR-02, FR-03; SEC-04, SEC-05)

- [ ] Routes: `/register`, `/login`, protected layout that redirects guests
- [ ] Register form: email, display name (2–50), password (15–128; spaces and Unicode allowed, never trimmed);
      field errors from the server shown as text
- [ ] Login with a single generic failure message
- [ ] Auth store: access token in memory; one shared refresh request at a time (serialized refresh);
      on 401, refresh once and retry the request; restore the session on reload through refresh
- [ ] Logout: call API, clear memory state, notify other tabs (BroadcastChannel), run transcript cleanup hook
- [ ] Account-switch detection between tabs

Done when: AT-01 client steps pass against mocks (register, login, refresh, expired session, logout, replay rejected).

## Phase 3: Lobby and consent (FR-05, FR-06, FR-07)

- [ ] Create room: topic (5–200), optional description (≤2,000), duration 2–30 minutes, default 10
- [ ] Show and copy the invite code; join a room by invite code; clear messages for invalid, expired or full rooms
- [ ] Waiting room: both participants, readiness, creator-only topic and duration edits that reset readiness
- [ ] Consent panel before ready: topic, duration, AI limitations, local transcript storage and its cleanup
      limits (FR-18), external LLM processing, retained results
- [ ] Microphone check: device picker, level meter, permission-denied guidance
- [ ] Creator starts; leaving releases the slot; creator leaving cancels the room

Done when: two mock users go from create to ready to start, and a non-member sees 403/404.

## Phase 4: Live debate room (FR-09, FR-10, FR-11, FR-12, FR-13)

- [ ] Lazy-load `livekit-client` on the room route only (fixes the 864 kB bundle warning)
- [ ] Join with the token from `POST /sessions/:id/media-token`; microphone only; remove the old audio prototype
- [ ] Mute and unmute, device switching, per-speaker connection and speaking indicators
- [ ] Event channel client: authenticate, drop duplicate events, refetch state after a sequence gap, reconnect with backoff
- [ ] Timer from server time only: compute clock offset from `server_time`, stay within 1 s (NFR-04);
      changing the local clock or reloading never extends the debate
- [ ] Opponent-disconnected banner with the 60 s grace countdown; reconnect restores state
- [ ] End-debate confirmation; finish is safe to call twice; media stops on end
- [ ] States for permission denied, reconnecting, media/ASR/LLM outage (NFR-06)

Done when: AT-03 and AT-04 client steps pass (mocked clock tampering, reload, double finish, disconnect).

## Phase 5: Live transcript and browser cache (FR-14 – FR-18)

- [ ] Transcript view: segments by speaker, provisional vs final, revisions replace text, unknown or overlapping speech marked
- [ ] Cache module: key `room:v1:<userId>:<sessionId>`, expiry at session end plus 5 minutes,
      1 MiB per session, 4,000 characters per segment
- [ ] Restore only after checking owner, expiry, schema and server session state; delete anything invalid
- [ ] Quota errors or disabled storage: show a degraded-transcription warning and stop caching without crashing
- [ ] Cleanup on finish, cancel, logout and account switch; cross-tab cleanup; sweep stale keys on startup before rendering

Done when: AT-06 client steps pass (end, cancel, logout, second tab, reload with stale cache, blocked storage,
poisoned cache entries).

## Phase 6: Results and history (FR-08, FR-21 – FR-25)

- [ ] Result page states: pending, processing, completed, failed, unavailable; incomplete capture shown honestly
- [ ] Four 0–25 subscores per participant, server total, feedback, clear "AI assessment, not proof" notice
- [ ] Claim checks: supported, contradicted, mixed or insufficient-evidence labels as text; source title, link
      (`rel="noopener noreferrer"`) and access time; "verification unavailable" state
- [ ] History: paginated list with topic, date, duration, participants, status and result state

Done when: AT-07 client steps pass on mocked results, including invalid and unavailable results.

## Phase 7: Hardening and release evidence (NFR-05; AT-09, AT-10)

- [ ] Playwright end-to-end: two browser profiles, full journey from account to history
- [ ] XSS-like strings everywhere text is shown; localStorage poisoning; keyboard-only journey; 360 px layouts
- [ ] Error boundaries per route; code-splitting per route
- [ ] Check that the app works under Member 5's CSP; decide whether to self-host the fonts
- [ ] Test on named versions of Chrome and Firefox (desktop) and Safari on iOS; record them
- [ ] Hand Member 5 the routes and storage behavior for attack testing

Done when: the client parts of AT-03, AT-05, AT-06, AT-07, AT-09 and AT-10 have recorded results.

## Open questions for the team

1. WebSocket auth: how does the socket authenticate? Tokens must not go in the URL (SEC-04). (Members 2 and 5)
2. CSRF token: how is it delivered (cookie or endpoint) and which header name? (Members 1 and 5)
3. Refresh cookie path, and does `/auth/refresh` return the user profile? (Member 1)
4. Exact transcript event and result field names. (Member 4)
5. Which browser versions to test, and which debate language(s)? (team)

## Blockers

None yet.
