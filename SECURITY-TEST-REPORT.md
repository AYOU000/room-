# Security and acceptance test report

Member 5 • 6 November 2026 • baseline `2d25d68` • branch `member-5/security-devops-main-layout`.

Evidence uses synthetic credentials, requests and metadata. Exact counts/outcomes are recorded in `security-evidence.json`. Common-control tests and healthy core services do not certify the missing account/room/transcript/AI product flow.

| Test | Evidence / observed result | State and next owner |
| --- | --- | --- |
| AT-01 Accounts | Media JWT signature/expiry and CSRF helper tests; no account/refresh implementation exists | BLOCKED: 1 implements Argon2id, cookie/JWT verification, atomic rotation/replay/family revocation and logout; 5 independently reviews |
| AT-02 Admission | Missing authorizer denies tokens; trusted returned identity/room override browser choices; 401/403/409 preserved | PARTIAL: 1/2 integrate real membership and two-human transactional admission, history/events |
| AT-03 Audio | Microphone-only grant claims; authenticated local LiveKit create/list/delete smoke | PARTIAL: 2/3 test actual microphone, camera/screen rejection, permission denial and two-network audio |
| AT-04 Timing/finish | No authoritative room timer/state controller | BLOCKED: 2 tests tampering/reload/grace/idempotent finish/active shutdown |
| AT-05 Transcript identity | No project-owned ASR adapter or transcript pipeline | BLOCKED: 4 with 2/3 tests authenticated attribution, revisions and tamper-resistant official input |
| AT-06 Deletion | Synthetic body/query/auth/cookie markers absent from core service logs; no new speech persistence | PARTIAL: 3/4 with 5 test actual cache/cross-tab/server-memory terminal purge and SQL/log/volume absence |
| AT-07 AI/evidence | Security contracts supplied; no provider/AI/retrieval feature | BLOCKED: 4 with 1/3/5 tests score/ID/citation validation, prompt injection and SSRF boundaries |
| AT-08 Outages | Missing provider credentials/authorizer and unexpected exceptions fail safely | PARTIAL: 2/4 test ASR/LLM/retrieval timeouts/retry caps/restart-unavailable/purge |
| AT-09 Input attacks | Real-HTTP local suite covers SQL/XSS-like/extra fields, JSON/type/size errors, origins, proxy spoofing, limits, safe errors/logs and CSRF/event helpers | PARTIAL: 1–4/5 add actual refresh replay, cross-room access, WS, cache poisoning and retrieval tests at their feature boundaries |
| AT-10 Operations | Clean synthetic PostgreSQL volume; native Prisma migration completed; API/frontend/LiveKit/PostgreSQL healthy; proxy/privacy/media smokes; synthetic dump→separate-db restore and restricted-role assertions | PARTIAL: core operations pass; 4 supplies tested ASR/model/adapter, 2/3 prove public media/browser/accessibility, team measures NFR load/latency |

## Reproduce

```bash
bash backend/scripts/ci.sh checks
# Disposable runner only:
bash backend/scripts/ci.sh integration
```

The first command performs source/layout/secret scans, isolated frozen installs, source/test type checks, feature/security tests, both builds and audits. It keeps main's tracked dependency tree unchanged. The second requires Docker and empty synthetic deployment state. No hosted pipeline run is asserted; the user explicitly requested the existing folder layout and a script instead of `.github/workflows`.

Core deployment was checked on separate local ports/project/subnet alongside existing services. A temporary validation-only override selected built images and supplied managed CA trust to native migration; it changed no application policy, skipped no dependency/migration and was not added to the source tree. The initial disk-capacity failure was resolved by removing unused build cache. Existing services and database volumes were preserved.

Observed environment: Linux amd64, host Node 24.19.0/npm 11.9.0, Docker Engine 28.4.0/Compose 2.40.3. Image Node 22, PostgreSQL 16 and LiveKit 1.13.11 are pinned by digest. No real audio, external provider, public certificate, browser matrix, ASR model or capacity benchmark was exercised.

Before release every AT-01–10 row needs owner-provided, build-specific evidence. Critical/high triage items and all missing security features must be resolved; no unrun test is presented as passing.
