import type { Decision } from '@/types/models';

export type PrimaryActionKind =
    | 'upload-first-quote'
    | 'finalize-reception'
    | 'force-finalize-reception'
    | 'finalize-voting-now'
    | 'resolve-tiebreak'
    | 'generate-charge'
    | 'view-charge'
    | null;

export interface PrimaryAction {
    kind: Exclude<PrimaryActionKind, null>;
    label: string;
    /**
     * 'solid'  = primary, prominent (CTA color)
     * 'outline' = optional-early action (less prominent)
     * 'link'   = navigation action (e.g. "Ver cargo →")
     */
    variant: 'solid' | 'outline' | 'link';
}

/**
 * Decides the primary CTA to show in the decision detail hero, based on the
 * current phase + derived signals (active quote count, deadline passed, charge generated).
 *
 * Returns `null` when no primary action applies (e.g. CANCELLED, or user has no manage permission).
 * The caller is responsible for gating `null` by permissions (this function doesn't know about roles).
 */
export function resolvePrimaryAction(
    decision: Decision,
    activeQuoteCount: number,
): PrimaryAction | null {
    switch (decision.status) {
        case 'RECEPTION':
            if (activeQuoteCount === 0) {
                return {
                    kind: 'upload-first-quote',
                    label: 'Subir primera cotización',
                    variant: 'solid',
                };
            }
            if (decision.is_deadline_passed) {
                return {
                    kind: 'finalize-reception',
                    label: 'Finalizar recepción → Abrir votación',
                    variant: 'solid',
                };
            }
            // Deadline aún no vence: backend acepta force+reason para saltar el wait.
            return {
                kind: 'force-finalize-reception',
                label: 'Pasar a votación ahora',
                variant: 'solid',
            };
        case 'VOTING':
            if (decision.is_deadline_passed) {
                return {
                    kind: 'finalize-voting-now',
                    label: 'Finalizar votación',
                    variant: 'solid',
                };
            }
            // Backend no acepta force en VOTING; sin CTA hasta que venza deadline.
            return null;
        case 'TIEBREAK_PENDING':
            return {
                kind: 'resolve-tiebreak',
                label: 'Resolver empate',
                variant: 'solid',
            };
        case 'RESOLVED':
            if (!decision.resulting_id) {
                // Guard: generate-charge is only valid when a winning quote exists.
                // If winner_quote_id is null (manual resolve without a matched quote,
                // or edge states), emit no primary CTA — let admin use overflow actions
                // or resolve via other surfaces.
                if (!decision.winner_quote_id) {
                    return null;
                }
                return {
                    kind: 'generate-charge',
                    label: 'Generar cargo',
                    variant: 'solid',
                };
            }
            return {
                kind: 'view-charge',
                label: 'Ver cargo →',
                variant: 'link',
            };
        case 'CANCELLED':
            return null;
        default: {
            const _exhaustive: never = decision.status;
            return _exhaustive;
        }
    }
}

/**
 * Returns the deep-link route for a resolved decision's charge.
 * Falls back to `/decisions/{id}` if resulting_id/type missing.
 */
export function getChargeDeepLink(decision: Decision): string {
    if (!decision.resulting_id || !decision.resulting_type) {
        return `/decisions/${decision.id}`;
    }
    if (decision.resulting_type === 'INVOICE') {
        return `/billing/invoices/${decision.resulting_id}`;
    }
    // ASSESSMENT — route prefix is confirmed during Phase 4 QA; default kept consistent with finances module
    return `/finances/petty-cash/assessments/${decision.resulting_id}`;
}
