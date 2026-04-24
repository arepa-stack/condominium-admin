'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils/format';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { decisionsService } from '@/lib/services/decisions.service';
import { QuoteDeleteDialog } from '@/components/decisions/QuoteDeleteDialog';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DecisionQuote, DecisionStatus } from '@/types/models';
import { ExternalLink, Loader2, MoreVertical, Trophy, Trash2 } from 'lucide-react';
import { formatDistanceStrict } from 'date-fns';
import { es } from 'date-fns/locale';

interface QuoteCardProps {
    quote: DecisionQuote;
    decisionId: string;
    decisionStatus: DecisionStatus;
    currentRound: number;
    isWinner: boolean;
    /** IDs of quotes still eligible in the current (tiebreak) round. When empty, every quote is eligible. */
    tiebreakEligibleIds?: string[];
    canDelete: boolean;
    isSelfDelete: boolean;
    isOwnedByMe?: boolean;
    onDeleted: (quoteId: string) => void;
    onRequestImagePreview?: (url: string, filename: string) => void;
}

function isProbablyImage(url: string): boolean {
    const lower = url.toLowerCase();
    return (
        lower.includes('.png') ||
        lower.includes('.jpg') ||
        lower.includes('.jpeg') ||
        lower.includes('.webp')
    );
}

export function QuoteCard({
    quote,
    decisionId,
    decisionStatus,
    currentRound,
    isWinner,
    tiebreakEligibleIds,
    canDelete,
    isSelfDelete,
    isOwnedByMe,
    onDeleted,
    onRequestImagePreview,
}: QuoteCardProps) {
    const [loadingFile, setLoadingFile] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [notesExpanded, setNotesExpanded] = useState(false);

    const isDeleted = !!quote.deleted_at;
    const isTiebreakPhase = decisionStatus === 'TIEBREAK_PENDING';
    const isInTiebreakSet =
        !isTiebreakPhase ||
        !tiebreakEligibleIds ||
        tiebreakEligibleIds.length === 0 ||
        tiebreakEligibleIds.includes(quote.id);
    const dimmedOutOfRound = isTiebreakPhase && !isInTiebreakSet && !isDeleted;
    const notesLong = (quote.notes ?? '').length > 200;

    const shell = cn(
        'relative rounded-xl border p-4 transition',
        isDeleted && 'opacity-50 grayscale-[30%]',
        !isDeleted && isWinner &&
            'ring-2 ring-emerald-500 border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-card dark:from-emerald-950/30 dark:to-card',
        !isDeleted && !isWinner && isTiebreakPhase && isInTiebreakSet &&
            'ring-1 ring-amber-400 bg-amber-50/40 dark:bg-amber-950/20',
        !isDeleted && !isWinner && !isInTiebreakSet &&
            'border-border/60 bg-card',
        !isDeleted && !isWinner && !isTiebreakPhase &&
            'border-border/60 bg-card',
        !isDeleted && isOwnedByMe && 'border-l-4 border-l-amber-700',
        dimmedOutOfRound && 'opacity-30',
    );

    const handleViewFile = async () => {
        setLoadingFile(true);
        try {
            const quotes = await decisionsService.listQuotes(decisionId, { limit: 50 });
            const fresh = (quotes?.data ?? []).find((q) => q.id === quote.id);
            const url = fresh?.file_url ?? quote.file_url;
            if (!url) {
                toast.error('No se encontró el archivo de esta cotización.');
                return;
            }
            if (isProbablyImage(url) && onRequestImagePreview) {
                onRequestImagePreview(url, `${quote.provider_name}.img`);
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setLoadingFile(false);
        }
    };

    return (
        <>
            <div className={shell}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    {isWinner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            <Trophy className="h-3 w-3" /> Ganadora
                        </span>
                    )}
                    {isTiebreakPhase && isInTiebreakSet && !isWinner && (
                        <span className="inline-flex items-center rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
                            ⚖ Empatada
                        </span>
                    )}
                    {isTiebreakPhase && !isInTiebreakSet && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            No en ronda {currentRound}
                        </span>
                    )}
                    {isDeleted && (
                        <span
                            className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-800 dark:bg-red-950/60 dark:text-red-200"
                            title={quote.deletion_reason ?? 'Eliminada'}
                        >
                            Eliminada
                        </span>
                    )}
                    {isOwnedByMe && !isDeleted && (
                        <span className="inline-flex items-center rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                            Tuya
                        </span>
                    )}
                </div>

                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h3
                            className={cn(
                                'text-base font-semibold text-foreground',
                                isDeleted && 'line-through',
                            )}
                        >
                            {quote.provider_name}
                        </h3>
                        <p className="mt-0.5 text-lg font-semibold text-primary">
                            {formatCurrency(quote.amount)}
                        </p>
                    </div>
                    {canDelete && !isDeleted && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Más acciones de cotización"
                                >
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onSelect={() => setDeleteOpen(true)}
                                    className="text-red-600 focus:text-red-700 dark:text-red-400"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {quote.notes && (
                    <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                        {notesLong && !notesExpanded
                            ? `${quote.notes.slice(0, 200)}…`
                            : quote.notes}
                        {notesLong && (
                            <button
                                type="button"
                                className="ml-1 text-primary underline-offset-2 hover:underline"
                                onClick={() => setNotesExpanded((s) => !s)}
                            >
                                {notesExpanded ? 'Ver menos' : 'Ver más'}
                            </button>
                        )}
                    </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleViewFile}
                        disabled={loadingFile}
                    >
                        {loadingFile ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                            <ExternalLink className="mr-2 h-3.5 w-3.5" />
                        )}
                        Ver archivo
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        {quote.uploader?.name ?? 'Usuario eliminado'} · hace{' '}
                        {formatDistanceStrict(new Date(quote.created_at), new Date(), {
                            locale: es,
                            addSuffix: false,
                        })}
                    </p>
                </div>

                {isDeleted && quote.deletion_reason && (
                    <p className="mt-2 text-xs text-muted-foreground">
                        Motivo: {quote.deletion_reason}
                    </p>
                )}
            </div>

            {canDelete && (
                <QuoteDeleteDialog
                    open={deleteOpen}
                    onOpenChange={setDeleteOpen}
                    decisionId={decisionId}
                    quoteId={quote.id}
                    providerName={quote.provider_name}
                    isSelfDelete={isSelfDelete}
                    onDeleted={() => onDeleted(quote.id)}
                />
            )}
        </>
    );
}
