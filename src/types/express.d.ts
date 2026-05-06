// src/types/express.d.ts';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      email?: string;
      name?: string;
      avatar_url?: string;
      firebase_uid?: string;
    }

    interface Request {
      validatedQuery?: any;
      id?: string;
      user?: AuthUser;
    }
  }
}

export {};
