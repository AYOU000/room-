# Room operations and incident runbook

Scope: Member 5 baseline for the existing prototype. Read docs/security/findings.md before deployment. No public release is approved: real accounts, rooms/state, transcript/AI workflows and their security evidence remain with Members 1–4.

## Clean local start

Requirements: Git; Docker Engine/Compose v2; Python 3 for credential generation and smoke checks. Node 22.12+ (below 25) is needed only for native development; containers pin a Node 22 digest. From the checkout root:

```bash
python3 scripts/configure-local.py
docker compose up -d --build --wait --wait-timeout 180
python3 scripts/compose-smoke.py
bash scripts/test-backup-restore.sh
node scripts/media-service-smoke.cjs
python3 scripts/privacy-log-smoke.py
```

The generator creates .env (mode 0600) and .local/livekit.yaml (0600, matching API key/secret); it refuses to replace existing files. Leave generated files out of Git. Existing users must merge .env.example fields manually and keep LiveKit/API keys synchronized. Manually supplied database passwords in DATABASE_URL must be URL-encoded; the generator uses URL-safe random hex. PostgreSQL credentials change on disk only for a fresh volume; changing .env does not change an existing database password. Never delete a volume to "fix" this on real data.

Default service order: PostgreSQL health → one-shot Prisma migrate deploy → API health → static frontend/reverse proxy. LiveKit health is also required by the API. Database/ASR have no public host ports. Only loopback web and media ports are published by default. The API runtime uses a restricted room_app role; only the migrate service and operator have administrator credentials. The bootstrap role script runs once on a fresh PostgreSQL volume. Alternate role names require updating the synthetic role assertion in test-backup-restore.sh.

The frontend is served at local port 8080; /api and /health are proxied to backend. No Vite public secret variable is required. API readiness is process-level liveness only: /health does not certify PostgreSQL, ASR or LLM workflow readiness. Docker health checks verify each current service independently.

## Native development

```bash
npm ci --prefix backend
npm ci --prefix frontend
npm run typecheck --prefix backend
npm test --prefix backend
npm run build --prefix backend
npm run dev --prefix backend
# separate shell:
npm run dev --prefix frontend
```

For native API use, securely supply LiveKit configuration, ALLOWED_ORIGINS and a DATABASE_URL using a reachable development database. The backend does not automatically read root .env; set variables for that process or use an ignored backend .env. Vite proxies to localhost:4000; API_PROXY_TARGET can select another private API address. Do not expose PostgreSQL merely to run unrelated frontend checks.

The prototype issues no media token until Members 1/2 supply the verified authorizer. For an intentionally insecure local audio demonstration only, explicitly set ENABLE_DEV_MEDIA_TOKENS=true and NODE_ENV=development, then recreate backend. This mode has no user verification, membership, consent or two-person guarantee. It is forbidden by production configuration validation. Keep it off during security smoke tests.

## Managed-cloud proxy and Prisma blocker

In the onboarding machine, package-manager hosts are allowed but binaries.prisma.sh is denied. This prevents verified Prisma engine generation/migration. The previously saved environment draft requests that domain; review/save the environment settings and publish when appropriate. Retest before claiming a clean start. Do not use checksum-ignore flags or disable TLS verification.

Builds needing the managed CA use BuildKit secrets; never bake a session certificate or credentials into an image:

```bash
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t room-backend ./backend
docker build --secret id=proxy_ca,src="$CODEX_PROXY_CERT" -t room-frontend ./frontend
```

Migration containers also need the read-only CA mount for HTTPS access in this environment:

```bash
docker compose run --rm --no-deps \
  --volume "$CODEX_PROXY_CERT:/run/proxy-ca.pem:ro" \
  --env NODE_EXTRA_CA_CERTS=/run/proxy-ca.pem migrate
```

Current local evidence used `docker compose up -d postgres livekit` and `docker compose up -d --no-deps backend frontend` to validate the independent services. The initial migration SQL was applied directly to this empty synthetic database solely for backup/restore testing. This is a diagnostic isolation step, not a clean default Compose/migration pass; it is not a production migration procedure. Do not rerun CREATE TABLE on an existing schema, reset a real database or alter Prisma migration history to conceal the failure.

## HTTPS, WSS, ports and firewall

Set real APP_DOMAIN/MEDIA_DOMAIN DNS to the deployment host, NODE_ENV=production, ALLOWED_ORIGINS=https://APP_DOMAIN and LIVEKIT_PUBLIC_URL=wss://MEDIA_DOMAIN; keep development tokens disabled. Provision TLS using the optional Caddy production profile. Open TCP 80/443 for ACME/HTTPS and media TCP 7881 plus UDP 7882 as needed. Keep raw LiveKit signaling port 7880 loopback-only: Caddy proxies WSS internally. Change MEDIA_BIND_IP to the actual interface for remote ICE media and configure use_external_ip/advertised address in the ignored runtime file. Review NAT/public IP behavior; binding a port alone does not make ICE work.

