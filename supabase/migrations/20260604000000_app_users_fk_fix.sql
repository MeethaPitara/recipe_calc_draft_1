-- Phase 6.1: app_users is this app's real user-identity table (custom JWT
-- auth — see server/src/routes/auth.ts / jwtConfig.ts — never Supabase
-- Auth). req.user.id is always an app_users.id. auth.users is irrelevant
-- to this app and any FK pointing at it is a live bug: an insert with a
-- non-null changed_by/user_id fails its FK check since app_users IDs don't
-- exist in auth.users.
--
-- Verified against the live DB (pg_constraint / pg_policies) before writing
-- this rather than trusting migration files — most auth.users/auth.uid()
-- references in this repo's migration files turned out to have never
-- actually applied. Only these two FKs and one RLS policy are real.

ALTER TABLE public.ingredient_versions DROP CONSTRAINT ingredient_versions_changed_by_fkey;
ALTER TABLE public.ingredient_versions ADD CONSTRAINT ingredient_versions_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES public.app_users(id) ON DELETE SET NULL;

ALTER TABLE public.target_profiles DROP CONSTRAINT target_profiles_user_id_fkey;
ALTER TABLE public.target_profiles ADD CONSTRAINT target_profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

-- auth.uid() never resolves under this app's custom JWT scheme — it only
-- means anything for a Supabase Auth session, which this app never
-- creates. Real authorization happens in Express via requireAuth, and the
-- backend's service-role key bypasses RLS entirely anyway, so this policy
-- was decorative rather than actually enforcing anything. Made explicitly
-- permissive rather than left looking functional when it isn't.
DROP POLICY "Users can manage their own target profiles" ON public.target_profiles;
CREATE POLICY "Users can manage their own target profiles"
    ON public.target_profiles FOR ALL
    USING (true)
    WITH CHECK (true);

-- Phase 6.4: needed by Phase 9.2's Base Batch Manager — "base" means a
-- saved recipe flagged is_base_recipe = true, not an arbitrary ingredient.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS is_base_recipe BOOLEAN DEFAULT false;
