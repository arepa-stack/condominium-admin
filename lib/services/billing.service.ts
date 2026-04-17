import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type {
    Invoice, InvoicePayment, UnitBalance, BillingDebtPayload,
    ProposedInvoice, PreviewInvoicesResponse, UnitCreditResponse, InvoiceTag
} from '@/types/models';

const P = ADMIN_API_PREFIX;

export const billingService = {

    async getInvoices(params?: {
        building_id?: string;
        unit_id?: string;
        status?: string;
        month?: number;
        year?: number;
        user_id?: string;
        tag?: InvoiceTag;
    }): Promise<Invoice[]> {
        // Response shape: { data: Invoice[], metadata: {...} }. UI aún no pagina,
        // pedimos limit alto para traer todo en una sola llamada.
        const { data } = await apiClient.get<{ data: Invoice[]; metadata?: unknown }>(
            `${P}/billing/invoices`,
            { params: { limit: 1000, ...params } },
        );
        return data?.data ?? [];
    },

    async getInvoiceById(id: string): Promise<Invoice> {
        const { data } = await apiClient.get<Invoice>(`${P}/billing/invoices/${id}`);
        return data;
    },

    async getInvoicePayments(id: string): Promise<InvoicePayment[]> {
        const { data } = await apiClient.get<InvoicePayment[]>(`${P}/billing/invoices/${id}/payments`);
        return data;
    },

    async getPaymentInvoices(id: string): Promise<Invoice[]> {
        const { data } = await apiClient.get<Invoice[]>(`${P}/billing/payments/${id}/invoices`);
        return data;
    },

    async getUnitInvoices(unitId: string, tag?: InvoiceTag): Promise<Invoice[]> {
        const { data } = await apiClient.get<Invoice[]>(`${P}/billing/units/${unitId}/invoices`, {
            params: tag ? { tag } : undefined
        });
        return data;
    },

    async getUnitBalance(unitId: string): Promise<UnitBalance> {
        const { data } = await apiClient.get<UnitBalance>(`${P}/billing/units/${unitId}/balance`);
        return data;
    },

    async getUnitCredit(unitId: string): Promise<UnitCreditResponse> {
        const { data } = await apiClient.get<UnitCreditResponse>(`${P}/billing/units/${unitId}/credit`);
        return data;
    },

    async loadDebt(payload: BillingDebtPayload): Promise<Invoice> {
        const { data } = await apiClient.post<Invoice>(`${P}/billing/debt`, payload);
        return data;
    },

    async previewInvoices(building_id: string, file: File): Promise<PreviewInvoicesResponse> {
        const formData = new FormData();
        formData.append('file', file);
        const { data } = await apiClient.post<PreviewInvoicesResponse>(`${P}/billing/invoices/preview`, formData, {
            params: { building_id },
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return data;
    },

    async confirmInvoices(building_id: string, invoices: ProposedInvoice[]): Promise<{ success: boolean }> {
        const { data } = await apiClient.post<{ success: boolean }>(`${P}/billing/invoices/confirm`, { invoices }, {
            params: { building_id }
        });
        return data;
    },
};
