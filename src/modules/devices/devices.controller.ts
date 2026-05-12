import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { z } from 'zod';

export const deviceSchema = {
  body: z.object({
    fcmToken: z.string().min(1),
    browser: z.string().optional(),
    os: z.string().optional(),
    nickname: z.string().optional(),
  })
};

export const updateDeviceSchema = {
  body: z.object({
    nickname: z.string().min(1).max(50),
  })
};

export const getDevices = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const devices = await db.queryAll(
    'SELECT * FROM devices WHERE user_id = $1 ORDER BY updated_at DESC',
    [user.id]
  );
  res.json({ success: true, data: devices });
};

export const registerDevice = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { fcmToken, browser, os, nickname } = req.body;
  const user = (req as any).user;

  const device = await db.queryOne(
    `INSERT INTO devices (fcm_token, browser, os, user_id, nickname) 
    VALUES ($1, $2, $3, $4, $5) 
    ON CONFLICT (fcm_token) DO UPDATE SET 
    user_id = EXCLUDED.user_id,
    browser = EXCLUDED.browser,
    os = EXCLUDED.os,
    nickname = COALESCE(devices.nickname, EXCLUDED.nickname),
    updated_at = NOW()
    RETURNING *`,
    [fcmToken, browser, os, user.id, nickname]
  );

  res.json({ success: true, data: device });
};

export const updateDevice = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const { nickname } = req.body;
  const user = (req as any).user;

  const device = await db.queryOne(
    'UPDATE devices SET nickname = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *',
    [nickname, id, user.id]
  );

  if (!device) {
    return res.status(404).json({ success: false, message: 'Device not found' });
  }

  res.json({ success: true, data: device });
};

export const unregisterDevice = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const user = (req as any).user;
  await db.query('DELETE FROM devices WHERE id = $1 AND user_id = $2', [id, user.id]);
  res.json({ success: true, message: 'Unregistered' });
};
