import { apiClient } from '@/lib/api/client';
import type { Payment, UpdatePaymentDto, PaymentSummary } from '@/types/models';

export const paymentsService = {
    // Admin endpoints
    async getAdminPayments(params?: {
        building_id?: string;
        status?: string;
        period?: string;
        year?: string;
        unit_id?: string;
    }): Promise<Payment[]> {
        const { data } = await apiClient.get<Payment[]>('/payments/admin/payments', { params });
        return data.map(p => ({
            ...p,
            amount: Number(p.amount)
        }));
    },

    // User endpoints
    async getUserPayments(params?: {
        year?: string;
        unit_id?: string;
        building_id?: string;
    }): Promise<Payment[]> {
        const { data } = await apiClient.get<Payment[]>('/payments', { params });
        return data.map(p => ({
            ...p,
            amount: Number(p.amount)
        }));
    },

    async getPaymentSummary(): Promise<PaymentSummary> {
        const { data } = await apiClient.get<PaymentSummary>('/payments/summary');
        return data;
    },

    // Alias for backward compatibility - uses getAdminPayments
    async getPayments(params?: {
        building_id?: string;
        user_id?: string;
        unit_id?: string;
        status?: string;
        period?: string;
        year?: string;
    }): Promise<Payment[]> {
        return this.getAdminPayments(params);
    },

    async getPaymentById(id: string): Promise<Payment> {
        const { data } = await apiClient.get<Payment>(`/payments/${id}`);
        return data;
    },

    async createPayment(formData: FormData): Promise<Payment> {
        const { data } = await apiClient.post<Payment>('/payments', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return data;
    },

    async updatePaymentStatus(id: string, update: UpdatePaymentDto): Promise<Payment> {
        const { data } = await apiClient.patch<Payment>(`/payments/admin/payments/${id}`, update);
        return data;
    },

    async approvePayment(id: string, notes?: string): Promise<Payment> {
        return this.updatePaymentStatus(id, {
            status: 'APPROVED',
            notes
        });
    },

    async rejectPayment(id: string, notes?: string): Promise<Payment> {
        return this.updatePaymentStatus(id, {
            status: 'REJECTED',
            notes
        });
    },
};
