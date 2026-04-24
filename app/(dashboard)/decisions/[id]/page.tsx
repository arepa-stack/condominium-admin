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
import { PhotoLightbox } from '@/components/decisions/PhotoLightbox';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { toast } from 'sonner';
import { ArrowLeft, Plus, RefreshCw, Vote } from 'lucide-react';
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

    // New state for Phase 5
    const [tallyRefreshing, setTallyRefreshing] = useState(false);
    const [lastTallyAt, setLastTallyAt] = useState<Date | null>(null);
    const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
    const [votesKey, setVotesKey] = useState(0);

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

    // Auto-set lastTallyAt on first tally load
    useEffect(() => {
        if (tally) setLastTallyAt((prev) => prev ?? new Date());
    }, [tally]);

    const refreshTally = useCallback(async () => {
        setTallyRefreshing(true);
        try {
            const [detail, results] = await Promise.all([
                decisionsService.getById(id),
                decisionsService.getResults(id),
            ]);
            setDecision(detail.decision);
            setQuotes(detail.quotes);
            setTally(results);
            setLastTallyAt(new Date());
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setTallyRefreshing(false);
        }
    }, [id]);

    if (isLoading) {
        return (
            <div className="space-y-6 max-w-4xl">
                <Skeleton className="h-8 w-32" />
                <div className="rounded-xl bg-gradient-to-br from-stone-700 to-stone-900 p-6">
                    <Skeleton className="h-4 w-24 bg-white/20" />
                    <Skeleton className="mt-2 h-6 w-2/3 bg-white/20" />
                    <Skeleton className="mt-4 h-8 w-40 bg-white/20" />
                </div>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
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
        // Optimistic update — backend soft-deletes, so the quote stays in the array but gets deleted_at.
        setQuotes((prev) =>
            prev.map((q) =>
                q.id === quoteId
                    ? {
                          ...q,
                          deleted_at: new Date().toISOString(),
                          deleted_by: user ? { id: user.id, name: user.name } : null,
                      }
                    : q,
            ),
        );
        // Also decrement the activeQuotes-derived count source; re-fetch the decision to update quote_count.
        decisionsService.getById(id).then((res) => {
            setDecision(res.decision);
        }).catch(() => {
            // Silent: optimistic update already reflects the change.
        });
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
                onPhotoClick={async () => {
                    try {
                        // Re-fetch the decision so the signed photo URL is fresh
                        // (also incidentally refreshes quotes — acceptable for this surface).
                        const refreshed = await decisionsService.getById(id);
                        setDecision(refreshed.decision);
                        setQuotes(refreshed.quotes);
                        if (!refreshed.decision.photo_url) {
                            toast.error('No se pudo obtener la URL de la foto.');
                            return;
                        }
                        setLightboxUrl(refreshed.decision.photo_url);
                        setLightboxOpen(true);
                    } catch (err) {
                        toast.error(getDecisionErrorMessage(err));
                    }
                }}
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
                <section
                    aria-labelledby="decision-description-heading"
                    className="rounded-xl border border-border/60 bg-card p-5 shadow-sm"
                >
                    <h2
                        id="decision-description-heading"
                        className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                        Descripción
                    </h2>
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

                {/* activeQuotes excludes soft-deleted tombstones. Empty-state renders even when
                    tombstones exist below so admins see "nothing actionable" + the archive. */}
                {activeQuotes.length === 0 ? (
                    <Card className="border-dashed p-8 text-center">
                        <Vote
                            className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <p className="mb-2 font-medium text-foreground">Sin cotizaciones todavía</p>
                        <p className="mb-4 text-sm text-muted-foreground">
                            {decision.status === 'RECEPTION'
                                ? 'Subí la primera para avanzar.'
                                : 'Ya no hay cotizaciones activas.'}
                        </p>
                        {decision.status === 'RECEPTION' &&
                            canUploadQuote(decision.building_id) && (
                                <Button onClick={() => setQuoteUploadOpen(true)}>
                                    <Plus className="mr-2 h-4 w-4" /> Subir primera
                                </Button>
                            )}
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
                                    currentRound={decision.current_round}
                                    isWinner={q.id === decision.winner_quote_id}
                                    tiebreakEligibleIds={
                                        decision.status === 'TIEBREAK_PENDING' && tally
                                            ? tally.tallies.map((e) => e.quote_id)
                                            : []
                                    }
                                    canDelete={canDel}
                                    isSelfDelete={isSelf}
                                    isOwnedByMe={q.uploader?.id === user?.id}
                                    onDeleted={handleQuoteDeleted}
                                    onRequestImagePreview={(url) => {
                                        setLightboxUrl(url);
                                        setLightboxOpen(true);
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tally / Results */}
            {decision.status !== 'RECEPTION' && (
                <TallyCard
                    decision={decision}
                    tally={tally}
                    lastUpdatedAt={lastTallyAt}
                    isRefreshing={tallyRefreshing}
                    onRefresh={refreshTally}
                    onResolveManual={() => setTiebreakOpen(true)}
                    onCancel={() => setCancelOpen(true)}
                />
            )}

            {/* Votes list */}
            {decision.status !== 'RECEPTION' && (
                <div className="space-y-2">
                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVotesKey((k) => k + 1)}
                        >
                            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Actualizar votos
                        </Button>
                    </div>
                    <VotesList
                        key={votesKey}
                        decisionId={decision.id}
                        currentRound={decision.current_round}
                    />
                </div>
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
                    refreshTally();
                }}
            />

            <ResolveTiebreakDialog
                open={tiebreakOpen}
                onOpenChange={setTiebreakOpen}
                decisionId={decision.id}
                activeQuotes={activeQuotes}
                onResolved={(updated) => {
                    setDecision(updated);
                    refreshTally();
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

            <PhotoLightbox
                open={lightboxOpen}
                url={lightboxUrl}
                alt="Archivo adjunto"
                onClose={() => {
                    setLightboxOpen(false);
                    setLightboxUrl(null);
                }}
            />
        </div>
    );
}
