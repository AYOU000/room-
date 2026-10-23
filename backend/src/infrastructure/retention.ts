import type { PoolClient } from 'pg';
// Caller holds a fenced job transaction. Feature owners can use requestDeletion in their own transaction.
export async function requestDeletion(client: PoolClient, recordingId: string, reason: 'RETENTION' | 'CONSENT' | 'USER_REQUEST') {
  const recording = await client.query('SELECT id FROM recordings WHERE id=$1 FOR UPDATE', [recordingId]);
  if (!recording.rowCount) throw new Error('Recording not found');
  await client.query("UPDATE recordings SET status='DELETING' WHERE id=$1 AND status<>'DELETED'", [recordingId]);
  const tombstones = await client.query(`INSERT INTO deletion_tombstones(recording_id,object_key,reason)
    SELECT recording_id,object_key,$2 FROM audio_segments WHERE recording_id=$1
    ON CONFLICT(object_key) DO UPDATE SET object_key=EXCLUDED.object_key RETURNING id`, [recordingId,reason]);
  for (const tombstone of tombstones.rows) {
    await client.query(`INSERT INTO outbox(kind,dedupe_key,payload) VALUES('storage.delete',$1,$2)
      ON CONFLICT(dedupe_key) DO NOTHING`, [`delete:${tombstone.id}`, JSON.stringify({ tombstoneId: tombstone.id })]);
  }
  // Purge derived text and manifests immediately; retain consent and tombstone audit metadata.
  await client.query('DELETE FROM transcript_segments WHERE recording_id=$1', [recordingId]);
  await client.query('DELETE FROM recording_manifests WHERE recording_id=$1', [recordingId]);
  if (!tombstones.rowCount) await client.query("UPDATE recordings SET status='DELETED' WHERE id=$1", [recordingId]);
}
export async function scheduleRetention(client: PoolClient) {
  const expired = await client.query(`SELECT id FROM recordings WHERE retention_until<=clock_timestamp()
    AND status NOT IN ('DELETING','DELETED') ORDER BY retention_until FOR UPDATE SKIP LOCKED LIMIT 100`);
  for (const recording of expired.rows) await requestDeletion(client,recording.id,'RETENTION');
}
