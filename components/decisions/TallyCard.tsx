'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';
import type { Decision, DecisionTally, DecisionTallyEntry } from '@/types/models';
import { AlertTriangle, Loader2, RefreshCw, Trophy } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

interface TallyCardProps {
    decision: Decision;
    tally: DecisionTally | null;
    lastUpdatedAt: Date | null;
    isRefreshing: boolean;
    onRefresh: () => void;
    /** Invoked when user chooses an empty-state CTA. Host page decides which dialog to open. */
    onResolveManual?: () => void;
    onCancel?: () => void;
}

function barClasses(entry: DecisionTallyEntry, winnerId: string | null) {
    if (winnerId && entry.quote_id === winnerId) {
        return 'bg-emerald-500';
    }
    return 'bg-amber-600 dark:bg-amber-500';
}

export function TallyCard({
    decision,
    tally,
    lastUpdatedAt,
    isRefreshing,
    onRefresh,
    onResolveManual,
    onCancel,
}: TallyCardProps) {
    const isTiebreak = decision.status === 'TIEBREAK_PENDING';
    const noVotes = tally !== null && tally.total_votes === 0;
    const noActiveQuotes = tally !== null && tally.tallies.length === 0;

    const showNoVotesEmptyState =
        tally !== null &&
        noVotes &&
        (decision.status === 'TIEBREAK_PENDING' || decision.status === 'RESOLVED');

    const showNoActiveQuotesEmptyState =
        tally !== null &&
        noActiveQuotes &&
        (decision.status === 'TIEBREAK_PENDING' || decision.status === 'RESOLVED');

    return (
        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
            <header className="mb-4 flex items-start justify-between gap-2">
                <div>
                    <h2 className="text-lg font-semibold text-foreground">
                        Resultado de votación
                        {tally && tally.round > 1 && (
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                · Ronda {tally.round}
                            </span>
                        )}
                    </h2>
                    {tally && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                            {tally.total_votes}/{tally.total_apartments} aptos votaron
                            {' · '}
                            {Math.round(tally.participation_pct)}% participación
                        </p>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    aria-label="Actualizar resultados"
                >
                    {isRefreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                </Button>
            </header>

            {showNoActiveQuotesEmptyState ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        No quedan cotizaciones activas
                    </div>
                    <p className="text-muted-foreground">
                        Todas las cotizaciones fueron eliminadas. Cancelá esta decisión para
                        cerrarla.
                    </p>
                    {onCancel && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                            className="mt-3"
                        >
                            Cancelar decisión
                        </Button>
                    )}
                </div>
            ) : showNoVotesEmptyState ? (
                <div className="rounded-lg bg-muted/40 p-4 text-sm">
                    <div className="mb-2 flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                        <AlertTriangle className="h-4 w-4" />
                        Nadie votó
                    </div>
                    <p className="text-muted-foreground">
                        Resolvé manual eligiendo ganador, o cancelá la decisión.
                    </p>
                    <div className="mt-3 flex gap-2">
                        {onResolveManual && (
                            <Button variant="default" size="sm" onClick={onResolveManual}>
                                Resolver manual
                            </Button>
                        )}
                        {onCancel && (
                            <Button variant="outline" size="sm" onClick={onCancel}>
                                Cancelar
                            </Button>
                        )}
                    </div>
                </div>
            ) : !tally || tally.tallies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    Aún no hay votos emitidos.
                </p>
            ) : (
                <ol className="space-y-3" aria-live="polite">
                    {tally.tallies.map((entry) => {
                        const isWinner =
                            tally.winner_quote_id === entry.quote_id &&
                            decision.status === 'RESOLVED';
                        const isTied =
                            isTiebreak && tally.is_tied && entry.votes > 0;
                        return (
                            <li
                                key={entry.quote_id}
                                className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm"
                            >
                                <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                                    {isWinner && (
                                        <Trophy
                                            className="h-3.5 w-3.5 text-emerald-600"
                                            aria-hidden="true"
                                        />
                                    )}
                                    <span className="truncate">
                                        {entry.provider_name}
                                    </span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    {formatCurrency(entry.amount)}
                                </span>
                                <div
                                    className="col-span-2 flex items-center gap-3"
                                    role="progressbar"
                                    aria-valuenow={entry.votes}
                                    aria-valuemin={0}
                                    aria-valuemax={tally.total_votes || 1}
                                    aria-label={`${entry.provider_name}: ${entry.votes} de ${tally.total_votes} votos`}
                                >
                                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={cn(
                                                'h-full rounded-full transition-[width] duration-500 ease-out',
                                                barClasses(
                                                entry,
                                                decision.status === 'RESOLVED' ? tally.winner_quote_id : null,
                                            ),
                                            )}
                                            style={{
                                                width: `${Math.min(100, entry.pct)}%`,
                                            }}
                                        />
                                    </div>
                                    <span
                                        className={cn(
                                            'w-24 text-right text-xs tabular-nums',
                                            isWinner && 'font-semibold text-emerald-700 dark:text-emerald-400',
                                            isTied && 'text-amber-800 dark:text-amber-200',
                                        )}
                                    >
                                        {entry.votes} voto{entry.votes === 1 ? '' : 's'} ·{' '}
                                        {Math.round(entry.pct)}%
                                    </span>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}

            {isTiebreak && tally && tally.tallies.length > 0 && tally.is_tied && (
                <p className="mt-4 flex items-center gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    Empate detectado — se abrió ronda {decision.current_round}. Votá nuevamente o resolvé manual.
                </p>
            )}

            {lastUpdatedAt && (
                <p className="mt-3 text-right text-[11px] text-muted-foreground">
                    Actualizado hace{' '}
                    {formatDistanceStrict(lastUpdatedAt, new Date(), {
                        locale: es,
                        addSuffix: false,
                    })}
                </p>
            )}
        </section>
    );
}
