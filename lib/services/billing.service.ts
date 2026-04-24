import { apiClient } from '@/lib/api/client';
import {
    mapPaginatedResponse,
    mapUnitBalance,
    mapPreviewInvoicesResponse,
    proposedInvoiceToBody,
} from '@/lib/api/mappers';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type {
    Invoice, InvoicePayment, UnitBalance, BillingDebtPayload,
    ProposedInvoice, PreviewInvoicesResponse, UnitCreditResponse, InvoiceTag,
    PaginatedResponse, PaginationParams,
} from '@/types/models';

const P = ADMIN_API_PREFIX;

interface InvoiceListFilters {
    building_id?: string;
    unit_id?: string;
    status?: string;
    month?: number;
    year?: number;
    user_id?: string;
    tag?: InvoiceTag;
}

export const billingService = {

    async getInvoices(params?: InvoiceListFilters): Promise<Invoice[]> {
        const { data } = await apiClient.get(
            `${P}/billing/invoices`,
            { params: { limit: 'all', ...params } },
        );
        return mapPaginatedResponse<Invoice>(data).data;
    },

    async getInvoicesPaginated(
        params?: InvoiceListFilters & PaginationParams,
    ): Promise<PaginatedResponse<Invoice>> {
        const { data } = await apiClient.get(
            `${P}/billing/invoices`,
            { params },
        );
        return mapPaginatedResponse<Invoice>(data);
    },

    async getInvoiceById(id: string): Promise<Invoice> {
        const { data } = await apiClient.get<Invoice>(`${P}/billing/invoices/${id}`);
        return data;
    },

    async getInvoicePayments(id: string): Promise<InvoicePayment[]> {
        const { data } = await apiClient.get(
            `${P}/billing/invoices/${id}/payments`,
            { params: { limit: 'all' } },
        );
        return mapPaginatedResponse<InvoicePayment>(data).data;
    },

    async getPaymentInvoices(id: string): Promise<Invoice[]> {
        const { data } = await apiClient.get(
            `${P}/billing/payments/${id}/invoices`,
            { params: { limit: 'all' } },
        );
        return mapPaginatedResponse<Invoice>(data).data;
    },

    async getUnitInvoices(unitId: string, tag?: InvoiceTag): Promise<Invoice[]> {
        const { data } = await apiClient.get(
            `${P}/billing/units/${unitId}/invoices`,
            { params: { limit: 'all', ...(tag ? { tag } : {}) } },
        );
        return mapPaginatedResponse<Invoice>(data).data;
    },

    async getUnitBalance(unitId: string): Promise<UnitBalance> {
        const { data } = await apiClient.get(`${P}/billing/units/${unitId}/balance`);
        return mapUnitBalance(data);
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
        const { data } = await apiClient.post(`${P}/billing/invoices/preview`, formData, {
            params: { building_id },
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return mapPreviewInvoicesResponse(data);
    },

    async confirmInvoices(building_id: string, invoices: ProposedInvoice[]): Promise<{ success: boolean }> {
        const body = { invoices: invoices.map(proposedInvoiceToBody) };
        const { data } = await apiClient.post<{ success: boolean }>(
            `${P}/billing/invoices/confirm`,
            body,
            { params: { building_id } },
        );
        return data;
    },
};
