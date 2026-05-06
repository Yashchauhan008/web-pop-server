import type { Request, Response, NextFunction } from 'express';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { z } from 'zod';

export const tagSchema = {
  body: z.object({
    name: z.string().min(1),
    color: z.string().optional(),
  })
};

export const createTag = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { name, color } = req.body;
  const user = (req as any).user;

  const tag = await db.queryOne(
    'INSERT INTO tags (name, color, user_id) VALUES ($1, $2, $3) RETURNING *',
    [name, color, user.id]
  );

  res.status(201).json({ success: true, data: tag });
};

export const getTags = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const user = (req as any).user;
  const tags = await db.queryAll('SELECT * FROM tags WHERE user_id = $1', [user.id]);
  res.json({ success: true, data: tags });
};

export const deleteTag = async (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => {
  const { id } = req.params;
  const user = (req as any).user;
  await db.query('DELETE FROM tags WHERE id = $1 AND user_id = $2', [id, user.id]);
  res.json({ success: true, message: 'Deleted' });
};
