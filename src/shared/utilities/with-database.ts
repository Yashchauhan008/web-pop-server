import type { NextFunction, Request, Response } from 'express';
import Database from '@/shared/helpers/database.helper.js';
import type { DatabaseClient } from '@/shared/helpers/database.helper.js';


function WithDatabase(controller: (req: Request, res: Response, next: NextFunction, db: DatabaseClient) => Promise<any>) {
    return async (req: Request, res: Response, next: NextFunction) => {
        let db: DatabaseClient | null = null;
        try {
            db = await Database.getConnection();
            await controller(req, res, next, db);
        } catch (error) {
            next(error);
        } finally {
            if (db) db.release();
        }
    };
}

export default WithDatabase;
