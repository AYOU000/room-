# Room threat model

Member 5 baseline • 30 October 2026 • SRS v1.0 and TEAM v1.0 (25 October 2026).

## Assets and boundaries

Protect account credentials, refresh families, room membership, microphone tracks, active transcripts, derived results, provider credentials and durable PostgreSQL metadata. The browser, its clock/storage, client-selected IDs, ASR segments, model output and retrieval pages are untrusted. A room name is not authorization.

Boundaries: browser → HTTPS/API; browser → WSS/LiveKit; verified media → Member 4 adapter → private ASR; server memory → approved LLM/retrieval providers; validated results → parameterized database writes; operator → restricted deployment secrets/backups. Do not forward unverified user text as an instruction to privileged tools.

| Threat | Required defense | Owner | Current evidence / remaining work |
| --- | --- | --- | --- |
| Account takeover / enumeration | Argon2id ≥19 MiB, t=2, p=1; generic login failure; IP and account backoff | 1, review 5 | Shared strict schema and IP limiter tested; account endpoints absent |
| Access-token forgery / refresh replay | Verify algorithm, signature, issuer, audience, expiry; atomic refresh-family rotation/revocation | 1, review 5 | No identity implementation to review; release blocker |
| Cross-room access / identity substitution | Authenticate, authorize active membership/consent, derive grant identity on server | 2 with 1 | Default media path fails closed; injected authorizer denial and identity binding tested; real membership absent |
| Camera/screen/data escalation | Short-lived room-scoped microphone-only grants; close active media on finish | 2 with 5 | Grant restrictions and 5-minute TTL tested; actual terminal shutdown awaits state machine |
| XSS / localStorage poisoning | Strict parsing; React text; CSP; validate cache owner/state/expiry before rendering | 3 with 5 | No raw HTML API errors; CSP shipped; cache feature absent |
| SQL injection / mass assignment | Strict unknown-field rejection; bound SQL/Prisma; DB constraints | 1,2 with 5 | Attack strings/extra fields rejected on token route; database query paths absent |
| CSRF / hostile browser origin | Exact Origin allowlist; synchronizer token bound to refresh session; protected cookies | 1 with 5 | CORS/Origin and CSRF helper tested; no cookie endpoint exists yet |
| WebSocket abuse / replay | Origin+auth on upgrade; 16 KiB frames; per-connection limits; sequence/dedup/membership | 2 with 5 | Bounded frame parser tested; no WS server yet |
| Transcript leakage / forged official input | No audio/transcript logs, SQL, disk queues or volumes; bounded memory; browser cleanup and cross-tab expiry | 3,4 with 5 | API log redaction tested; no transcript implementation to certify |
| Prompt injection / fabricated citations | Delimit untrusted text; no model tools/DB write; strict scores/IDs; cite only retrieved evidence | 4 with 5 | Architecture review only; no AI provider/adapter exists |
| SSRF / unsafe retrieval | Approved provider only; HTTPS allowlist; reject private/link-local/loopback; DNS and redirect revalidation; egress firewall | 4 with 5 | No arbitrary URL fetch endpoint added; feature and network enforcement pending |
| Exposed keys / supply-chain compromise | Server-only secrets; frozen lockfiles/digest pins; scans; rotate previous keys | 5, operators | Current source scans and npm audits pass; historical key rotation unverified |
| DoS / proxy spoofing | Bounded bodies/counters, trusted individual proxy IP, timeouts, safe 429 | 5, feature owners | 16 KiB JSON and limiter/spoof tests pass; account/login-specific policies pending |
| Backup / operator exposure | Least-privilege API DB role; encrypted restricted backups; exclude transient data; tested restore | 5 with 1 | Synthetic restore and role assertions pass; production encryption/retention remain deployment decisions |

## Design decisions and limits

- Only one API instance is supported by the in-memory limiter. Scaling requires an atomic shared store. Counter resets during restart are not account/session revocation.
- `ENABLE_DEV_MEDIA_TOKENS=false` is the default. Explicit local demo mode has no membership or two-person guarantee; production rejects the flag entirely.
- The `authorizeMedia` integration point is not authentication. Members 1/2 must verify tokens, account/session membership, consent and state before returning a room/identity. Tests using a stub do not establish real access-control completion.
- The transcription profile is an isolated CPU runtime scaffold. It has no project-owned LiveKit adapter or reviewed model/dependency bundle. It must not be represented as functioning transcription.
- Browser storage deletion cannot be guaranteed while a browser is closed/offline. Reconcile and purge before rendering on next startup; disclose the external provider's separate retention policy.
- Auth, rooms, history, transcript, AI and public deployment remain blocked release gates. Member 5 security coordination does not transfer feature ownership.
