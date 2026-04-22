'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, ExternalLink, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { QuoteDeleteDialog } from './QuoteDeleteDialog';
import type { DecisionQuote, DecisionStatus } from '@/types/models';
import { decisionsService } from '@/lib/services/decisions.service';
import { toast } from 'sonner';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';

interface QuoteCardProps {
    quote: DecisionQuote;
    decisionId: string;
    decisionStatus: DecisionStatus;
    isWinner: boolean;
    canDelete: boolean;
    isSelfDelete: boolean;
    onDeleted: (quoteId: string) => void;
}

export function QuoteCard({
    quote,
    decisionId,
    decisionStatus,
    isWinner,
    canDelete,
    isSelfDelete,
    onDeleted,
}: QuoteCardProps) {
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [loadingFile, setLoadingFile] = useState(false);

    const isDeleted = !!quote.deleted_at;

    const handleViewFile = async () => {
        setLoadingFile(true);
        try {
            // Re-fetch para obtener una signed URL fresca (TTL 5-10 min)
            const quotes = await decisionsService.listQuotes(decisionId, { limit: 50 });
            const fresh = (quotes?.data ?? []).find((q) => q.id === quote.id);
            const url = fresh?.file_url ?? quote.file_url;
            if (!url) {
                toast.error('No se encontró el archivo de esta cotización.');
                return;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setLoadingFile(false);
        }
    };

    return (
        <>
            <Card
                className={`p-4 flex flex-col gap-3 ${isDeleted ? 'opacity-50' : ''} ${isWinner ? 'ring-2 ring-green-500 dark:ring-green-400' : ''}`}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{quote.provider_name}</span>
                        {isWinner && (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 shrink-0">
                                Ganadora
                            </Badge>
                        )}
                        {isDeleted && (
                            <Badge variant="destructive" className="shrink-0">
                                Eliminada
                            </Badge>
                        )}
                    </div>
                    <span className="text-lg font-bold text-foreground whitespace-nowrap">
                        {formatCurrency(quote.amount)}
                    </span>
                </div>

                {quote.notes && (
                    <p className="text-sm text-muted-foreground">{quote.notes}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                        Subida por{' '}
                        <span className="font-medium text-foreground">{quote.uploader?.name ?? '—'}</span>
                        {' · '}
                        {formatDate(quote.created_at)}
                    </span>
                </div>

                {isDeleted && quote.deleted_by && (
                    <p className="text-xs text-destructive">
                        Eliminada por {quote.deleted_by.name}
                        {quote.deletion_reason ? ` — ${quote.deletion_reason}` : ''}
                    </p>
                )}

                {!isDeleted && (
                    <div className="flex gap-2 pt-1">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleViewFile}
                            disabled={loadingFile}
                            className="flex-1"
                        >
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Ver archivo
                        </Button>
                        {canDelete && decisionStatus !== 'RESOLVED' && decisionStatus !== 'CANCELLED' && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setDeleteOpen(true)}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                )}
            </Card>

            <QuoteDeleteDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                decisionId={decisionId}
                quoteId={quote.id}
                providerName={quote.provider_name}
                isSelfDelete={isSelfDelete}
                onDeleted={onDeleted}
            />
        </>
    );
}
