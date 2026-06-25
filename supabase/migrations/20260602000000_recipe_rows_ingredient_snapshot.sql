-- Phase 5.4: snapshot the full ingredient composition at time of use, not a
-- live reference. Without this, reloading a saved recipe re-resolves each
-- row by ingredient name against the CURRENT ingredients table and silently
-- recomputes grams from today's composition — corrupting historical
-- accuracy and breaking trial integrity (Phase 6).
ALTER TABLE public.recipe_rows ADD COLUMN ingredient_snapshot JSONB;
