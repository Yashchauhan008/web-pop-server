import type { Request, Response, NextFunction } from 'express';
import db from '@/shared/helpers/database.helper.js';
import { decodeJWTToken } from '@/shared/utilities/token.js';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // 1. Verify our local JWT Token
    const payload = await decodeJWTToken<{ user_id: string }>(token);
    
    if (!payload || !payload.user_id) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // 2. Fetch user from DB
    const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [payload.user_id]);

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user as Express.AuthUser;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
