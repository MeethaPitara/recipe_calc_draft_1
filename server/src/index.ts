/**
 * Meetha Pitara — Express Backend Server
 * Entry point for all API routes.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import { authRouter } from './routes/auth.js';
import { ingredientsRouter } from './routes/ingredients.js';
import { recipesRouter } from './routes/recipes.js';
import { plansRouter } from './routes/plans.js';
import { aiRouter } from './routes/ai.js';
import { mlRouter } from './routes/ml.js';
import { calcRouter } from './routes/calc.js';
import { optimizeRouter } from './routes/optimize.js';
import { eventsRouter } from './routes/events.js';
import { productionRouter } from './routes/production.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
const corsOriginEnv = process.env.CORS_ORIGIN?.trim();

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);

        // If CORS_ORIGIN is "*" or not set, allow all origins
        if (!corsOriginEnv || corsOriginEnv === '*') {
            return callback(null, origin);
        }

        // Check against whitelist
        const allowedOrigins = corsOriginEnv.split(',').map(s => s.trim());
        if (allowedOrigins.includes(origin)) {
            return callback(null, origin);
        }

        callback(new Error(`CORS: Origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // Large payloads for image upload (label scanner)

// ── Health Check ──
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Route Mounting ──
app.use('/api/auth', authRouter);
app.use('/api/ingredients', ingredientsRouter);
app.use('/api/recipes', recipesRouter);
app.use('/api/plans', plansRouter);
app.use('/api/ai', aiRouter);
app.use('/api/ml', mlRouter);
app.use('/api/calc', calcRouter);
app.use('/api/optimize', optimizeRouter);
app.use('/api/events', eventsRouter);
app.use('/api/production', productionRouter);

// ── Global Error Handler ──
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        error: err.message || 'Internal server error',
    });
});

// ── Start ──
app.listen(PORT, () => {
    console.log(`🚀 Meetha Pitara API running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
});

export default app;
