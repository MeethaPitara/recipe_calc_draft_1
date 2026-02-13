
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

export type Plan = Database['public']['Tables']['production_plans_l1']['Row'];
export type InsertPlan = Database['public']['Tables']['production_plans_l1']['Insert'];

export const savePlan = async (plan: InsertPlan) => {
    const { data, error } = await supabase
        .from('production_plans_l1')
        .insert(plan)
        .select()
        .single();

    if (error) {
        console.error('Error saving plan:', error);
        throw error;
    }

    return data;
};

export const getPlans = async (email: string) => {
    const { data, error } = await supabase
        .from('production_plans_l1')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching plans:', error);
        throw error;
    }

    return data;
};

export const deletePlan = async (id: string) => {
    const { error } = await supabase
        .from('production_plans_l1')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting plan:', error);
        throw error;
    }
};
