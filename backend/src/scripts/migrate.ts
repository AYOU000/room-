import { resolve } from 'node:path';
import { createPool } from '../infrastructure/database';
import { migrate } from '../infrastructure/migrations';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const direction = process.argv[2] ?? 'up';
  if (!['up', 'down'].includes(direction)) throw new Error('Use up or down');
  if (direction === 'down' && process.env.ALLOW_DESTRUCTIVE_ROLLBACK !== 'yes') throw new Error('Backup first; explicitly set ALLOW_DESTRUCTIVE_ROLLBACK=yes');
  const pool = createPool(process.env.DATABASE_URL);
  try { await migrate(pool, resolve(__dirname, '../../migrations'), direction as 'up' | 'down'); }
  finally { await pool.end(); }
}
main().catch(() => { console.error('Migration failed. Check connectivity, migration checksums and ALLOW_DESTRUCTIVE_ROLLBACK for down.'); process.exitCode = 1; });
