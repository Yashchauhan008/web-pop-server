import cron from 'node-cron';
import db from '@/shared/helpers/database.helper.js';
import { reminderQueue } from '@/queues/reminder.queue.js';
import dayjs from 'dayjs';

export const initScheduler = () => {
  // Check for due reminders every 10 seconds
  cron.schedule('*/10 * * * * *', async () => {
    try {
      const now = dayjs().toISOString();
      const dueReminders = await db.queryAll(
        `SELECT * FROM reminders 
        WHERE is_active = true 
        AND is_paused = false 
        AND next_trigger_at <= $1`,
        [now]
      );

      for (const reminder of dueReminders) {
        await reminderQueue.add('send-notification', {
          reminderId: reminder.id,
          userId: reminder.user_id,
          title: reminder.title,
          message: reminder.message,
        });
      }
    } catch (error) {
      console.error('Scheduler Error:', error);
    }
  });
};
