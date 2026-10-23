import { spawnSync } from 'node:child_process';
const host=new URL(process.env.DATABASE_URL).hostname;
if(!['localhost','127.0.0.1'].includes(host))throw new Error('Local integration runner requires a loopback database. Set TEST_DATABASE_URL explicitly for other test hosts.');
const result=spawnSync('npm',['run','test:integration'],{stdio:'inherit',env:{...process.env,TEST_DATABASE_URL:process.env.DATABASE_URL,TEST_S3_ENDPOINT:process.env.S3_ENDPOINT}});
process.exit(result.status??1);
