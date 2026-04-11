/**
 * Server-side Supabase client
 * Uses SUPABASE_SERVICE_KEY (not anon key) for full DB access.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error(
        'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables.\n' +
        'Add them to server/.env'
    );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
