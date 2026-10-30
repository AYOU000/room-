#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
version=8.24.3
scan_dir=$(mktemp -d)
trap 'rm -rf "$scan_dir"' EXIT
# Export tracked and new, nonignored source only, excluding local credentials,
# node_modules and runtime files. CI also runs the structural artifact check.
python3 - "$scan_dir" <<'PY'
import pathlib,shutil,subprocess,sys
root=pathlib.Path.cwd(); target=pathlib.Path(sys.argv[1])/"source"
for name in set(subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z']).decode().split('\0')):
    if name and (root/name).is_file():
        dest=target/name; dest.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,dest)
PY
if ! command -v gitleaks >/dev/null; then
  platform="$(uname -m)"
  case "$platform" in x86_64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) echo 'Unsupported scanner platform' >&2; exit 1 ;; esac
  archive="gitleaks_${version}_linux_${arch}.tar.gz"
  mkdir "$scan_dir/tool"
  curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archive}" -o "$scan_dir/tool/$archive"
  curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${version}/gitleaks_${version}_checksums.txt" -o "$scan_dir/tool/checksums.txt"
  (cd "$scan_dir/tool"; awk -v name="$archive" '$2==name' checksums.txt > selected.sha256; test -s selected.sha256; sha256sum -c selected.sha256; tar xzf "$archive" gitleaks)
  scanner="$scan_dir/tool/gitleaks"
else
  scanner="$(command -v gitleaks)"
fi
# Tool binaries live outside the exported source to avoid irrelevant findings.
"$scanner" dir --no-banner --redact --log-level warn "$scan_dir/source"
