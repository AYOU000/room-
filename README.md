# Room

Room uses React/TypeScript/Vite, Express, PostgreSQL and LiveKit. This branch delivers Member 5's shared security and deployment baseline for **SRS v1.0** and **TEAM v1.0** (25 October 2026). Accounts, room/session state, transcription and AI features remain assigned to Members 1–4; see [security controls](SECURITY-CONTROLS.md) and [acceptance evidence](SECURITY-TEST-REPORT.md).

All folders and existing tracked paths from `main` are retained. Security helpers are flat files in `backend/src`, scripts/tests are in `backend/scripts`, deployment additions are files in `infra`, and documentation is at repository root. Main's tracked Windows `backend/node_modules` is preserved unchanged and excluded from Docker contexts and disposable CI installs. No `.github`, `docs`, root `scripts`, `backend/tests` or `backend/src/security` directories are added.

## Local deployment

Install Git, Docker Engine with Compose v2, and Python 3. From repository root:

```bash
python3 backend/scripts/configure-local.py
docker compose up -d --build --wait --wait-timeout 180
python3 backend/scripts/compose-smoke.py
bash backend/scripts/test-backup-restore.sh
docker compose exec -T -e SMOKE_LIVEKIT_URL=http://livekit:7880 backend node scripts/media-service-smoke.cjs
python3 backend/scripts/privacy-log-smoke.py
```

Open `http://localhost:8080`. The generator creates ignored random local credentials and refuses to overwrite existing configuration. The default media-token route fails closed until Members 1/2 integrate verified authentication and session membership. For an explicitly insecure, loopback-only prototype demonstration, see [operations](OPERATIONS.md); production rejects development tokens.

Service order is PostgreSQL health → verified Prisma migrations → API health → frontend/reverse proxy, with healthy LiveKit required by the API. PostgreSQL and optional ASR are private. Use `docker compose down` to stop services while retaining database data. Do not delete volumes to resolve configuration or migration problems.

## CI without changing folders

```bash
bash backend/scripts/ci.sh checks
# Only on an isolated disposable Docker runner, using synthetic data:
bash backend/scripts/ci.sh integration
```

The runner-neutral script checks the layout, scans source for secrets, verifies Gitleaks, installs locked dependencies in a disposable copy, type-checks source/tests, runs security and feature tests, builds both applications and runs dependency audits. Integration mode additionally runs Compose health/migrations, proxy/media/log checks and a synthetic backup/restore. Connect this command to your existing runner; no hosted workflow or hosted run is claimed. Override ports/subnet together when running alongside another stack; see the runbook.

## Member 5 deliverables

- [Threat model](THREAT-MODEL.md), [SEC-01–08/OPS matrix](SECURITY-CONTROLS.md), [findings register](SECURITY-FINDINGS.md).
- [Validation/error/auth/CSRF/media handoff](SECURITY-PATTERNS.md).
- [Operations, HTTPS/WSS, TURN, backups and incidents](OPERATIONS.md).
- [Security/acceptance test report](SECURITY-TEST-REPORT.md), [machine-readable evidence](security-evidence.json), [implementation report](report.md).

Real HTTPS certificates, cross-network browser audio, ASR/model/provider integration, complete transcript deletion and load/accessibility targets require separate evidence. A healthy local stack and common-control tests do not certify the complete SRS user journey.
