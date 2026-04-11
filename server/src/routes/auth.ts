/**
 * Auth Routes
 * Migrated from src/lib/auth/authService.ts
 *
 * POST /api/auth/signup   — Register new user
 * POST /api/auth/signin   — Login
 * POST /api/auth/guest    — Guest session
 * GET  /api/auth/me       — Current user (requires auth)
 */

import { Router } from 'express';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabaseClient.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const JWT_SECRET_STR = process.env.JWT_SECRET || 'meetha-pitara-default-dev-secret-change-me';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STR);
const TOKEN_EXPIRY = '7d';
const BCRYPT_ROUNDS = 10;

const GUEST_USER = { id: '00000000-0000-0000-0000-000000000000', email: 'guest@meethapitara.app' };

interface AppUser {
    id: string;
    email: string;
}

async function createToken(user: AppUser): Promise<string> {
    return new SignJWT({ sub: user.id, email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(JWT_SECRET);
}

// ── POST /signup ──
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required.' });
            return;
        }

        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const { data, error } = await supabase
            .from('app_users')
            .insert({ email: email.toLowerCase().trim(), password_hash: hash })
            .select('id, email')
            .single();

        if (error) {
            if (error.code === '23505') {
                res.status(409).json({ error: 'This email is already registered.' });
                return;
            }
            res.status(500).json({ error: error.message });
            return;
        }

        const user: AppUser = { id: data.id, email: data.email };
        const token = await createToken(user);

        res.json({ session: { user, token } });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Sign up failed' });
    }
});

// ── POST /signin ──
router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required.' });
            return;
        }

        const { data, error } = await supabase
            .from('app_users')
            .select('id, email, password_hash')
            .eq('email', email.toLowerCase().trim())
            .single();

        if (error || !data) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }

        const match = await bcrypt.compare(password, data.password_hash);
        if (!match) {
            res.status(401).json({ error: 'Invalid email or password.' });
            return;
        }

        const user: AppUser = { id: data.id, email: data.email };
        const token = await createToken(user);

        res.json({ session: { user, token } });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Sign in failed' });
    }
});

// ── POST /guest ──
router.post('/guest', async (_req, res) => {
    try {
        const token = await createToken(GUEST_USER);
        res.json({ session: { user: GUEST_USER, token } });
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Guest sign-in failed' });
    }
});

// ── GET /me ──
router.get('/me', requireAuth as any, (req, res) => {
    res.json({ user: req.user });
});

export { router as authRouter };
