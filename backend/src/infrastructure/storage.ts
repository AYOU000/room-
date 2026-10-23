import {
  S3Client, HeadBucketCommand, CreateBucketCommand, GetBucketPolicyCommand,
  PutBucketLifecycleConfigurationCommand, PutObjectCommand, GetObjectCommand,
  DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Environment } from '../config/env';

export function createStorage(env: Environment) {
  const client = new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    requestHandler: { connectionTimeout: 5000, requestTimeout: 10000 }, maxAttempts: 3 });
  const Bucket = env.S3_BUCKET;
  function key(Key: string) {
    if (!/^(staging|recordings)\/[a-zA-Z0-9/_-]+\.[a-z0-9]+$/.test(Key) || Key.includes('..')) throw new Error('Invalid private object key');
    return Key;
  }
  return {
    client, close: () => client.destroy(),
    ready: async () => { await client.send(new HeadBucketCommand({ Bucket })); },
    async provision() {
      try { await client.send(new HeadBucketCommand({ Bucket })); }
      catch (error) {
        if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
        await client.send(new CreateBucketCommand({ Bucket,
          ...(env.S3_REGION === 'us-east-1' ? {} : { CreateBucketConfiguration: { LocationConstraint: env.S3_REGION as 'eu-west-1' } }) }));
      }
      try {
        await client.send(new GetBucketPolicyCommand({ Bucket }));
        throw new Error('Bucket policy exists: review it before provisioning private storage');
      } catch (error) {
        if ((error as { name?: string }).name !== 'NoSuchBucketPolicy') throw error;
      }
      await client.send(new PutBucketLifecycleConfigurationCommand({ Bucket, LifecycleConfiguration: { Rules: [{
        ID: 'staging-expiry', Status: 'Enabled', Filter: { Prefix: 'staging/' },
        Expiration: { Days: 1 }, AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
      }] } }));
    },
    async put(Key: string, Body: Uint8Array, ContentType: string) {
      await client.send(new PutObjectCommand({ Bucket, Key: key(Key), Body, ContentType, IfNoneMatch: '*' }));
    },
    async inventory(cursor?: string) {
      return client.send(new ListObjectsV2Command({ Bucket, Prefix:'recordings/', MaxKeys:100, ContinuationToken:cursor }));
    },
    async head(Key: string) { return client.send(new HeadObjectCommand({ Bucket, Key: key(Key) })); },
    async remove(Key: string) { await client.send(new DeleteObjectCommand({ Bucket, Key: key(Key) })); },
    // Caller must authorize membership and check tombstones before invoking this primitive.
    async signedRead(Key: string) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key(Key) }), { expiresIn: 60 });
    },
  };
}
