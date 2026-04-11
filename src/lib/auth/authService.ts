/**
 * authService — Frontend auth client.
 *
 * All authentication logic (JWT signing, bcrypt hashing, DB queries) has been
 * moved to the backend. This module now delegates to /api/auth/* endpoints.
 *
 * Local responsibilities:
 *  - Token storage in localStorage
 *  - Cross-tab auth state synchronization (BroadcastChannel)
 *  - Sync user access via JWT payload decoding (no verification)
 */

import { apiPost, apiGet } from '@/lib/apiClient';
import type { AppUser, AuthSession } from './types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TOKEN_KEY = 'mp_auth_token';
const GUEST_KEY = 'mp_guest_mode';
const CHANNEL_NAME = 'mp-auth';

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
     * Register a new user via backend API.
     */
    async signUp(email: string, password: string): Promise<{ session: AuthSession | null; error: string | null }> {
        try {
            const data = await apiPost<{ session: AuthSession }>('/api/auth/signup', { email, password });
            localStorage.setItem(TOKEN_KEY, data.session.token);
            notifyListeners('SIGNED_IN', data.session);
            return { session: data.session, error: null };
        } catch (e: any) {
            return { session: null, error: e.message || 'Sign up failed' };
        }
    },

    /**
     * Sign in via backend API.
     */
    async signIn(email: string, password: string): Promise<{ session: AuthSession | null; error: string | null }> {
        try {
            const data = await apiPost<{ session: AuthSession }>('/api/auth/signin', { email, password });
            localStorage.setItem(TOKEN_KEY, data.session.token);
            notifyListeners('SIGNED_IN', data.session);
            return { session: data.session, error: null };
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
     * Sign in as a guest via backend API.
     */
    async signInAsGuest(): Promise<{ session: AuthSession }> {
        const data = await apiPost<{ session: AuthSession }>('/api/auth/guest');
        localStorage.setItem(TOKEN_KEY, data.session.token);
        localStorage.setItem(GUEST_KEY, 'true');
        notifyListeners('SIGNED_IN', data.session);
        return { session: data.session };
    },

    /**
     * Check if the current session is a guest session.
     */
    isGuest(): boolean {
        return localStorage.getItem(GUEST_KEY) === 'true';
    },

    /**
     * Get the current session from the stored JWT.
     * Decodes locally (no network call) for speed.
     */
    async getSession(): Promise<AuthSession | null> {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        const user = this.getUserSync();
        if (!user) {
            localStorage.removeItem(TOKEN_KEY);
            return null;
        }
        return { user, token };
    },

    /**
     * Get the current user (or null).
     */
    async getUser(): Promise<AppUser | null> {
        const session = await this.getSession();
        return session?.user ?? null;
    },

    /**
     * Synchronous version — decodes JWT payload without verification.
     */
    getUserSync(): AppUser | null {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;
        try {
            const [, payloadB64] = token.split('.');
            const payload = JSON.parse(atob(payloadB64));
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
     * Subscribe to auth state changes.
     */
    onAuthStateChange(callback: AuthCallback): { unsubscribe: () => void } {
        listeners.add(callback);
        getBroadcastChannel();
        return {
            unsubscribe: () => {
                listeners.delete(callback);
            },
        };
    },
};
