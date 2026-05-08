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
    let user = await db.queryOne('SELECT * FROM users WHERE firebase_uid = $1', [sub]);

    if (!user) {
      // Create new user
      user = await db.queryOne(
        'INSERT INTO users (name, email, firebase_uid, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
        [name || 'User', email, sub, picture]
      );
    } else if (user.name !== (name || 'User') || user.avatar_url !== picture || user.email !== email) {
      // Update existing user if details changed
      user = await db.queryOne(
        'UPDATE users SET name = $1, avatar_url = $2, email = $3, updated_at = NOW() WHERE firebase_uid = $4 RETURNING *',
        [name || 'User', picture, email, sub]
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
