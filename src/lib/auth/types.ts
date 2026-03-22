/**
 * Custom auth types — replaces @supabase/supabase-js Session / User.
 */

export interface AppUser {
    id: string;
    email: string;
}

export interface AuthSession {
    user: AppUser;
    token: string;
}
