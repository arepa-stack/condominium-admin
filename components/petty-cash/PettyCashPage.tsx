'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { BalanceCard } from '@/components/petty-cash/BalanceCard';
import { TransactionDialog, type PettyCashManualEntryType } from '@/components/petty-cash/TransactionDialog';
import { AssessmentPreviewDialog } from '@/components/petty-cash/AssessmentPreviewDialog';
import { TransparencyView } from '@/components/petty-cash/TransparencyView';
import { ReverseEntryDialog } from '@/components/petty-cash/ReverseEntryDialog';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeletons';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import type {
    PettyCashBalance,
    PettyCashEntry,
    PettyCashEntryType,
    PettyCashCategory,
    PettyCashAssessmentPreview,
    PettyCashTransparency,
    CreatePettyCashAssessmentDto,
    PaginationMetadata,
} from '@/types/models';
import { Paginator } from '@/components/ui/paginator';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { PETTY_CASH_CATEGORIES } from '@/lib/utils/constants';
import { toast } from 'sonner';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Eye,
    AlertTriangle,
    Receipt,
    Undo2,
    ArrowRightCircle,
    RotateCcw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { AxiosError } from 'axios';

function currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface PettyCashPageProps {
    buildingId: string;
    variant?: 'default' | 'building';
}

type TypeFilter = 'all' | PettyCashEntryType;
type CategoryFilter = 'all' | PettyCashCategory;

const ENTRY_TYPE_META: Record<
    PettyCashEntryType,
    { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
    income: {
        label: 'Ingreso',
        className: 'border-chart-1/30 bg-chart-1/15 text-chart-1',
        icon: ArrowUpCircle,
    },
    expense: {
        label: 'Egreso',
        className: 'border-chart-2/30 bg-chart-2/15 text-chart-2',
        icon: ArrowDownCircle,
    },
    collection: {
        label: 'Cobro auto',
        className: 'border-primary/30 bg-primary/15 text-primary',
        icon: ArrowRightCircle,
    },
    reversal: {
        label: 'Reversa',
        className: 'border-destructive/30 bg-destructive/15 text-destructive',
        icon: RotateCcw,
    },
};

