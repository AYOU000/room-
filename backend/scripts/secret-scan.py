#!/usr/bin/env python3
"""Scan tracked/new nonignored source without printing matched credential values."""
import re
import subprocess
import sys
from pathlib import Path
root = Path(__file__).resolve().parents[2]
paths = subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
patterns = [
    re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    re.compile(r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b'),
    re.compile(r'(?:password|api[_-]?secret|api[_-]?key)\s*[=:]\s*[\"\x27]?([a-fA-F0-9]{24,})',re.I),
]
failed = []
for name in sorted(set(paths)):
    path = root / name
    if not name or not path.is_file(): continue
    # Main already tracks Windows dependencies. check-layout.py independently
    # forbids additions/modifications there; do not delete that baseline here.
    if 'node_modules' in Path(name).parts:
        continue
    if '.local' in Path(name).parts or Path(name).name == '.env':
        failed.append((name,0,'forbidden tracked artifact')); continue
    if path.is_symlink():
        failed.append((name,0,'unexpected source symlink')); continue
    if name.endswith(('.pdf','.png','.jpg')): continue
    for number,line in enumerate(path.read_text(errors='replace').splitlines(),1):
        if any(rule.search(line) for rule in patterns): failed.append((name,number,'possible credential'))
for name,line,reason in failed: print(f'{name}:{line}: {reason} (value redacted)')
if failed: sys.exit(1)
print('PASS: source secret/artifact checks; no credential values printed. History rotation still requires operator review.')
