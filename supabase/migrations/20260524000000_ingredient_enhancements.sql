ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS supplier_data_sheet_url text;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS formulation_warnings text[];

CREATE TABLE IF NOT EXISTS ingredient_versions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    ingredient_id uuid REFERENCES ingredients(id) ON DELETE CASCADE,
    version_number int NOT NULL,
    snapshot jsonb NOT NULL,
    changed_by uuid REFERENCES auth.users(id),
    changed_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredient_versions_unique ON ingredient_versions(ingredient_id, version_number);
