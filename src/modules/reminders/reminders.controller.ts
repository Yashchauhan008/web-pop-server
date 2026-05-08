import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { calculateNextTrigger } from '@/modules/recurrence/recurrence.service.js';
import { z } from 'zod';

export const reminderSchema = {
  body: z.object({
    title: z.string().min(1),
    message: z.string().optional().nullable(),
    iconFileId: z.string().uuid().optional().nullable(),
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
      (title, message, icon, start_at, end_at, recurrence_type, recurrence_interval, timezone, next_trigger_at, user_id) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING id`,
      [data.title, data.message, data.iconFileId, data.startAt, data.endAt, data.recurrenceType, data.recurrenceInterval, data.timezone, nextTriggerAt, user.id]
    );

    const createdReminder = await db.queryOne(
      `SELECT r.id, r.title, r.message, r.icon as "iconFileId",
      COALESCE(
        f.url,
        CASE WHEN r.icon LIKE 'http%' THEN r.icon ELSE NULL END
      ) as "iconUrl",
      r.start_at as "startAt", r.end_at as "endAt", 
      r.recurrence_type as "recurrenceType", r.recurrence_interval as "recurrenceInterval", 
      r.timezone, r.next_trigger_at as "nextTriggerAt", 
      r.is_active as "isActive", r.is_paused as "isPaused"
      FROM reminders r
      LEFT JOIN files f ON f.id::text = r.icon
      WHERE r.id = $1 AND r.user_id = $2`,
      [reminder.id, user.id]
    );

    if (data.tagIds?.length) {
      for (const tagId of data.tagIds) {
        await db.query('INSERT INTO reminder_tags (reminder_id, tag_id) VALUES ($1, $2)', [reminder.id, tagId]);
      }
    }

    await db.commit();
    res.status(201).json({ success: true, data: createdReminder });
  } catch (error) {
    await db.rollback();
    next(error);
  }
};

export const getReminders = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const reminders = await db.queryAll(
    `SELECT r.id, r.title, r.message, r.icon as "iconFileId",
    COALESCE(
      MAX(f.url),
      CASE WHEN r.icon LIKE 'http%' THEN r.icon ELSE NULL END
    ) as "iconUrl",
    r.start_at as "startAt", r.end_at as "endAt", 
    r.recurrence_type as "recurrenceType", r.recurrence_interval as "recurrenceInterval", 
    r.timezone, r.next_trigger_at as "nextTriggerAt", 
    r.is_active as "isActive", r.is_paused as "isPaused",
    COALESCE(json_agg(t.*) FILTER (WHERE t.id IS NOT NULL), '[]') as tags
    FROM reminders r
    LEFT JOIN files f ON f.id::text = r.icon
    LEFT JOIN reminder_tags rt ON r.id = rt.reminder_id
    LEFT JOIN tags t ON rt.tag_id = t.id
    WHERE r.user_id = $1
    GROUP BY r.id
    ORDER BY r.next_trigger_at ASC`,
    [user.id]
  );
  res.json({ success: true, data: reminders });
};

export const updateReminderSchema = {
  body: z.object({
    title: z.string().min(1).optional(),
    message: z.string().optional().nullable(),
    iconFileId: z.string().uuid().optional().nullable(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional().nullable(),
    recurrenceType: z.enum(['once', 'secondly', 'minutely', 'hourly', 'daily', 'weekly', 'monthly', 'custom']).optional(),
    recurrenceInterval: z.number().optional(),
    timezone: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
  })
};

export const updateReminder = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const data = req.body;
  const user = (req as any).user;

  if (!id) return res.status(400).json({ success: false, message: 'Invalid reminder id' });

  const existing = await db.queryOne('SELECT * FROM reminders WHERE id = $1 AND user_id = $2', [id, user.id]);
  if (!existing) return res.status(404).json({ success: false, message: 'Not found' });

  // Always recalculate nextTriggerAt if any scheduling field changed, 
  // or if the current nextTriggerAt is in the past/null and we are updating the reminder.
  const hasScheduleChange = data.startAt || data.recurrenceType || data.recurrenceInterval || data.timezone;
  const isExpired = !existing.next_trigger_at || new Date(existing.next_trigger_at) < new Date();
  
  let nextTriggerAt = existing.next_trigger_at;
  
  if (hasScheduleChange || isExpired) {
    nextTriggerAt = calculateNextTrigger({
      startAt: new Date(data.startAt || existing.start_at),
      recurrenceType: data.recurrenceType || existing.recurrence_type,
      recurrenceInterval: data.recurrenceInterval !== undefined ? data.recurrenceInterval : existing.recurrence_interval,
      timezone: data.timezone || existing.timezone,
    });
  }

  await db.begin();
  try {
    const updatedRow = await db.queryOne(
      `UPDATE reminders SET 
      title = $1,
      message = $2,
      icon = $3,
      start_at = $4,
      end_at = $5,
      recurrence_type = $6,
      recurrence_interval = $7,
      timezone = $8,
      next_trigger_at = $9,
      updated_at = NOW()
      WHERE id = $10 AND user_id = $11
      RETURNING id`,
      [
        data.title !== undefined ? data.title : existing.title,
        data.message !== undefined ? data.message : existing.message,
        data.iconFileId !== undefined ? data.iconFileId : existing.icon,
        data.startAt !== undefined ? data.startAt : existing.start_at,
        data.endAt !== undefined ? data.endAt : existing.end_at,
        data.recurrenceType !== undefined ? data.recurrenceType : existing.recurrence_type,
        data.recurrenceInterval !== undefined ? data.recurrenceInterval : existing.recurrence_interval,
        data.timezone !== undefined ? data.timezone : existing.timezone,
        nextTriggerAt,
        id,
        user.id
      ]
    );

    const updated = await db.queryOne(
      `SELECT r.id, r.title, r.message, r.icon as "iconFileId",
      COALESCE(
        f.url,
        CASE WHEN r.icon LIKE 'http%' THEN r.icon ELSE NULL END
      ) as "iconUrl",
      r.start_at as "startAt", r.end_at as "endAt", 
      r.recurrence_type as "recurrenceType", r.recurrence_interval as "recurrenceInterval", 
      r.timezone, r.next_trigger_at as "nextTriggerAt", 
      r.is_active as "isActive", r.is_paused as "isPaused"
      FROM reminders r
      LEFT JOIN files f ON f.id::text = r.icon
      WHERE r.id = $1 AND r.user_id = $2`,
      [updatedRow.id, user.id]
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
  const idParam = req.params.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const user = (req as any).user;
  if (!id) return res.status(400).json({ success: false, message: 'Invalid reminder id' });
  await db.query('DELETE FROM reminders WHERE id = $1 AND user_id = $2', [id, user.id]);
  res.json({ success: true, message: 'Deleted' });
};

export const toggleReminderStatus = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const { isPaused } = req.body;
  const user = (req as any).user;
  await db.query(
    'UPDATE reminders SET is_paused = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
    [isPaused, id, user.id]
  );
  res.json({ success: true, message: 'Status updated' });
};

export const snoozeReminder = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const { minutes = 15 } = req.body;
  const user = (req as any).user;
  
  const nextTrigger = new Date(Date.now() + minutes * 60000);
  
  await db.query(
    'UPDATE reminders SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
    [nextTrigger.toISOString(), id, user.id]
  );
  
  res.json({ success: true, message: `Snoozed for ${minutes} minutes`, data: { nextTrigger } });
};

export const completeReminder = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const user = (req as any).user;
  
  const reminder = await db.queryOne('SELECT * FROM reminders WHERE id = $1 AND user_id = $2', [id, user.id]);
  if (!reminder) return res.status(404).json({ success: false, message: 'Not found' });
  
  if (reminder.recurrence_type === 'once') {
    await db.query('UPDATE reminders SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
  } else {
    const nextTriggerAt = RemindersService.calculateNextTrigger({
      startAt: new Date(reminder.start_at),
      recurrenceType: reminder.recurrence_type,
      recurrenceInterval: reminder.recurrence_interval,
      timezone: reminder.timezone
    });
    await db.query('UPDATE reminders SET next_trigger_at = $1, updated_at = NOW() WHERE id = $2', [nextTriggerAt, id]);
  }
  
  res.json({ success: true, message: 'Marked as completed' });
};
