-- Add tolerance_grams to recipe_rows
ALTER TABLE public.recipe_rows 
ADD COLUMN tolerance_grams NUMERIC DEFAULT 0;

-- Add equipment notes and storage conditions to recipes
ALTER TABLE public.recipes
ADD COLUMN equipment_notes TEXT,
ADD COLUMN storage_conditions TEXT;

-- Exports Log Table
CREATE TABLE public.exports_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    export_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    exported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS Policies for exports_log
ALTER TABLE public.exports_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own export logs" 
    ON public.exports_log FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own export logs" 
    ON public.exports_log FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
