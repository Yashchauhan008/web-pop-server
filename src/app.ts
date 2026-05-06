import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import Logger from './shared/configs/logger.js';
import errorHandler from './shared/middlewares/error-handler.js';
import appRoute from './app.route.js';
import RedisClient from './shared/configs/redis.js';

import env from './shared/configs/env.js';


import apiRoutes from './routes/index.js';
import { initScheduler } from './modules/scheduler/scheduler.service.js';
import { initWorker } from './workers/notification.worker.js';

const app = express();

app.use(morgan(':method :url Status : :status, Time taken: :response-time ms', {
    stream: { write: (message) => Logger.info(message) },
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Keep popup auth flows (e.g., Google Sign-In) working with window.postMessage.
app.use('/api/v1/auth', (_req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
});

// Health check route
const serverStartTimeStamp = new Date().toISOString();

// Status route
app.get('/', (req, res) => {
    res.status(200).json({
        status: 'OK',
        version: '1.0.0',
        startTime: serverStartTimeStamp,
        service: env.SERVICE_NAME,
        codeSign: 'R.P.Raiyani',
        author: 'rajraiyani.com',
    });
});

app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// API Routes
app.use('/api/v1', apiRoutes);

// Error handler
app.use(errorHandler);

// Initialize Services
initScheduler();
initWorker();

export default app;

