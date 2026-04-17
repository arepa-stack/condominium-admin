
import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import { canEnterPanel } from '@/lib/utils/roles';
import type { AuthResponse, LoginCredentials, User } from '@/types/models';

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);

        console.log('Login response data:', data);

        // Handle potential response structure variations
        // Structure A: { token: { access_token: ... }, user: ... }
        // Structure B: { access_token: ..., user: ... }
        const accessToken = data.token?.access_token || (data as any).access_token;
        const refreshToken = data.token?.refresh_token || (data as any).refresh_token;

        if (!accessToken) {
            console.error('Login failed: Missing access_token in response', data);
            throw new Error('Authentication failed: Invalid server response.');
        }

        // Store tokens immediately
        localStorage.setItem('access_token', accessToken);

        if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
        }

        console.log('Login response user:', data.user);

        if (!canEnterPanel(data.user)) {
            console.error('Access denied: user is neither admin nor board in any building.', data.user);
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            throw new Error('Access denied. Only administrators and board members can access this panel.');
        }

        // Rule: Check status
        if (data.user.status === 'pending') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            throw new Error('Your account is pending approval.');
        }

        if (data.user.status === 'rejected') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            throw new Error('Your account has been rejected.');
        }

        if (data.user.status === 'inactive') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            throw new Error('Your account is inactive.');
        }

        return data;
    },

    async getCurrentUser(): Promise<User> {
        const { data } = await apiClient.get<User>(`${ADMIN_API_PREFIX}/users/me`);
        return data;
    },

    logout() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    },

    getAccessToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('access_token');
        }
        return null;
    },

    isAuthenticated(): boolean {
        return !!this.getAccessToken();
    },
};
