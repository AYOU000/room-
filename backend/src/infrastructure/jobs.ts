import type { Pool, PoolClient } from 'pg';
import { transaction } from './database';

export interface Claim { id: string; kind: string; payload: unknown; owner: string; fence: string; attempts: number }
export class LostLeaseError extends Error { constructor() { super('Worker ownership expired or was replaced'); } }
export async function enqueue(client: PoolClient, kind: string, dedupeKey: string, payload: unknown) {
  const inserted = await client.query('INSERT INTO jobs(kind,dedupe_key,payload) VALUES($1,$2,$3) ON CONFLICT(dedupe_key) DO NOTHING RETURNING id', [kind,dedupeKey,JSON.stringify(payload)]);
  if (inserted.rowCount) return inserted.rows[0].id as string;
  const existing = await client.query('SELECT id FROM jobs WHERE dedupe_key=$1 AND kind=$2 AND payload=$3::jsonb', [dedupeKey,kind,JSON.stringify(payload)]);
  if (!existing.rowCount) throw new Error('Idempotency key reused with different job');
  return existing.rows[0].id as string;
}
export async function claimJob(pool: Pool, owner: string, kinds: readonly string[], seconds: number): Promise<Claim | undefined> {
  if (!owner || !Number.isInteger(seconds) || seconds < 1) throw new Error('Invalid lease');
  return transaction(pool, async client => {
    await client.query(`UPDATE jobs SET status='FAILED', owner=NULL, lease_until=NULL, last_error='Lease expired after final attempt'
      WHERE status='RUNNING' AND lease_until<=clock_timestamp() AND attempts>=max_attempts AND kind=ANY($1::text[])`, [kinds]);
    const result = await client.query<Claim>(`WITH next AS (
      SELECT id FROM jobs WHERE kind=ANY($1::text[]) AND attempts<max_attempts AND
      ((status='PENDING' AND available_at<=clock_timestamp()) OR (status='RUNNING' AND lease_until<=clock_timestamp()))
      ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1
    ) UPDATE jobs SET status='RUNNING',owner=$2,lease_until=clock_timestamp()+make_interval(secs=>$3),
      fence=fence+1,attempts=attempts+1 FROM next WHERE jobs.id=next.id RETURNING jobs.*`, [kinds,owner,seconds]);
    return result.rows[0];
  });
}
export async function heartbeat(pool: Pool, claim: Claim, seconds: number) {
  const result = await pool.query(`UPDATE jobs SET lease_until=clock_timestamp()+make_interval(secs=>$4)
    WHERE id=$1 AND owner=$2 AND fence=$3 AND status='RUNNING' AND lease_until>clock_timestamp()`, [claim.id,claim.owner,claim.fence,seconds]);
  if (!result.rowCount) throw new LostLeaseError();
}
export async function finishJob(pool: Pool, claim: Claim, effect: (client: PoolClient) => Promise<void> = async () => {}) {
  await transaction(pool, async client => {
    const owned = await client.query(`SELECT id FROM jobs WHERE id=$1 AND owner=$2 AND fence=$3 AND status='RUNNING'
      AND lease_until>clock_timestamp() FOR UPDATE`, [claim.id,claim.owner,claim.fence]);
    if (!owned.rowCount) throw new LostLeaseError();
    await effect(client);
    const result = await client.query(`UPDATE jobs SET status='SUCCEEDED',owner=NULL,lease_until=NULL,completed_at=clock_timestamp()
      WHERE id=$1 AND owner=$2 AND fence=$3 AND lease_until>clock_timestamp()`, [claim.id,claim.owner,claim.fence]);
    if (!result.rowCount) throw new LostLeaseError();
  });
}
export async function failJob(pool: Pool, claim: Claim) {
  const result = await pool.query(`UPDATE jobs SET status=CASE WHEN attempts>=max_attempts THEN 'FAILED' ELSE 'PENDING' END,
    owner=NULL,lease_until=NULL,last_error='Handler failed; see correlated worker log',
    available_at=clock_timestamp()+make_interval(secs=>LEAST(300,power(2,attempts)::integer))
    WHERE id=$1 AND owner=$2 AND fence=$3 AND status='RUNNING' AND lease_until>clock_timestamp()`, [claim.id,claim.owner,claim.fence]);
  if (!result.rowCount) throw new LostLeaseError();
}
export async function dispatchOutbox(pool: Pool) {
  return transaction(pool, async client => {
    const events = await client.query('SELECT * FROM outbox WHERE delivered_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 100');
    for (const event of events.rows) {
      await enqueue(client,event.kind,event.dedupe_key,event.payload);
      await client.query('UPDATE outbox SET delivered_at=clock_timestamp() WHERE id=$1', [event.id]);
    }
    return events.rowCount;
  });
}
