-- Create a migration to add user_email to ingredients table

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS user_email TEXT DEFAULT NULL;

-- Create an index for performance
CREATE INDEX IF NOT EXISTS idx_ingredients_user_email ON ingredients(user_email);

-- Update RLS policies to allow users to see their own ingredients and null (public) ones
-- Note: Assuming RLS is enabled on ingredients table. If not, these might be skipped or need adjustment.
-- This is a conceptual migration file.

-- Policy for select
CREATE POLICY "Allow users to view public and their own ingredients"
ON ingredients FOR SELECT
USING (user_email IS NULL OR user_email = auth.uid()::text OR user_email = auth.email()); 
-- Note: Adjust based on how user identity is stored (uid vs email). PRD says email.

-- Policy for insert
CREATE POLICY "Allow users to insert their own ingredients"
ON ingredients FOR INSERT
WITH CHECK (user_email = auth.email());

-- Policy for update/delete
CREATE POLICY "Allow users to update/delete their own ingredients"
ON ingredients FOR ALL
USING (user_email = auth.email());
