#!/usr/bin/env python3
"""Keep every main path and folder; never rewrite main's tracked dependencies."""
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[2]
baseline = sys.argv[1] if len(sys.argv) > 1 else '2d25d68f1a94efd12cc9c0abb2c87f939ac9aa10'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=root).decode().split('\0')


before = set(filter(None, git('ls-tree', '-rz', '--name-only', baseline)))
after = {p for p in git('ls-files', '--cached', '--others', '--exclude-standard', '-z')
         if p and (root / p).is_file()}
folders = lambda files: {str(parent) for p in files for parent in Path(p).parents}
new_folders = folders(after) - folders(before)
missing = before - after
vendor_changes = git('diff', '--name-only', '-z', baseline, '--', 'backend/node_modules')
vendor_additions = {p for p in after - before if p.startswith('backend/node_modules/')}
if new_folders or missing or any(vendor_changes) or vendor_additions:
    for kind, names in [('new folder', new_folders), ('removed main file', missing),
                        ('changed baseline dependency', filter(None, vendor_changes)),
                        ('added baseline dependency', vendor_additions)]:
        for name in sorted(names):
            print(f'FAIL: {kind}: {name}')
    raise SystemExit(1)
print(f'PASS: all {len(before)} main paths retained; folder set identical; tracked dependencies unchanged.')
