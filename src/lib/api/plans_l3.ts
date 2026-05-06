
import { apiPost, apiGet, apiDelete } from '@/lib/apiClient';
import { Database } from '@/integrations/supabase/types';

export type PlanL3 = Database['public']['Tables']['production_plans_l3']['Row'];
export type InsertPlanL3 = Database['public']['Tables']['production_plans_l3']['Insert'];

export const savePlanL3 = async (plan: InsertPlanL3) => {
    return apiPost('/api/plans/l3', plan);
};

export const getPlansL3 = async (email: string) => {
    return apiGet(`/api/plans/l3?email=${encodeURIComponent(email)}`);
};

export const deletePlanL3 = async (id: string) => {
    return apiDelete(`/api/plans/l3/${id}`);
};
