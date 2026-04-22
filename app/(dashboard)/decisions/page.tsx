'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Paginator } from '@/components/ui/paginator';
import { Card } from '@/components/ui/card';
import { DecisionStatusBadge } from '@/components/decisions/DecisionStatusBadge';
import { DecisionDialog } from '@/components/decisions/DecisionDialog';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { decisionsService } from '@/lib/services/decisions.service';
import { formatDate } from '@/lib/utils/format';
import { DECISION_STATUSES } from '@/lib/utils/constants';
import { toast } from 'sonner';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { Plus, Vote, Eye, AlertTriangle } from 'lucide-react';
import type { Decision, PaginationMetadata } from '@/types/models';

const PAGE_SIZE = 20;

export default function DecisionsPage() {
    const { isSuperAdmin, isBoardMember, buildingId, canManageDecisions } = usePermissions();
    const { availableBuildings, selectedBuildingId } = useBuildingContext();

    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [metadata, setMetadata] = useState<PaginationMetadata | null>(null);
    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterTitle, setFilterTitle] = useState('');
    const [titleInput, setTitleInput] = useState('');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const effectiveBuildingId = buildingId ?? undefined;

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await decisionsService.list({
                page,
                limit: PAGE_SIZE,
                building_id: effectiveBuildingId,
                status: filterStatus || undefined,
                search: filterTitle || undefined,
            });
            setDecisions(res.data);
            setMetadata(res.metadata);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    }, [page, effectiveBuildingId, filterStatus, filterTitle]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSearch = () => {
        setPage(1);
        setFilterTitle(titleInput);
    };

    const handleStatusChange = (val: string) => {
        setPage(1);
        setFilterStatus(val === 'ALL' ? '' : val);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">
                        Presupuestos
                    </h1>
                    <p className="text-muted-foreground">
                        Presupuestos competitivos y votaciones del condominio.
                    </p>
                </div>
                {canManageDecisions(effectiveBuildingId) && (
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nueva decisión
                    </Button>
                )}
            </div>

            {/* No building selected warning for board members */}
            {!effectiveBuildingId && !isSuperAdmin && (
                <Card className="p-6 border-dashed text-center text-muted-foreground">
                    Selecciona un edificio para gestionar sus decisiones.
                </Card>
            )}

            {/* Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex gap-2 flex-1">
                    <Input
                        placeholder="Buscar por título…"
                        value={titleInput}
                        onChange={(e) => setTitleInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        className="max-w-xs"
                    />
                    <Button variant="outline" onClick={handleSearch}>
                        Buscar
                    </Button>
                </div>
                <Select value={filterStatus || 'ALL'} onValueChange={handleStatusChange}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">Todos los estados</SelectItem>
                        {DECISION_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                                {s}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            {isLoading ? (
                <TableSkeleton rows={6} columns={7} />
            ) : decisions.length === 0 ? (
                <EmptyState
                    icon={Vote}
                    title="Sin decisiones"
                    message="No se encontraron decisiones con los filtros seleccionados."
                    variant="card"
                />
            ) : (
                <Card className="overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Título</TableHead>
                                {isSuperAdmin && <TableHead>Edificio</TableHead>}
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-center">Ronda</TableHead>
                                <TableHead className="text-center">Cotizaciones</TableHead>
                                <TableHead>Recepción</TableHead>
                                <TableHead>Votación</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {decisions.map((d) => {
                                const needsAction =
                                    d.is_deadline_passed &&
                                    (d.status === 'RECEPTION' || d.status === 'VOTING');
                                return (
                                    <TableRow
                                        key={d.id}
                                        className={needsAction ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}
                                    >
                                        <TableCell className="font-medium max-w-xs">
                                            <div className="flex items-center gap-2 truncate">
                                                {needsAction && (
                                                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 shrink-0" />
                                                )}
                                                <span className="truncate" title={d.title}>
                                                    {d.title}
                                                </span>
                                            </div>
                                        </TableCell>
                                        {isSuperAdmin && (
                                            <TableCell className="text-sm text-muted-foreground">
                                                {availableBuildings.find((b) => b.id === d.building_id)
                                                    ?.name ?? d.building_id.slice(0, 8)}
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <DecisionStatusBadge status={d.status} />
                                        </TableCell>
                                        <TableCell className="text-center">{d.current_round}</TableCell>
                                        <TableCell className="text-center">{d.quote_count}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDate(d.reception_deadline, 'dd/MM/yy HH:mm')}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDate(d.voting_deadline, 'dd/MM/yy HH:mm')}
                                        </TableCell>
                                        <TableCell>
                                            <Link href={`/decisions/${d.id}`}>
                                                <Button size="sm" variant="ghost">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>

                    <Paginator
                        metadata={metadata}
                        isLoading={isLoading}
                        onPageChange={setPage}
                        className="border-t border-border/60"
                    />
                </Card>
            )}

            {/* Create dialog: se monta solo cuando está abierto para evitar conflictos de portal durante navegación */}
            {isCreateOpen && (
                <DecisionDialog
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    buildingId={effectiveBuildingId}
                    availableBuildings={availableBuildings}
                    onCreated={(_d) => {
                        setPage(1);
                        load();
                    }}
                />
            )}
        </div>
    );
}
