import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccountPathCandidates = [
  process.env.FCM_SERVICE_ACCOUNT_PATH,
  join(process.cwd(), 'fcm.json'),
  join(process.cwd(), 'FCM.json'),
].filter((path): path is string => Boolean(path));

const resolveServiceAccountPath = () => {
  for (const path of serviceAccountPathCandidates) {
    try {
      readFileSync(path, 'utf8');
      return path;
    } catch {
      // Try next candidate path
    }
  }
  return serviceAccountPathCandidates[0];
};

try {
  const serviceAccountPath = resolveServiceAccountPath();
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log(`Firebase Admin initialized successfully using ${serviceAccountPath}`);
  }
} catch (error) {
  console.warn('Failed to initialize Firebase Admin using service account file:', (error as any).message);
  console.warn('Push notifications will not work until a valid fcm.json is provided.');
}

export default admin;
