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
        `SELECT r.*,
        COALESCE(
          f.url,
          CASE WHEN r.icon LIKE 'http%' THEN r.icon ELSE NULL END
        ) as icon_url
        FROM reminders r
        LEFT JOIN files f ON f.id::text = r.icon
        WHERE r.is_active = true 
        AND r.is_paused = false 
        AND r.next_trigger_at <= $1`,
        [now]
      );

      for (const reminder of dueReminders) {
        await reminderQueue.add('send-notification', {
          reminderId: reminder.id,
          userId: reminder.user_id,
          title: reminder.title,
          message: reminder.message,
          icon: reminder.icon_url,
        });
      }
    } catch (error) {
      console.error('Scheduler Error:', error);
    }
  });
};
