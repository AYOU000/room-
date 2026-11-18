# Live lobby integration

Open `/lobby`, also linked from the sample dashboard. The lobby uses authenticated API calls for create/join/read/update/ready/leave; it never substitutes sample rooms. The dashboard's existing cards remain explicitly sample data.

The authentication owner must call `setAuthSession({ userId, accessToken })` from `frontend/src/lib/auth-session.ts` on successful login and refresh, and `setAuthSession(null)` on logout. Tokens remain in memory. The backend validates the token independently. No login screen, credential storage, or browser token-pasting bypass is added. Until the account flow supplies a session, the lobby displays a sign-in requirement.

Both slots, connection status and readiness refresh every two seconds. Creator-only settings edits reset consent UI when settings change. Readiness requires explicit acknowledgement. Invite codes are kept in component memory only; reload cannot retrieve the one-time secret. Room IDs are preserved in the route query for reload. Guest departure releases the slot; creator departure cancels. This lobby covers admission and readiness only; audio preflight/start/live debate integration remains separate.

Backend create/join/update/ready routes and transactional two-account admission were already implemented. PostgreSQL room-row locks serialize join/start/leave/edit, with unique session/user and session/slot plus slot CHECK constraints. Existing service tests are not a substitute for a real PostgreSQL race test.
