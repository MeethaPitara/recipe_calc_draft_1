
import { apiPost, apiGet, apiDelete } from '@/lib/apiClient';
import { Database } from '@/integrations/supabase/types';

export type Plan = Database['public']['Tables']['production_plans_l1']['Row'];
export type InsertPlan = Database['public']['Tables']['production_plans_l1']['Insert'];

export const savePlan = async (plan: InsertPlan) => {
    return apiPost('/api/plans/l1', plan);
};

export const getPlans = async (email: string) => {
    return apiGet(`/api/plans/l1?email=${encodeURIComponent(email)}`);
};

export const deletePlan = async (id: string) => {
    return apiDelete(`/api/plans/l1/${id}`);
};
