#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$#" -ne 2 ] || [[ ! "$2" =~ ^room_restore_[a-z0-9_]+$ ]]; then
  echo 'Usage: bash scripts/db-restore.sh backups/room.dump room_restore_NAME' >&2; exit 2
fi
test -s "$1"
# Never restore over a running application database. createdb fails if it exists.
docker compose exec -T postgres sh -c 'exec createdb -U "$POSTGRES_USER" "$1"' sh "$2"
docker compose exec -T postgres sh -c 'exec pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -U "$POSTGRES_USER" -d "$1"' sh "$2" < "$1"
echo 'Restored into a separate verification database. Validate it before any cutover.'
