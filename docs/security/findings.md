# Findings register

Assessment date: 30 October 2026. Scope: current repository and local synthetic test environment. Severity is a project triage judgment, not a CVSS calculation. Never copy credential values into this register.

| ID | Severity | Finding / owner | Fix or disposition | Retest / release state |
| --- | --- | --- | --- | --- |
| F-01 | Critical | Anonymous browser-selected identity/room could mint media credentials; 2 with 1/5 | Default denies issuance unless verified authorizer is supplied; dev demo explicitly opt-in and prohibited in production | Default 503, 401/403/409 integration-denial tests and verified identity tests pass; real auth/membership remains a release blocker |
| F-02 | High | Media grant allowed camera/screen/data; 2/5 | Restrict sources to microphone, no publish data/admin/record/metadata update, 5-minute TTL | Signed JWT checks pass; terminal media revocation still owned by 2 |
| F-03 | High | Static development DB/LiveKit credentials existed in Git; 5/operator | Remove literals from current templates; generate random ignored local credentials; scan current source | Current source clean; repository history still contains prior values. Rotate/revoke anywhere reused; operator confirmation pending. Do not rewrite shared history automatically |
| F-04 | High | deepmerge-ts stack-exhaustion advisory GHSA-ggr8-5vv4-36mx via Prisma; 5 with 1 | Exact override to deepmerge-ts 8.0.2, retain Prisma 6 to avoid unreviewed ORM-major migration | npm audit now zero; configuration merge/cycle/Prisma defineConfig tests pass. Full engine-backed migration remains blocked by environment network policy |
| F-05 | Medium | Unknown fields, loose parsing and inconsistent internal errors; 5 | Strict schemas, size/type/encoding gates, redacted common envelope and new server request ID | Input/JSON/oversize/type/error tests pass; frontend consumes safe message |
| F-06 | Medium | Missing abuse limits and client-IP trust policy; 5, future 1/2/4 | Bounded IP limiter, Retry-After, trusted proxy address, HTTP timeouts | Spoofing/expiry/saturation tests pass; account limits and distributed state still pending |
| F-07 | High | Required identity, state, cache, ASR and AI security features absent; 1–4, review 5 | Do not ship public debate flow; explicit integration contracts and AT evidence matrix | AT-01–08 blocked/partial as recorded; no false end-to-end pass |
| F-08 | Medium | Docker builds depended on tracked Windows node_modules and mirror URLs; 5 | Remove generated dependencies from Git, frozen official-registry locks, pinned versions/base-image digests, Linux non-root builds | Frozen installation and container builds pass |
| F-09 | External blocker | Prisma checksum/artifact host denied in current cloud policy; environment operator | Allow binaries.prisma.sh using environment settings; keep TLS/checksum validation enabled | Retried with OpenSSL 3 and managed CA; 403 persists. Native Prisma migrate/generate and clean default Compose start not validated |
| F-10 | Release gate | WhisperLiveKit/model/provider selection and adapter unavailable; 4 with 5 | Private optional runtime scaffold only; approve model hash, resource sizing, full transitive lock and provider retention before use | No ASR/LLM/media-quality/load claim; optional profile not built/run |

The full user journey is not release-ready. Before public launch close F-01/F-03/F-07/F-10 integration gates and F-09 environment blocker, run AT-01–10, and attach new evidence. A local fail-closed prototype does not establish production authorization.
