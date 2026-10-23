import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import type { Environment } from '../config/env';
import { createStorage } from './storage';
import { z } from 'zod';

const manifestSchema = z.object({ version:z.literal(1), objects:z.array(z.object({
  key:z.string(), file:z.string().regex(/^[a-f0-9]{64}\.bin$/), sha256:z.string().regex(/^[a-f0-9]{64}$/), bytes:z.number().int().nonnegative(), contentType:z.string(),
})) });
export async function backupObjects(env:Environment,directory:string) {
  await mkdir(directory,{recursive:false,mode:0o700});
  const storage=createStorage(env);
  const objects:z.infer<typeof manifestSchema>['objects']=[];
  try {
    let cursor:string|undefined;
    do {
      const page=await storage.client.send(new ListObjectsV2Command({Bucket:env.S3_BUCKET,ContinuationToken:cursor}));
      for(const object of page.Contents??[]) {
        if(!object.Key?.startsWith('recordings/'))continue; // staging is ephemeral and never restored
        const result=await storage.client.send(new GetObjectCommand({Bucket:env.S3_BUCKET,Key:object.Key}));
        const body=await result.Body!.transformToByteArray();
        const sha256=createHash('sha256').update(body).digest('hex');
        const file=createHash('sha256').update(object.Key).digest('hex')+'.bin';
        await writeFile(join(directory,file),body,{flag:'wx',mode:0o600});
        objects.push({key:object.Key,file,sha256,bytes:body.length,contentType:result.ContentType??'application/octet-stream'});
      }
      cursor=page.IsTruncated?page.NextContinuationToken:undefined;
    }while(cursor);
    await writeFile(join(directory,'manifest.json'),JSON.stringify({version:1,objects},null,2),{flag:'wx',mode:0o600});
    return objects.length;
  }finally{storage.close();}
}
export async function restoreObjects(env:Environment,directory:string,tombstonedKeys:ReadonlySet<string>) {
  const manifest=manifestSchema.parse(JSON.parse(await readFile(join(directory,'manifest.json'),'utf8')));
  const storage=createStorage(env);
  try {
    // Verify all backup bytes before writing anything to the destination.
    for(const entry of manifest.objects){
      const body=await readFile(join(directory,entry.file));
      if(body.length!==entry.bytes||createHash('sha256').update(body).digest('hex')!==entry.sha256)throw new Error('Backup integrity mismatch');
    }
    let restored=0;
    for(const entry of manifest.objects){
      if(tombstonedKeys.has(entry.key)){await storage.remove(entry.key);continue;}
      const body=await readFile(join(directory,entry.file));
      await storage.put(entry.key,body,entry.contentType);restored++;
    }
    return restored;
  }finally{storage.close();}
}
