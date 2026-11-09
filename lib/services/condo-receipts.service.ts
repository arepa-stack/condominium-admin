import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';

export type ExpenseCurrency = 'USD' | 'VES';

export interface ExpenseCode {
    id: string;
    code: string;
    description: string;
}

export interface MonthlyExpense {
    id: string;
    period: string;
    code_id: string;
    code: string;
    code_description: string;
    detail: string | null;
    amount: number;
    currency: ExpenseCurrency;
    expense_date: string;
    invoice_url: string | null;
}

export interface PeriodExpenses {
    period: string;
    closed: boolean;
    totals: { usd: number; ves: number; count: number };
    expenses: MonthlyExpense[];
}

export interface ReceiptLine {
    code: string | null;
    description: string;
    amount_bs: number;
    percent: number;
}

export interface ReceiptUnit {
    unit_id: string;
    unit_name: string;
    aliquot: number;
    control_number: string;
    total_bs: number;
    total_usd: number;
}

export interface CondoReceipt {
    id: string;
    period: string;
    reserve_percent: number;
    exchange_rate: number;
    rate_source: string;
    rate_date: string;
    total_bs: number;
    total_usd: number;
    lines: ReceiptLine[];
    units: ReceiptUnit[];
    created_at: string;
}

export interface UnitReceipt {
    building: { id: string; name: string; address: string };
    period: string;
    control_number: string;
    issued_at: string;
    exchange_rate: number;
    rate_date: string;
    unit: { id: string; name: string; aliquot: number; owners: string[] };
    lines: (ReceiptLine & { share_bs: number })[];
    total_bs: number;
    net_bs: number;
    net_usd: number;
    debt_usd: number;
    debt_bs: number;
    pending_invoices: number;
    last_payments: { payment_date: string; amount: number; original_currency: string; original_amount: number | null }[];
    payment_info: {
        bank_name: string | null;
        account_holder: string | null;
        rif: string | null;
        account_number: string | null;
        pago_movil_phone: string | null;
        email: string | null;
    } | null;
}

const base = (buildingId: string) => `${ADMIN_API_PREFIX}/condo-receipts/buildings/${buildingId}`;

export const condoReceiptsService = {
    async listCodes(buildingId: string) {
        return (await apiClient.get<ExpenseCode[]>(`${base(buildingId)}/codes`)).data;
    },
    async createCode(buildingId: string, code: string, description: string) {
        return (await apiClient.post<ExpenseCode>(`${base(buildingId)}/codes`, { code, description })).data;
    },
    async listExpenses(buildingId: string, period: string) {
        return (await apiClient.get<PeriodExpenses>(`${base(buildingId)}/periods/${period}/expenses`)).data;
    },
    async addExpense(buildingId: string, period: string, input: {
        code_id: string; detail: string; amount: string; currency: ExpenseCurrency; expense_date: string; invoice: File | null;
    }) {
        const form = new FormData();
        form.append('code_id', input.code_id);
        if (input.detail.trim()) form.append('detail', input.detail.trim());
        form.append('amount', input.amount);
        form.append('currency', input.currency);
        form.append('expense_date', input.expense_date);
        if (input.invoice) form.append('invoice', input.invoice);
        return (await apiClient.post<MonthlyExpense>(`${base(buildingId)}/periods/${period}/expenses`, form)).data;
    },
    async deleteExpense(buildingId: string, expenseId: string) {
        await apiClient.delete(`${base(buildingId)}/expenses/${expenseId}`);
    },
    /** Only for a closed period (`PeriodExpenses.closed`); 404 otherwise. */
    async getReceipt(buildingId: string, period: string) {
        return (await apiClient.get<CondoReceipt>(`${base(buildingId)}/receipts/${period}`)).data;
    },
    async generate(buildingId: string, period: string, reservePercent: number) {
        return (await apiClient.post<CondoReceipt>(`${base(buildingId)}/receipts/${period}`, { reserve_percent: reservePercent })).data;
    },
    async void(buildingId: string, period: string) {
        await apiClient.delete(`${base(buildingId)}/receipts/${period}`);
    },
    async getUnitReceipt(buildingId: string, period: string, unitId: string) {
        return (await apiClient.get<UnitReceipt>(`${base(buildingId)}/receipts/${period}/units/${unitId}`)).data;
    },
};
