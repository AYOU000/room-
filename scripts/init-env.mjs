import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const template = await readFile(new URL('../.env.example',import.meta.url),'utf8');
const db = randomBytes(24).toString('hex');
const object = randomBytes(24).toString('hex');
const content = template.replaceAll('room_local_database_only',db).replaceAll('room_local_storage_only_change_me',object);
await writeFile(new URL('../.env',import.meta.url),content,{flag:'wx',mode:0o600});
console.log('Created .env with random local credentials. Existing files are never overwritten.');
