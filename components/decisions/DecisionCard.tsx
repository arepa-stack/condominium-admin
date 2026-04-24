'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CountdownBadge } from '@/components/decisions/CountdownBadge';
import { getPhaseTheme } from '@/lib/utils/decision-phase';
import type { Decision } from '@/types/models';
import { AlertTriangle, Trophy, Vote } from 'lucide-react';

interface DecisionCardProps {
    decision: Decision;
    /** Shown under title in admin global view. Pass undefined when the user is board of a specific building. */
    buildingLabel?: string;
    /** Preserve triage chip state on back-nav. */
    hrefSuffix?: string;
}

export function DecisionCard({
    decision,
    buildingLabel,
    hrefSuffix = '',
}: DecisionCardProps) {
    const theme = getPhaseTheme(decision.status);
    const PhaseIcon = theme.icon;

    const isLivingPhase =
        decision.status === 'RECEPTION' || decision.status === 'VOTING';
    const isVoting = decision.status === 'VOTING';
    const isResolvedCharged =
        decision.status === 'RESOLVED' && !!decision.resulting_id;
    const isResolvedPendingCharge =
        decision.status === 'RESOLVED' && !decision.resulting_id;
    const isCancelled = decision.status === 'CANCELLED';
    const isTiebreak = decision.status === 'TIEBREAK_PENDING';

    // Cards no longer use full-saturated gradients for the background to keep a "sutil" look.
    // They now use a themed background tint (in shell) and standard muted foregrounds.

    const shell = cn(
        'group block overflow-hidden rounded-xl border transition hover:shadow-md',
        isCancelled && 'bg-stone-100 opacity-70 dark:bg-stone-900/60',
        !isCancelled && 'bg-card hover:border-border',
        // Subtle background tint for the "living" or "hot" phases
        decision.status === 'RECEPTION' && 'bg-stone-50/50 border-l-4 border-amber-800 dark:bg-stone-900/20 dark:border-amber-800/50',
        decision.status === 'VOTING' && 'bg-amber-50/50 border-l-4 border-amber-600 dark:bg-amber-900/10 dark:border-amber-600/50',
        isTiebreak && 'ring-2 ring-amber-400/70 bg-amber-50 dark:bg-amber-950/40',
        isResolvedPendingCharge && 'bg-amber-50/30 border-l-4 border-amber-500 dark:bg-amber-900/10 dark:border-amber-500/50',
        isResolvedCharged && 'bg-emerald-50/30 border-l-4 border-emerald-600 dark:bg-emerald-900/10 dark:border-emerald-600/50',
    );

    const titleClass = cn(
        'text-base font-semibold leading-snug line-clamp-2',
        'text-foreground',
        isCancelled && 'line-through',
    );

    const deadlineIso =
        decision.status === 'RECEPTION'
            ? decision.reception_deadline
            : decision.status === 'VOTING' || decision.status === 'TIEBREAK_PENDING'
              ? decision.voting_deadline
              : null;

    return (
        <Link href={`/decisions/${decision.id}${hrefSuffix}`} className={shell}>
            <div className="flex flex-col gap-3 p-4">
                {/* Header row: phase/round + countdown */}
                <div className="flex items-start justify-between gap-2">
                    <div
                        className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                        <PhaseIcon className="h-3 w-3" aria-hidden="true" />
                        <span>
                            {theme.label}
                            {decision.current_round > 1 &&
                                ` · R${decision.current_round}`}
                        </span>
                    </div>
                    {deadlineIso && (
                        <CountdownBadge
                            deadline={deadlineIso}
                            isDeadlinePassed={decision.is_deadline_passed}
                        />
                    )}
                </div>

                {/* Photo thumb */}
                <div className="flex items-start gap-3">
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {decision.photo_url ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                                src={decision.photo_url}
                                alt=""
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <Vote
                                className="h-6 w-6 text-muted-foreground"
                                aria-hidden="true"
                            />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h3 className={titleClass}>{decision.title}</h3>
                        {buildingLabel && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                {buildingLabel}
                            </p>
                        )}
                    </div>
                </div>

                {/* Phase-specific metadata */}
                <div className="space-y-1.5 text-xs text-muted-foreground">
                    {isLivingPhase && (
                        <p>
                            📋 {decision.quote_count}{' '}
                            {decision.quote_count === 1 ? 'cotización' : 'cotizaciones'}
                        </p>
                    )}
                    {isTiebreak && (
                        <p className="inline-flex items-center gap-1 text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            Empate en ronda {decision.current_round} — resolvé manual
                        </p>
                    )}
                    {isResolvedPendingCharge && (
                        <p className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
                            <Trophy className="h-3 w-3" />
                            Resuelta — pendiente cargo
                        </p>
                    )}
                    {isResolvedCharged && (
                        <p className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <Trophy className="h-3 w-3" />
                            Resuelta · cargo emitido
                        </p>
                    )}
                    {isCancelled && decision.cancel_reason && (
                        <p className="line-clamp-2">Motivo: {decision.cancel_reason}</p>
                    )}
                </div>
            </div>
        </Link>
    );
}
