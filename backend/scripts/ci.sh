#!/usr/bin/env bash
# Runner-neutral CI entrypoint; no new .github/workflows directory is required.
set -euo pipefail
cd "$(dirname "$0")/../.."
root_dir=$PWD
mode=${1:-checks}
if [[ "$mode" != checks && "$mode" != integration ]]; then
  echo 'Usage: bash backend/scripts/ci.sh [checks|integration]' >&2
  exit 2
fi
python3 backend/scripts/check-layout.py "${STRUCTURE_BASE_REF:-2d25d68f1a94efd12cc9c0abb2c87f939ac9aa10}"
python3 backend/scripts/secret-scan.py
bash backend/scripts/run-gitleaks.sh

# Builds use a disposable copy so npm ci cannot rewrite main's tracked Windows
# node_modules. Install hooks and scans run only on synthetic CI configuration.
ci_dir=$(mktemp -d)
cleanup() {
  if [[ "$mode" == integration && -f "$ci_dir/source/.env" ]]; then
    (cd "$ci_dir/source" && docker compose down --remove-orphans) || true
  fi
  rm -rf "$ci_dir"
}
trap cleanup EXIT
python3 - "$ci_dir/source" <<'PY'
from pathlib import Path
import shutil, subprocess, sys
root=Path.cwd(); target=Path(sys.argv[1])
for name in set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')):
    if not name or any(part in ['node_modules','.local'] for part in Path(name).parts): continue
    path=root/name
    if not path.is_file(): continue
    if path.is_symlink(): raise SystemExit('Refusing source symlink')
    dest=target/name; dest.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(path,dest)
PY
cd "$ci_dir/source"
export npm_config_cache="$ci_dir/npm-cache"
export CI=true NODE_ENV=test
npm ci --prefix backend --no-audit --no-fund
npm ci --prefix frontend --no-audit --no-fund
npm run typecheck --prefix backend
npm run typecheck --prefix frontend
npm test --prefix backend
npm run build --prefix backend
npm run build --prefix frontend
npm audit --prefix backend --audit-level=high
npm audit --prefix frontend --audit-level=high
if [[ "$mode" == integration ]]; then
  # Run only on an isolated CI runner with Docker, no existing Room stack/data,
  # and no real credentials. Transcript/audio fixtures are never stored.
  unset NODE_ENV
  export COMPOSE_PROJECT_NAME="room_ci_${CI_RUN_ID:-$$}"
  python3 backend/scripts/configure-local.py
  docker compose up -d --build --wait --wait-timeout 180
  python3 backend/scripts/compose-smoke.py
  python3 backend/scripts/privacy-log-smoke.py
  node backend/scripts/media-service-smoke.cjs
  bash backend/scripts/test-backup-restore.sh
fi
cd "$root_dir"
python3 backend/scripts/check-layout.py "${STRUCTURE_BASE_REF:-2d25d68f1a94efd12cc9c0abb2c87f939ac9aa10}"
echo 'PASS: requested CI checks completed. Feature-owner acceptance gates remain in SECURITY-TEST-REPORT.md.'
