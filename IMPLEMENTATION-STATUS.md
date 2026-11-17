# Room contract implementation

The four requested lifecycle/interface/admission/protocol requirements are represented in code and documented in ROOM-TIMER-MEDIA-CONTRACTS.md section 12.

Added durable disconnect deadlines and event sequence numbers, terminal cleanup retries, authenticated audio preflight, current LiveKit observation checks, strict snapshot/event schemas, heartbeat and periodic subscription authorization checks. No solo/open phase exists.

Deployment needs migration 20261117120000_session_runtime, AUTH_ISSUER/AUTH_AUDIENCE/AUTH_JWKS_URL for RS256/ES256 access tokens with existing user UUID subjects, and LiveKit credentials plus LIVEKIT_INTERNAL_URL. This implementation does not add registration or login. Run one controller process.

The demo frontend is not the real session flow. Its replacement, ASR capture/drain and evaluation adapters remain separate integration tasks. With no capture adapter, evaluation is explicitly unavailable. Microphone readiness is browser-reported capability combined with server-observed LiveKit connectivity, not proof of audible speech.

Validation: backend typecheck and automated tests; no live PostgreSQL, LiveKit, or two-browser acceptance run was available in this workspace. Do not treat unit tests as production certification. Keep the PR in draft until live acceptance testing and the consuming client integration are complete.
