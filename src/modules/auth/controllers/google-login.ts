import type { NextFunction, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';
import { STATUS_CODES } from '@/shared/constants/status-codes.js';
import { createJWTToken } from '@/shared/utilities/token.js';
import { TOKEN_TYPES } from '../auth.constant.js';
import z from 'zod';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(googleClientId);

export const ValidationSchema = {
  body: z.object({
    credential: z.string().min(1),
  }),
};

export async function Controller(
  req: Request,
  res: Response,
  next: NextFunction,
  db: DatabaseClient,
) {
  const { credential } = req.body as z.infer<typeof ValidationSchema.body>;

  try {
    if (!googleClientId) {
      return res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ 
        success: false, 
        message: 'GOOGLE_CLIENT_ID is not configured on server' 
      });
    }

    // 1. Verify the Google ID Token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      return res.status(STATUS_CODES.UNAUTHORIZED).json({ 
        success: false, 
        message: 'Invalid Google token' 
      });
    }

    const { sub, email, name, picture } = payload;
    
    // 2. Sync with local users table
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

    // 3. Issue our own long-lived JWT (7 days)
    const accessToken = await createJWTToken(
      { type: TOKEN_TYPES.USER_ACCESS_TOKEN, user_id: user.id },
      '7d',
    );

    return res.status(STATUS_CODES.OK).json({
      success: true,
      token: accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatar_url
      },
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(STATUS_CODES.UNAUTHORIZED).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
}
