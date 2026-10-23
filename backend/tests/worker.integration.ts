import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Pool } from 'pg';
import { DeleteBucketCommand } from '@aws-sdk/client-s3';
import { readEnvironment } from '../src/config/env';
import { migrate } from '../src/infrastructure/migrations';
import { createStorage } from '../src/infrastructure/storage';
import { transaction } from '../src/infrastructure/database';

if(!process.env.TEST_DATABASE_URL||!process.env.TEST_S3_ENDPOINT)throw new Error('Dedicated test database and S3 configuration required');
test('real worker drains durable outbox, deletes private object, tolerates duplicate delivery and shuts down', {timeout:30000},async()=>{
 const schema=`test_${randomUUID().replaceAll('-','')}`;
 const admin=new Pool({connectionString:process.env.TEST_DATABASE_URL});await admin.query(`CREATE SCHEMA ${schema}`);
 const database=new URL(process.env.TEST_DATABASE_URL!);database.searchParams.set('options',`-c search_path=${schema}`);
 const pool=new Pool({connectionString:database.toString()});
 const env=readEnvironment({...process.env,NODE_ENV:'test',DATABASE_URL:database.toString(),S3_ENDPOINT:process.env.TEST_S3_ENDPOINT,S3_BUCKET:`room-test-${randomUUID()}`,LOG_LEVEL:'silent'});
 const storage=createStorage(env);
 let child:ReturnType<typeof spawn>|undefined;
 const key=`recordings/${randomUUID()}/fixture.webm`;
 try{
  await migrate(pool,resolve(__dirname,'../migrations'));await storage.provision();
  await storage.put(key,Buffer.from('private deletion fixture'),'audio/webm');
  const tombstone=randomUUID();
  await transaction(pool,async c=>{
   await c.query("INSERT INTO deletion_tombstones(id,recording_id,object_key,reason) VALUES($1,$2,$3,'USER_REQUEST')",[tombstone,randomUUID(),key]);
   await c.query("INSERT INTO outbox(kind,dedupe_key,payload) VALUES('storage.delete',$1,$2)",[`delete:${tombstone}`,JSON.stringify({tombstoneId:tombstone})]);
  });
  const socket=createServer().listen(0,'127.0.0.1');await once(socket,'listening');
  const address=socket.address();assert(address&&typeof address!=='string');const port=address.port;
  await new Promise<void>(r=>socket.close(()=>r()));
  child=spawn(process.execPath,['--import','tsx',resolve(__dirname,'../src/worker.ts')],{
   env:{...process.env,...Object.fromEntries(Object.entries(env).map(([k,v])=>[k,String(v)])),WORKER_PORT:String(port)},stdio:'ignore',
  });
  let done=false;
  for(let i=0;i<80;i++){
   const result=await pool.query('SELECT deleted_at FROM deletion_tombstones WHERE id=$1',[tombstone]);
   if(result.rows[0].deleted_at){done=true;break;}
   if(child.exitCode!==null)throw new Error('Worker exited before processing');await sleep(100);
  }
  assert(done,'Worker must process the persisted deletion');
  await assert.rejects(storage.head(key),e=>(e as any).$metadata.httpStatusCode===404);
  await pool.query('UPDATE outbox SET delivered_at=NULL');
  for(let i=0;i<40;i++){
   if((await pool.query('SELECT 1 FROM outbox WHERE delivered_at IS NULL')).rowCount===0)break;
   await sleep(100);
  }
  assert.equal((await pool.query('SELECT 1 FROM outbox WHERE delivered_at IS NULL')).rowCount,0);
  assert.equal((await pool.query("SELECT * FROM jobs WHERE kind='storage.delete'")).rowCount,1);
  assert.equal((await fetch(`http://127.0.0.1:${port}/health/ready`)).status,200);
  const exited=once(child,'exit');child.kill('SIGTERM');const [code]=await exited;assert.equal(code,0);
 }finally{
  if(child && child.exitCode===null){const exit=once(child,'exit');child.kill('SIGKILL');await Promise.race([exit,sleep(1000)]);}
  await storage.remove(key).catch(()=>{});
  await storage.client.send(new DeleteBucketCommand({Bucket:env.S3_BUCKET})).catch(()=>{});storage.close();
  await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
 }
});
