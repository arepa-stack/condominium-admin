import type { DecisionStatus } from '@/types/models';
import type { LucideIcon } from 'lucide-react';
import { Clock, Vote, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export interface PhaseTheme {
    label: string;
    icon: LucideIcon;
    /**
     * Subtle gradient for Hero background.
     */
    gradientClass: string;
    /**
     * Color for primary accents (left borders, prominently colored text).
     */
    accentClass: string;
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
        gradientClass: 'bg-gradient-to-br from-amber-500/10 to-amber-600/5',
        accentClass: 'border-amber-800 text-amber-800 dark:border-amber-700 dark:text-amber-500',
        toneClass: 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
        tone: 'amber',
    },
    VOTING: {
        label: 'Votación',
        icon: Vote,
        gradientClass: 'bg-gradient-to-br from-amber-500/20 to-orange-600/5',
        accentClass: 'border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-500',
        toneClass: 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200',
        tone: 'hot',
    },
    TIEBREAK_PENDING: {
        label: 'Empate pendiente',
        icon: AlertTriangle,
        gradientClass: 'bg-gradient-to-br from-yellow-400/20 to-amber-500/5',
        accentClass: 'border-amber-500 text-amber-600 dark:border-amber-500 dark:text-amber-400',
        toneClass: 'bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-200',
        tone: 'warning',
    },
    RESOLVED: {
        label: 'Resuelta',
        icon: CheckCircle2,
        gradientClass: 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5',
        accentClass: 'border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-500',
        toneClass: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200',
        tone: 'success',
    },
    CANCELLED: {
        label: 'Cancelada',
        icon: XCircle,
        gradientClass: 'bg-gradient-to-br from-stone-500/10 to-stone-600/5',
        accentClass: 'border-stone-500 text-stone-600 dark:border-stone-500 dark:text-stone-400',
        toneClass: 'bg-stone-100 text-stone-700 dark:bg-stone-900/40 dark:text-stone-300',
        tone: 'muted',
    },
};

export function getPhaseTheme(status: DecisionStatus): PhaseTheme {
    return THEMES[status];
}
