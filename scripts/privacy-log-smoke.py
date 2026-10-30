#!/usr/bin/env python3
"""Check existing service logs for one synthetic request marker, not real speech."""
import json
import os
import secrets
import subprocess
import urllib.error
import urllib.request
marker='synthetic-privacy-'+secrets.token_hex(12)
base=os.environ.get('SMOKE_BASE_URL','http://127.0.0.1:8080')
req=urllib.request.Request(base+'/api/rooms/token?private='+marker,
    data=json.dumps({'roomName':'smoke','identity':'test','transcript':marker}).encode(),
    headers={'Content-Type':'application/json','Authorization':'Bearer '+marker,'Cookie':'refresh='+marker})
try:
    urllib.request.urlopen(req,timeout=5)
    raise AssertionError('Unexpected accepted invalid request')
except urllib.error.HTTPError as error:
    assert error.code==400
logs=subprocess.check_output(['docker','compose','logs','--no-color','backend','frontend','livekit'],stderr=subprocess.STDOUT)
assert marker.encode() not in logs
print('PASS: synthetic body/query/auth/cookie marker absent from current API/proxy/LiveKit logs. Full transcript lifecycle remains unimplemented.')
