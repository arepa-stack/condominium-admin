'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeletons';
import { DecisionHero } from '@/components/decisions/DecisionHero';
import { DecisionActions } from '@/components/decisions/DecisionActions';
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
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import type { Decision, DecisionQuote, DecisionTally } from '@/types/models';

export default function DecisionDetailPage() {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const fromView = searchParams.get('view') || '';
    const { user, canManageDecisions, canUploadQuote, canDeleteQuoteAsOwner } =
        usePermissions();
    const { availableBuildings } = useBuildingContext();

    const [decision, setDecision] = useState<Decision | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
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
            <div className="mb-4">
                <Button asChild variant="ghost" size="sm">
                    <Link href={`/decisions${fromView ? `?view=${fromView}` : ''}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a Presupuestos
                    </Link>
                </Button>
            </div>

            <DecisionHero
                decision={decision}
                tally={tally}
                buildingLabel={
                    availableBuildings.find((b) => b.id === decision.building_id)?.name ??
                    undefined
                }
                onPhotoClick={() => setLightboxOpen(true)}
                actionsSlot={
                    <DecisionActions
                        decision={decision}
                        activeQuoteCount={activeQuotes.length}
                        canManage={canManage}
                        handlers={{
                            onUploadQuote: () => setQuoteUploadOpen(true),
                            onExtendDeadlines: () => setExtendOpen(true),
                            onFinalize: () => setFinalizeOpen(true),
                            onResolveTiebreak: () => setTiebreakOpen(true),
                            onGenerateCharge: () => setChargeOpen(true),
                            onCancel: () => setCancelOpen(true),
                            onOpenAuditLog: () => setAuditOpen(true),
                        }}
                    />
                }
            />

            {decision.description && (
                <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Descripción
                    </h3>
                    <p className="whitespace-pre-line text-sm text-foreground">
                        {decision.description}
                    </p>
                </section>
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
