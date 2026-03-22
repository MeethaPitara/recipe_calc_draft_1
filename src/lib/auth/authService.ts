/**
 * authService — custom JWT authentication backed by Supabase DB table `app_users`.
 *
 * Replaces supabase.auth.* with:
 *  - signUp / signIn / signOut
 *  - getSession / getUser (sync, from localStorage JWT)
 *  - onAuthStateChange (cross-tab via BroadcastChannel + storage event)
 */

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { supabase } from '@/integrations/supabase/client';
import type { AppUser, AuthSession } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'mp_auth_token';
const GUEST_KEY = 'mp_guest_mode';
const GUEST_USER: AppUser = { id: '00000000-0000-0000-0000-000000000000', email: 'guest@meethapitara.app' };
const JWT_SECRET_STR = import.meta.env.VITE_JWT_SECRET || 'meetha-pitara-default-dev-secret-change-me';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STR);
const TOKEN_EXPIRY = '7d'; // 7 days
const BCRYPT_ROUNDS = 10;
const CHANNEL_NAME = 'mp-auth';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function createToken(user: AppUser): Promise<string> {
    return new SignJWT({ sub: user.id, email: user.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(JWT_SECRET);
}

async function verifyToken(token: string): Promise<AppUser | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        if (!payload.sub || !payload.email) return null;
        return { id: payload.sub, email: payload.email as string };
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Auth state change listeners
// ---------------------------------------------------------------------------
type AuthCallback = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: AuthSession | null) => void;

const listeners = new Set<AuthCallback>();
let channel: BroadcastChannel | null = null;

function getBroadcastChannel() {
    if (!channel && typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (e) => {
            const { event, session } = e.data as { event: 'SIGNED_IN' | 'SIGNED_OUT'; session: AuthSession | null };
            listeners.forEach(cb => cb(event, session));
        };
    }
    return channel;
}

function notifyListeners(event: 'SIGNED_IN' | 'SIGNED_OUT', session: AuthSession | null) {
    listeners.forEach(cb => cb(event, session));
    try {
        getBroadcastChannel()?.postMessage({ event, session });
    } catch {
        // BroadcastChannel not available in some environments
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const authService = {
    /**
     * Register a new user. Hashes password and stores in `app_users` table.
     */
    async signUp(email: string, password: string): Promise<{ session: AuthSession | null; error: string | null }> {
        try {
            const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

            const { data, error } = await (supabase as any)
                .from('app_users')
                .insert({ email: email.toLowerCase().trim(), password_hash: hash })
                .select('id, email')
                .single();

            if (error) {
                if (error.code === '23505') {
                    return { session: null, error: 'This email is already registered. Please sign in instead.' };
                }
                return { session: null, error: error.message };
            }

            const user: AppUser = { id: data.id, email: data.email };
            const token = await createToken(user);
            const session: AuthSession = { user, token };

            localStorage.setItem(TOKEN_KEY, token);
            notifyListeners('SIGNED_IN', session);

            return { session, error: null };
        } catch (e: any) {
            return { session: null, error: e.message || 'Sign up failed' };
        }
    },

    /**
     * Sign in with email + password. Validates against `app_users` table.
     */
    async signIn(email: string, password: string): Promise<{ session: AuthSession | null; error: string | null }> {
        try {
            const { data, error } = await (supabase as any)
                .from('app_users')
                .select('id, email, password_hash')
                .eq('email', email.toLowerCase().trim())
                .single();

            if (error || !data) {
                return { session: null, error: 'Invalid email or password. Please try again.' };
            }

            const match = await bcrypt.compare(password, data.password_hash);
            if (!match) {
                return { session: null, error: 'Invalid email or password. Please try again.' };
            }

            const user: AppUser = { id: data.id, email: data.email };
            const token = await createToken(user);
            const session: AuthSession = { user, token };

            localStorage.setItem(TOKEN_KEY, token);
            notifyListeners('SIGNED_IN', session);

            return { session, error: null };
        } catch (e: any) {
            return { session: null, error: e.message || 'Sign in failed' };
        }
    },

    /**
     * Sign out — clears the JWT from storage.
     */
    signOut() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(GUEST_KEY);
        notifyListeners('SIGNED_OUT', null);
    },

    /**
     * Sign in as a guest — no database call, creates a synthetic session.
     * Uses a fixed guest identity so features like recipe save use "guest@meethapitara.app".
     */
    async signInAsGuest(): Promise<{ session: AuthSession }> {
        const token = await createToken(GUEST_USER);
        const session: AuthSession = { user: GUEST_USER, token };

        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(GUEST_KEY, 'true');
        notifyListeners('SIGNED_IN', session);

        return { session };
    },

    /**
     * Check if the current session is a guest session.
     */
    isGuest(): boolean {
        return localStorage.getItem(GUEST_KEY) === 'true';
    },

    /**
     * Get the current session from the stored JWT. Returns null if expired or absent.
     */
    async getSession(): Promise<AuthSession | null> {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        const user = await verifyToken(token);
        if (!user) {
            localStorage.removeItem(TOKEN_KEY);
            return null;
        }
        return { user, token };
    },

    /**
     * Convenience: get the current user (or null).
     */
    async getUser(): Promise<AppUser | null> {
        const session = await this.getSession();
        return session?.user ?? null;
    },

    /**
     * Synchronous version for places that cannot be async.
     * Decodes the JWT payload without full verification (expiry is still checked).
     */
    getUserSync(): AppUser | null {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;
        try {
            const [, payloadB64] = token.split('.');
            const payload = JSON.parse(atob(payloadB64));
            // Check expiry
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                localStorage.removeItem(TOKEN_KEY);
                return null;
            }
            if (!payload.sub || !payload.email) return null;
            return { id: payload.sub, email: payload.email };
        } catch {
            return null;
        }
    },

    /**
     * Subscribe to auth state changes (sign in / sign out).
     * Returns an unsubscribe function.
     */
    onAuthStateChange(callback: AuthCallback): { unsubscribe: () => void } {
        listeners.add(callback);
        getBroadcastChannel(); // ensure channel is set up
        return {
            unsubscribe: () => {
                listeners.delete(callback);
            },
        };
    },
};
