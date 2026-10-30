#!/usr/bin/env node
// Authenticated local LiveKit service operations; no microphone/media/browser claim.
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const requireBackend = createRequire(path.join(__dirname, '../backend/package.json'));
requireBackend('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { RoomServiceClient } = requireBackend('livekit-server-sdk');
const assert = require('node:assert/strict');
(async () => {
  assert.ok(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET, 'Local LiveKit credentials required');
  const client = new RoomServiceClient('http://127.0.0.1:7880', process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
  const name = `synthetic-service-${randomUUID()}`;
  let created = false;
  try {
    await client.createRoom({ name }); created = true;
    assert.ok((await client.listRooms()).some(room => room.name === name));
  } finally {
    if (created) await client.deleteRoom(name);
  }
  console.log('PASS: authenticated LiveKit create/list/delete with local generated credentials. Browser audio not tested.');
})().catch(() => { console.error('LiveKit synthetic service smoke failed (details redacted).'); process.exitCode = 1; });
