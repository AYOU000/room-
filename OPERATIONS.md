# Operations and incident runbook

Member 5 • 6 November 2026 • SRS/TEAM v1.0. Core deployment is validated with synthetic data; full application release remains gated by SECURITY-TEST-REPORT.md.

## Clean start

Requirements: Git, Docker Engine/Compose v2, Python 3. Runtime images pin Node 22, PostgreSQL 16, LiveKit and nginx. For native CI use Node ≥22.12 and <25, npm, Python, curl, tar, sha256sum and Git.

```bash
python3 backend/scripts/configure-local.py
docker compose up -d --build --wait --wait-timeout 180
python3 backend/scripts/compose-smoke.py
bash backend/scripts/test-backup-restore.sh
docker compose exec -T -e SMOKE_LIVEKIT_URL=http://livekit:7880 backend node scripts/media-service-smoke.cjs
python3 backend/scripts/privacy-log-smoke.py
```

The generator refuses existing configuration and creates random, ignored `.env` and `.local/livekit.yaml` with mode 0600; no secret is printed. The generated UID/GID matches the non-root LiveKit process. Keep the two signing credentials synchronized. Merge new template settings manually for an existing deployment. Use URL-encoded passwords in DATABASE_URL; generated passwords use URL-safe hex. Changing `.env` does not rotate an existing database password. Never delete a real data volume to repair configuration.

Service order: PostgreSQL healthy → one-shot Prisma migration successful → API healthy → static frontend/reverse proxy. API also waits for LiveKit health. Migrations use the administrative DB identity; application operations use a non-superuser/no-role-create/no-database-create identity. The bootstrap SQL grants present and future table/sequence privileges and runs once on a fresh volume. `/health` reports process liveness, not ASR/LLM product readiness.

Open `http://localhost:8080`. Default token issuance returns a safe 503 until Members 1/2 supply verified account/session membership through createApp's authorizer. An intentionally insecure local audio demo requires ENABLE_DEV_MEDIA_TOKENS=true and NODE_ENV=development, then backend recreation; it has no identity, capacity, consent or private-room guarantee. It is forbidden in production. Keep it disabled for smoke tests.

Core service state is persistent only in the approved PostgreSQL metadata volume. Stop with `docker compose down`; do not add `-v` for a real deployment. Existing volumes are never replaced automatically by the supplied scripts.

## Preserve main's folder layout

All original paths, including tracked Windows backend dependencies, stay in Git unchanged. Docker contexts exclude node_modules, local configuration, logs and generated output. Run `bash backend/scripts/ci.sh checks`: dependencies and builds live in a disposable copy. Avoid npm ci directly in the source checkout when preserving the tracked baseline. The CI script can be called by any runner; no hosted workflow is installed or claimed.

For a disposable runner with Docker and no existing Room data, `bash backend/scripts/ci.sh integration` adds clean startup, migrations, proxy/media/privacy checks and synthetic backup restoration. It preserves database volumes during cleanup. It must not target production or real speech. For parallel stacks set COMPOSE_PROJECT_NAME plus WEB_PORT, LIVEKIT_HTTP_PORT/TCP_PORT/UDP_PORT, EDGE_SUBNET and matching FRONTEND_PROXY_IP. SMOKE_BASE_URL and SMOKE_LIVEKIT_URL must point to the corresponding local test ports. Integration does not certify cross-network browser audio or other owners' missing features.

## Managed-cloud networking

Keep proxy routing and TLS verification enabled. When the managed CA is required, pass it only as an ephemeral BuildKit secret:

```bash
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t room-backend ./backend
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t room-frontend ./frontend
```

The Node install steps extend trust via NODE_EXTRA_CA_CERTS only while the mount exists. Do not copy the CA or credentials into image layers, disable TLS, or bypass Prisma checksums. If runtime migration needs the session CA, use a temporary Compose override that mounts the CA read-only and sets NODE_EXTRA_CA_CERTS for the migration service. Retain migration failure as a startup failure; do not substitute manual SQL and claim native migration success. This branch's isolated core deployment completed native Prisma migrate deploy successfully.

## HTTPS/WSS, ICE and TURN

Outside development loopback use NODE_ENV=production, exact HTTPS ALLOWED_ORIGINS, WSS LIVEKIT_PUBLIC_URL and strong non-placeholder signing credentials. The API rejects remote plaintext origins/media URLs. Configure real APP_DOMAIN and MEDIA_DOMAIN DNS, then use `docker compose --profile production up -d --build --wait`. Caddy terminates HTTPS/WSS and restricts browser connect-src to the configured media host; its admin endpoint and access logs are disabled. Actual DNS/ACME/public HTTPS has not been exercised here.

