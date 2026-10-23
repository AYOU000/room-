import { randomUUID } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { readEnvironment } from '../config/env';
import { createPool,transaction } from '../infrastructure/database';
import { backupObjects,restoreObjects } from '../infrastructure/backup';

const tombstoneSchema=z.array(z.object({id:z.uuid(),recording_id:z.uuid(),object_key:z.string(),reason:z.enum(['RETENTION','CONSENT','USER_REQUEST','ORPHAN']),requested_at:z.string()}));
async function main(){
 const env=readEnvironment();const [command,directory,tombstoneFile]=process.argv.slice(2);
 if(!directory)throw new Error('Usage: objects backup|export-tombstones|restore PATH [current-tombstones.json]');
 if(command==='backup') {console.log(`Backed up ${await backupObjects(env,directory)} objects`);return;}
 const pool=createPool(env.DATABASE_URL);
 try {
  if(command==='export-tombstones'){
   const rows=await pool.query('SELECT id,recording_id,object_key,reason,requested_at FROM deletion_tombstones ORDER BY object_key');
   await writeFile(directory,JSON.stringify(rows.rows,null,2),{flag:'wx',mode:0o600});return;
  }
  if(command!=='restore'||!tombstoneFile)throw new Error('Restore requires the latest independent tombstone export');
  const latest=tombstoneSchema.parse(JSON.parse(await readFile(tombstoneFile,'utf8')));
  await transaction(pool,async client=>{
   for(const row of latest) await client.query(`INSERT INTO deletion_tombstones(id,recording_id,object_key,reason,requested_at)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(object_key) DO NOTHING`,[row.id,row.recording_id,row.object_key,row.reason,row.requested_at]);
   await client.query("UPDATE recordings SET status='DELETING' WHERE id IN (SELECT recording_id FROM deletion_tombstones)");
   await client.query('DELETE FROM transcript_segments WHERE recording_id IN (SELECT recording_id FROM deletion_tombstones)');
   await client.query('DELETE FROM recording_manifests WHERE recording_id IN (SELECT recording_id FROM deletion_tombstones)');
  });
  const denied=await pool.query<{object_key:string}>('SELECT object_key FROM deletion_tombstones');
  const count=await restoreObjects(env,directory,new Set(denied.rows.map(r=>r.object_key)));
  await pool.query(`INSERT INTO outbox(kind,dedupe_key,payload)
   SELECT 'storage.delete',$1||id::text,jsonb_build_object('tombstoneId',id) FROM deletion_tombstones
   ON CONFLICT(dedupe_key) DO NOTHING`,[`restore-delete:${randomUUID()}:`]);
  console.log(`Restored ${count} objects; tombstoned objects excluded; deletion reconciliation queued`);
 }finally{await pool.end();}
}
main().catch(()=>{console.error('Object backup/restore failed; retain maintenance mode and inspect configuration, checksums and tombstone export');process.exitCode=1;});
