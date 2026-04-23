'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeletons';
import { DecisionStatusBadge } from '@/components/decisions/DecisionStatusBadge';
import { ExtendDeadlinesDialog } from '@/components/decisions/ExtendDeadlinesDialog';
import { CancelDecisionDialog } from '@/components/decisions/CancelDecisionDialog';
import { FinalizeConfirmDialog } from '@/components/decisions/FinalizeConfirmDialog';
import { ResolveTiebreakDialog } from '@/components/decisions/ResolveTiebreakDialog';
import { GenerateChargeDialog } from '@/components/decisions/GenerateChargeDialog';
import { AuditLogDrawer } from '@/components/decisions/AuditLogDrawer';
import { QuoteCard } from '@/components/decisions/QuoteCard';
import { QuoteUploadDialog } from '@/components/decisions/QuoteUploadDialog';
import { TallyCard } from '@/components/decisions/TallyCard';
import { VotesList } from '@/components/decisions/VotesList';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { decisionsService } from '@/lib/services/decisions.service';
import { formatDate } from '@/lib/utils/format';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { toast } from 'sonner';
import {
    ArrowLeft,
    Calendar,
    CheckCircle2,
    Clock,
    ExternalLink,
    History,
    Plus,
    AlertTriangle,
} from 'lucide-react';
import type { Decision, DecisionQuote, DecisionTally } from '@/types/models';

