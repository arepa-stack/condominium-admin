'use client';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Trophy } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import type { DecisionTally } from '@/types/models';

interface TallyCardProps {
    tally: DecisionTally;
}

export function TallyCard({ tally }: TallyCardProps) {
    return (
        <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">
                    Resultados{tally.round > 1 ? ` — Ronda ${tally.round}` : ''}
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>
                        {tally.total_votes} / {tally.total_apartments} votos (
                        {tally.participation_pct.toFixed(1)}%)
                    </span>
                </div>
            </div>

            {tally.tallies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                    Aún no hay votos registrados.
                </p>
            ) : (
                <div className="space-y-3">
                    {tally.tallies.map((entry) => {
                        const isWinner = entry.quote_id === tally.winner_quote_id;
                        return (
                            <div key={entry.quote_id} className="space-y-1.5">
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {isWinner && (
                                            <Trophy className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                        )}
                                        <span className="font-medium truncate">
                                            {entry.provider_name}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {formatCurrency(entry.amount)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-muted-foreground">
                                            {entry.votes} votos
                                        </span>
                                        <Badge
                                            variant={isWinner ? 'default' : 'secondary'}
                                            className={
                                                isWinner
                                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200'
                                                    : ''
                                            }
                                        >
                                            {entry.pct.toFixed(1)}%
                                        </Badge>
                                    </div>
                                </div>
                                <Progress
                                    value={entry.pct}
                                    className={
                                        isWinner
                                            ? '[&>div]:bg-green-500 dark:[&>div]:bg-green-400'
                                            : ''
                                    }
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {tally.is_tied && tally.total_votes > 0 && (
                <p className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md px-3 py-2">
                    Hay un empate entre las cotizaciones con mayor puntaje.
                </p>
            )}
        </Card>
    );
}
