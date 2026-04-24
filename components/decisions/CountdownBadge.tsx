'use client';

import { cn } from '@/lib/utils';
import { formatCountdown } from '@/lib/utils/decision-countdown';
import { AlertTriangle } from 'lucide-react';

interface CountdownBadgeProps {
    deadline: string;
    isDeadlinePassed?: boolean;
    /**
     * When true the badge is shown even if the client clock reports expiry but the
     * backend has NOT yet flagged the deadline as passed. Default false — during that
     * "client-only expiry" limbo the badge is hidden and only shown once the backend
     * confirms via `isDeadlinePassed`.
     */
    renderWhenClosed?: boolean;
    /** Extra classes (e.g. text size overrides on hero). */
    className?: string;
}

const URGENCY_CLASSES = {
    safe: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100',
    danger: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
    expired: 'bg-red-600 text-white',
} as const;

export function CountdownBadge({
    deadline,
    isDeadlinePassed = false,
    renderWhenClosed = false,
    className,
}: CountdownBadgeProps) {
    const { label, urgency, isExpired } = formatCountdown(deadline, isDeadlinePassed);

    if (isExpired && !isDeadlinePassed && !renderWhenClosed) {
        return null;
    }

    // Expired override: generic label from formatCountdown is descriptive ("Plazo vencido"),
    // but the admin panel badge needs action-prompting phrasing when the phase is still open
    // past the deadline (backend is_deadline_passed=true).
    const tone =
        urgency === 'expired'
            ? 'Pendiente de finalizar'
            : label;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                URGENCY_CLASSES[urgency],
                className,
            )}
        >
            {urgency === 'expired' && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
            <span>{urgency === 'expired' ? `⚠ ${tone}` : tone}</span>
        </span>
    );
}
