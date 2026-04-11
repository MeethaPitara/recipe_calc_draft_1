/**
 * Centralized API Client
 * All frontend HTTP calls to the backend go through this module.
 * Handles auth token injection, JSON parsing, and error handling.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const TOKEN_KEY = 'mp_auth_token';

function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...extra,
    };

    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return headers;
}

interface ApiError {
    error: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as ApiError;
        throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
}

/**
 * Generic GET request
 */
export async function apiGet<T = any>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'GET',
        headers: buildHeaders(),
    });
    return handleResponse<T>(res);
}

/**
 * Generic POST request
 */
export async function apiPost<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
}

/**
 * Generic PUT request
 */
export async function apiPut<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers: buildHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
}

/**
 * Generic DELETE request
 */
export async function apiDelete<T = any>(path: string): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
        method: 'DELETE',
        headers: buildHeaders(),
    });
    return handleResponse<T>(res);
}

/**
 * API_BASE export for external usage if needed
 */
export { API_BASE };
