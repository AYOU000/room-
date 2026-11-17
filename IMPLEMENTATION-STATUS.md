# Room lifecycle implementation status

This branch is a draft and is not ready for deployment.

Added membership-gated room reads, creator cancellation, trusted end-reason transitions, finalization transition, JWT verification via configured HTTPS JWKS, session media grants, a server-only ASR grant helper, reconciliation, and snake_case WebSocket envelopes.

Configure AUTH_ISSUER, AUTH_AUDIENCE and AUTH_JWKS_URL for an identity provider issuing RS256/ES256 tokens whose subject is the existing users table UUID. Accounts must already exist; this change does not provision users. Set LIVEKIT_INTERNAL_URL to the backend-accessible LiveKit HTTP service. Existing LiveKit credentials and public URL configuration also apply.

WebSocket clients connect to /api/events and send one initial JSON message with authorization (Bearer token) and session_id. Do not put credentials in URLs. Event payloads contain room snapshots. The demo frontend is not wired to this protocol yet.

## Remaining acceptance work

- Persist disconnect deadlines and event sequences across restarts; current maps are process-local, so run no production workload on this draft.
- Add heartbeat, subscription token-expiry handling, and connection quotas.
- Verify usable microphone capability during preflight, beyond LiveKit participant presence.
- Wire the real frontend to authentication, consent, ready/start/finish, media tokens and events; the existing debate page remains sample data.
- Integrate ASR start/stop and bounded transcript drain. Until that exists finalization marks evaluation unavailable.
- Add database concurrency tests, LiveKit integration tests, and restart recovery tests. Current passing route tests use mocked services and do not validate real PostgreSQL transitions.
- Reconcile cancellation/media cleanup retries and stale tokens against terminal room state.

## Validation

Backend typecheck passes. Backend test suite: 64 tests passed. No live PostgreSQL/LiveKit or browser end-to-end run performed.
