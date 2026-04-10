import { apiClient } from '@/lib/api/client';
import type {
    PettyCashBalance,
    PettyCashTransaction,
    CreatePettyCashIncomeDto,
} from '@/types/models';

export const pettyCashService = {
    async getBalance(buildingId: string): Promise<PettyCashBalance> {
        const { data } = await apiClient.get<PettyCashBalance>(
            `/petty-cash/balance/${buildingId}`
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
            `/petty-cash/history/${buildingId}`,
            { params }
        );
        return (Array.isArray(data) ? data : []).map((t) => ({
            ...t,
            amount: Number(t.amount),
        }));
    },

    async registerIncome(payload: CreatePettyCashIncomeDto): Promise<PettyCashTransaction> {
        const { data } = await apiClient.post<PettyCashTransaction>(
            '/petty-cash/income',
            {
                building_id: payload.building_id,
                description: payload.description,
                amount:
                    typeof payload.amount === 'string'
                        ? Number(payload.amount)
                        : payload.amount,
            }
        );
        return {
            ...data,
            amount: Number(data.amount),
        };
    },

    async registerExpense(formData: FormData): Promise<PettyCashTransaction> {
        const { data } = await apiClient.post<PettyCashTransaction>(
            '/petty-cash/expense',
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
};
