export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
// export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://condominio.api.diangogavidia.com';
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Condominio Admin';
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

export const PAYMENT_METHODS = ['PAGO_MOVIL', 'TRANSFER', 'CASH'] as const;
export const PAYMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export const USER_ROLES = ['resident', 'board', 'admin'] as const;
export const USER_STATUSES = ['pending', 'active'] as const;

export const ROUTES = {
    LOGIN: '/login',
    DASHBOARD: '/dashboard',
    BUILDINGS: '/buildings',
    USERS: '/users',
    PAYMENTS: '/payments',
} as const;
