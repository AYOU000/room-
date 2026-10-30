#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "$#" -ne 1 ]; then echo 'Usage: bash scripts/db-backup.sh backups/room.dump' >&2; exit 2; fi
umask 077
mkdir -p "$(dirname "$1")"
if [ -e "$1" ]; then echo 'Refusing to overwrite an existing backup.' >&2; exit 1; fi
temp=$(mktemp "$(dirname "$1")/.room-backup.XXXXXX")
trap 'rm -f "$temp"' EXIT
docker compose exec -T postgres sh -c 'exec pg_dump --format=custom --no-owner --no-privileges -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$temp"
test -s "$temp"
mv "$temp" "$1"
echo 'Backup created. Encrypt and restrict access before off-host retention.'
