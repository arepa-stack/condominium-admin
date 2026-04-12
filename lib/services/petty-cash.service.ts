import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type {
    PettyCashBalance,
    PettyCashTransaction,
    CreatePettyCashIncomeDto,
    PettyCashAssessmentPreview,
    PettyCashAssessmentResponse,
    PettyCashTransparency,
} from '@/types/models';

const P = ADMIN_API_PREFIX;

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
        params?: {
            type?: string;
            category?: string;
            page?: number;
            limit?: number;
        }
    ): Promise<PettyCashTransaction[]> {
        const { data } = await apiClient.get<PettyCashTransaction[]>(
            `${P}/petty-cash/funds/${buildingId}/transactions`,
            { params }
        );
        return (Array.isArray(data) ? data : []).map((t) => ({
            ...t,
            amount: Number(t.amount),
        }));
    },

    async registerIncome(payload: CreatePettyCashIncomeDto): Promise<PettyCashTransaction> {
        const { data } = await apiClient.post<PettyCashTransaction>(
            `${P}/petty-cash/funds/${payload.building_id}/transactions`,
            {
                description: payload.description,
                amount:
                    typeof payload.amount === 'string'
                        ? Number(payload.amount)
                        : payload.amount,
                type: 'INCOME',
            }
        );
        return {
            ...data,
            amount: Number(data.amount),
        };
    },

    async registerExpense(formData: FormData): Promise<PettyCashTransaction> {
        const buildingId = formData.get('building_id');
        // Type is explicitly added to formData in TransactionDialog or we ensure it's here
        if (!formData.has('type')) {
            formData.append('type', 'EXPENSE');
        }
        
        const { data } = await apiClient.post<PettyCashTransaction>(
            `${P}/petty-cash/funds/${buildingId}/transactions`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return {
            ...data,
            amount: Number(data.amount),
        };
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

    async generateAssessments(buildingId: string): Promise<PettyCashAssessmentResponse> {
        const { data } = await apiClient.post<PettyCashAssessmentResponse>(`${P}/petty-cash/funds/${buildingId}/assessments`);
        return data;
    },

    async getTransparency(buildingId: string): Promise<PettyCashTransparency> {
        const { data } = await apiClient.get<PettyCashTransparency>(
            `${P}/petty-cash/funds/${buildingId}/transparency`
        );
        return data;
    },
};
