/**
 * Meetha Pitara — Express Backend Server
 * Entry point for all API routes.
 * (Triggering restart to load new .env port)
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
import { targetProfilesRouter } from './routes/targetProfiles.js';
import { costsRouter } from './routes/costs.js';
import { trialsRouter } from './routes/trials.js';
import { exportsRouter } from './routes/exports.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──
app.use(cors({
    origin: (origin, callback) => {
        // Always reflect the requesting origin (or allow if no origin)
        callback(null, origin || true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
app.use('/api/target-profiles', targetProfilesRouter);
app.use('/api/costs', costsRouter);
app.use('/api/trials', trialsRouter);
app.use('/api/exports', exportsRouter);

// ── Global Error Handler ──
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        error: err.message || 'Internal server error',
    });
});

// ── Graceful Shutdown ──
let server: ReturnType<typeof app.listen> | null = null;

function shutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('✅ Server closed.');
            process.exit(0);
        });
        // Force exit after 3s if connections are hanging
        setTimeout(() => process.exit(0), 3000);
    } else {
        process.exit(0);
    }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ── Start (with auto-recovery from EADDRINUSE) ──
function startServer(retried = false) {
    server = app.listen(PORT, () => {
        console.log(`🚀 Meetha Pitara API running on http://localhost:${PORT}`);
        console.log(`   Health: http://localhost:${PORT}/api/health`);
    });

    server.on('error', async (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && !retried) {
            console.warn(`⚠️  Port ${PORT} is busy. Attempting to free it...`);
            try {
                const { execSync } = await import('child_process');
                // Use PowerShell to find PIDs holding the port (works reliably on Windows)
                const out = execSync(
                    `powershell -Command "(Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique"`,
                    { encoding: 'utf-8' }
                ).trim();
                const pids = [...new Set(out.split(/\r?\n/).map(p => p.trim()).filter(Boolean))];
                for (const pid of pids) {
                    if (!pid || pid === String(process.pid) || pid === '0' || pid === '4') continue; // don't kill ourselves or critical system processes
                    try {
                        execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf-8' });
                        console.log(`   Killed PID ${pid}`);
                    } catch { /* already gone */ }
                }
                // Brief pause then retry
                setTimeout(() => startServer(true), 1500);
            } catch (killErr) {
                console.error('❌ Could not free port automatically. Please change the PORT in .env or kill the process manually.');
                process.exit(1);
            }
        } else {
            console.error(`❌ Server error: ${err.message}`);
            process.exit(1);
        }
    });
}

startServer();

export default app;
