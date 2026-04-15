import { format as dateFnsFormat, parseISO } from 'date-fns';

/**
 * Formats a number as currency (USD)
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
}

/**
 * Formats an amount with a specific ISO 4217 currency code (falls back to USD if invalid).
 */
export function formatMoney(amount: number, currencyCode = 'USD'): string {
    try {
        return new Intl.NumberFormat('es-VE', {
            style: 'currency',
            currency: currencyCode.length === 3 ? currencyCode : 'USD',
        }).format(amount);
    } catch {
        return formatCurrency(amount);
    }
}

/**
 * Formats a date string to a human-readable format
 */
export function formatDate(date: string | Date, format = 'MMM dd, yyyy'): string {
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        return dateFnsFormat(dateObj, format);
    } catch (error) {
        return 'Invalid date';
    }
}

/**
 * Formats a period string (YYYY-MM) to readable format
 */
export function formatPeriod(period: string): string {
    if (!period) return '--';
    try {
        const [year, month] = period.split('-').map(Number);
        if (!year || !month) return period;
        const date = new Date(year, month - 1);
        return new Intl.DateTimeFormat('en-US', {
            month: 'long',
            year: 'numeric',
        }).format(date);
    } catch (error) {
        return period;
    }
}

/**
 * Formats a payment method to readable text
 */
export function formatPaymentMethod(method: string): string {
    const methods: Record<string, string> = {
        PAGO_MOVIL: 'Pago Móvil',
        TRANSFER: 'Transferencia',
        CASH: 'Efectivo',
    };
    return methods[method] || method;
}

/**
 * Formats a user role to readable text
 */
export function formatUserRole(role: string): string {
    const roles: Record<string, string> = {
        admin: 'Super Admin',
        board: 'Board Member',
        resident: 'Resident',
    };
    return roles[role] || role;
}
