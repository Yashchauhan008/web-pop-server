import { S3Client } from '@aws-sdk/client-s3';
import env from './env.js';

const s3Config: ConstructorParameters<typeof S3Client>[0] = {
    region: env.AWS_REGION || 'ap-south-1',
};

if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    s3Config.credentials = {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    };
}

export const s3 = new S3Client(s3Config);
