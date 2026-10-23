# Room — development foundation

Room is a 1v1 debate platform. This checkout currently contains a React starter and the Member 5 database/infrastructure implementation. Authentication, room lifecycle, recording/media behavior and transcription remain feature-owner handoffs; a complete audio debate is not implemented here.

The supplied Member 5 checklist targets audio-only v3, while the supplied architecture document is text-based v2. The checklist governs this infrastructure work. Provisional audio contracts and release gates are recorded in [docs/member-05.md](docs/member-05.md).

## Clean checkout

Prerequisites: Node.js 24, npm 11, Docker Engine with Compose v2. The first storage build compiles checksum-pinned upstream MinIO source and requires Go module download access. Do not commit installed dependencies, generated credentials or backups.

```sh
npm ci
node scripts/init-env.mjs
npm run build
npm run lint
npm test
docker compose up --build -d --wait
npm run db:seed
npm run test:integration:local
bash scripts/verify-db-restore.sh
npm run test:recovery
```

`init-env.mjs` generates random development credentials into `.env` and refuses to overwrite an existing file. Reserved characters in custom database passwords must be URL-encoded in `DATABASE_URL`; Compose defaults are generated hexadecimal values. Keep `.env` private. Use a secrets manager and separate least-privilege roles for deployment.

The local stack publishes web on port 8080, API on 3000, PostgreSQL on 5432, and S3 on 9000, all bound to loopback. `API_PORT`, `DB_PORT`, and `S3_PORT` may be changed in `.env`; update the corresponding host URLs too. Container services use internal DNS names. Health endpoints are `/health/live` and `/health/ready`. Readiness returns 503 if required infrastructure is unavailable.

## Native development

```sh
docker compose up --build -d --wait db storage
npm run db:migrate
npm run storage:init
npm run db:seed
# Separate terminals:
npm run dev:api
npm run dev:worker
npm run dev:web
```

Build `@room/contracts` again after contract changes (`npm run build -w @room/contracts`). The backend exports `createApp` for transport tests; `server.ts` and `worker.ts` are independent entry points. Migrations run as an explicit deployment step, never implicitly at API startup. The workspace lockfile is authoritative; use `npm ci` at the repository root. Windows `node_modules` formerly tracked in the backend have been removed.

## Audio fixtures and verification

```sh
npm run fixtures
npx playwright install --with-deps chromium
npm run test:e2e
# Linux/Docker: isolated authenticated TURN relay acceptance
npm run test:turn
# With a preinstalled browser:
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

The fixture suite launches two independent Chromium processes with distinct 440Hz/660Hz WAV microphones. It tests actual MediaRecorder output, recorder loss, and a peer audio transport primitive. It does **not** represent a complete Room debate, authenticated playback, or transcription accuracy. For forced relay testing set `TURN_ONLY=1` and provide `TURN_TEST_URL`, `TURN_TEST_USERNAME`, `TURN_TEST_PASSWORD` securely. The suite fails when those requirements are absent; it does not silently skip live audio.

Real microphones require HTTPS or a browser-trusted localhost origin and user permission. Use two physical devices and headphones for acceptance. Do not use fake-device flags for that run. Follow [operations](docs/operations.md) for HTTPS, TURN, backups, deletion recovery, migration rollback, drain behavior and network requirements. See [release evidence](docs/member-05.md) for verified results and unresolved gates.
