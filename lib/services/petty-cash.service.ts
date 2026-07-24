import { apiClient } from '@/lib/api/client';
import { mapPaginatedResponse } from '@/lib/api/mappers';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type {
    PettyCashBalance,
    PettyCashEntry,
    PettyCashEntryType,
    PettyCashCategory,
    CreatePettyCashIncomeDto,
    CreatePettyCashAssessmentDto,
    CreateExpressAssessmentDto,
    PettyCashAssessmentPreview,
    PettyCashAssessmentResponse,
    PettyCashTransparency,
    PettyCashPaymentReportItem,
    PettyCashPaymentReportFilters,
    PaginatedResponse,
    PaginationParams,
    RateSet,
    CancelExpressAssessmentResponse,
    SetTargetFundResponse,
    ContributionResponse,
} from '@/types/models';

interface PettyCashEntryFilters {
    type?: PettyCashEntryType;
    category?: PettyCashCategory;
}

const P = ADMIN_API_PREFIX;

const normalizeEntry = (e: PettyCashEntry): PettyCashEntry => ({
    ...e,
    amount: Number(e.amount),
});

export const pettyCashService = {
    async getBalance(buildingId: string): Promise<PettyCashBalance> {
        const { data } = await apiClient.get<PettyCashBalance>(
            `${P}/petty-cash/funds/${buildingId}`
        );
        return {
            ...data,
            current_balance: Number(data.current_balance),
            balances_by_currency: (data.balances_by_currency ?? []).map((b) => ({
                currency: b.currency,
                balance: Number(b.balance),
            })),
        };
    },

    // Exchange rates live under the app prefix (read-only for any authenticated user).
    async getRates(date?: string): Promise<RateSet> {
        const { data } = await apiClient.get<RateSet>(
            `/api/v1/app/exchange-rates`,
            { params: date ? { date } : undefined }
        );
        return data;
    },

    async getHistory(
        buildingId: string,
        params?: PettyCashEntryFilters,
    ): Promise<PettyCashEntry[]> {
        const { data } = await apiClient.get(
            `${P}/petty-cash/funds/${buildingId}/entries`,
            { params: { limit: 'all', ...params } },
        );
        return mapPaginatedResponse<PettyCashEntry>(data, normalizeEntry).data;
    },

    async getHistoryPaginated(
        buildingId: string,
        params?: PettyCashEntryFilters & PaginationParams,
    ): Promise<PaginatedResponse<PettyCashEntry>> {
        const { data } = await apiClient.get(
            `${P}/petty-cash/funds/${buildingId}/entries`,
            { params },
        );
        return mapPaginatedResponse<PettyCashEntry>(data, normalizeEntry);
    },

    async registerIncome(payload: CreatePettyCashIncomeDto): Promise<PettyCashEntry> {
        const fd = new FormData();
        fd.append('type', 'income');
        fd.append('amount', String(payload.amount));
        fd.append('description', payload.description);
        if (payload.currency) fd.append('currency', payload.currency);

        const { data } = await apiClient.post<PettyCashEntry>(
            `${P}/petty-cash/funds/${payload.building_id}/entries`,
            fd,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return normalizeEntry(data);
    },

    async registerExpense(formData: FormData): Promise<PettyCashEntry> {
        const buildingId = formData.get('building_id');
        if (!buildingId) {
            throw new Error('building_id is required');
        }
        if (!formData.has('type')) {
            formData.append('type', 'expense');
        }

        const { data } = await apiClient.post<PettyCashEntry>(
            `${P}/petty-cash/funds/${buildingId}/entries`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return normalizeEntry(data);
    },

    async reverseEntry(
        buildingId: string,
        entryId: string,
        reason: string
    ): Promise<PettyCashEntry> {
        const { data } = await apiClient.post<PettyCashEntry>(
            `${P}/petty-cash/funds/${buildingId}/entries/${entryId}/reverse`,
            { reason }
        );
        return normalizeEntry(data);
    },

    async getAssessmentPreview(buildingId: string): Promise<PettyCashAssessmentPreview | null> {
        try {
            const { data } = await apiClient.get<PettyCashAssessmentPreview>(
                `${P}/petty-cash/funds/${buildingId}/assessments`
            );
            return data;
        } catch (error) {
            const axiosError = error as import('axios').AxiosError;
            // 400/404: no preview available — not an error condition.
            // 403: caller lacks assessment permission — silently return null
            //      so the rest of the page still loads.
            const status = axiosError.response?.status;
            if (status === 400 || status === 404 || status === 403) {
                return null;
            }
            throw error;
        }
    },

    async generateAssessments(
        buildingId: string,
        payload: CreatePettyCashAssessmentDto
    ): Promise<PettyCashAssessmentResponse> {
        const { data } = await apiClient.post<PettyCashAssessmentResponse>(
            `${P}/petty-cash/funds/${buildingId}/assessments`,
            {
                description: payload.description,
                amount: payload.amount,
                ...(payload.category ? { category: payload.category } : {}),
                ...(payload.unit_ids !== undefined ? { unit_ids: payload.unit_ids } : {}),
            }
        );
        return data;
    },

    async getTransparency(
        buildingId: string,
        period: string
    ): Promise<PettyCashTransparency> {
        const { data } = await apiClient.get<PettyCashTransparency>(
            `${P}/petty-cash/funds/${buildingId}/transparency`,
            { params: { period } }
        );
        return data;
    },

    async generateExpressAssessment(
        buildingId: string,
        dto: CreateExpressAssessmentDto
    ): Promise<PettyCashAssessmentResponse> {
        const { data } = await apiClient.post<PettyCashAssessmentResponse>(
            `${P}/petty-cash/funds/${buildingId}/assessments`,
            {
                description: dto.description,
                amount: dto.amount,
                kind: 'EXPRESS',
                source_entry_id: dto.source_entry_id,
                unit_ids: dto.unit_ids,
                ...(dto.unit_amounts ? { unit_amounts: dto.unit_amounts } : {}),
                ...(dto.category ? { category: dto.category } : {}),
            }
        );
        return data;
    },

    async cancelExpressAssessment(
        buildingId: string,
        assessmentId: string,
        reason: string
    ): Promise<CancelExpressAssessmentResponse> {
        const { data } = await apiClient.post<CancelExpressAssessmentResponse>(
            `${P}/petty-cash/funds/${buildingId}/assessments/${assessmentId}/cancel`,
            { reason }
        );
        return data;
    },

    async setTargetFund(
        buildingId: string,
        targetFund: number
    ): Promise<SetTargetFundResponse> {
        const { data } = await apiClient.put<SetTargetFundResponse>(
            `${P}/petty-cash/funds/${buildingId}/target-fund`,
            { target_fund: targetFund }
        );
        return data;
    },

    async registerContribution(
        buildingId: string,
        formData: FormData
    ): Promise<ContributionResponse> {
        const { data } = await apiClient.post<ContributionResponse>(
            `${P}/petty-cash/funds/${buildingId}/contributions`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return data;
    },

    async getPaymentsReport(
        buildingId: string,
        filters?: PettyCashPaymentReportFilters
    ): Promise<PettyCashPaymentReportItem[]> {
        const { data } = await apiClient.get<PettyCashPaymentReportItem[]>(
            `${P}/petty-cash/funds/${buildingId}/payments-report`,
            { params: filters }
        );
        return data;
    },
};
