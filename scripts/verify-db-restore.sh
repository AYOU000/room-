#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
restore_database="restore_drill_$(date +%s)_$RANDOM"
backup_file=$(mktemp)
cleanup() {
  docker compose exec -T db sh -c 'dropdb --if-exists -U "$POSTGRES_USER" "$1"' sh "$restore_database" >/dev/null
  rm -f "$backup_file"
}
trap cleanup EXIT
# Read-only snapshot of source; restore goes exclusively into a new disposable database.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_file"
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$restore_database"
docker compose exec -T db sh -c 'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$1"' sh "$restore_database" < "$backup_file"
query='SELECT (SELECT count(*) FROM schema_migrations), (SELECT count(*) FROM topics), (SELECT count(*) FROM deletion_tombstones);'
original=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "$1"' sh "$query")
restored=$(docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$1" -Atc "$2"' sh "$restore_database" "$query")
[[ "$original" == "$restored" && "$restored" != 0\|* ]] || { echo 'Restore verification failed'; exit 1; }
printf 'PASS: pg_dump/pg_restore into isolated DB; migration, topic and tombstone counts match (%s).\n' "$restored"