```bash
docker compose --profile production up -d --build --wait
```

Caddy restricts production connect-src to self and the configured media WSS host; nginx's local-development policy permits WS/WSS for local testing. HSTS lasts one year after HTTPS deployment; understand this before changing domains. Caddy certificate volumes contain certificate material only, never speech. Disable content/access logging at every external proxy/CDN too. Check Caddy diagnostic logs for metadata exposure before production collection.

Member 2 must test ICE across two different networks. Deploy a reviewed TURN service/certificate and short-lived TURN credentials if restrictive networks require it; plan UDP/TCP/TLS relay ports and outbound firewall rules. TURN is not silently supplied by this Compose file. No cross-network or public-certificate test has been claimed here.

Trust only the fixed frontend proxy IP (172.30.50.10) for forwarded client IPs. Nginx overwrites incoming forwarding headers. If Caddy is in front, API limits intentionally see Caddy's address unless a separately reviewed trusted-hop design is implemented; do not enable blanket trust or accept browser-controlled forwarding chains. Shared NAT behavior and account-specific limits need feature-owner integration. Change the chosen subnet in Compose and API proxy trust together if it conflicts with the host network.

## WhisperLiveKit and provider requirements

The transcription profile pins WhisperLiveKit 0.2.26 and documents Python 3.12, FFmpeg, faster-whisper, PyTorch/Torchaudio and CPU inference. It is optional and unvalidated, not a fake Node ASR package. Pre-provision an approved model into ASR_MODEL_DIR/model with verified artifact hashes; runtime network is private and HF_HUB_OFFLINE is enabled. No transcript/audio disk volume or ASR logs are configured. /tmp is bounded memory-backed scratch space. Member 4 must inspect upstream code for disk writes, temp-file behavior, telemetry and output logging; complete the transitive dependency lock and model/resource benchmark before this profile is accepted. Neither the inference profile nor model load was built/run in this task.

A LiveKit-to-WhisperLiveKit adapter does not exist in this repository. Member 4 owns its implementation, health endpoint, restricted service identity, authenticated per-track mapping and memory-only lifecycle. Add it to the private ASR network only after integration; do not publish an unauthenticated ASR UI/WebSocket. LLM/evidence provider keys stay in server secrets, never VITE_ variables. Provider choice, region, retention/training terms, supported language, model version and budget remain open decisions. No real speech should be sent until these are approved.

## Backup and restoration

Only approved durable metadata belongs in PostgreSQL. Never back up audio, prompts, raw transcripts, disk queues or browser caches. Backups can contain private account/history metadata; restrict file access, encrypt before off-host storage, document retention and test expiry.

```bash
bash scripts/db-backup.sh backups/room.dump
bash scripts/db-restore.sh backups/room.dump room_restore_check
bash scripts/test-backup-restore.sh
```

Backup refuses to overwrite; restore creates a separate room_restore_* database and refuses existing names. Inspect data and schema before a planned cutover; no script overwrites production automatically. The synthetic restore test inserts then removes one fixed UUID marker and checks the app role; run it on local/staging only. It fails if the marker already exists, preserving pre-existing data. Real account deletion/shared-result retention and backup expiry still need team policy decisions.

## Logging, restart and incident handling

API audit records contain generated request ID, method, route template, HTTP status, stable error category and rounded duration only. No body, raw URL/query, headers, cookies, IP, tokens, exception stack or provider payload. Nginx access logs are disabled; ASR logging is disabled; Docker runtime logs are size-bounded. Centralized collectors must honor the proposed 14-day redacted log retention; a size cap is not a retention policy. Availability diagnostics should record categories rather than speech content.

On restart retain PostgreSQL only for approved durable data. Members 2/4 must reconcile unfinished sessions and mark evaluations unavailable when the ephemeral transcript was lost; never reconstruct official scoring from a browser cache. Live processes and in-memory limiter counters do not survive restart. Compose is not high availability.

Incident steps: identify affected service/request IDs without collecting private content; contain ingress/disable affected provider access; rotate/revoke leaked API keys and refresh families (Member 1), and close active media sessions (Member 2). Preserve redacted evidence, not transcripts. Remove secrets from current code; old Git values are compromised even after removal. Coordinate any history rewrite rather than doing it unilaterally. Patch, rerun negative tests/scans, document owner/fix/retest, restore only from validated metadata backups, then re-enable traffic after security-owner review.

Stop services with `docker compose down`; this preserves durable volumes. Never add -v except an explicitly approved disposable-data reset. CI's hosted workflow is configured, but its first remote run is not evidence until observed.
