import { apiGet, apiPost, apiDelete } from '@/lib/apiClient';

export interface CustomTargetProfile {
    id: string;
    user_id: string;
    name: string;
    product_type: string;
    ranges: {
        fat: [number, number];
        msnf: [number, number];
        sugars: [number, number];
        ts: [number, number];
    };
    constraint_defaults?: any;
    created_at: string;
}

export async function fetchTargetProfiles(): Promise<CustomTargetProfile[]> {
    return await apiGet<CustomTargetProfile[]>('/api/target-profiles');
}

export async function saveTargetProfile(
    name: string,
    product_type: string,
    ranges: CustomTargetProfile['ranges'],
    constraint_defaults?: any
): Promise<CustomTargetProfile> {
    return await apiPost<CustomTargetProfile>('/api/target-profiles', {
        name,
        product_type,
        ranges,
        constraint_defaults
    });
}

export async function deleteTargetProfile(id: string): Promise<void> {
    await apiDelete(`/api/target-profiles/${id}`);
}
