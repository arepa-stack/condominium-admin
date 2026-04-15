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
        // FormData: no fijar Content-Type para que el navegador agregue el boundary multipart
        if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
            const h = config.headers;
            if (h && typeof (h as { delete?: (k: string) => void }).delete === 'function') {
                (h as { delete: (k: string) => void }).delete('Content-Type');
            } else if (h && typeof h === 'object') {
                delete (h as Record<string, unknown>)['Content-Type'];
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }> = [];

const processQueue = (error: AxiosError | null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(undefined);
        }
    });
    failedQueue = [];
};

const isLoginPage = () => {
    if (typeof window === 'undefined') return false;
    return window.location.pathname === '/login';
};

const clearAuthAndRedirect = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    if (typeof window !== 'undefined') {
        window.location.href = '/login';
    }
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config;
        const url = originalRequest?.url || '';
        const isAuthEndpoint = url.includes('/users/me');

        if (error.response?.status === 401 && isAuthEndpoint) {
            if (isLoginPage()) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => apiClient(originalRequest!))
                    .catch((err) => Promise.reject(err));
            }

            isRefreshing = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (!refreshToken) {
                clearAuthAndRedirect();
                isRefreshing = false;
                return Promise.reject(error);
            }

            try {
                const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                    refresh_token: refreshToken,
                });

                const newAccessToken = data.access_token || data.token?.access_token;
                if (newAccessToken) {
                    localStorage.setItem('access_token', newAccessToken);
                    if (data.refresh_token || data.token?.refresh_token) {
                        localStorage.setItem('refresh_token', data.refresh_token || data.token?.refresh_token);
                    }
                    processQueue(null);
                    isRefreshing = false;
                    return apiClient(originalRequest!);
                } else {
                    throw new Error('No new access token');
                }
            } catch (refreshError) {
                processQueue(refreshError as AxiosError);
                clearAuthAndRedirect();
                isRefreshing = false;
                return Promise.reject(refreshError);
            }
        }

        // Transform error to user-friendly message
        // Don't logout on 5xx server errors - these are typically transient
        const status = error.response?.status;
        const isServerError = status && status >= 500;
        
        if (isServerError) {
            console.error('Server error:', status, error.response?.data);
        }

        const message = error.response?.data
            ? (error.response.data as { message?: string }).message || 'An error occurred'
            : error.message || 'Network error';

        return Promise.reject(new Error(message));
    }
);
