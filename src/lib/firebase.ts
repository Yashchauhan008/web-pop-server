import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

const serviceAccountPath = join(process.cwd(), 'FCM.json');

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized successfully using FCM.json');
  }
} catch (error) {
  console.warn('Failed to initialize Firebase Admin with FCM.json:', (error as any).message);
  console.warn('Push notifications will not work until a valid FCM.json is provided.');
}

export default admin;
