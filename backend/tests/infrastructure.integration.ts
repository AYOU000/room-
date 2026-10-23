import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import type { Claim } from '../src/infrastructure/jobs';
import { queueOrphan } from '../src/infrastructure/orphans';
import { Pool } from 'pg';
import { migrate } from '../src/infrastructure/migrations';
import { requestDeletion, scheduleRetention } from '../src/infrastructure/retention';
import { transaction } from '../src/infrastructure/database';
import { claimJob, dispatchOutbox, enqueue, finishJob, heartbeat, LostLeaseError } from '../src/infrastructure/jobs';

// Integration tests refuse an implicit application database; each run uses an isolated schema.
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL is required for integration tests');
const directory = resolve(__dirname,'../migrations');
test('PostgreSQL migrations, room isolation, durable queue, fenced ownership and outbox recovery', async t => {
  const schema = `test_${randomUUID().replaceAll('-','')}`;
  const admin = new Pool({connectionString:url});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({connectionString:url,options:`-c search_path=${schema}`});
  try {
    await t.test('migrations apply twice and checksum validation is repeatable', async () => {
      await migrate(pool,directory); await migrate(pool,directory);
      assert.equal((await pool.query('SELECT * FROM schema_migrations')).rowCount,2);
    });
    const user = (await pool.query("INSERT INTO users(username,email,password_hash) VALUES('fixture','fixture@example.invalid','not-a-login') RETURNING id")).rows[0].id;
    const rooms: string[] = [];
    for (let i=0;i<2;i++) rooms.push((await pool.query("INSERT INTO rooms(creator_id,custom_topic,solo_duration_sec,open_duration_sec) VALUES($1,'Fixture',300,300) RETURNING id",[user])).rows[0].id);
    const participant = (await pool.query("INSERT INTO participants(room_id,user_id,side) VALUES($1,$2,'PRO') RETURNING id",[rooms[0],user])).rows[0].id;
    const round = (await pool.query("INSERT INTO rounds(room_id,type) VALUES($1,'SOLO') RETURNING id",[rooms[1]])).rows[0].id;
    await t.test('cross-room scores and consent are rejected by composite foreign keys', async () => {
      await assert.rejects(pool.query('INSERT INTO scores(room_id,round_id,participant_id,factual_score,persuasion_score) VALUES($1,$2,$3,80,70)',[rooms[1],round,participant]),{code:'23503'});
      await assert.rejects(pool.query("INSERT INTO recording_consents(room_id,participant_id,policy_version) VALUES($1,$2,'v1')",[rooms[1],participant]),{code:'23503'});
    });
    await t.test('duplicate concurrent delivery creates one job; changed payload fails',async()=>{
      const ids = await Promise.all(Array.from({length:8},()=>transaction(pool,c=>enqueue(c,'fixture','same',{x:1}))));
      assert.equal(new Set(ids).size,1);
      await assert.rejects(transaction(pool,c=>enqueue(c,'fixture','same',{x:2})),/Idempotency/);
    });
    await t.test('only one worker claims; expired worker cannot heartbeat or commit',async()=>{
      const claims = await Promise.all(['a','b'].map(owner=>claimJob(pool,owner,['fixture'],30)));
      assert.equal(claims.filter(Boolean).length,1);
      const old = claims.find(Boolean)!;
      await pool.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[old.id]);
      await assert.rejects(heartbeat(pool,old,30),LostLeaseError);
      const replacement = await claimJob(pool,'replacement',['fixture'],30); assert(replacement);
      assert(BigInt(replacement.fence)>BigInt(old.fence));
      await assert.rejects(finishJob(pool,old,async c=>{await c.query("INSERT INTO topics(title) VALUES('stale')");}),LostLeaseError);
      assert.equal((await pool.query("SELECT * FROM topics WHERE title='stale'")).rowCount,0);
      await finishJob(pool,replacement);
      assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1',[old.id])).rows[0].status,'SUCCEEDED');
    });
    await t.test('outbox rolls back with domain transaction and replay remains idempotent',async()=>{
      await assert.rejects(transaction(pool,async c=>{
        await c.query("INSERT INTO outbox(kind,dedupe_key,payload) VALUES('fixture','rollback','{}')");
        throw new Error('crash before commit');
      }));
      assert.equal((await pool.query("SELECT * FROM outbox WHERE dedupe_key='rollback'")).rowCount,0);
      await pool.query("INSERT INTO outbox(kind,dedupe_key,payload) VALUES('fixture','delivery','{}')");
      await dispatchOutbox(pool);
      await pool.query('UPDATE outbox SET delivered_at=NULL');
      await dispatchOutbox(pool);
      assert.equal((await pool.query("SELECT * FROM jobs WHERE dedupe_key='delivery'")).rowCount,1);
    });
    await t.test('audio cutoff and cross-room tracks are enforced; retention and deletion outbox commit together',async()=>{
      const ownRound=(await pool.query("INSERT INTO rounds(room_id,type) VALUES($1,'SOLO') RETURNING id",[rooms[0]])).rows[0].id;
      const consent=(await pool.query("INSERT INTO recording_consents(room_id,participant_id,policy_version) VALUES($1,$2,'audio-v1') RETURNING id",[rooms[0],participant])).rows[0].id;
      const recording=(await pool.query("INSERT INTO recordings(room_id,round_id,participant_id,consent_id,mime_type,cutoff_ms,retention_until) VALUES($1,$2,$3,$4,'audio/webm',1000,now()) RETURNING id",[rooms[0],ownRound,participant,consent])).rows[0].id;
      await assert.rejects(pool.query("INSERT INTO audio_tracks(room_id,recording_id,round_id,participant_id,media_track_id) VALUES($1,$2,$3,$4,'bad')",[rooms[1],recording,round,participant]),{code:'23503'});
      const track=(await pool.query("INSERT INTO audio_tracks(room_id,recording_id,round_id,participant_id,media_track_id) VALUES($1,$2,$3,$4,'canonical') RETURNING id",[rooms[0],recording,ownRound,participant])).rows[0].id;
      const params=[rooms[0],recording,track,'recordings/fixture/audio.webm','a'.repeat(64)];
      await assert.rejects(pool.query("INSERT INTO audio_segments(room_id,recording_id,track_id,sequence,start_ms,end_ms,object_key,sha256,bytes) VALUES($1,$2,$3,0,0,1001,$4,$5,42)",params),{code:'23514'});
      await pool.query("INSERT INTO audio_segments(room_id,recording_id,track_id,sequence,start_ms,end_ms,object_key,sha256,bytes) VALUES($1,$2,$3,0,0,1000,$4,$5,42)",params);
      await transaction(pool,scheduleRetention);
      await transaction(pool,c=>requestDeletion(c,recording,'RETENTION'));
      assert.equal((await pool.query('SELECT * FROM deletion_tombstones WHERE recording_id=$1',[recording])).rowCount,1);
      assert.equal((await pool.query("SELECT * FROM outbox WHERE kind='storage.delete'")).rowCount,1);
      await assert.rejects(pool.query("UPDATE audio_segments SET bytes=43 WHERE recording_id=$1",[recording]),{code:'23514'});
    });
    await t.test('an expired lease during a transaction rolls back its side effects',async()=>{
      await transaction(pool,c=>enqueue(c,'slow','slow-job',{}));
      const claim=await claimJob(pool,'slow-worker',['slow'],1);assert(claim);
      await assert.rejects(finishJob(pool,claim,async c=>{
        await c.query("INSERT INTO topics(title) VALUES('must-rollback')");
        await c.query('SELECT pg_sleep(1.1)');
      }),LostLeaseError);
      assert.equal((await pool.query("SELECT * FROM topics WHERE title='must-rollback'")).rowCount,0);
    });
    await t.test('killed worker process leaves a durable claim recoverable by a new process owner',async()=>{
      await transaction(pool,c=>enqueue(c,'crash-fixture','crash-job',{}));
      const child=fork(resolve(__dirname,'helpers/claim-child.ts'),[],{execArgv:['--import','tsx'],env:{...process.env,TEST_DB_OPTIONS:`-c search_path=${schema}`},stdio:['ignore','ignore','inherit','ipc']});
      let timer:NodeJS.Timeout|undefined;
      try{
        const [old]=await Promise.race([once(child,'message'),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Child claim timeout')),10000);})]) as [Claim];
        const exited=once(child,'exit');child.kill('SIGKILL');await exited;
        assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1',[old.id])).rows[0].status,'RUNNING');
        await pool.query("UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1",[old.id]);
        const recovered=await claimJob(pool,'after-restart',['crash-fixture'],30);assert(recovered);
        await finishJob(pool,recovered);
        await assert.rejects(finishJob(pool,old),LostLeaseError);
      }finally{if(timer)clearTimeout(timer);child.kill('SIGKILL');}
    });
    await t.test('orphan inventory cannot delete a committed object and tombstones prohibit key reuse',async()=>{
      const referenced=await transaction(pool,c=>queueOrphan(c,'recordings/fixture/audio.webm'));
      assert.equal(referenced,false);
      assert.equal(await transaction(pool,c=>queueOrphan(c,'recordings/orphan/audio.webm')),true);
      assert.equal(await transaction(pool,c=>queueOrphan(c,'recordings/orphan/audio.webm')),true);
      assert.equal((await pool.query("SELECT * FROM deletion_tombstones WHERE object_key='recordings/orphan/audio.webm'")).rowCount,1);
      const recording=(await pool.query('SELECT * FROM recordings LIMIT 1')).rows[0];
      // Simulate stale restored metadata trying to resurrect an erased object key.
      await pool.query("UPDATE recordings SET status='STAGING' WHERE id=$1",[recording.id]);
      const track=(await pool.query("INSERT INTO audio_tracks(room_id,recording_id,round_id,participant_id,media_track_id) VALUES($1,$2,$3,$4,'restore-attempt') RETURNING id",[recording.room_id,recording.id,recording.round_id,recording.participant_id])).rows[0].id;
      await assert.rejects(pool.query("INSERT INTO audio_segments(room_id,recording_id,track_id,sequence,start_ms,end_ms,object_key,sha256,bytes) VALUES($1,$2,$3,0,0,1000,'recordings/orphan/audio.webm',$4,42)",[recording.room_id,recording.id,track,'a'.repeat(64)]),{code:'23514'});

    });
    await t.test('rollback and reapply work on disposable schema',async()=>{
      await migrate(pool,directory,'down'); await migrate(pool,directory,'down');
      assert.equal((await pool.query('SELECT * FROM schema_migrations')).rowCount,0);
      await migrate(pool,directory);
    });
  } finally { await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); }
});
