#!/usr/bin/env python3
"""Exercise public boundaries of the running Compose stack (no real speech)."""
import json
import os
import urllib.error
import urllib.request
base = os.environ.get('SMOKE_BASE_URL','http://127.0.0.1:8080')

def call(path, data=None, headers=None):
    req=urllib.request.Request(base+path,data=data,headers=headers or {})
    try:
        with urllib.request.urlopen(req,timeout=5) as response: return response.status,response.headers,response.read()
    except urllib.error.HTTPError as error: return error.code,error.headers,error.read()

status,headers,html=call('/')
assert status==200 and b'<div id="root">' in html
assert "script-src 'self'" in headers['Content-Security-Policy']
status,headers,data=call('/health');assert status==200 and json.loads(data)['status']=='ok'
status,headers,data=call('/api/rooms/token',b'{"roomName":"smoke","identity":"test"}',{'Content-Type':'application/json'})
assert status==503 and json.loads(data)['error']['code']=='MEDIA_AUTHORIZATION_UNAVAILABLE'
status,headers,data=call('/api/rooms/token',b'{"identity":"<script>attack</script>"}',{'Content-Type':'application/json'})
assert status==400 and json.loads(data)['error']['code']=='INVALID_INPUT'
status,headers,data=call('/api/rooms/token',b'{}',{'Content-Type':'application/json','Origin':'https://attacker.invalid'})
assert status==403 and 'Access-Control-Allow-Origin' not in headers
print('PASS: frontend/CSP, API health, fail-closed media, input attack, hostile Origin through Compose reverse proxy.')
