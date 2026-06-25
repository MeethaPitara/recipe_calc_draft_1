-- Add tolerance_grams to recipe_rows
ALTER TABLE public.recipe_rows
ADD COLUMN IF NOT EXISTS tolerance_grams NUMERIC DEFAULT 0;

-- Add equipment notes and storage conditions to recipes
ALTER TABLE public.recipes
ADD COLUMN IF NOT EXISTS equipment_notes TEXT,
ADD COLUMN IF NOT EXISTS storage_conditions TEXT;

-- Exports Log Table
-- Phase 6.1: user_id references public.app_users (this app's real
-- user-identity table — custom JWT auth, never Supabase Auth/auth.users).
CREATE TABLE public.exports_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    export_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    exported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies for exports_log
-- Phase 6.1: auth.uid() never resolves under this app's custom JWT scheme;
-- made explicitly permissive (see 20260604000000_app_users_fk_fix.sql for
-- the full rationale).
ALTER TABLE public.exports_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export logs"
    ON public.exports_log FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own export logs"
    ON public.exports_log FOR INSERT
    WITH CHECK (true);
