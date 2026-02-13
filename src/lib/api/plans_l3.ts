
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type PlanL3 = Database['public']['Tables']['production_plans_l3']['Row'];
export type InsertPlanL3 = Database['public']['Tables']['production_plans_l3']['Insert'];

export const savePlanL3 = async (plan: InsertPlanL3) => {
    const { data, error } = await supabase
        .from('production_plans_l3')
        .insert(plan)
        .select()
        .single();

    if (error) {
        console.error('Error saving Level 3 plan:', error);
        throw error;
    }

    return data;
};

export const getPlansL3 = async (email: string) => {
    const { data, error } = await supabase
        .from('production_plans_l3')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching Level 3 plans:', error);
        throw error;
    }

    return data;
};

export const deletePlanL3 = async (id: string) => {
    const { error } = await supabase
        .from('production_plans_l3')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting Level 3 plan:', error);
        throw error;
    }
};
