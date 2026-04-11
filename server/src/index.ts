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
import { aiRouter } from './routes/ai.js';
import { mlRouter } from './routes/ml.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:5173', 'http://localhost:8080'],
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
app.use('/api/ai', aiRouter);
app.use('/api/ml', mlRouter);

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
