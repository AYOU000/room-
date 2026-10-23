import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DeleteBucketCommand, GetBucketLifecycleConfigurationCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readEnvironment } from '../src/config/env';
import { createStorage } from '../src/infrastructure/storage';
import { backupObjects,restoreObjects } from '../src/infrastructure/backup';

if(!process.env.TEST_S3_ENDPOINT) throw new Error('TEST_S3_ENDPOINT is required; storage integration must not silently skip');
test('private object access, staging lifecycle, idempotent deletion and checksum-verified restore with tombstones',async()=>{
 const env=readEnvironment({...process.env,S3_ENDPOINT:process.env.TEST_S3_ENDPOINT,S3_BUCKET:`room-test-${randomUUID()}`});
 const targetEnv={...env,S3_BUCKET:`room-test-${randomUUID()}`};
 const source=createStorage(env),target=createStorage(targetEnv);
 const directory=await mkdtemp(join(tmpdir(),'room-backup-'));const backup=join(directory,'objects');
 try{
  await source.provision();await source.provision();await target.provision();
  const lifecycle=await source.client.send(new GetBucketLifecycleConfigurationCommand({Bucket:env.S3_BUCKET}));
  assert.equal(lifecycle.Rules?.[0].Expiration?.Days,1);
  const key=`recordings/${randomUUID()}/audio.webm`;const deleted=`recordings/${randomUUID()}/audio.webm`;
  const bytes=Buffer.from('known-fixture-audio-bytes');
  await source.put(key,bytes,'audio/webm');await source.put(deleted,bytes,'audio/webm');
  await source.put(`staging/${randomUUID()}/orphan.webm`,bytes,'audio/webm');
  const anonymous=await fetch(`${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`);assert.equal(anonymous.status,403);
  const signed=await fetch(await source.signedRead(key));assert.equal(signed.status,200);assert.deepEqual(Buffer.from(await signed.arrayBuffer()),bytes);
  await assert.rejects(source.put(key,bytes,'audio/webm')); // immutable key
  assert.equal(await backupObjects(env,backup),2); // staging objects excluded
  assert.equal(await restoreObjects(targetEnv,backup,new Set([deleted])),1);
  await assert.rejects(target.head(deleted),e=>(e as any).$metadata.httpStatusCode===404);
  assert.equal((await target.head(key)).ContentLength,bytes.length);
  const manifest=JSON.parse(await readFile(join(backup,'manifest.json'),'utf8'));
  await writeFile(join(backup,manifest.objects[0].file),'corrupt');
  await assert.rejects(restoreObjects(targetEnv,backup,new Set()),/integrity/);
  await target.remove(key);await target.remove(key);await assert.rejects(target.head(key));
 }finally{
  for(const [storage,bucket] of [[source,env.S3_BUCKET],[target,targetEnv.S3_BUCKET]] as const){
   const items=await storage.client.send(new ListObjectsV2Command({Bucket:bucket})).catch(()=>({Contents:[]}));
   for(const object of items.Contents??[])await storage.remove(object.Key!);
   await storage.client.send(new DeleteBucketCommand({Bucket:bucket})).catch(()=>{});storage.close();
  }
  await rm(directory,{recursive:true,force:true});
 }
});
