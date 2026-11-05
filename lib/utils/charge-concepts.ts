import type { ChargeConcept, ChargeConceptKind, ChargeDistribution } from '@/types/models';

export const CONCEPT_KIND_LABELS: Record<ChargeConceptKind, string> = {
    ORDINARY: 'Ordinario',
    EXTRAORDINARY: 'Extraordinario',
};

export const DISTRIBUTION_LABELS: Record<ChargeDistribution, string> = {
    ALIQUOT: 'Por alícuota',
    EQUAL: 'Partes iguales',
    FIXED: 'Monto fijo por unidad',
};

// Default description of an invoice billed for a concept, e.g. "Condominio 2026-10".
export function conceptInvoiceDescription(concept: Pick<ChargeConcept, 'name'>, period: string): string {
    return period ? `${concept.name} ${period}` : concept.name;
}

/**
 * Amount one unit pays for a concept, rounded to cents the same way the API bills it:
 * ALIQUOT rounds each unit on its own, FIXED charges the amount as is, EQUAL is an estimate
 * (the API assigns the remaining cents so the total matches).
 */
export function unitShareOfConcept(
    distribution: ChargeDistribution,
    amount: number,
    aliquot: number | null,
    unitCount: number,
): number | null {
    if (!(amount > 0)) return null;
    const cents = Math.round(amount * 100);
    switch (distribution) {
        case 'FIXED':
            return cents / 100;
        case 'EQUAL':
            return unitCount > 0 ? Math.floor(cents / unitCount) / 100 : null;
        case 'ALIQUOT':
            return aliquot === null ? null : Math.round((cents * aliquot) / 100) / 100;
    }
}

export interface ShareUnit {
    id: string;
    name: string;
    aliquot: number | null;
}

/**
 * Per-unit amounts for a concept, mirroring the API split (ChargeDistribution): units sorted by name,
 * ALIQUOT rounds each unit on its own, EQUAL hands the remaining cents to the first units, FIXED repeats
 * the amount. Units that cannot be computed (no aliquot) get null.
 */
export function splitConceptAmount(
    distribution: ChargeDistribution,
    amount: number,
    units: ShareUnit[],
): Map<string, number | null> {
    const shares = new Map<string, number | null>();
    const cents = Math.round(amount * 100);
    const sorted = [...units].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }));
    if (!(cents > 0) || sorted.length === 0) {
        sorted.forEach(u => shares.set(u.id, null));
        return shares;
    }
    if (distribution === 'EQUAL') {
        const each = Math.floor(cents / sorted.length);
        const remainder = cents - each * sorted.length;
        sorted.forEach((u, i) => shares.set(u.id, (each + (i < remainder ? 1 : 0)) / 100));
        return shares;
    }
    sorted.forEach(u => shares.set(u.id, unitShareOfConcept(distribution, amount, u.aliquot, sorted.length)));
    return shares;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
    const err = error as { response?: { data?: { message?: string } } };
    return err.response?.data?.message || fallback;
}
