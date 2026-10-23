// Isolated DB+S3 restore drill. Requires the local Compose DB/storage, built API and .env.
import { randomUUID,createHash } from 'node:crypto';
import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync,spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { DeleteBucketCommand,ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readEnvironment } from '../backend/dist/config/env.js';
import { createStorage } from '../backend/dist/infrastructure/storage.js';
import { backupObjects } from '../backend/dist/infrastructure/backup.js';
import { transaction } from '../backend/dist/infrastructure/database.js';
import { requestDeletion } from '../backend/dist/infrastructure/retention.js';

const started=performance.now();
const env=readEnvironment();
assert(['localhost','127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname),'Drill requires local Compose database');
const token=randomUUID().replaceAll('-','');
const sourceDB=`restore_source_${token}`,targetDB=`restore_target_${token}`;
const connection=name=>{const url=new URL(env.DATABASE_URL);url.pathname='/'+name;return url.toString();};
const sourceEnv={...env,NODE_ENV:'test',DATABASE_URL:connection(sourceDB),S3_BUCKET:`room-drill-source-${token}`};
const targetEnv={...sourceEnv,DATABASE_URL:connection(targetDB),S3_BUCKET:`room-drill-target-${token}`};
const source=createStorage(sourceEnv),target=createStorage(targetEnv);
const sourcePool=new Pool({connectionString:sourceEnv.DATABASE_URL}),targetPool=new Pool({connectionString:targetEnv.DATABASE_URL});
const directory=await mkdtemp(join(tmpdir(),'room-recovery-'));
function docker(script,args=[],input){const r=spawnSync('docker',['compose','exec','-T','db','sh','-c',script,'sh',...args],{input,maxBuffer:20*1024*1024});if(r.status!==0)throw new Error('Recovery database command failed');return r.stdout;}
function command(file,args,config){const r=spawnSync(process.execPath,[file,...args],{env:{...process.env,...Object.fromEntries(Object.entries(config).map(([k,v])=>[k,String(v)]))},stdio:'pipe'});if(r.status!==0)throw new Error('Recovery application command failed');}
let worker;
try{
 docker('createdb -U "$POSTGRES_USER" "$1"',[sourceDB]);docker('createdb -U "$POSTGRES_USER" "$1"',[targetDB]);
 command('backend/dist/scripts/migrate.js',[],sourceEnv);
 await source.provision();await target.provision();
 const bytes=await readFile('tests/e2e/fixtures/pro.wav');const digest=createHash('sha256').update(bytes).digest('hex');
 const ids={user:randomUUID(),room:randomUUID(),participant:randomUUID(),round:randomUUID(),consent:randomUUID()};
 const records=['keep','erase'].map(label=>({label,id:randomUUID(),track:randomUUID(),key:`recordings/${randomUUID()}/fixture.wav`}));
 await transaction(sourcePool,async c=>{
  await c.query("INSERT INTO users(id,username,email,password_hash) VALUES($1,'recovery_fixture','fixture@example.invalid','not-a-login')",[ids.user]);
  await c.query("INSERT INTO rooms(id,creator_id,custom_topic,solo_duration_sec,open_duration_sec) VALUES($1,$2,'Recovery fixture',300,300)",[ids.room,ids.user]);
  await c.query("INSERT INTO participants(id,room_id,user_id,side) VALUES($1,$2,$3,'PRO')",[ids.participant,ids.room,ids.user]);
  await c.query("INSERT INTO rounds(id,room_id,type) VALUES($1,$2,'SOLO')",[ids.round,ids.room]);
  await c.query("INSERT INTO recording_consents(id,room_id,participant_id,policy_version) VALUES($1,$2,$3,'fixture-v1')",[ids.consent,ids.room,ids.participant]);
  for(const r of records){
   await c.query("INSERT INTO recordings(id,room_id,round_id,participant_id,consent_id,mime_type,cutoff_ms,retention_until) VALUES($1,$2,$3,$4,$5,'audio/wav',5000,now()+interval '30 days')",[r.id,ids.room,ids.round,ids.participant,ids.consent]);
   await c.query('INSERT INTO audio_tracks(id,room_id,recording_id,round_id,participant_id,media_track_id) VALUES($1,$2,$3,$4,$5,$6)',[r.track,ids.room,r.id,ids.round,ids.participant,r.label]);
   await c.query('INSERT INTO audio_segments(room_id,recording_id,track_id,sequence,start_ms,end_ms,object_key,sha256,bytes) VALUES($1,$2,$3,0,0,5000,$4,$5,$6)',[ids.room,r.id,r.track,r.key,digest,bytes.length]);
   await c.query("UPDATE recordings SET status='COMPLETE' WHERE id=$1",[r.id]);
   await c.query("INSERT INTO transcript_segments(room_id,recording_id,track_id,sequence,start_ms,end_ms,language,content,provider,model_version) VALUES($1,$2,$3,0,0,5000,'und','Synthetic recovery-only text, not transcription','fixture','fixture-v1')",[ids.room,r.id,r.track]);
  }
 });
 for(const r of records)await source.put(r.key,bytes,'audio/wav');
 const dump=docker('pg_dump -U "$POSTGRES_USER" -d "$1" -Fc',[sourceDB]);
 await writeFile(join(directory,'database.dump'),dump,{mode:0o600});
 assert.equal(await backupObjects(sourceEnv,join(directory,'objects')),2);
 // A user deletion happens AFTER the snapshot. Preserve its newer tombstone independently.
 await transaction(sourcePool,c=>requestDeletion(c,records[1].id,'USER_REQUEST'));
 await source.remove(records[1].key);
 command('backend/dist/scripts/objects.js',['export-tombstones',join(directory,'latest-tombstones.json')],sourceEnv);
 docker('pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$1"',[targetDB],dump);
 command('backend/dist/scripts/objects.js',['restore',join(directory,'objects'),join(directory,'latest-tombstones.json')],targetEnv);
 assert.equal((await target.head(records[0].key)).ContentLength,bytes.length);
 await assert.rejects(target.head(records[1].key),e=>e.$metadata.httpStatusCode===404);
 assert.equal((await targetPool.query('SELECT * FROM transcript_segments WHERE recording_id=$1',[records[1].id])).rowCount,0);
 assert.equal((await targetPool.query('SELECT * FROM transcript_segments WHERE recording_id=$1',[records[0].id])).rowCount,1);
 // No health port collision: reserve a free local port before starting the isolated recovery worker.
 const {createServer}=await import('node:net');const listener=createServer().listen(0,'127.0.0.1');await once(listener,'listening');const port=listener.address().port;await new Promise(r=>listener.close(r));
 worker=spawn(process.execPath,['backend/dist/worker.js'],{env:{...process.env,...Object.fromEntries(Object.entries(targetEnv).map(([k,v])=>[k,String(v)])),WORKER_PORT:String(port),LOG_LEVEL:'silent'},stdio:'ignore'});
 let reconciled=false;
 for(let i=0;i<80;i++){
  if((await targetPool.query('SELECT status FROM recordings WHERE id=$1',[records[1].id])).rows[0].status==='DELETED'){reconciled=true;break;}
  await sleep(100);
 }
 assert(reconciled,'Recovery worker must finish tombstone reconciliation before traffic');
 const exited=once(worker,'exit');worker.kill('SIGTERM');const [code]=await exited;assert.equal(code,0);
 console.log(JSON.stringify({result:'PASS',databaseRestore:true,objectsBackedUp:2,objectsRestored:1,postBackupDeletionPreserved:true,derivedTranscriptRemoved:true,workerReconciled:true,fixtureBytesPerObject:bytes.length,elapsedMs:Math.round(performance.now()-started)}));
}finally{
 if(worker&&worker.exitCode===null){worker.kill('SIGKILL');}
 await Promise.all([sourcePool.end(),targetPool.end()]);
 for(const [storage,config] of [[source,sourceEnv],[target,targetEnv]]){
  const listed=await storage.client.send(new ListObjectsV2Command({Bucket:config.S3_BUCKET})).catch(()=>({Contents:[]}));
  for(const item of listed.Contents??[])await storage.remove(item.Key);
  await storage.client.send(new DeleteBucketCommand({Bucket:config.S3_BUCKET})).catch(()=>{});storage.close();
 }
 docker('dropdb --if-exists --force -U "$POSTGRES_USER" "$1"',[sourceDB]);docker('dropdb --if-exists --force -U "$POSTGRES_USER" "$1"',[targetDB]);
 await rm(directory,{recursive:true,force:true});
}
