'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Paginator } from '@/components/ui/paginator';
import { EmptyState } from '@/components/ui/empty-state';
import { ActionFilterChips, filterByView, type DecisionView } from '@/components/decisions/ActionFilterChips';
import { DecisionCard } from '@/components/decisions/DecisionCard';
import { DecisionCardSkeleton } from '@/components/decisions/DecisionCardSkeleton';
import { DecisionDialog } from '@/components/decisions/DecisionDialog';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { toast } from 'sonner';
import { Plus, Search, Vote } from 'lucide-react';
import type { Decision, PaginationMetadata } from '@/types/models';

const PAGE_LIMIT = 24;

export default function DecisionsListPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const viewFromUrl = (searchParams.get('view') as DecisionView) || 'activas';

    const { isSuperAdmin, canManageDecisions } = usePermissions();
    const { selectedBuildingId, availableBuildings } = useBuildingContext();

    const [allDecisions, setAllDecisions] = useState<Decision[]>([]);
    const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [view, setView] = useState<DecisionView>(viewFromUrl);
    const [titleInput, setTitleInput] = useState('');
    const [search, setSearch] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const effectiveBuildingId = selectedBuildingId;

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await decisionsService.list({
                building_id: effectiveBuildingId ?? undefined,
                search: search || undefined,
                page,
                limit: PAGE_LIMIT,
            });
            setAllDecisions(res.data);
            setMetadata(res.metadata);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
            setAllDecisions([]);
            setMetadata(null);
        } finally {
            setIsLoading(false);
        }
    }, [effectiveBuildingId, search, page]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const current = searchParams.get('view') || 'activas';
        if (current !== view) {
            const sp = new URLSearchParams(searchParams.toString());
            sp.set('view', view);
            router.replace(`/decisions?${sp.toString()}`, { scroll: false });
        }
    }, [view, searchParams, router]);

    const filtered = useMemo(
        () => filterByView(allDecisions, view),
        [allDecisions, view],
    );

    const canCreate = canManageDecisions(effectiveBuildingId ?? undefined);

    const emptyMessage: Record<DecisionView, { title: string; message: string; showCta: boolean }> = {
        activas: {
            title: 'Ninguna decisión activa',
            message: '¿Creamos una?',
            showCta: true,
        },
        pendientes: {
            title: '✓ Todo al día',
            message: 'No hay decisiones pendientes de acción.',
            showCta: false,
        },
        archivadas: {
            title: 'Sin historial aún',
            message: 'Acá vas a ver decisiones cerradas o canceladas.',
            showCta: false,
        },
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-foreground">Presupuestos</h1>
                    <p className="text-sm text-muted-foreground">
                        Decisiones con cotizaciones competitivas y votación de apartamentos.
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nueva decisión
                    </Button>
                )}
            </header>

            {isSuperAdmin && !effectiveBuildingId && (
                <Card className="border-amber-400/40 bg-amber-50/50 p-4 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    Vista global: se listan decisiones de todos los edificios.
                </Card>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ActionFilterChips
                    decisions={allDecisions}
                    selected={view}
                    onChange={(v) => {
                        setPage(1);
                        setView(v);
                    }}
                />
                <form
                    className="relative w-full sm:w-64"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setPage(1);
                        setSearch(titleInput.trim());
                    }}
                >
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        placeholder="Buscar por título…"
                        className="pl-9"
                    />
                </form>
            </div>

            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <DecisionCardSkeleton key={i} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={Vote}
                    title={emptyMessage[view].title}
                    message={emptyMessage[view].message}
                    action={
                        emptyMessage[view].showCta && canCreate ? (
                            <Button onClick={() => setIsCreateOpen(true)}>
                                <Plus className="mr-2 h-4 w-4" />
                                Crear decisión
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((decision) => (
                        <DecisionCard
                            key={decision.id}
                            decision={decision}
                            buildingLabel={
                                isSuperAdmin
                                    ? availableBuildings.find(
                                          (b) => b.id === decision.building_id,
                                      )?.name
                                    : undefined
                            }
                            hrefSuffix={`?view=${view}`}
                        />
                    ))}
                </div>
            )}

            {metadata && metadata.totalPages > 1 && (
                <Paginator
                    metadata={metadata}
                    isLoading={isLoading}
                    onPageChange={(p) => setPage(p)}
                />
            )}

            {canCreate && (
                <DecisionDialog
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    buildingId={effectiveBuildingId ?? undefined}
                    availableBuildings={availableBuildings}
                    onCreated={() => load()}
                />
            )}
        </div>
    );
}
