#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Includes external media writers; an API stop alone cannot make an audio snapshot consistent.
: "${MAINTENANCE_ACK:?Drain all writers, then set MAINTENANCE_ACK=yes}"
[[ "$MAINTENANCE_ACK" == yes ]] || exit 1
backup_dir="${1:?Usage: bash scripts/backup.sh NEW_BACKUP_DIRECTORY}"
umask 077
mkdir "$backup_dir"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
node --env-file=.env backend/dist/scripts/objects.js backup "$backup_dir/objects"
node --env-file=.env backend/dist/scripts/objects.js export-tombstones "$backup_dir/tombstones.json"
(cd "$backup_dir" && sha256sum database.dump tombstones.json objects/manifest.json > SHA256SUMS)
printf 'Backup complete. Keep encrypted off-host copies and independent tombstone exports.\n'
