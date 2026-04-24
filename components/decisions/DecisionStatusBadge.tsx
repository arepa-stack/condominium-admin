'use client';

import { Badge } from '@/components/ui/badge';
import type { DecisionStatus } from '@/types/models';

const STATUS_CONFIG: Record<
    DecisionStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
    RECEPTION: { label: 'Recepción', variant: 'secondary' },
    VOTING: { label: 'Votación', variant: 'default' },
    TIEBREAK_PENDING: { label: 'Empate pendiente', variant: 'outline' },
    RESOLVED: { label: 'Resuelta', variant: 'default' },
    CANCELLED: { label: 'Cancelada', variant: 'destructive' },
};

interface DecisionStatusBadgeProps {
    status: DecisionStatus;
    className?: string;
}

export function DecisionStatusBadge({ status, className }: DecisionStatusBadgeProps) {
    const config = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' as const };
    return (
        <Badge
            variant={config.variant}
            className={
                status === 'RESOLVED'
                    ? `bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 ${className ?? ''}`
                    : status === 'TIEBREAK_PENDING'
                      ? `bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800 ${className ?? ''}`
                      : className
            }
        >
            {config.label}
        </Badge>
    );
}
