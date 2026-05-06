import { Queue } from 'bullmq';
import redis from '@/lib/redis.js';

export const reminderQueue = new Queue('reminder-notifications', {
  connection: redis,
});
