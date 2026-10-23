import { Pool } from 'pg';
import { claimJob } from '../../src/infrastructure/jobs';
const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,options:process.env.TEST_DB_OPTIONS});
claimJob(pool,'crashing-process',['crash-fixture'],30).then(claim=>{
 if(!claim)throw new Error('No job');
 process.send?.(claim);
 setInterval(()=>{},1000);
}).catch(()=>process.exit(1));
