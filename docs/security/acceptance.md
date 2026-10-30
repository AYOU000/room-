# Acceptance and adversarial evidence

Build baseline: 8451f76; implementation branch: member-5/security-devops. Date: 30 October 2026. Owner of this assessment: Member 5. All payloads/records synthetic. See report.md for actual versions and final check counts.

| SRS test | Observed result | Status | Next owner / required evidence |
| --- | --- | --- | --- |
| AT-01 Accounts | No account/password/refresh endpoints or full tables exist | BLOCKED | 1: hash-only storage, Argon2id, expiry, rotation/replay/family revocation, logout; 5 review |
| AT-02 Admission | Default token issuance blocked; authorizer hook uses trusted IDs; denial paths tested | PARTIAL | 1/2: real auth/membership, race three joins, exactly two humans, private history and events |
| AT-03 Audio | Signed grants permit microphone only; no camera/screen/data | PARTIAL | 2/3: two real browsers/networks, permission denial recovery, actual media publication rejection |
| AT-04 Timing/finish | No timer/session state machine exists | BLOCKED | 2: clock tampering, reload, repeated finish, 60-second grace, server media shutdown |
| AT-05 Transcript identity | No ASR adapter/segment pipeline exists | BLOCKED | 4 with 2/3: track attribution, revision/dedup, forged browser input exclusion |
| AT-06 Deletion | API logs omit seeded sensitive body/query/header/cookie markers | PARTIAL | 3/4 with 5: active/terminal cache and memory expiry, tabs/offline/reload; inspect SQL/logs/volumes after actual transcript lifecycle |
| AT-07 AI/evidence | No AI or retrieval implementation | BLOCKED | 4 with 1/3/5: score bounds, known IDs, prompt attacks, citation provenance, unknown evidence |
| AT-08 Outages | Missing media configuration produces safe 503; authorizer exception redacted | PARTIAL | 4 with 2/5: independent ASR/LLM/retrieval outages, 60-second timeout, bounded retry, restart unavailable/purge |
| AT-09 Input attacks | Automated real-HTTP tests reject XSS/SQL-like token fields, extra fields, malformed/oversize JSON, hostile Origin, proxy spoofing; CSRF/frame helpers tested | PARTIAL | 1–4/5: actual CSRF endpoints, refresh replay, cross-room auth, WS frames, localStorage poisoning and unsafe retrieval after integration |
| AT-10 Operations | API/frontend images build; four runtime health checks and reverse-proxy smoke pass; synthetic dump/restore and DB privilege check pass | PARTIAL | 5/operator: native Prisma blocked by denied artifact host; 4 ASR/model/adapter; 2/3 cross-network browsers and accessibility; named load/latency run |

## Reproduce delivered checks

From repository root:

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run typecheck --prefix backend
npm run typecheck --prefix frontend
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm audit --prefix backend --audit-level=high
npm audit --prefix frontend --audit-level=high
python3 scripts/secret-scan.py
bash scripts/run-gitleaks.sh
```

After a normally migrated Compose deployment: `python3 scripts/compose-smoke.py` and `bash scripts/test-backup-restore.sh`. See operations.md for the current managed-network exception. Direct SQL setup used to isolate backup testing must not be confused with a passed Prisma migration or used to mark a failed migrate service complete.

Security assertions live in backend/tests/security.test.ts and supply-chain.test.ts. These are executable tests, not all-SRS test substitutes. CI is committed; a local run does not prove a successful hosted GitHub Actions run.
