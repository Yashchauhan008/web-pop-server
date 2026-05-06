import type { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import db from '@/shared/helpers/database.helper.js';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(googleClientId);

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!googleClientId) {
      return res.status(500).json({ success: false, message: 'GOOGLE_CLIENT_ID is not configured on server' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Google ID Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: googleClientId,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const { sub, email, name, picture } = payload;
    
    // Sync with local users table
    // We still use 'firebase_uid' column but it now stores the Google 'sub'
    let user = await db.queryOne('SELECT * FROM users WHERE firebase_uid = $1', [sub]);

    if (!user) {
      user = await db.queryOne(
        'INSERT INTO users (name, email, firebase_uid, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [name || 'User', email, sub, picture]
      );
    }

    req.user = user as Express.AuthUser;
    next();
  } catch (error) {
    console.error('Auth Error:', error);
    // Handle the specific timeout error with a better message
    if ((error as any).code === 'ERR_JWKS_TIMEOUT' || (error as any).message?.includes('timeout')) {
      return res.status(503).json({ success: false, message: 'Authentication server timeout. Please try again.' });
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
