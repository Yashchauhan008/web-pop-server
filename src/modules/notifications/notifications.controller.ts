import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import admin from '@/lib/firebase.js';

export const getNotificationHistory = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;
  const search = req.query.search as string;

  let query = `
    SELECT nl.*, r.title as reminder_title 
    FROM notification_logs nl 
    LEFT JOIN reminders r ON nl.reminder_id = r.id 
    WHERE nl.user_id = $1 
  `;
  const params: any[] = [user.id];

  if (search) {
    query += ` AND (r.title ILIKE $2 OR nl.error ILIKE $2 OR 'System Alert' ILIKE $2) `;
    params.push(`%${search}%`);
  }

  query += ` ORDER BY nl.sent_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const history = await db.queryAll(query, params);
  res.json({ success: true, data: history });
};

export const clearNotificationHistory = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  await db.query('DELETE FROM notification_logs WHERE user_id = $1', [user.id]);
  res.json({ success: true, message: 'History cleared' });
};

export const testNotification = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const devices = await db.queryAll('SELECT fcm_token FROM devices WHERE user_id = $1', [user.id]);
  
  if (devices.length === 0) {
    return res.status(400).json({ success: false, message: 'No registered devices' });
  }

  const tokens = devices.map(d => d.fcm_token);
  const message: any = {
    tokens,
    data: {
      title: 'Test Notification',
      body: 'If you see this, notifications are working!',
      icon: '',
      image: '',
      link: '/app/settings'
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    await db.query(
      'INSERT INTO notification_logs (status, user_id) VALUES ($1, $2)',
      ['sent', user.id]
    );
    res.json({ success: true, data: response });
  } catch (error) {
    await db.query(
      'INSERT INTO notification_logs (status, error, user_id) VALUES ($1, $2, $3)',
      ['failed', (error as any).message, user.id]
    );
    next(error);
  }
};

export const testReminderNotification = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const user = (req as any).user;

  const reminder = await db.queryOne(
    `SELECT r.*,
    COALESCE(
      f.url,
      CASE WHEN r.icon LIKE 'http%' THEN r.icon ELSE NULL END
    ) as icon_url
    FROM reminders r
    LEFT JOIN files f ON f.id::text = r.icon
    WHERE r.id = $1 AND r.user_id = $2`,
    [id, user.id]
  );
  if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found' });

  const devices = await db.queryAll('SELECT fcm_token FROM devices WHERE user_id = $1', [user.id]);
  if (devices.length === 0) return res.status(400).json({ success: false, message: 'No registered devices' });

  const tokens = devices.map(d => d.fcm_token);
  const message: any = {
    tokens,
    data: {
      title: `🔔 ${reminder.title}`,
      body: reminder.message || 'Time for your reminder!',
      icon: reminder.icon_url || '',
      image: reminder.icon_url || '',
      reminderId: id,
      link: `/app/reminders/${id}`
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    await db.query(
      'INSERT INTO notification_logs (status, reminder_id, user_id) VALUES ($1, $2, $3)',
      ['sent', id, user.id]
    );
    res.json({ success: true, data: response });
  } catch (error) {
    await db.query(
      'INSERT INTO notification_logs (status, error, reminder_id, user_id) VALUES ($1, $2, $3, $4)',
      ['failed', (error as any).message, id, user.id]
    );
    next(error);
  }
};

export const purgeQueue = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { reminderQueue } = await import('@/queues/reminder.queue.js');
  await reminderQueue.drain(true); // Drains all waiting/delayed jobs
  res.json({ success: true, message: 'Notification queue purged' });
};