export function PettyCashPage({ buildingId, variant = 'default' }: PettyCashPageProps) {
    const { canManageBuilding } = usePermissions();
    const canEdit = canManageBuilding(buildingId);
    const period = currentPeriod();

    const [balance, setBalance] = useState<PettyCashBalance | null>(null);
    const [entries, setEntries] = useState<PettyCashEntry[]>([]);
    const [entriesMetadata, setEntriesMetadata] = useState<PaginationMetadata | null>(null);
    const [assessmentPreview, setAssessmentPreview] = useState<PettyCashAssessmentPreview | null>(null);
    const [transparency, setTransparency] = useState<PettyCashTransparency | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isReversing, setIsReversing] = useState(false);
    const [filterType, setFilterType] = useState<TypeFilter>('all');
    const [filterCategory, setFilterCategory] = useState<CategoryFilter>('all');
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState<PettyCashManualEntryType>('income');
    const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
    const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);
    const [reverseDialogOpen, setReverseDialogOpen] = useState(false);
    const [entryToReverse, setEntryToReverse] = useState<PettyCashEntry | null>(null);

    const isBuildingVariant = variant === 'building';

    const fetchAll = useCallback(async () => {
        if (!buildingId) return;
        try {
            setIsLoading(true);
            const [bal, history, preview, trans] = await Promise.all([
                pettyCashService.getBalance(buildingId),
                pettyCashService.getHistoryPaginated(buildingId, {
                    type: filterType !== 'all' ? filterType : undefined,
                    category: filterCategory !== 'all' ? filterCategory : undefined,
                    page,
                    limit: pageSize,
                }),
                pettyCashService.getAssessmentPreview(buildingId),
                pettyCashService.getTransparency(buildingId, period),
            ]);
            setBalance(bal);
            setEntries(history.data);
            setEntriesMetadata(history.metadata);
            setAssessmentPreview(preview);
            setTransparency(trans);
        } catch (e) {
            console.error(e);
            toast.error('No se pudo cargar la caja chica');
            setBalance(null);
            setEntries([]);
            setEntriesMetadata(null);
            setAssessmentPreview(null);
            setTransparency(null);
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterType, filterCategory, page, period]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const reversedEntryIds = useMemo(() => {
        const set = new Set<string>();
        for (const e of entries) {
            if (e.type === 'reversal' && e.reference_type === 'reversal' && e.reference_id) {
                set.add(e.reference_id);
            }
        }
        return set;
    }, [entries]);

    const openDialog = (type: PettyCashManualEntryType) => {
        setDialogType(type);
        setDialogOpen(true);
    };

    const handleGenerateAssessments = async (dto: CreatePettyCashAssessmentDto) => {
        setIsGenerating(true);
        try {
            const resp = await pettyCashService.generateAssessments(buildingId, dto);
            toast.success(
                `Se generaron ${resp.invoices_created} facturas para "${resp.description}"`
            );
            setAssessmentDialogOpen(false);
            await fetchAll();
        } catch (e) {
            const err = e as AxiosError<{ code?: string; message?: string }>;
            const code = err.response?.data?.code;
            if (code === 'AMOUNT_TOO_SMALL_TO_DISTRIBUTE') {
                toast.error('El monto es demasiado bajo para repartir entre las unidades');
            } else if (code === 'NO_UNITS') {
                toast.error('El edificio no tiene unidades asignadas');
            } else {
                toast.error(err.response?.data?.message || 'Error al generar el prorrateo');
            }
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleReverseEntry = async (entryId: string, reason: string) => {
        setIsReversing(true);
        try {
            await pettyCashService.reverseEntry(buildingId, entryId, reason);
            toast.success('Movimiento revertido');
            setReverseDialogOpen(false);
            setEntryToReverse(null);
            await fetchAll();
        } catch (e) {
            const err = e as AxiosError<{ code?: string; message?: string }>;
            const code = err.response?.data?.code;
            const status = err.response?.status;
            if (code === 'INVALID_OPERATION' || status === 409) {
                toast.error('No se puede reversar una reversa');
            } else if (status === 404) {
                toast.error('Movimiento no encontrado');
            } else {
                toast.error(err.response?.data?.message || 'Error al revertir el movimiento');
            }
            console.error(e);
        } finally {
            setIsReversing(false);
        }
    };

    const openReverseDialog = (entry: PettyCashEntry) => {
        setEntryToReverse(entry);
        setReverseDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1
                        className={
                            isBuildingVariant
                                ? 'font-display text-3xl font-bold tracking-tight text-foreground'
                                : 'text-3xl font-bold text-foreground'
                        }
                    >
                        Caja chica
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Saldo, movimientos y prorrateos del fondo del edificio
                    </p>
                </div>
                {canEdit && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => openDialog('income')}
                        >
                            <ArrowUpCircle className="h-4 w-4 text-chart-1" />
                            Registrar ingreso
                        </Button>
                        <Button className="gap-2" onClick={() => openDialog('expense')}>
                            <ArrowDownCircle className="h-4 w-4" />
                            Registrar egreso
                        </Button>
                    </div>
                )}
            </div>

            {assessmentPreview && assessmentPreview.pending_to_assess > 0 && canEdit && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                            <div>
                                <h3 className="font-semibold text-foreground">
                                    Hay saldo sin prorratear
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Quedan{' '}
                                    {formatMoney(assessmentPreview.pending_to_assess)} por
                                    cobrar a {assessmentPreview.units.length} unidades.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            disabled={isGenerating}
                            onClick={() => setAssessmentDialogOpen(true)}
                            className="whitespace-nowrap"
                        >
                            Generar prorrateo
                        </Button>
                    </div>
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <BalanceCard
                    balance={balance}
                    isLoading={isLoading}
                    onRefresh={fetchAll}
                />
            </div>

            <TransparencyView transparency={transparency} period={period} />

            <FilterBar>
                <div className="w-full md:w-48">
                    <Select
                        value={filterType}
                        onValueChange={(v) => {
                            setPage(1);
                            setFilterType(v as TypeFilter);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los tipos</SelectItem>
                            <SelectItem value="income">Ingreso</SelectItem>
                            <SelectItem value="expense">Egreso</SelectItem>
                            <SelectItem value="collection">Cobro auto</SelectItem>
                            <SelectItem value="reversal">Reversa</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full md:w-56">
                    <Select
                        value={filterCategory}
                        onValueChange={(v) => {
                            setPage(1);
                            setFilterCategory(v as CategoryFilter);
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Categoría" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las categorías</SelectItem>
                            {PETTY_CASH_CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                    {c}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </FilterBar>

            {isLoading ? (
                <TableSkeleton rows={5} columns={7} />
            ) : (
                <>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Monto</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead>Evidencia</TableHead>
                                {canEdit && <TableHead className="text-right">Acciones</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={canEdit ? 7 : 6}
                                        className="p-0"
                                    >
                                        <EmptyState
                                            icon={Receipt}
                                            message="No hay movimientos registrados"
                                            variant="inline"
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                entries.map((entry) => {
                                    const meta = ENTRY_TYPE_META[entry.type];
                                    const isReversal = entry.type === 'reversal';
                                    const alreadyReversed = reversedEntryIds.has(entry.id);
                                    const canReverse =
                                        canEdit && !isReversal && !alreadyReversed;

                                    return (
                                        <TableRow
                                            key={entry.id}
                                            className={alreadyReversed ? 'opacity-60' : ''}
                                        >
                                            <TableCell>
                                                {entry.created_at
                                                    ? formatDate(entry.created_at)
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="secondary"
                                                    className={meta.className}
                                                >
                                                    {meta.label}
                                                </Badge>
                                                {alreadyReversed && (
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-1 border-muted-foreground/40 text-muted-foreground"
                                                    >
                                                        Reversada
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell
                                                className={
                                                    entry.amount < 0
                                                        ? 'font-medium tabular-nums text-destructive'
                                                        : 'font-medium tabular-nums'
                                                }
                                                style={
                                                    alreadyReversed
                                                        ? { textDecoration: 'line-through' }
                                                        : undefined
                                                }
                                            >
                                                {formatMoney(entry.amount)}
                                            </TableCell>
                                            <TableCell className="max-w-xs truncate whitespace-normal">
                                                {entry.description}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {entry.category || '—'}
                                            </TableCell>
                                            <TableCell>
                                                {entry.evidence_url ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1"
                                                        onClick={() =>
                                                            setEvidenceUrl(entry.evidence_url)
                                                        }
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        Ver
                                                    </Button>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            {canEdit && (
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="gap-1"
                                                        onClick={() => openReverseDialog(entry)}
                                                        disabled={!canReverse}
                                                        title={
                                                            isReversal
                                                                ? 'No se puede reversar una reversa'
                                                                : alreadyReversed
                                                                    ? 'Esta entrada ya fue reversada'
                                                                    : 'Revertir movimiento'
                                                        }
                                                    >
                                                        <Undo2 className="h-4 w-4" />
                                                        Revertir
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    <Paginator
                        metadata={entriesMetadata}
                        isLoading={isLoading}
                        onPageChange={setPage}
                    />
                </>
            )}

            <TransactionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                entryType={dialogType}
                buildingId={buildingId}
                onSuccess={fetchAll}
            />

            <AssessmentPreviewDialog
                open={assessmentDialogOpen}
                onOpenChange={setAssessmentDialogOpen}
                preview={assessmentPreview}
                existingBatches={transparency?.assessments ?? []}
                period={period}
                isGenerating={isGenerating}
                onConfirm={handleGenerateAssessments}
            />

            <ReverseEntryDialog
                open={reverseDialogOpen}
                onOpenChange={(o) => {
                    setReverseDialogOpen(o);
                    if (!o) setEntryToReverse(null);
                }}
                entry={entryToReverse}
                isReversing={isReversing}
                onConfirm={handleReverseEntry}
            />

            <Dialog open={!!evidenceUrl} onOpenChange={(o) => !o && setEvidenceUrl(null)}>
                <DialogContent className="max-h-[95vh] max-w-5xl overflow-y-auto border-border bg-card">
                    <DialogHeader>
                        <DialogTitle>Comprobante</DialogTitle>
                        <DialogDescription className="sr-only">
                            Vista previa del comprobante del movimiento.
                        </DialogDescription>
                    </DialogHeader>
                    {evidenceUrl && (
                        <>
                            <div className="flex justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.open(evidenceUrl, '_blank')}
                                >
                                    Abrir en nueva pestaña
                                </Button>
                            </div>
                            {evidenceUrl.toLowerCase().includes('.pdf') ||
                                evidenceUrl.toLowerCase().includes('pdf') ? (
                                <p className="mt-4 text-sm text-muted-foreground">
                                    Los archivos PDF no se previsualizan aquí. Usá el botón
                                    de arriba para abrirlos.
                                </p>
                            ) : (
                                <div className="relative mt-2 h-[75vh] min-h-[400px] w-full">
                                    <Image
                                        src={evidenceUrl}
                                        alt="Evidencia"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
