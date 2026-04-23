'use client';

import { cn } from '@/lib/utils';

interface UrgencyChipProps {
    label: string;
    count?: number;
    selected?: boolean;
    onClick: () => void;
    tone?: 'default' | 'danger' | 'neutral';
}

const TONE_CLASSES = {
    default: {
        selected: 'bg-primary text-primary-foreground border-primary',
        idle: 'bg-card text-foreground border-border hover:bg-muted/50',
    },
    danger: {
        selected: 'bg-red-600 text-white border-red-600',
        idle:
            'bg-card text-red-800 border-red-300 hover:bg-red-50 dark:text-red-300 dark:border-red-900/50 dark:hover:bg-red-950/30',
    },
    neutral: {
        selected: 'bg-stone-700 text-white border-stone-700',
        idle: 'bg-card text-muted-foreground border-border hover:bg-muted/50',
    },
} as const;

export function UrgencyChip({
    label,
    count,
    selected = false,
    onClick,
    tone = 'default',
}: UrgencyChipProps) {
    const palette = TONE_CLASSES[tone];
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
                selected ? palette.selected : palette.idle,
            )}
        >
            <span>{label}</span>
            {typeof count === 'number' && (
                <span
                    className={cn(
                        'inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 text-[10px] font-semibold',
                        selected
                            ? 'bg-white/25 text-white'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    {count}
                </span>
            )}
        </button>
    );
}
