import { Worker, Job } from 'bullmq';
import redis from '@/lib/redis.js';
import db from '@/shared/helpers/database.helper.js';
import admin from '@/lib/firebase.js';
import { calculateNextTrigger } from '@/modules/recurrence/recurrence.service.js';

export const initWorker = () => {
  const worker = new Worker(
    'reminder-notifications',
    async (job: Job) => {
      const { reminderId, userId, title, message, icon } = job.data;

      // 1. Get user's device tokens
      const devices = await db.queryAll('SELECT fcm_token FROM devices WHERE user_id = $1', [userId]);
      const tokens = devices.map((d: any) => d.fcm_token);

      if (tokens.length > 0) {
        try {
          // 2. Send multicast notification
          const response = await admin.messaging().sendEachForMulticast({
            tokens,
            notification: { title, body: message || '' },
            webpush: {
              notification: icon ? { icon, image: icon } : undefined,
              fcmOptions: { link: '/' },
            },
          });

          // 3. Log results
          await db.query(
            'INSERT INTO notification_logs (status, reminder_id, user_id) VALUES ($1, $2, $3)',
            ['sent', reminderId, userId]
          );

          // 4. Handle invalid tokens
          if (response.failureCount > 0) {
            const tokensToRemove: string[] = [];
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                const error = resp.error?.code;
                if (error === 'messaging/invalid-registration-token' || error === 'messaging/registration-token-not-registered') {
                  tokensToRemove.push(tokens[idx]);
                }
              }
            });

            if (tokensToRemove.length > 0) {
              for (const token of tokensToRemove) {
                await db.query('DELETE FROM devices WHERE fcm_token = $1', [token]);
              }
            }
          }
        } catch (error) {
          console.error('Push Send Error:', error);
          await db.query(
            'INSERT INTO notification_logs (status, error, reminder_id, user_id) VALUES ($1, $2, $3, $4)',
            ['failed', (error as any).message, reminderId, userId]
          );
        }
      }


    },
    { connection: redis }
  );

  worker.on('error', (err) => {
    console.error('Worker Error:', err);
  });

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });
};
