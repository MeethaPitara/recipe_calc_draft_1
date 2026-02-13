
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type PlanL2 = Database['public']['Tables']['production_plans_l2']['Row'];
export type InsertPlanL2 = Database['public']['Tables']['production_plans_l2']['Insert'];

export const savePlanL2 = async (plan: InsertPlanL2) => {
    const { data, error } = await supabase
        .from('production_plans_l2')
        .insert(plan)
        .select()
        .single();

    if (error) {
        console.error('Error saving Level 2 plan:', error);
        throw error;
    }

    return data;
};

export const getPlansL2 = async (email: string) => {
    const { data, error } = await supabase
        .from('production_plans_l2')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching Level 2 plans:', error);
        throw error;
    }

    return data;
};

export const deletePlanL2 = async (id: string) => {
    const { error } = await supabase
        .from('production_plans_l2')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Level 2 plan:', error);
        throw error;
    }
};
