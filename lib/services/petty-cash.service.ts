import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type {
    PettyCashBalance,
    PettyCashEntry,
    PettyCashEntryType,
    PettyCashCategory,
    CreatePettyCashIncomeDto,
    CreatePettyCashAssessmentDto,
    PettyCashAssessmentPreview,
    PettyCashAssessmentResponse,
    PettyCashTransparency,
    PaginatedResponse,
    PaginationParams,
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
        };
    },

    async getHistory(
        buildingId: string,
        params?: PettyCashEntryFilters,
    ): Promise<PettyCashEntry[]> {
        const { data } = await apiClient.get<PaginatedResponse<PettyCashEntry>>(
            `${P}/petty-cash/funds/${buildingId}/entries`,
            { params: { limit: 'all', ...params } },
        );
        return (data?.data ?? []).map(normalizeEntry);
    },

    async getHistoryPaginated(
        buildingId: string,
        params?: PettyCashEntryFilters & PaginationParams,
    ): Promise<PaginatedResponse<PettyCashEntry>> {
        const { data } = await apiClient.get<PaginatedResponse<PettyCashEntry>>(
            `${P}/petty-cash/funds/${buildingId}/entries`,
            { params },
        );
        return {
            data: (data?.data ?? []).map(normalizeEntry),
            metadata: data.metadata,
        };
    },

    async registerIncome(payload: CreatePettyCashIncomeDto): Promise<PettyCashEntry> {
        const fd = new FormData();
        fd.append('type', 'income');
        fd.append('amount', String(payload.amount));
        fd.append('description', payload.description);

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
            if (axiosError.response?.status === 400 || axiosError.response?.status === 404) {
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
};