export default function DecisionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const { user, isSuperAdmin, isBoardMember, canManageDecisions, canUploadQuote, canDeleteQuoteAsOwner } =
        usePermissions();

    const [decision, setDecision] = useState<Decision | null>(null);
    const [quotes, setQuotes] = useState<DecisionQuote[]>([]);
    const [tally, setTally] = useState<DecisionTally | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog states
    const [extendOpen, setExtendOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [finalizeOpen, setFinalizeOpen] = useState(false);
    const [tiebreakOpen, setTiebreakOpen] = useState(false);
    const [chargeOpen, setChargeOpen] = useState(false);
    const [auditOpen, setAuditOpen] = useState(false);
    const [quoteUploadOpen, setQuoteUploadOpen] = useState(false);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await decisionsService.getById(id);
            setDecision(res.decision);
            setQuotes(res.quotes ?? []);
            setTally(res.tally);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [id]);

    useEffect(() => {
        load();
    }, [load]);

    const refreshResults = async () => {
        try {
            const updated = await decisionsService.getResults(id);
            setTally(updated);
        } catch {
            // silently ignore tally refresh errors
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-8 w-1/3" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    if (!decision) {
        return (
            <div className="text-center py-20 text-muted-foreground">
                Decisión no encontrada.
            </div>
        );
    }

    const canManage = canManageDecisions(decision.building_id);
    const isPreTerminal = decision.status !== 'RESOLVED' && decision.status !== 'CANCELLED';
    const activeQuotes = quotes.filter((q) => !q.deleted_at);
    const winnerQuote = quotes.find((q) => q.id === decision.winner_quote_id);

    const handleQuoteDeleted = (quoteId: string) => {
        setQuotes((prev) =>
            prev.map((q) =>
                q.id === quoteId
                    ? { ...q, deleted_at: new Date().toISOString(), deleted_by: user ? { id: user.id, name: user.name } : null }
                    : q,
            ),
        );
        load();
    };

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Back link */}
            <Link href="/decisions">
                <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
                    <ArrowLeft className="h-4 w-4" />
                    Volver a Presupuestos
                </Button>
            </Link>

            {/* Header card */}
            <Card className="p-6 space-y-4">
                <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <DecisionStatusBadge status={decision.status} />
                            {decision.current_round > 1 && (
                                <Badge variant="outline">Ronda {decision.current_round}</Badge>
                            )}
                            {decision.is_deadline_passed && isPreTerminal && (
                                <Badge
                                    variant="outline"
                                    className="text-yellow-700 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-700 gap-1"
                                >
                                    <AlertTriangle className="h-3 w-3" />
                                    Pendiente de finalizar
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-2xl font-bold text-foreground font-display tracking-tight">
                            {decision.title}
                        </h1>
                        {decision.description && (
                            <p className="text-muted-foreground">{decision.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Creada por {decision.created_by.name} &middot;{' '}
                            {formatDate(decision.created_at, 'dd/MM/yyyy')}
                        </p>
                    </div>

                    {decision.photo_url && (
                        <img
                            src={decision.photo_url}
                            alt="Referencia"
                            className="h-24 w-24 rounded-lg object-cover border border-border/50 shrink-0"
                        />
                    )}
                </div>

                {/* Deadlines */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Límite recepción</p>
                            <p className="text-sm font-medium">
                                {formatDate(decision.reception_deadline, 'dd/MM/yyyy HH:mm')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                            <p className="text-xs text-muted-foreground">Límite votación</p>
                            <p className="text-sm font-medium">
                                {formatDate(decision.voting_deadline, 'dd/MM/yyyy HH:mm')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Resolved result */}
                {decision.status === 'RESOLVED' && winnerQuote && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                                Ganador: {winnerQuote.provider_name}
                            </p>
                            <p className="text-xs text-green-700 dark:text-green-400">
                                Finalizada el{' '}
                                {decision.finalized_at
                                    ? formatDate(decision.finalized_at, 'dd/MM/yyyy HH:mm')
                                    : '—'}
                            </p>
                        </div>
                    </div>
                )}

                {decision.status === 'CANCELLED' && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                        <p className="text-sm text-red-700 dark:text-red-400">
                            <span className="font-semibold">Cancelada</span>
                            {decision.cancel_reason ? ` — ${decision.cancel_reason}` : ''}
                        </p>
                    </div>
                )}

                {/* Charge info */}
                {decision.resulting_id && (
                    <div className="flex items-center gap-2 text-sm border border-border/50 rounded-lg px-3 py-2 bg-muted/30">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                        <span>
                            Cargo generado ({decision.resulting_type}):{' '}
                            <span className="font-mono text-xs">{decision.resulting_id.slice(0, 8)}…</span>
                        </span>
                        {decision.resulting_type === 'INVOICE' && (
                            <Link href={`/billing?id=${decision.resulting_id}`}>
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1">
                                    <ExternalLink className="h-3 w-3" />
                                    Ver factura
                                </Button>
                            </Link>
                        )}
                        {decision.resulting_type === 'ASSESSMENT' && (
                            <Link href="/finances?tab=petty-cash">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1">
                                    <ExternalLink className="h-3 w-3" />
                                    Ver caja chica
                                </Button>
                            </Link>
                        )}
                    </div>
                )}
            </Card>

            {/* Action toolbar */}
            {canManage && (
                <div className="flex flex-wrap gap-2">
                    {/* Extend deadlines — any pre-terminal */}
                    {isPreTerminal && (
                        <Button variant="outline" size="sm" onClick={() => setExtendOpen(true)}>
                            <Calendar className="h-3.5 w-3.5 mr-1.5" />
                            Extender plazos
                        </Button>
                    )}

                    {/* Finalize phase */}
                    {(decision.status === 'RECEPTION' || decision.status === 'VOTING') && (
                        <Button
                            size="sm"
                            variant={decision.is_deadline_passed ? 'default' : 'outline'}
                            onClick={() => setFinalizeOpen(true)}
                        >
                            {decision.status === 'RECEPTION'
                                ? 'Finalizar recepción'
                                : 'Finalizar votación'}
                        </Button>
                    )}

                    {/* Resolve tiebreak */}
                    {decision.status === 'TIEBREAK_PENDING' && (
                        <Button size="sm" onClick={() => setTiebreakOpen(true)}>
                            Resolver empate
                        </Button>
                    )}

                    {/* Generate charge */}
                    {decision.status === 'RESOLVED' && !decision.resulting_id && (
                        <Button size="sm" onClick={() => setChargeOpen(true)}>
                            Generar cargo
                        </Button>
                    )}

                    {/* Cancel */}
                    {isPreTerminal && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setCancelOpen(true)}
                        >
                            Cancelar decisión
                        </Button>
                    )}

                    {/* Audit log */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => setAuditOpen(true)}
                    >
                        <History className="h-3.5 w-3.5 mr-1.5" />
                        Auditoría
                    </Button>
                </div>
            )}

            {/* Quotes section */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                        Cotizaciones{' '}
                        <span className="text-sm font-normal text-muted-foreground">
                            ({activeQuotes.length} activas)
                        </span>
                    </h2>
                    {canUploadQuote(decision.building_id) && decision.status === 'RECEPTION' && (
                        <Button size="sm" variant="outline" onClick={() => setQuoteUploadOpen(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Subir cotización
                        </Button>
                    )}
                </div>

                {quotes.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground border-dashed">
                        No hay cotizaciones para esta decisión.
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {quotes.map((q) => {
                            const isSelf = canDeleteQuoteAsOwner(q, decision.status);
                            const canDel =
                                isSelf || (canManage && !q.deleted_at);
                            return (
                                <QuoteCard
                                    key={q.id}
                                    quote={q}
                                    decisionId={decision.id}
                                    decisionStatus={decision.status}
                                    isWinner={q.id === decision.winner_quote_id}
                                    canDelete={canDel}
                                    isSelfDelete={isSelf}
                                    onDeleted={handleQuoteDeleted}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tally / Results */}
            {(decision.status === 'RECEPTION' || decision.status === 'VOTING' || decision.status === 'RESOLVED' || decision.status === 'TIEBREAK_PENDING') && tally && (
                <TallyCard tally={tally} />
            )}

            {/* Votes list */}
            {(decision.status === 'RECEPTION' || decision.status === 'VOTING' || decision.status === 'RESOLVED' || decision.status === 'TIEBREAK_PENDING') && (
                <VotesList decisionId={decision.id} currentRound={decision.current_round} />
            )}

            {/* Dialogs */}
            <ExtendDeadlinesDialog
                open={extendOpen}
                onOpenChange={setExtendOpen}
                decisionId={decision.id}
                currentStatus={decision.status}
                currentReceptionDeadline={decision.reception_deadline}
                currentVotingDeadline={decision.voting_deadline}
                onExtended={(updated) => setDecision(updated)}
            />

            <CancelDecisionDialog
                open={cancelOpen}
                onOpenChange={setCancelOpen}
                decisionId={decision.id}
                decisionTitle={decision.title}
                onCancelled={(updated) => setDecision(updated)}
            />

            <FinalizeConfirmDialog
                open={finalizeOpen}
                onOpenChange={setFinalizeOpen}
                decisionId={decision.id}
                currentStatus={decision.status}
                onFinalized={(updated) => {
                    setDecision(updated);
                    refreshResults();
                }}
            />

            <ResolveTiebreakDialog
                open={tiebreakOpen}
                onOpenChange={setTiebreakOpen}
                decisionId={decision.id}
                activeQuotes={activeQuotes}
                onResolved={(updated) => {
                    setDecision(updated);
                    refreshResults();
                }}
            />

            {winnerQuote && (
                <GenerateChargeDialog
                    open={chargeOpen}
                    onOpenChange={setChargeOpen}
                    decisionId={decision.id}
                    winnerAmount={winnerQuote.amount}
                    onGenerated={(updated) => setDecision(updated)}
                />
            )}

            <AuditLogDrawer
                open={auditOpen}
                onOpenChange={setAuditOpen}
                decisionId={decision.id}
            />

            <QuoteUploadDialog
                open={quoteUploadOpen}
                onOpenChange={setQuoteUploadOpen}
                decisionId={decision.id}
                onUploaded={(newQuote) => {
                    setQuotes((prev) => [...prev, newQuote]);
                    setDecision((prev) => prev ? { ...prev, quote_count: prev.quote_count + 1 } : prev);
                }}
            />
        </div>
    );
}
