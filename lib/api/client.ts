import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '@/lib/utils/constants';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
apiClient.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const url = error.config?.url || '';
        const isAuthEndpoint = url.includes('/auth/me') || url.includes('/users/me');

        if (error.response?.status === 401 && isAuthEndpoint) {
            // Only force logout if the core session check fails
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }

        // Transform error to user-friendly message
        const message = error.response?.data
            ? (error.response.data as { message?: string }).message || 'An error occurred'
            : error.message || 'Network error';

        return Promise.reject(new Error(message));
    }
);
