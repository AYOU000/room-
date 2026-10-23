import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { validateManifest } from '@room/contracts';
import { readEnvironment } from '../src/config/env';
import { createApp } from '../src/app';

test('manifest rejects gaps, overlap, wrong order and cutoff overrun', () => {
  const first = { sequence: 0, startMs: 0, endMs: 1000, sha256: 'a'.repeat(64), bytes: 42 };
  assert.equal(validateManifest([first],1000).length,1);
  for (const segments of [[],[{...first,startMs:1}],[first,{...first,sequence:1,startMs:900,endMs:1500}], [{...first,sequence:1}], [{...first,endMs:1001}]]) {
    assert.throws(() => validateManifest(segments,1000));
  }
});
test('configuration fails without credentials and rejects insecure production origin', () => {
  assert.throws(() => readEnvironment({}), /Invalid environment/);
  const input = { DATABASE_URL:'postgres://test:test@localhost/test', S3_ENDPOINT:'http://localhost:9000',S3_BUCKET:'room-test',S3_ACCESS_KEY_ID:'test',S3_SECRET_ACCESS_KEY:'a'.repeat(20) };
  assert.equal(readEnvironment(input).PORT,3000);
  assert.throws(() => readEnvironment({...input,NODE_ENV:'production'}),/HTTPS/);
  const secret = 'SECRET_DO_NOT_PRINT';
  assert.throws(() => readEnvironment({...input,DATABASE_URL:secret}), e => !String(e).includes(secret));
});
test('API readiness fails closed during dependency loss and drain; liveness remains available', async () => {
  let drain = false, broken = false;
  const app = createApp({ origin:'http://localhost:5173',draining:()=>drain,ready:async()=>{if(broken)throw new Error('private connection details');} });
  const server = app.listen(0,'127.0.0.1'); await once(server,'listening');
  const address = server.address(); assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${url}/health/ready`)).status,200);
    broken = true;
    const response = await fetch(`${url}/health/ready`); assert.equal(response.status,503);
    assert(!JSON.stringify(await response.json()).includes('private'));
    broken = false; drain = true;
    assert.equal((await fetch(`${url}/health/ready`)).status,503);
    assert.equal((await fetch(`${url}/health/live`)).status,200);
  } finally { await new Promise<void>(resolve => server.close(()=>resolve())); }
});
