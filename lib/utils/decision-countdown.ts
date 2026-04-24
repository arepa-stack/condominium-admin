import { differenceInHours, differenceInMinutes, formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

export type CountdownUrgency = 'safe' | 'warn' | 'danger' | 'expired';

export interface CountdownResult {
    label: string;
    urgency: CountdownUrgency;
    isExpired: boolean;
}

/**
 * Computes a human label + urgency level for a decision phase deadline.
 *
 * - `safe`: more than 7 days remaining
 * - `warn`: between 24h and 7 days remaining
 * - `danger`: less than 24h remaining (and not expired)
 * - `expired`: deadline has passed (caller decides how to render based on isDeadlinePassed flag from backend)
 */
export function formatCountdown(
    deadlineIso: string,
    isDeadlinePassedFromBackend: boolean = false,
): CountdownResult {
    const deadline = new Date(deadlineIso);
    const now = new Date();
    const minutesLeft = differenceInMinutes(deadline, now);
    const hoursLeft = differenceInHours(deadline, now);
    const isExpired = minutesLeft <= 0 || isDeadlinePassedFromBackend;

    if (isExpired) {
        return {
            label: 'Plazo vencido',
            urgency: 'expired',
            isExpired: true,
        };
    }

    const distance = formatDistanceStrict(deadline, now, {
        locale: es,
        addSuffix: false,
    });

    if (hoursLeft < 24) {
        return { label: `⏱ ${distance}`, urgency: 'danger', isExpired: false };
    }

    if (hoursLeft < 24 * 7) {
        return { label: `⏱ ${distance}`, urgency: 'warn', isExpired: false };
    }

    return { label: `En ${distance}`, urgency: 'safe', isExpired: false };
}
