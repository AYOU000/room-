# Member 5 delivery report

6 November 2026 • Branch `member-5/security-devops-main-layout` • main baseline `2d25d68`.

The supplied SRS v1.0 and TEAM v1.0 (25 October 2026) assign Member 5 security coordination, shared controls, operations and security evidence. This replacement retains main's complete folder set and all 2,216 original file paths, including unchanged tracked Windows dependencies. The useful common-control work from `member-5/security-devops` was adapted into the existing folders; its directory additions and dependency deletions were not carried over.

## Delivered

- Flat `backend/src/security-*.ts` helpers: strict schemas, JSON/encoding/size gates, stable safe errors, generated request IDs, content-free audit records, exact origins/CORS, session-bound CSRF helper, bounded rate limits, explicit proxy trust, HTTP timeouts and secure production configuration validation.
- Media issuance fails closed pending Members 1/2's verified authorizer. Server-owned identity/room values replace browser choices; grants are microphone-only, room-scoped and five minutes, without data/admin/record/metadata-update rights. Local demo is opt-in and rejected in production.
- Multi-stage non-root API/static frontend, explicit health/dependency ordering, native migration job with only required database credentials, separate restricted runtime database identity, private data/ASR networks, loopback defaults, configurable media ports/subnet, frame isolation and optional HTTPS/WSS proxy.
- Context-local Docker ignore rules, pinned direct dependencies/lockfiles and core image digests, source/dependency scanning and checked Gitleaks. The existing tracked vendor tree is kept unchanged but never used for container or CI dependency installation.
- `backend/scripts/ci.sh` is the requested runner-neutral CI pipeline. It runs checks in a disposable copy and optionally adds Docker integration. No `.github/workflows` folder or hosted run is asserted.
- Threat model, SEC/OPS control matrix, validation/error handoff, security/acceptance report, findings/release register, secret generation, backup/restore, media/privacy smoke checks and incident/runbook documentation. Optional Python/FFmpeg/WhisperLiveKit runtime scaffold is private; Member 4 still owns its actual adapter/model bundle.

## Validation

The final local check suite passed **54/54 tests**, backend source/test and frontend type checks, both builds, source/Gitleaks scans and both npm audits (**zero reported vulnerabilities**). The frontend build emits a bundle-size warning.

Both core images built with TLS verification and an ephemeral managed CA. A separate local Compose project with a fresh synthetic database volume completed native Prisma migration and brought PostgreSQL, LiveKit, API and frontend to healthy state. Proxy attacks/headers, content-free logs, authenticated synthetic LiveKit management, separate-database backup/restore and restricted application-role checks passed. Caddy configuration validated without external network access. A CA-only/image-selection validation override was used; migration dependencies and security policy were not bypassed.

Initial Docker disk exhaustion was resolved by removing unused build cache. Existing services and database volumes were preserved. Later configuration changes were syntax/layout checked; test payloads and backup rows were synthetic. See [machine evidence](security-evidence.json) and [AT matrix](SECURITY-TEST-REPORT.md).

## Integration and release gates

Member 1 retains accounts, Argon2id, JWT/cookies, atomic refresh-family replay/revocation, private history and complete schema. Member 2 retains actual authenticated membership/admission, readiness/state/timer/event channel and active media shutdown. Member 3 retains consent, complete UI and transcript-cache/cross-tab lifecycle. Member 4 retains the LiveKit→ASR adapter, authenticated speaker mapping, bounded canonical memory/purge, provider/AI/retrieval validation and model/dependency review. Member 5 independently reviews these implementations when available; current helpers and stub-authorizer tests do not complete them.

Real browser audio/TURN, public DNS/certificates, ASR/model/provider behavior, transcript deletion, refresh replay, prompt/SSRF end-to-end checks, load/latency and accessibility remain explicitly unrun or blocked by missing features. Operators must rotate/revoke any historical example keys reused elsewhere. This is an evidenced common security/operations baseline, not approval to launch the full product.

## Layout and delivery

`backend/scripts/check-layout.py` enforces the exact main folder set, retention of every original path and no edits/additions under the original dependency tree. New tests/scripts stay in `backend/scripts`; helpers stay in `backend/src`; deployment files stay in `infra`; documents stay at root. CI follows the user's explicit choice to preserve every folder.

The replacement is pushed as a new branch; the old remote branch is deleted only after the replacement push is confirmed and only if its observed tip has not changed. Main is not rewritten. Final remote commit and deletion are reported after Git confirms them.