Default host publications are loopback web 8080, LiveKit signaling TCP 7880, RTC TCP 7881 and UDP 7882. PostgreSQL, API and ASR have no published host port. Keep raw 7880 signaling loopback-only behind TLS. For remote ICE, configure the advertised/public media address and use_external_ip in the ignored runtime LiveKit file, review NAT/firewall rules, and deliberately select MEDIA_BIND_IP. Open only reviewed HTTPS/ACME/media ports.

Member 2/operator must test two browsers on different networks. Restricted networks can require a separately deployed, reviewed TURN service, TLS certificate, short-lived credentials and documented relay port ranges. TURN is not silently included. No browser audio/latency assertion follows from a successful LiveKit management API check.

Frontend proxy IP and API trust are configured together by FRONTEND_PROXY_IP within EDGE_SUBNET. nginx overwrites forwarding headers. Behind Caddy, the API deliberately sees Caddy's address unless a separately reviewed trusted-hop policy is added. Do not trust arbitrary forwarded chains; test shared-NAT fairness. Multiple API replicas require shared atomic rate counters.

## Transcription and provider gates

The optional `transcription` profile uses `infra/WhisperLiveKit.Dockerfile`: Python 3.12, FFmpeg, WhisperLiveKit 0.2.26 and faster-whisper. It is a private CPU runtime scaffold, not a Node package or a completed LiveKit bridge. Pre-provision a reviewed model at ASR_MODEL_DIR/model with verified hashes; runtime is offline/private with telemetry disabled, no audio/transcript volume, memory-backed scratch and no container logs.

Member 4 still owns the authenticated per-track LiveKit→ASR adapter, its health/auth contract, full inference dependency/model lock, resource sizing and upstream disk/telemetry review. The optional profile was not built/run and must not process private speech until those gates close. Add the actual adapter to the private ASR network after owner integration; do not expose an unauthenticated ASR UI or internal callback.

LLM/retrieval keys are server-only. Before real text is sent, approve provider, region, retention/training policy, language, model version and cost ceiling. Official transcripts stay bounded in server memory; never reconstruct scoring from a browser cache. SEC-07 policies and tests remain with Member 4's real implementation.

## Backups and recovery

Only approved durable account/history metadata belongs in PostgreSQL. Never store or back up raw speech, transcript, prompts, disk queues or browser caches. Backups contain private metadata: mode-restrict and encrypt off-host copies, apply retention/expiry and test recovery.

```bash
bash backend/scripts/db-backup.sh backups/room.dump
bash backend/scripts/db-restore.sh backups/room.dump room_restore_check
bash backend/scripts/test-backup-restore.sh
```

Backup atomically refuses an existing destination. Restore creates a separate room_restore_* database and refuses to overwrite an existing one. Validate schema/content before a separately planned cutover; no script cuts over production. The restore test inserts/removes a fixed synthetic UUID, verifies one restored row and checks the default room_app privileges; run only on disposable local/staging metadata. A pre-existing fixture makes it fail without deleting that record. Custom application-role names require adapting the fixture assertion.

## Logging, restart and incidents

API records contain generated request ID, method, route template, status, error category and rounded duration. Bodies, raw URLs/queries, authorization/cookies, tokens, exception stacks, transcript, model output and retrieval payloads are excluded. nginx access/error content logs are disabled; ASR logs are disabled; Docker operational logs are bounded. Centralized collectors must enforce the proposed 14-day retention separately; file size limits do not do so. The local privacy check uses one synthetic marker, not real speech.

On restart Members 2/4 must reconcile unfinished sessions and mark evaluations unavailable if their in-memory transcript was lost. Proposed browser/server transcript bounds and five-minute purge are documented in SECURITY-PATTERNS.md and still need feature implementation. In-memory rate counters reset on restart and are not session revocation. Compose is not high availability.

Incident procedure: identify affected request IDs/categories without capturing content; contain ingress/provider access; rotate/revoke leaked keys and refresh families with Member 1; close active media with Member 2. Preserve redacted evidence, patch, rerun relevant negative tests/scans and record owner/fix/retest. Removing a current secret does not revoke historical values; coordinate any history rewrite separately. Restore only validated metadata backups, then re-enable traffic after owner review.
