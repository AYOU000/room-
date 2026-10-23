import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { setTimeout as sleep } from 'node:timers/promises';
import { deletionPayloadSchema, maintenancePayloadSchema, orphanScanPayloadSchema, jobTypes } from '@room/contracts';
import { readEnvironment } from './config/env';
import { createLogger } from './config/logger';
import { createPool, transaction } from './infrastructure/database';
import { createStorage } from './infrastructure/storage';
import { claimJob, dispatchOutbox, enqueue, failJob, finishJob, heartbeat } from './infrastructure/jobs';
import { queueOrphan } from './infrastructure/orphans';
import { scheduleRetention } from './infrastructure/retention';

async function main() {
  const env = readEnvironment();
  const logger = createLogger(env.LOG_LEVEL);
  const pool = createPool(env.DATABASE_URL);
  const storage = createStorage(env);
  const owner = randomUUID();
  let draining = false, lastPoll = 0;
  pool.on('error', () => logger.error('Worker database connection error'));
  const health = createServer((req,res) => {
    const live = req.url === '/health/live';
    const ready = req.url === '/health/ready';
    const ok = live || (ready && !draining && Date.now()-lastPoll < 15000);
    res.writeHead(live || ready ? (ok ? 200 : 503) : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: draining ? 'draining' : ok ? 'ok' : 'unavailable', service: 'worker' }));
  }).listen(env.WORKER_PORT);
  let deadline: NodeJS.Timeout | undefined;
  for (const signal of ['SIGTERM','SIGINT'] as const) process.once(signal, () => {
    draining = true;
    logger.info('Worker draining: finish current claim, then stop');
    deadline = setTimeout(() => process.exit(1),25000); deadline.unref();
  });
  try {
    while (!draining) {
      try {
        await storage.ready();
        // DB clock gives all workers the same hourly maintenance idempotency key.
        await transaction(pool, async client => {
          const hour = await client.query("SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD-HH24') AS value");
          await enqueue(client,'storage.retention',`retention:${hour.rows[0].value}`,{});
          await enqueue(client,'storage.orphans',`orphans:${hour.rows[0].value}`,{});
        });
        await dispatchOutbox(pool);
        const claim = await claimJob(pool,owner,jobTypes,env.JOB_LEASE_SECONDS);
        lastPoll = Date.now();
        if (!claim) { await sleep(500); continue; }
        let leaseLost = false;
        const timer = setInterval(() => { void heartbeat(pool,claim,env.JOB_LEASE_SECONDS).then(() => { lastPoll = Date.now(); }).catch(() => { leaseLost = true; }); }, env.JOB_LEASE_SECONDS*1000/3);
        try {
          if (claim.kind === 'storage.retention') {
            maintenancePayloadSchema.parse(claim.payload);
            await finishJob(pool,claim,scheduleRetention);
          } else if (claim.kind === 'storage.orphans') {
            const payload=orphanScanPayloadSchema.parse(claim.payload);
            const page=await storage.inventory(payload.cursor);
            await finishJob(pool,claim,async client=>{
              const clock=await client.query("SELECT clock_timestamp()-interval '1 day' AS cutoff");
              for(const object of page.Contents??[]) {
                if(object.Key && object.LastModified && object.LastModified < clock.rows[0].cutoff) await queueOrphan(client,object.Key);
              }
              if(page.IsTruncated && page.NextContinuationToken) await enqueue(client,'storage.orphans',`orphan-page:${claim.id}`,{cursor:page.NextContinuationToken});
            });
          } else if (claim.kind === 'storage.delete') {
            const { tombstoneId } = deletionPayloadSchema.parse(claim.payload);
            const result = await pool.query('SELECT * FROM deletion_tombstones WHERE id=$1', [tombstoneId]);
            if (!result.rowCount) throw new Error('Missing deletion tombstone');
            const tombstone = result.rows[0];
            // Deletion is monotonic and idempotent; keys must never be reused, including after restore.
            if (!leaseLost) await storage.remove(tombstone.object_key);
            if (leaseLost) throw new Error('Lease lost');
            await finishJob(pool,claim, async client => {
              await client.query('UPDATE deletion_tombstones SET deleted_at=clock_timestamp() WHERE id=$1', [tombstoneId]);
              await client.query(`UPDATE recordings SET status='DELETED' WHERE id=$1 AND status='DELETING'
                AND NOT EXISTS(SELECT 1 FROM deletion_tombstones WHERE recording_id=$1 AND deleted_at IS NULL)`, [tombstone.recording_id]);
            });
          }
          logger.info({ jobId: claim.id, kind: claim.kind, fence: claim.fence },'Job completed');
        } catch {
          logger.error({ jobId: claim.id, kind: claim.kind, fence: claim.fence },'Job failed or ownership expired');
          await failJob(pool,claim).catch(() => {});
        } finally { clearInterval(timer); }
      } catch { logger.error('Worker dependency check or poll failed'); await sleep(1000); }
    }
  } finally { health.close(); await pool.end(); storage.close(); if (deadline) clearTimeout(deadline); }
}
main().catch(() => { console.error('Worker startup failed; validate configuration'); process.exitCode = 1; });
