#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ "$#" -ne 1 ]; then echo 'Usage: bash backend/scripts/db-backup.sh backups/room.dump' >&2; exit 2; fi
umask 077
mkdir -p "$(dirname "$1")"
if [ -e "$1" ]; then echo 'Refusing to overwrite an existing backup.' >&2; exit 1; fi
temp=$(mktemp "$(dirname "$1")/.room-backup.XXXXXX")
trap 'rm -f "$temp"' EXIT
docker compose exec -T postgres sh -c 'exec pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$temp"
test -s "$temp"
# Atomic no-replace publication, including concurrent backup invocations.
python3 - "$temp" "$1" <<'PY'
import os, sys
os.link(sys.argv[1], sys.argv[2], follow_symlinks=False)
PY
echo 'Backup created. Encrypt and restrict access before off-host retention.'
