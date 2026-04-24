import type { DecisionStatus } from '@/types/models';
import type { LucideIcon } from 'lucide-react';
import { Clock, Vote, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export interface PhaseTheme {
    label: string;
    icon: LucideIcon;
    /**
     * Tailwind class for a gradient background that reads on white text.
     * Used on Hero and list Card variants where white text sits on the gradient.
     */
    gradientClass: string;
    /**
     * Muted tone class for non-gradient surfaces (chips, card borders),
     * using theme tokens so it respects dark mode.
     */
    toneClass: string;
    /** Short tone identifier for programmatic decisions. */
    tone: 'amber' | 'hot' | 'warning' | 'success' | 'muted';
}

const THEMES: Record<DecisionStatus, PhaseTheme> = {
    RECEPTION: {
        label: 'Recepción',
        icon: Clock,
        gradientClass: 'bg-gradient-to-br from-amber-700 to-amber-900',
        toneClass: 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
        tone: 'amber',
    },
    VOTING: {
        label: 'Votación',
        icon: Vote,
        gradientClass: 'bg-gradient-to-br from-amber-600 to-orange-800',
        toneClass: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
        tone: 'hot',
    },
    TIEBREAK_PENDING: {
        label: 'Empate pendiente',
        icon: AlertTriangle,
        gradientClass: 'bg-gradient-to-br from-yellow-500 to-amber-700',
        toneClass: 'bg-yellow-50 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200',
        tone: 'warning',
    },
    RESOLVED: {
        label: 'Resuelta',
        icon: CheckCircle2,
        gradientClass: 'bg-gradient-to-br from-emerald-700 to-emerald-900',
        toneClass: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
        tone: 'success',
    },
    CANCELLED: {
        label: 'Cancelada',
        icon: XCircle,
        gradientClass: 'bg-gradient-to-br from-stone-600 to-stone-800',
        toneClass: 'bg-stone-100 text-stone-700 dark:bg-stone-900/60 dark:text-stone-300',
        tone: 'muted',
    },
};

export function getPhaseTheme(status: DecisionStatus): PhaseTheme {
    return THEMES[status];
}
