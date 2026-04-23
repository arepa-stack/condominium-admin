'use client';

import type { Decision } from '@/types/models';
import { UrgencyChip } from '@/components/decisions/UrgencyChip';
import { differenceInHours } from 'date-fns';

export type DecisionView = 'activas' | 'pendientes' | 'archivadas';

interface ActionFilterChipsProps {
    decisions: Decision[];
    selected: DecisionView;
    onChange: (view: DecisionView) => void;
}

export function filterByView(
    decisions: Decision[],
    view: DecisionView,
    now: Date = new Date(),
): Decision[] {
    return decisions.filter((d) => {
        const isOpen = d.status === 'RECEPTION' || d.status === 'VOTING';
        const isTiebreak = d.status === 'TIEBREAK_PENDING';
        const resolvedNeedsCharge =
            d.status === 'RESOLVED' && !d.resulting_id;
        const resolvedCharged =
            d.status === 'RESOLVED' && !!d.resulting_id;
        const cancelled = d.status === 'CANCELLED';

        const votingCloseSoon =
            d.status === 'VOTING' &&
            differenceInHours(new Date(d.voting_deadline), now) < 24 &&
            !d.is_deadline_passed;

        const requiresAction =
            isTiebreak || resolvedNeedsCharge || votingCloseSoon || d.is_deadline_passed;

        if (view === 'activas') return isOpen || isTiebreak;
        if (view === 'pendientes') return requiresAction;
        return cancelled || resolvedCharged; // archivadas
    });
}

export function ActionFilterChips({
    decisions,
    selected,
    onChange,
}: ActionFilterChipsProps) {
    const now = new Date();
    const activasCount = filterByView(decisions, 'activas', now).length;
    const pendientesCount = filterByView(decisions, 'pendientes', now).length;
    const archivadasCount = filterByView(decisions, 'archivadas', now).length;

    return (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtro de decisiones">
            <UrgencyChip
                label="Activas"
                count={activasCount}
                selected={selected === 'activas'}
                onClick={() => onChange('activas')}
            />
            <UrgencyChip
                label="Pendientes acción"
                count={pendientesCount}
                selected={selected === 'pendientes'}
                onClick={() => onChange('pendientes')}
                tone="danger"
            />
            <UrgencyChip
                label="Archivadas"
                count={archivadasCount}
                selected={selected === 'archivadas'}
                onClick={() => onChange('archivadas')}
                tone="neutral"
            />
        </div>
    );
}
