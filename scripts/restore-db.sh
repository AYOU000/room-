#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
backup_dir="${1:?Usage: restore-db.sh BACKUP_DIRECTORY NEW_DATABASE_NAME}"
restore_database="${2:?Use a new isolated database name}"
[[ "$restore_database" =~ ^restore_[a-z0-9_]+$ ]] || { echo 'Destination must start with restore_'; exit 1; }
(cd "$backup_dir" && sha256sum -c SHA256SUMS)
docker compose exec -T db sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$restore_database"
docker compose exec -T db sh -c 'pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$1"' sh "$restore_database" < "$backup_dir/database.dump"
printf 'Database restored in isolation. Apply the latest tombstones and restore objects into an empty private bucket before any traffic.\n'
