-- Phase 5.1/5.2: Simple/Advanced ingredient modes.
-- server/src/routes/ingredients.ts already reads/writes lactose_pct,
-- verification_status, verified_at, verified_source,
-- supplier_data_sheet_url, formulation_warnings, and user_email — but
-- src/integrations/supabase/types.ts (stale, not regenerated since
-- Phase 6.5 hasn't run yet) doesn't show them on the ingredients table,
-- same surprise as the missing calculated_metrics table in Phase 3.
-- Use IF NOT EXISTS everywhere so this is safe to run regardless of
-- which of these already exist.
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS lactose_pct NUMERIC;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS verification_status TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS verified_source TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS supplier_data_sheet_url TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS formulation_warnings TEXT[];
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS sugar_split JSONB;

-- New for Simple mode (protein-based MSNF/lactose auto-derivation) and
-- Advanced mode (DE index for glucose syrups).
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS protein_pct NUMERIC;
ALTER TABLE public.ingredients ADD COLUMN IF NOT EXISTS de NUMERIC;
