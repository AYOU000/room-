import { readEnvironment } from '../config/env';
import { createStorage } from '../infrastructure/storage';
async function main() {
  const storage = createStorage(readEnvironment());
  try { await storage.provision(); }
  finally { storage.close(); }
}
main().catch(() => { console.error('Private storage initialization failed; check access and existing bucket policy'); process.exitCode = 1; });
