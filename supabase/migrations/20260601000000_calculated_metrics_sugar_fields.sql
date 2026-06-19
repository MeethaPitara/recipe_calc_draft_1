-- calculated_metrics did not exist in this database at all (baseline gap —
-- it was never captured in a tracked migration). Create it matching the
-- shape already assumed by server/src/routes/recipes.ts and
-- src/integrations/supabase/types.ts, plus the two new sugar fields needed
-- for Phase 3.3.
CREATE TABLE IF NOT EXISTS public.calculated_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL UNIQUE REFERENCES public.recipes(id) ON DELETE CASCADE,
    total_quantity_g NUMERIC NOT NULL,
    total_solids_g NUMERIC NOT NULL,
    total_solids_pct NUMERIC NOT NULL,
    sugars_pct NUMERIC NOT NULL,
    fat_pct NUMERIC NOT NULL,
    msnf_pct NUMERIC NOT NULL,
    other_solids_pct NUMERIC NOT NULL,
    total_sugars_g NUMERIC NOT NULL,
    total_fat_g NUMERIC NOT NULL,
    total_msnf_g NUMERIC NOT NULL,
    total_other_solids_g NUMERIC NOT NULL,
    fpdt NUMERIC,
    sp NUMERIC,
    pac NUMERIC,
    pod_index NUMERIC,
    added_sugars_pct NUMERIC,
    total_sugars_pct NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.calculated_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recipe metrics"
    ON public.calculated_metrics FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = calculated_metrics.recipe_id AND r.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert metrics for their own recipes"
    ON public.calculated_metrics FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = calculated_metrics.recipe_id AND r.user_id = auth.uid()
    ));

CREATE POLICY "Users can update metrics for their own recipes"
    ON public.calculated_metrics FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = calculated_metrics.recipe_id AND r.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete metrics for their own recipes"
    ON public.calculated_metrics FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM public.recipes r
        WHERE r.id = calculated_metrics.recipe_id AND r.user_id = auth.uid()
    ));
