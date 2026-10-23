import { createPool } from '../infrastructure/database';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = createPool(process.env.DATABASE_URL);
  try { await pool.query("INSERT INTO topics(title,description,category) VALUES('Should cities prioritize public transport?', 'Development topic; no fabricated users or credentials.', 'Society') ON CONFLICT(title) DO NOTHING"); }
  finally { await pool.end(); }
}
main().catch(() => { console.error('Seed failed'); process.exitCode = 1; });
