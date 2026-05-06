
import { apiPost, apiGet, apiDelete } from '@/lib/apiClient';
import { Database } from '@/integrations/supabase/types';

export type PlanL2 = Database['public']['Tables']['production_plans_l2']['Row'];
export type InsertPlanL2 = Database['public']['Tables']['production_plans_l2']['Insert'];

export const savePlanL2 = async (plan: InsertPlanL2) => {
    return apiPost('/api/plans/l2', plan);
};

export const getPlansL2 = async (email: string) => {
    return apiGet(`/api/plans/l2?email=${encodeURIComponent(email)}`);
};

export const deletePlanL2 = async (id: string) => {
    return apiDelete(`/api/plans/l2/${id}`);
};
