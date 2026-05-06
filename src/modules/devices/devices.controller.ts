import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { z } from 'zod';

export const deviceSchema = {
  body: z.object({
    fcmToken: z.string().min(1),
    browser: z.string().optional(),
    os: z.string().optional(),
  })
};

export const registerDevice = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { fcmToken, browser, os } = req.body;
  const user = (req as any).user;

  const device = await db.queryOne(
    `INSERT INTO devices (fcm_token, browser, os, user_id) 
    VALUES ($1, $2, $3, $4) 
    ON CONFLICT (fcm_token) DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    browser = EXCLUDED.browser,
    os = EXCLUDED.os,
    updated_at = NOW()
    RETURNING *`,
    [fcmToken, browser, os, user.id]
  );

  res.json({ success: true, data: device });
};

export const unregisterDevice = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const user = (req as any).user;
  await db.query('DELETE FROM devices WHERE id = $1 AND user_id = $2', [id, user.id]);
  res.json({ success: true, message: 'Unregistered' });
};
