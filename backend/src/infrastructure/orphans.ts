import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
// Called after inventory finds an object older than the upload acceptance window.
// Serialize on the object key with the audio_segments trigger to avoid deleting a concurrent commit.
export async function queueOrphan(client:PoolClient,key:string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
  const referenced=await client.query('SELECT 1 FROM audio_segments WHERE object_key=$1',[key]);
  if(referenced.rowCount)return false;
  const result=await client.query(`INSERT INTO deletion_tombstones(recording_id,object_key,reason)
    VALUES($1,$2,'ORPHAN') ON CONFLICT(object_key) DO UPDATE SET object_key=EXCLUDED.object_key RETURNING id`,[randomUUID(),key]);
  const id=result.rows[0].id;
  await client.query(`INSERT INTO outbox(kind,dedupe_key,payload) VALUES('storage.delete',$1,$2)
    ON CONFLICT(dedupe_key) DO NOTHING`,[`delete:${id}`,JSON.stringify({tombstoneId:id})]);
  return true;
}
