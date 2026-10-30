# Security control matrix

Sources: SRS pages 8–11; TEAM page 6. Status describes this implementation, not product certification.

| Requirement | Common control delivered | Feature integration / owner | Evidence |
| --- | --- | --- | --- |
| INT-01, SEC-01 | Strict Zod schemas; JSON-only 16 KiB boundary; no compressed requests; bounded frame parser; stable errors and request IDs | Members 1–4 must validate every new body/param/query/cookie/event/cache/provider response | `backend/tests/security.test.ts`; API and proxy smoke checks |
| SEC-02 | No reflected raw error input; React error text; CSP; least-privilege DB application role | 1 parameterized SQL; 3 all user/model text as React text; 4 no model execution | Attack-input tests pass for existing endpoint; absent modules unreviewed |
| SEC-03 | Password-preserving registration schema and logging prohibition | 1 implements Argon2id salts/hashing and benchmarks host | Password byte preservation tested; hashing absent |
| SEC-04 | Short-lived microphone-only media grants; no token response caching | 1 access-JWT validation and refresh cookies/rotation; 2 verified session authorizer and active revocation | Signed grant tests; auth/refresh/replay blocked |
| SEC-05 | Exact CORS/Origin; CSRF synchronizer helper; HSTS/CSP; TLS/WSS proxy profile | 1 binds CSRF token to session; 2 WS Origin; operator configures DNS/certs | Origin+CSRF helper tests; Caddy configuration validation; real HTTPS unrun |
| SEC-06 | 60 requests/IP/15 min (health exempt); Retry-After; bounded 10,000-key store; no forwarded-address trust except fixed proxy | 1 five failed logins/account/15 min plus backoff; 2 ten room creates/account/hour; 4 one active evaluation/session | Limit/expiry/saturation/spoof tests; account-specific policies absent |
| SEC-07 | ASR private profile; no arbitrary fetch API; retrieval/AI guardrails in handoff | 4 provider allowlist, SSRF protection, citation provenance, strict output; operator egress | Architecture only; no runtime SSRF/prompt-injection claim |
| SEC-08 | Generated ignored credentials; separate DB roles; exact npm versions, normalized official registry, integrity-preserving lockfiles; digest pins; CI secret/audit gates | Operator rotates old committed credentials; 4 completes inference dependency/model lock | Current-source scans clean; npm audit zero; history rotation open |
| OPS-01 | Multi-stage non-root API/frontend; health checks; migration dependency; database volume; optional private WhisperLiveKit profile | 4 supplies authenticated audio/ASR adapter and tested model runtime | Images built; four runtime services healthy; full Prisma path externally blocked |
| OPS-02 | Default loopback exposure; private DB/ASR; Caddy HTTPS/WSS; media-port/TURN runbook | 2,3 and operator prove two-network calls and ICE/TURN | Proxy smoke pass; public network audio unrun |
| OPS-03 | Metadata-only API logs; bounded Docker log files; backup/restore scripts; incident/restart procedures | 1,2,4 implement state reconciliation and unavailable evaluation on lost buffer | Synthetic backup/restore pass; feature restart recovery blocked |
| NFR-07 | No added transcript persistence; API sensitive-input redaction tests; inspection checklist | 3,4 implement lifecycle and provide marker/purge evidence | API log marker absent; full SQL/log/volume/cache deletion unrun |

The SRS numeric values remain proposed defaults. Feature owners must review contracts before integration. No critical/high issue may be accepted silently for release.
