#!/usr/bin/env python3
"""Generate local-only credentials without printing them or replacing user files."""
import os
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[1]
env_path = root / '.env'
config_path = root / '.local' / 'livekit.yaml'
if env_path.exists() or config_path.exists():
    raise SystemExit('Configuration already exists. Preserve it; see docs/operations.md for manual setup/rotation.')
config_path.parent.mkdir(mode=0o700, exist_ok=True)
password, app_password, api_key, api_secret = secrets.token_hex(24), secrets.token_hex(24), secrets.token_hex(16), secrets.token_hex(32)
content = (root / '.env.example').read_text().replace('replace-with-generated-password', password).replace('replace-with-generated-app-password', app_password).replace('replace-with-generated-api-key', api_key).replace('replace-with-generated-secret', api_secret)
content += f'\nLOCAL_UID={getattr(os, "getuid", lambda: 1000)()}\nLOCAL_GID={getattr(os, "getgid", lambda: 1000)()}\n'
# O_EXCL protects against concurrent writes. Credential values never go to stdout.
for path, text in [(env_path, content), (config_path, f'port: 7880\nlog_level: warn\nrtc:\n  tcp_port: 7881\n  udp_port: 7882\n  use_external_ip: false\nkeys:\n  {api_key}: {api_secret}\n')]:
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        handle.write(text)
print('Created ignored .env and .local/livekit.yaml; media token demo stays disabled.')
