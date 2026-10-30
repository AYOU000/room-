# Room — Real-Time Debate Platform

Room is a React/TypeScript and Express audio-debate prototype using PostgreSQL and LiveKit. The SRS also requires accounts, authorized two-person rooms, timers, temporary transcription, AI results and private history; those feature implementations are still pending.

Member 5's security and operations baseline supplies shared validation/errors, secure-by-default media-token behavior, deployment configuration, tests, CI and handoff documentation. See [report.md](report.md) for exact results and limitations.

## Development setup

Install Git, Docker Engine with Compose v2 and Python 3. From the existing checkout:

```bash
python3 scripts/configure-local.py
docker compose up -d --build --wait --wait-timeout 180
python3 scripts/compose-smoke.py
```

The generator creates ignored .env and .local/livekit.yaml with matching random local credentials and refuses to overwrite existing files. Do not copy real secrets into .env.example or commit generated files. See [operations.md](docs/operations.md) for existing-config migration, native Node development, database roles, backups and recovery.

The static frontend listens on local port 8080 and proxies /api and /health internally. PostgreSQL and ASR have no public ports. API liveness does not certify missing AI/transcription functionality.

Media-token issuance is **disabled by default** until Members 1/2 provide the verified authentication/membership authorizer. The explicit local-development demo option is documented in the runbook and is forbidden in production. A room name does not authorize access, and the demo does not enforce two human slots.

In the current managed cloud environment, verified Prisma engine downloads are denied at binaries.prisma.sh. Full clean-start migration is therefore blocked until that network requirement is applied. Independent services and synthetic backup restoration were validated separately; see the report. Never bypass checksum/TLS checks or silently mark a skipped migration successful.

Stop with `docker compose down`. Preserve the database volume; do not use -v on real data.

## Checks

With Node 22.12+ (below 25), from repository root:

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

CI runs these checks plus Compose smoke, synthetic restoration and log-privacy tests. Its first hosted run must be reviewed separately from local results.

## Security and team documentation

- [Member 5 report and test evidence](report.md)
- [Validation and Error Patterns — PDF](docs/security/validation-and-error-patterns.pdf) and [Markdown source](docs/security/validation-and-error-patterns.md)
- [Threat model](docs/security/threat-model.md), [control matrix](docs/security/control-matrix.md), [findings](docs/security/findings.md) and [SRS acceptance evidence](docs/security/acceptance.md)
- [Operations/runbook](docs/operations.md): HTTPS/WSS, media ports, TURN, private services, optional WhisperLiveKit prerequisites, backups, incidents and retention

Previously committed development credentials have been removed from current templates. Rotate/revoke them wherever reused; deleting a file does not revoke a secret in history. Full identity/session/transcript/AI functionality and cross-network media/privacy acceptance remain release gates.
