-- Phase 6.2: a trial must link to a recipe VERSION (a frozen snapshot),
-- not the live recipe — otherwise editing the recipe later would silently
-- rewrite what a historical trial was actually testing. recipe_rows already
-- snapshots each ingredient's composition at save time (Phase 5.4); this
-- table extends that to the whole recipe (header + rows + metrics) at the
-- moment a trial is recorded.
CREATE TABLE public.recipe_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Trial Records
-- Phase 6.1: user_id references public.app_users — this app's real
-- user-identity table (custom JWT auth, never Supabase Auth/auth.users).
CREATE TABLE public.trial_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    recipe_version_id UUID NOT NULL REFERENCES public.recipe_versions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    trial_date DATE NOT NULL DEFAULT CURRENT_DATE,
    batch_size_g NUMERIC NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'pass', 'fail', 'revision')),
    notes TEXT,
    -- Phase 6.3: predicted-vs-actual fields
    actual_fat_pct NUMERIC,
    actual_msnf_pct NUMERIC,
    actual_sugars_pct NUMERIC,
    actual_ts_pct NUMERIC,
    actual_overrun_pct NUMERIC,
    draw_temp_c NUMERIC,
    serving_temp_c NUMERIC,
    hardness_score NUMERIC,
    melt_rate NUMERIC,
    sensory_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- QA Records
CREATE TABLE public.qa_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trial_id UUID NOT NULL REFERENCES public.trial_records(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    target_value NUMERIC,
    actual_value NUMERIC,
    pass_fail BOOLEAN,
    deviation_pct NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies
-- Phase 6.1: auth.uid() never resolves under this app's custom JWT scheme
-- (verified against the live DB — it never authenticates through Supabase
-- Auth). Real authorization happens in Express via requireAuth, and the
-- backend's service-role key bypasses RLS anyway, so these are made
-- explicitly permissive rather than left referencing a check that always
-- evaluates to NULL/false and looks like it's enforcing something it isn't.
ALTER TABLE public.recipe_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to recipe versions"
    ON public.recipe_versions FOR ALL
    USING (true) WITH CHECK (true);

CREATE POLICY "Users can view all trial records"
    ON public.trial_records FOR SELECT
    USING (true);

CREATE POLICY "Users can insert trial records"
    ON public.trial_records FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their trial records"
    ON public.trial_records FOR UPDATE
    USING (true);

CREATE POLICY "Users can view all qa records"
    ON public.qa_records FOR SELECT
    USING (true);

CREATE POLICY "Users can insert qa records"
    ON public.qa_records FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their qa records"
    ON public.qa_records FOR UPDATE
    USING (true);

-- Triggers for updated_at. Defined here rather than assumed to exist
-- elsewhere — not found in any other tracked migration, and this file
-- was never actually applied, so its dependency was never verified.
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_updated_at_trial_records
    BEFORE UPDATE ON public.trial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
