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
import { JWT_SECRET } from '../lib/jwtConfig.js';

const router = Router();

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
        const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : '';
        const password = typeof req.body?.password === 'string' ? req.body.password : '';
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'Password must be at least 6 characters.' });
            return;
        }

        const { data: existingUser, error: lookupError } = await supabase
            .from('app_users')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (lookupError) throw lookupError;
        if (existingUser) {
            res.status(409).json({ error: 'This email is already registered.' });
            return;
        }

        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Supabase Auth sends the confirmation message. The app's custom JWT is
        // issued only after the user confirms and later signs in.
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) {
            const partiallyCreatedUserId = (authData as any)?.user?.id;
            if (partiallyCreatedUserId) {
                await supabase.auth.admin.deleteUser(partiallyCreatedUserId);
            }
            console.error('Email confirmation signup failed:', authError.message);
            res.status(503).json({ error: 'Could not send the confirmation email. The app owner may need to configure email delivery.' });
            return;
        }
        if (!authData.user || authData.user.identities?.length === 0) {
            res.status(409).json({ error: 'This email may already have an account. Try signing in.' });
            return;
        }
        if (authData.session) {
            // Do not silently allow unverified signup if Confirm Email is later
            // disabled in Supabase.
            await supabase.auth.admin.deleteUser(authData.user.id);
            res.status(503).json({ error: 'Email confirmation is not enabled for this project.' });
            return;
        }

        const { data, error } = await supabase
            .from('app_users')
            .insert({ id: authData.user.id, email, password_hash: hash })
            .select('id, email')
            .single();

        if (error) {
            await supabase.auth.admin.deleteUser(authData.user.id);
            if (error.code === '23505') {
                res.status(409).json({ error: 'This email is already registered.' });
                return;
            }
            console.error('Could not create pending app account:', error.message);
            res.status(500).json({ error: 'Could not finish creating the account.' });
            return;
        }

        res.status(202).json({ email: data.email, verificationRequired: true });
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

        // New accounts have matching Supabase Auth IDs. Older custom-JWT
        // accounts have no Auth identity and remain able to sign in.
        const { data: authData, error: authError } = await supabase.auth.admin.getUserById(data.id);
        if (authError && authError.status !== 404) {
            console.error('Could not check email confirmation:', authError.message);
            res.status(503).json({ error: 'Could not verify account status. Please try again.' });
            return;
        }
        if (authData.user && !authData.user.email_confirmed_at) {
            res.status(403).json({ error: 'Please confirm your email address before signing in. Check your inbox and spam folder.' });
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
