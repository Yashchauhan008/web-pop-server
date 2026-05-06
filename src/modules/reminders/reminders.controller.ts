import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { calculateNextTrigger } from '@/modules/recurrence/recurrence.service.js';
import { z } from 'zod';

export const reminderSchema = {
  body: z.object({
    title: z.string().min(1),
    message: z.string().optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime().optional(),
    recurrenceType: z.enum(['once', 'secondly', 'minutely', 'hourly', 'daily', 'weekly', 'monthly', 'custom']),
    recurrenceInterval: z.number().optional(),
    timezone: z.string().default('UTC'),
    tagIds: z.array(z.string()).optional(),
  })
};

export const createReminder = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const data = req.body;
  const user = (req as any).user;

  const nextTriggerAt = calculateNextTrigger({
    startAt: new Date(data.startAt),
    recurrenceType: data.recurrenceType,
    recurrenceInterval: data.recurrenceInterval,
    timezone: data.timezone,
  });

  await db.begin();
  try {
    const reminder = await db.queryOne(
      `INSERT INTO reminders 
      (title, message, start_at, end_at, recurrence_type, recurrence_interval, timezone, next_trigger_at, user_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING id, title, message, start_at as "startAt", end_at as "endAt", 
      recurrence_type as "recurrenceType", recurrence_interval as "recurrenceInterval", 
      timezone, next_trigger_at as "nextTriggerAt", is_active as "isActive", is_paused as "isPaused"`,
      [data.title, data.message, data.startAt, data.endAt, data.recurrenceType, data.recurrenceInterval, data.timezone, nextTriggerAt, user.id]
    );

    if (data.tagIds?.length) {
      for (const tagId of data.tagIds) {
        await db.query('INSERT INTO reminder_tags (reminder_id, tag_id) VALUES ($1, $2)', [reminder.id, tagId]);
      }
    }

    await db.commit();
    res.status(201).json({ success: true, data: reminder });
  } catch (error) {
    await db.rollback();
    next(error);
  }
};

export const getReminders = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const reminders = await db.queryAll(
    `SELECT r.id, r.title, r.message, 
    r.start_at as "startAt", r.end_at as "endAt", 
    r.recurrence_type as "recurrenceType", r.recurrence_interval as "recurrenceInterval", 
    r.timezone, r.next_trigger_at as "nextTriggerAt", 
    r.is_active as "isActive", r.is_paused as "isPaused",
    COALESCE(json_agg(t.*) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
    FROM reminders r
    LEFT JOIN reminder_tags rt ON r.id = rt.reminder_id
    LEFT JOIN tags t ON rt.tag_id = t.id
    WHERE r.user_id = $1
    GROUP BY r.id
    ORDER BY r.next_trigger_at ASC`,
    [user.id]
  );
  res.json({ success: true, data: reminders });
};

export const updateReminder = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const data = req.body;
  const user = (req as any).user;

  const existing = await db.queryOne('SELECT * FROM reminders WHERE id = $1 AND user_id = $2', [id, user.id]);
  if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

  let nextTriggerAt = existing.next_trigger_at;
  if (data.startAt || data.recurrenceType || data.recurrenceInterval || data.timezone) {
    nextTriggerAt = calculateNextTrigger({
      startAt: new Date(data.startAt || existing.start_at),
      recurrenceType: data.recurrenceType || existing.recurrence_type,
      recurrenceInterval: data.recurrenceInterval || existing.recurrence_interval,
      timezone: data.timezone || existing.timezone,
    });
  }

  await db.begin();
  try {
    const updated = await db.queryOne(
      `UPDATE reminders SET 
      title = COALESCE($1, title),
      message = COALESCE($2, message),
      start_at = COALESCE($3, start_at),
      end_at = COALESCE($4, end_at),
      recurrence_type = COALESCE($5, recurrence_type),
      recurrence_interval = COALESCE($6, recurrence_interval),
      timezone = COALESCE($7, timezone),
      next_trigger_at = $8,
      updated_at = NOW()
      WHERE id = $9 AND user_id = $10
      RETURNING id, title, message, start_at as "startAt", end_at as "endAt", 
      recurrence_type as "recurrenceType", recurrence_interval as "recurrenceInterval", 
      timezone, next_trigger_at as "nextTriggerAt", is_active as "isActive", is_paused as "isPaused"`,
      [data.title, data.message, data.startAt, data.endAt, data.recurrenceType, data.recurrenceInterval, data.timezone, nextTriggerAt, id, user.id]
    );

    if (data.tagIds) {
      await db.query('DELETE FROM reminder_tags WHERE reminder_id = $1', [id]);
      for (const tagId of data.tagIds) {
        await db.query('INSERT INTO reminder_tags (reminder_id, tag_id) VALUES ($1, $2)', [id, tagId]);
      }
    }

    await db.commit();
    res.json({ success: true, data: updated });
  } catch (error) {
    await db.rollback();
    next(error);
  }
};

export const deleteReminder = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const user = (req as any).user;
  await db.query('DELETE FROM reminders WHERE id = $1 AND user_id = $2', [id, user.id]);
  res.json({ success: true, message: 'Deleted' });
};

export const toggleReminderStatus = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const { isActive, isPaused } = req.body;
  const user = (req as any).user;
  
  const updated = await db.queryOne(
    'UPDATE reminders SET is_active = COALESCE($1, is_active), is_paused = COALESCE($2, is_paused) WHERE id = $3 AND user_id = $4 RETURNING id, is_active as "isActive", is_paused as "isPaused"',
    [isActive, isPaused, id, user.id]
  );
  
  res.json({ success: true, data: updated });
};
