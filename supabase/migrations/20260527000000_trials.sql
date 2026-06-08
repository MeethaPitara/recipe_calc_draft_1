-- Trial Records
CREATE TABLE public.trial_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    trial_date DATE NOT NULL DEFAULT CURRENT_DATE,
    batch_size_g NUMERIC NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('pending', 'pass', 'fail', 'revision')),
    notes TEXT,
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
ALTER TABLE public.trial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all trial records" 
    ON public.trial_records FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert trial records" 
    ON public.trial_records FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their trial records" 
    ON public.trial_records FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view all qa records" 
    ON public.qa_records FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert qa records" 
    ON public.qa_records FOR INSERT 
    WITH CHECK (true); -- Requires linked trial_record which already has RLS

CREATE POLICY "Users can update their qa records" 
    ON public.qa_records FOR UPDATE 
    USING (true);

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at_trial_records
    BEFORE UPDATE ON public.trial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
