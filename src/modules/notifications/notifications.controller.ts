import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import admin from '@/lib/firebase.js';

export const getNotificationHistory = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const history = await db.queryAll(
    `SELECT nl.*, r.title as reminder_title 
    FROM notification_logs nl 
    LEFT JOIN reminders r ON nl.reminder_id = r.id 
    WHERE nl.user_id = $1 
    ORDER BY nl.sent_at DESC`,
    [user.id]
  );
  res.json({ success: true, data: history });
};

export const testNotification = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const devices = await db.queryAll('SELECT fcm_token FROM devices WHERE user_id = $1', [user.id]);
  
  if (devices.length === 0) {
    return res.status(400).json({ success: false, message: 'No registered devices' });
  }

  const tokens = devices.map(d => d.fcm_token);
  const message = {
    notification: {
      title: 'Test Notification',
      body: 'If you see this, notifications are working!',
    },
    tokens,
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

  console.log('Testing reminder:', id, 'for user:', user?.id);

  const reminder = await db.queryOne('SELECT * FROM reminders WHERE id = $1 AND user_id = $2', [id, user.id]);
  if (!reminder) return res.status(404).json({ success: false, message: 'Reminder not found' });

  const devices = await db.queryAll('SELECT fcm_token FROM devices WHERE user_id = $1', [user.id]);
  if (devices.length === 0) return res.status(400).json({ success: false, message: 'No registered devices' });

  const tokens = devices.map(d => d.fcm_token);
  const message = {
    notification: {
      title: `🔔 ${reminder.title}`,
      body: reminder.message || 'Time for your reminder!',
    },
    tokens,
    webpush: {
      fcmOptions: { link: '/' },
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
