import cron from 'node-cron';
import db from '@/shared/helpers/database.helper.js';
import { reminderQueue } from '@/queues/reminder.queue.js';
import dayjs from 'dayjs';
import { calculateNextTrigger } from '@/modules/recurrence/recurrence.service.js';

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
        // Calculate next trigger time
        const nextTriggerAt = calculateNextTrigger({
          startAt: new Date(reminder.start_at),
          recurrenceType: reminder.recurrence_type,
          recurrenceInterval: reminder.recurrence_interval,
          timezone: reminder.timezone,
        });

        // Update DB first to prevent double-queuing in the next cron run
        await db.query(
          'UPDATE reminders SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2',
          [nextTriggerAt, reminder.id]
        );

        // Then add to queue with a unique ID to prevent duplicates
        const jobId = `reminder-${reminder.id}-${dayjs(reminder.next_trigger_at).unix()}`;
        await reminderQueue.add('send-notification', {
          reminderId: reminder.id,
          userId: reminder.user_id,
          title: reminder.title,
          message: reminder.message,
          icon: reminder.icon_url,
        }, { 
          jobId,
          removeOnComplete: true,
          removeOnFail: true
        });
      }
    } catch (error) {
      console.error('Scheduler Error:', error);
    }
  });
};
