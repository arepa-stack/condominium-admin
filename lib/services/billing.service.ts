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
        const invoices = mapPaginatedResponse<Invoice>(data).data;

        // If the backend list endpoint omits description, enrich in parallel chunks
        if (invoices.length > 0 && invoices.some((inv) => inv.description === undefined)) {
            const chunkSize = 15;
            for (let i = 0; i < invoices.length; i += chunkSize) {
                const chunk = invoices.slice(i, i + chunkSize);
                await Promise.all(
                    chunk.map(async (inv) => {
                        if (inv.description !== undefined) return;
                        try {
                            const detail = await apiClient.get<Invoice>(`${P}/billing/invoices/${inv.id}`);
                            if (detail.data) {
                                if (detail.data.description !== undefined) inv.description = detail.data.description;
                                if (detail.data.due_date && !inv.due_date) inv.due_date = detail.data.due_date;
                                if (detail.data.receipt_number && !inv.receipt_number) inv.receipt_number = detail.data.receipt_number;
                            }
                        } catch {
                            // Non-fatal if detail call fails
                        }
                    })
                );
            }
        }

        return invoices;
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

    // Excel files and the administrator's PDF notices share the preview/confirm flow.
    async previewInvoices(building_id: string, file: File): Promise<PreviewInvoicesResponse> {
        const formData = new FormData();
        formData.append('file', file);
        const endpoint = isPdfFile(file) ? 'preview-pdf' : 'preview';
        const { data } = await apiClient.post(`${P}/billing/invoices/${endpoint}`, formData, {
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

    async updateInvoice(
        id: string,
        data: {
            status?: string;
            paid_amount?: number;
            receipt_number?: string;
            description?: string;
            due_date?: string;
            payment_method?: string;
            payment_date?: string;
        }
    ): Promise<Invoice> {
        const { data: res } = await apiClient.patch<Invoice>(`${P}/billing/invoices/${id}`, data);
        return res;
    },
};

function isPdfFile(file: File): boolean {
    return file.name.toLowerCase().endsWith('.pdf');
}
