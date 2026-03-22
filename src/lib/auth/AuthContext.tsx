/**
 * AuthContext — React context providing auth state and actions.
 * Wraps the app so any component can call useAuth().
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from './authService';
import type { AppUser, AuthSession } from './types';

interface AuthContextValue {
    user: AppUser | null;
    session: AuthSession | null;
    loading: boolean;
    isGuest: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => void;
    continueAsGuest: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<AuthSession | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialise from stored JWT
    useEffect(() => {
        let mounted = true;

        authService.getSession().then((s) => {
            if (mounted) {
                setSession(s);
                setLoading(false);
            }
        });

        // Cross-tab & in-tab listener
        const { unsubscribe } = authService.onAuthStateChange((_event, newSession) => {
            if (mounted) {
                setSession(newSession);
            }
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        const result = await authService.signIn(email, password);
        if (result.session) setSession(result.session);
        return { error: result.error };
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
        const result = await authService.signUp(email, password);
        if (result.session) setSession(result.session);
        return { error: result.error };
    }, []);

    const signOut = useCallback(() => {
        authService.signOut();
        setSession(null);
    }, []);

    const continueAsGuest = useCallback(async () => {
        const result = await authService.signInAsGuest();
        setSession(result.session);
    }, []);

    return (
        <AuthContext.Provider
            value={{
                user: session?.user ?? null,
                session,
                loading,
                isGuest: authService.isGuest(),
                signIn,
                signUp,
                signOut,
                continueAsGuest,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access auth state & actions.
 */
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an <AuthProvider>');
    }
    return ctx;
}
