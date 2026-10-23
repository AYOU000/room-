import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Pool } from 'pg';

export async function migrate(pool: Pool, directory: string, direction: 'up' | 'down' = 'up') {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(7251905)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = await client.query<{ name: string; sha256: string }>('SELECT name,sha256 FROM schema_migrations ORDER BY name');
    const files = (await readdir(directory)).filter(f => f.endsWith('.up.sql')).sort();
    for (const row of applied.rows) {
      const source = await readFile(join(directory, row.name), 'utf8');
      if (createHash('sha256').update(source).digest('hex') !== row.sha256) throw new Error(`Applied migration changed: ${row.name}`);
    }
    const targets = direction === 'up' ? files.filter(f => !applied.rows.some(r => r.name === f)) : applied.rows.slice(-1).map(r => r.name);
    for (const name of targets) {
      const sql = await readFile(join(directory, direction === 'up' ? name : name.replace('.up.sql', '.down.sql')), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        if (direction === 'up') await client.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [name,createHash('sha256').update(sql).digest('hex')]);
        else await client.query('DELETE FROM schema_migrations WHERE name=$1', [name]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(7251905)');
    client.release();
  }
}
