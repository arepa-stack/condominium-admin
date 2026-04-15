import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type { Payment, UpdatePaymentDto, PaymentSummary } from '@/types/models';

const P = ADMIN_API_PREFIX;

export const paymentsService = {
    async getAdminPayments(params?: {
        building_id?: string;
        status?: string;
        period?: string;
        year?: string;
        unit_id?: string;
    }): Promise<Payment[]> {
        const { data } = await apiClient.get<Payment[]>(`${P}/payments/admin/payments`, { params });
        return data.map(p => ({
            ...p,
            amount: Number(p.amount)
        }));
    },

    async getUserPayments(params?: {
        year?: string;
        unit_id?: string;
        building_id?: string;
    }): Promise<Payment[]> {
        const { data } = await apiClient.get<Payment[]>(`${P}/payments`, { params });
        return data.map(p => ({
            ...p,
            amount: Number(p.amount)
        }));
    },

    async getPaymentSummary(): Promise<PaymentSummary> {
        const { data } = await apiClient.get<PaymentSummary>(`${P}/payments/summary`);
        return data;
    },

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
        const { data } = await apiClient.get<Payment>(`${P}/payments/${id}`);
        return data;
    },

    async createPayment(formData: FormData): Promise<Payment> {
        // No establecer Content-Type manualmente: el interceptor quita el default JSON para que
        // el boundary multipart se genere correctamente.
        const { data } = await apiClient.post<Payment>(`${P}/payments`, formData);
        return data;
    },

    async updatePaymentStatus(id: string, update: UpdatePaymentDto): Promise<Payment> {
        const { data } = await apiClient.patch<Payment>(`${P}/payments/admin/payments/${id}`, update);
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

    async reversePayment(id: string, reason: string): Promise<{ success: boolean }> {
        const { data } = await apiClient.post<{ success: boolean }>(`${P}/payments/admin/payments/${id}/reverse`, {
            reason
        });
        return data;
    },
};
