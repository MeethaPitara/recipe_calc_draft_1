-- Add cost_per_kg to recipes
ALTER TABLE public.recipes ADD COLUMN cost_per_kg NUMERIC;

-- Create cost_records table
CREATE TABLE public.cost_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    cost_per_kg NUMERIC,
    batch_size_g NUMERIC,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE public.cost_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own cost records"
    ON public.cost_records FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own cost records"
    ON public.cost_records FOR SELECT
    USING (auth.uid() = user_id);
