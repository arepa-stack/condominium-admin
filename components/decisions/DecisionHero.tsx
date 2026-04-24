'use client';

import { CountdownBadge } from '@/components/decisions/CountdownBadge';
import { cn } from '@/lib/utils';
import { getPhaseTheme } from '@/lib/utils/decision-phase';
import type { Decision, DecisionTally } from '@/types/models';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';

interface DecisionHeroProps {
    decision: Decision;
    tally: DecisionTally | null;
    /** Optional slot to render primary CTA + overflow on the right side of the hero. */
    actionsSlot?: React.ReactNode;
    /** Invoked when the photo thumbnail is clicked. Host page shows the lightbox. */
    onPhotoClick?: () => void;
    buildingLabel?: string;
}

export function DecisionHero({
    decision,
    tally,
    actionsSlot,
    onPhotoClick,
    buildingLabel,
}: DecisionHeroProps) {
    const theme = getPhaseTheme(decision.status);
    const Icon = theme.icon;
    const [photoError, setPhotoError] = useState(false);

    const titleClass = cn(
        'text-2xl font-semibold leading-tight text-white',
        decision.status === 'CANCELLED' && 'line-through opacity-90',
    );

    const showParticipation =
        (decision.status === 'VOTING' || decision.status === 'TIEBREAK_PENDING') &&
        tally &&
        tally.total_apartments > 0;

    const roundLabel =
        decision.current_round > 1
            ? `· Ronda ${decision.current_round}`
            : '';

    return (
        <section
            className={cn(
                'relative overflow-hidden rounded-xl p-6 text-white shadow-lg',
                theme.gradientClass,
                decision.status === 'TIEBREAK_PENDING' && 'ring-2 ring-amber-300/80',
            )}
        >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                    {decision.photo_url &&
                        /^https?:\/\//i.test(decision.photo_url) &&
                        !photoError && (
                        <button
                            type="button"
                            onClick={onPhotoClick}
                            aria-label="Ver foto de la decisión"
                            className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-white/30 bg-white/10 transition hover:ring-2 hover:ring-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={decision.photo_url}
                                alt="Foto de la decisión"
                                className="h-full w-full object-cover"
                                onError={() => setPhotoError(true)}
                            />
                        </button>
                    )}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-white/80">
                            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                                {theme.label} {roundLabel}
                            </span>
                        </div>
                        <h2 className={titleClass}>{decision.title}</h2>
                        {buildingLabel && (
                            <p className="mt-1 text-sm text-white/80">{buildingLabel}</p>
                        )}
                    </div>
                </div>
                {actionsSlot && (
                    <div className="flex items-center gap-2">{actionsSlot}</div>
                )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/90">
                {decision.status === 'RECEPTION' && (
                    <CountdownBadge
                        deadline={decision.reception_deadline}
                        isDeadlinePassed={decision.is_deadline_passed}
                    />
                )}
                {(decision.status === 'VOTING' ||
                    decision.status === 'TIEBREAK_PENDING') && (
                    <CountdownBadge
                        deadline={decision.voting_deadline}
                        isDeadlinePassed={decision.is_deadline_passed}
                    />
                )}
                {decision.status === 'RESOLVED' && decision.finalized_at && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs">
                        ✓ Finalizada
                    </span>
                )}
                {decision.status === 'CANCELLED' && decision.cancel_reason && (
                    <span className="text-xs text-white/80">
                        Motivo: {decision.cancel_reason}
                    </span>
                )}
            </div>

            {showParticipation && (
                <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-white/85">
                        <span>
                            {tally.total_votes}/{tally.total_apartments} aptos votaron
                        </span>
                        <span>{Math.round(tally.participation_pct)}%</span>
                    </div>
                    <Progress
                        value={Math.min(100, tally.participation_pct)}
                        aria-label="Participación"
                        className="h-2 bg-white/20"
                        indicatorClassName="bg-white"
                    />
                </div>
            )}
        </section>
    );
}
