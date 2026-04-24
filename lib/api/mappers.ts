import type {
    PaginationMetadata,
    PaginatedResponse,
    UnitBalance,
    UnitInvoice,
    PreviewInvoicesResponse,
    ProposedInvoice,
} from '@/types/models';

interface RawPaginationMetadata {
    total?: number;
    page?: number;
    limit?: number;
    total_pages?: number;
    has_next_page?: boolean;
    has_prev_page?: boolean;
}

interface RawPaginatedResponse<T> {
    data?: T[];
    items?: T[];
    metadata?: RawPaginationMetadata;
}

export function mapPaginationMetadata(raw?: RawPaginationMetadata): PaginationMetadata {
    const meta = raw ?? {};
    const page = meta.page ?? 1;
    const totalPages = meta.total_pages ?? 1;
    return {
        total: meta.total ?? 0,
        page,
        limit: meta.limit ?? 20,
        totalPages,
        hasNextPage: meta.has_next_page ?? page < totalPages,
        hasPrevPage: meta.has_prev_page ?? page > 1,
    };
}

export function mapPaginatedResponse<T, U = T>(
    raw: RawPaginatedResponse<T> | undefined,
    mapItem?: (item: T) => U,
): PaginatedResponse<U> {
    const items = raw?.data ?? raw?.items ?? [];
    const data = mapItem ? items.map(mapItem) : (items as unknown as U[]);
    return {
        data,
        metadata: mapPaginationMetadata(raw?.metadata),
    };
}

interface RawUnitInvoice {
    invoice_id?: string;
    invoiceId?: string;
    amount: number;
    paid: number;
    remaining: number;
    period: string;
    status: string;
}

interface RawUnitBalance {
    unit: string;
    total_debt?: number;
    totalDebt?: number;
    pending_invoices?: number;
    pendingInvoices?: number;
    credit_balance?: number;
    creditBalance?: number;
    net_balance?: number;
    netBalance?: number;
    details?: RawUnitInvoice[];
}

export function mapUnitBalance(raw: RawUnitBalance): UnitBalance {
    return {
        unit: raw.unit,
        totalDebt: raw.total_debt ?? raw.totalDebt ?? 0,
        pendingInvoices: raw.pending_invoices ?? raw.pendingInvoices ?? 0,
        creditBalance: raw.credit_balance ?? raw.creditBalance ?? 0,
        netBalance: raw.net_balance ?? raw.netBalance ?? 0,
        details: (raw.details ?? []).map(mapUnitInvoice),
    };
}

function mapUnitInvoice(raw: RawUnitInvoice): UnitInvoice {
    return {
        invoiceId: raw.invoice_id ?? raw.invoiceId ?? '',
        amount: raw.amount,
        paid: raw.paid,
        remaining: raw.remaining,
        period: raw.period,
        status: raw.status,
    };
}

interface RawProposedInvoice {
    unit_name?: string;
    unitName?: string;
    amount: number;
    period: string;
    issue_date?: string;
    issueDate?: string;
    receipt_number?: string;
    receiptNumber?: string;
    unit_id?: string;
    unitId?: string;
    warning?: string;
    status: 'EXISTS' | 'TO_BE_CREATED';
}

interface RawPreviewInvoicesResponse {
    invoices?: RawProposedInvoice[];
    units_to_create?: string[];
    unitsToCreate?: string[];
}

export function mapPreviewInvoicesResponse(
    raw: RawPreviewInvoicesResponse,
): PreviewInvoicesResponse {
    return {
        invoices: (raw.invoices ?? []).map(mapProposedInvoice),
        unitsToCreate: raw.units_to_create ?? raw.unitsToCreate ?? [],
    };
}

function mapProposedInvoice(raw: RawProposedInvoice): ProposedInvoice {
    return {
        unitName: raw.unit_name ?? raw.unitName ?? '',
        amount: raw.amount,
        period: raw.period,
        issueDate: raw.issue_date ?? raw.issueDate ?? '',
        receiptNumber: raw.receipt_number ?? raw.receiptNumber ?? '',
        warning: raw.warning,
        status: raw.status,
    };
}

export function proposedInvoiceToBody(inv: ProposedInvoice): Record<string, unknown> {
    return {
        unit_name: inv.unitName,
        amount: inv.amount,
        period: inv.period,
        issue_date: inv.issueDate,
        receipt_number: inv.receiptNumber,
        ...(inv.warning ? { warning: inv.warning } : {}),
        status: inv.status,
    };
}
