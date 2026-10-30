#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Source DB must already have repository migrations applied by Compose migrate.
# This synthetic record is approved durable metadata, never transcript/audio.
restore_db="room_restore_$(date +%s)_${RANDOM}"
backup_dir=$(mktemp -d)
inserted=false
cleanup() {
  docker compose exec -T postgres sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$restore_db"
  if [ "$inserted" = true ]; then
    docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL' >/dev/null
DELETE FROM users WHERE id = '11111111-1111-4111-8111-111111111111';
SQL
  fi
  rm -rf "$backup_dir"
}
# Avoid interpolating user input or secrets into SQL; fixture is a fixed UUID.
trap cleanup EXIT
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
INSERT INTO users (id) VALUES ('11111111-1111-4111-8111-111111111111');
SQL
inserted=true
bash scripts/db-backup.sh "$backup_dir/room.dump"
bash scripts/db-restore.sh "$backup_dir/room.dump" "$restore_db"
count=$(docker compose exec -T postgres sh -c 'psql -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$1"' sh "$restore_db" <<'SQL'
SELECT count(*) FROM users WHERE id = '11111111-1111-4111-8111-111111111111';
SQL
)
[ "$count" = 1 ]
privileges=$(docker compose exec -T postgres sh -c 'psql -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
SELECT rolname || ':' || rolsuper || ':' || rolcreatedb || ':' || rolcreaterole FROM pg_roles WHERE rolname = 'room_app';
SQL
)
[ "$privileges" = 'room_app:false:false:false' ]
can_read=$(docker compose exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_APP_PASSWORD" psql -h 127.0.0.1 -At -v ON_ERROR_STOP=1 -U "$POSTGRES_APP_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM users;"')
[[ "$can_read" =~ ^[0-9]+$ ]]
echo 'PASS: synthetic record restored exactly once; runtime database role is not superuser/role creator/database creator.'
