import type {
    BillingSummary, BillingTotals, ChargeConcept, ChargeConceptKind, ChargeDistribution, Invoice,
} from '@/types/models';

export const UNCLASSIFIED_GROUP_ID = 'unclassified';

/** A card of the grouped billing view: one concept (per period when ORDINARY), or the invoices without one. */
export interface ConceptViewGroup {
    id: string;
    conceptId: string | null;
    title: string;
    kind: ChargeConceptKind | null;
    distribution: ChargeDistribution | null;
    period: string | null;
    goal: number | null;
    billed: number;
    collected: number;
    /** % collected: against the goal when the concept has one, otherwise against what was billed. */
    progress: number;
    count: number;
    paidCount: number;
    partialCount: number;
    pendingCount: number;
    /** Invoices of the group that pass the current filters. */
    invoices: Invoice[];
}

const groupKey = (conceptId: string, period: string | null) => `${conceptId}:${period ?? ''}`;

const percent = (part: number, whole: number) =>
    whole > 0 ? Math.min(100, Math.round((part / whole) * 1000) / 10) : 0;

function totalsOf(invoices: Invoice[]): BillingTotals {
    const active = invoices.filter(inv => inv.status !== 'CANCELLED');
    const cents = (n: number) => Math.round((n || 0) * 100);
    const billed = active.reduce((sum, inv) => sum + cents(inv.amount), 0);
    const collected = active.reduce((sum, inv) => sum + cents(inv.paid_amount), 0);
    return {
        invoice_count: active.length,
        billed: billed / 100,
        collected: collected / 100,
        outstanding: (billed - collected) / 100,
        paid_count: active.filter(inv => inv.status === 'PAID').length,
        partial_count: active.filter(inv => inv.status === 'PARTIAL').length,
        pending_count: active.filter(inv => inv.status === 'PENDING').length,
    };
}

function fromTotals(totals: BillingTotals): Pick<ConceptViewGroup, 'billed' | 'collected' | 'count' | 'paidCount' | 'partialCount' | 'pendingCount'> {
    return {
        billed: totals.billed,
        collected: totals.collected,
        count: totals.invoice_count,
        paidCount: totals.paid_count,
        partialCount: totals.partial_count,
        pendingCount: totals.pending_count,
    };
}

/**
 * Groups invoices by their concept_id (and period for ORDINARY concepts). Card totals come from the
 * billing summary, so they cover the whole concept even when the list is filtered by unit or month;
 * groups the summary does not know (e.g. only cancelled invoices) fall back to the listed invoices.
 * Active EXTRAORDINARY concepts without invoices are shown only when `includeEmpty` is set.
 */
export function buildConceptGroups(
    summary: BillingSummary | null,
    concepts: ChargeConcept[],
    invoices: Invoice[],
    includeEmpty: boolean,
): ConceptViewGroup[] {
    const conceptById = new Map(concepts.map(c => [c.id, c]));
    // The summary also knows each concept's kind, in case the concept list could not be loaded
    const kindById = new Map<string, ChargeConceptKind>((summary?.groups ?? []).map(g => [g.concept_id, g.kind]));
    concepts.forEach(c => kindById.set(c.id, c.kind));

    const invoicesByKey = new Map<string, Invoice[]>();
    for (const inv of invoices) {
        const key = inv.concept_id
            ? groupKey(inv.concept_id, kindById.get(inv.concept_id) === 'EXTRAORDINARY' ? null : (inv.period ?? null))
            : UNCLASSIFIED_GROUP_ID;
        const list = invoicesByKey.get(key) ?? [];
        list.push(inv);
        invoicesByKey.set(key, list);
    }

    const groups: ConceptViewGroup[] = [];
    const seen = new Set<string>();

    for (const g of summary?.groups ?? []) {
        const key = groupKey(g.concept_id, g.period);
        const listed = invoicesByKey.get(key) ?? [];
        if (listed.length === 0 && !(includeEmpty && g.invoice_count === 0)) continue;
        seen.add(key);
        groups.push({
            id: key,
            conceptId: g.concept_id,
            title: g.period ? `${g.name} · ${g.period}` : g.name,
            kind: g.kind,
            distribution: g.distribution,
            period: g.period,
            goal: g.goal,
            progress: g.progress ?? percent(g.collected, g.billed),
            ...fromTotals(g),
            invoices: listed,
        });
    }

    for (const [key, listed] of invoicesByKey) {
        if (seen.has(key) || key === UNCLASSIFIED_GROUP_ID) continue;
        const concept = conceptById.get(listed[0].concept_id!);
        const totals = totalsOf(listed);
        const period = concept?.kind === 'EXTRAORDINARY' ? null : (listed[0].period ?? null);
        const name = concept?.name ?? 'Concepto';
        groups.push({
            id: key,
            conceptId: listed[0].concept_id ?? null,
            title: period ? `${name} · ${period}` : name,
            kind: concept?.kind ?? null,
            distribution: concept?.distribution ?? null,
            period,
            goal: concept?.kind === 'EXTRAORDINARY' ? concept.base_amount : null,
            progress: percent(totals.collected, totals.billed),
            ...fromTotals(totals),
            invoices: listed,
        });
    }

    const unclassified = invoicesByKey.get(UNCLASSIFIED_GROUP_ID);
    if (unclassified?.length) {
        const totals = summary?.unclassified ?? totalsOf(unclassified);
        groups.push({
            id: UNCLASSIFIED_GROUP_ID,
            conceptId: null,
            title: 'Sin concepto',
            kind: null,
            distribution: null,
            period: null,
            goal: null,
            progress: percent(totals.collected, totals.billed),
            ...fromTotals(totals),
            invoices: unclassified,
        });
    }

    return groups;
}
