'use client';

import { useCallback, useEffect, useState } from 'react';
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { BalanceCard } from '@/components/petty-cash/BalanceCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TransactionDialog, type PettyCashManualEntryType } from '@/components/petty-cash/TransactionDialog';
import { AssessmentPreviewDialog } from '@/components/petty-cash/AssessmentPreviewDialog';
import { TransparencyView } from '@/components/petty-cash/TransparencyView';
import { ReverseEntryDialog } from '@/components/petty-cash/ReverseEntryDialog';
import { ExpressAssessmentDialog } from '@/components/petty-cash/ExpressAssessmentDialog';
import { CancelExpressDialog, CancelSuccessSummary } from '@/components/petty-cash/CancelExpressDialog';
import { TargetFundCard } from '@/components/petty-cash/TargetFundCard';
import { ContributionDialog } from '@/components/petty-cash/ContributionDialog';
import { ExportPettyCashPaymentsDialog } from '@/components/petty-cash/ExportPettyCashPaymentsDialog';
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
    PettyCashTransparencyBatch,
    CreatePettyCashAssessmentDto,
    CreateExpressAssessmentDto,
    PaginationMetadata,
    Building,
    RateSource,
    PettyCashCoverage,
    ContributionResponse,
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
    Zap,
    LayoutList,
    X,
    HandCoins,
    Download,
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
    const [building, setBuilding] = useState<Building | null>(null);
    const [savingRate, setSavingRate] = useState(false);
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
    const [exportDialogOpen, setExportDialogOpen] = useState(false);
    const [entryToReverse, setEntryToReverse] = useState<PettyCashEntry | null>(null);

    // B12: post-expense recovery offer state
    const [recoveryCoverage, setRecoveryCoverage] = useState<PettyCashCoverage | null>(null);
    const [recoverySourceEntryId, setRecoverySourceEntryId] = useState<string | null>(null);

    // B13: express assessment dialog
    const [expressDialogOpen, setExpressDialogOpen] = useState(false);
    const [isSubmittingExpress, setIsSubmittingExpress] = useState(false);

    // B13: cancel express dialog
    const [cancelExpressDialogOpen, setCancelExpressDialogOpen] = useState(false);
    const [batchToCancel, setBatchToCancel] = useState<PettyCashTransparencyBatch | null>(null);
    const [isCancellingExpress, setIsCancellingExpress] = useState(false);

    // Direct contribution dialog
    const [contributionDialogOpen, setContributionDialogOpen] = useState(false);

    const isBuildingVariant = variant === 'building';

    // Derived: target fund from assessmentPreview
    const targetFund = assessmentPreview?.target_fund ?? 0;

    const fetchAll = useCallback(async () => {
        if (!buildingId) return;
        setIsLoading(true);
        try {
            const [balResult, historyResult, previewResult, transResult, bldResult] =
                await Promise.allSettled([
                    pettyCashService.getBalance(buildingId),
                    pettyCashService.getHistoryPaginated(buildingId, {
                        type: filterType !== 'all' ? filterType : undefined,
                        category: filterCategory !== 'all' ? filterCategory : undefined,
                        page,
                        limit: pageSize,
                    }),
                    pettyCashService.getAssessmentPreview(buildingId),
                    pettyCashService.getTransparency(buildingId, period),
                    buildingsService.getBuildingById(buildingId).catch(() => null),
                ]);

            if (balResult.status === 'fulfilled') {
                setBalance(balResult.value);
            } else {
                const status = (balResult.reason as import('axios').AxiosError)?.response?.status;
                setBalance(null);
                if (status !== 403) {
                    toast.error('No se pudo cargar el saldo de caja chica');
                }
                console.error(balResult.reason);
            }

            if (historyResult.status === 'fulfilled') {
                setEntries(historyResult.value.data);
                setEntriesMetadata(historyResult.value.metadata);
            } else {
                const status = (historyResult.reason as import('axios').AxiosError)?.response?.status;
                setEntries([]);
                setEntriesMetadata(null);
                if (status !== 403) {
                    toast.error('No se pudo cargar el historial de movimientos');
                }
                console.error(historyResult.reason);
            }

            if (previewResult.status === 'fulfilled') {
                setAssessmentPreview(previewResult.value);
            } else {
                setAssessmentPreview(null);
                console.error(previewResult.reason);
            }

            if (transResult.status === 'fulfilled') {
                setTransparency(transResult.value);
            } else {
                const status = (transResult.reason as import('axios').AxiosError)?.response?.status;
                setTransparency(null);
                if (status !== 403) {
                    toast.error('No se pudo cargar la transparencia de prorrateos');
                }
                console.error(transResult.reason);
            }

            if (bldResult.status === 'fulfilled') {
                setBuilding(bldResult.value);
            } else {
                setBuilding(null);
                console.error(bldResult.reason);
            }
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterType, filterCategory, page, period]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

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
            } else if (code === 'NO_UNITS_SELECTED') {
                toast.error('Seleccioná al menos un apartamento');
            } else if (code === 'INVALID_UNIT_SELECTION') {
                toast.error('La selección de apartamentos ya no es válida. Actualizá e intentá de nuevo');
            } else {
                toast.error(err.response?.data?.message || 'Error al generar el prorrateo');
            }
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    // B13: Express assessment submit
    const handleExpressAssessmentSubmit = async (dto: CreateExpressAssessmentDto) => {
        setIsSubmittingExpress(true);
        try {
            const resp = await pettyCashService.generateExpressAssessment(buildingId, dto);
            toast.success(
                `Se generaron ${resp.invoices_created} facturas para "${resp.description}"`
            );
            setExpressDialogOpen(false);
            setRecoveryCoverage(null);
            setRecoverySourceEntryId(null);
            await fetchAll();
        } catch (e) {
            const err = e as AxiosError<{ code?: string; message?: string }>;
            const code = err.response?.data?.code;
            if (code === 'AMOUNT_TOO_SMALL_TO_DISTRIBUTE') {
                toast.error('El monto es demasiado bajo para repartir entre las unidades');
            } else if (code === 'UNIT_AMOUNTS_MISMATCH') {
                toast.error('La suma de los montos por unidad no coincide con el total');
            } else {
                toast.error(err.response?.data?.message || 'Error al emitir la factura express');
            }
            console.error(e);
        } finally {
            setIsSubmittingExpress(false);
        }
    };

    // B13: Cancel express assessment
    const handleCancelExpress = async (reason: string) => {
        if (!batchToCancel) return;
        setIsCancellingExpress(true);
        try {
            const resp = await pettyCashService.cancelExpressAssessment(
                buildingId,
                batchToCancel.id,
                reason
            );
            toast.success(
                <CancelSuccessSummary
                    cancelledInvoices={resp.cancelled_invoices}
                    totalRemainderReturned={resp.total_remainder_returned}
                />
            );
            setCancelExpressDialogOpen(false);
            setBatchToCancel(null);
            await fetchAll();
        } catch (e) {
            const err = e as AxiosError<{ code?: string; message?: string }>;
            const code = err.response?.data?.code;
            if (code === 'NOT_CANCELLABLE') {
                toast.error('Todas las facturas ya fueron cobradas. No se puede cancelar.');
            } else if (code === 'INVALID_OPERATION') {
                toast.error('Solo se pueden cancelar prorrateos de tipo express.');
            } else {
                toast.error(err.response?.data?.message || 'Error al cancelar el prorrateo');
            }
            console.error(e);
        } finally {
            setIsCancellingExpress(false);
        }
    };

    const openCancelExpressDialog = (batch: PettyCashTransparencyBatch) => {
        setBatchToCancel(batch);
        setCancelExpressDialogOpen(true);
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

    const handleRateChange = async (source: RateSource) => {
        setSavingRate(true);
        try {
            await buildingsService.updateBuilding(buildingId, { default_rate_source: source });
            setBuilding((b) => (b ? { ...b, default_rate_source: source } : b));
            toast.success('Tasa del edificio actualizada');
        } catch (e) {
            const err = e as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || 'No se pudo actualizar (requiere permisos de administrador)');
            console.error(e);
        } finally {
            setSavingRate(false);
        }
    };

    // B14: Save target fund
    const handleSaveTargetFund = async (value: number) => {
        try {
            await pettyCashService.setTargetFund(buildingId, value);
            toast.success(
                value === 0
                    ? 'Fondo objetivo eliminado'
                    : `Fondo objetivo actualizado a ${formatMoney(value)}`
            );
            await fetchAll();
        } catch (e) {
            const err = e as AxiosError<{ message?: string }>;
            toast.error(err.response?.data?.message || 'No se pudo guardar el fondo objetivo');
            console.error(e);
        }
    };

    // B12: Called by TransactionDialog when expense succeeds — check coverage
    const handleExpenseSuccess = useCallback(
        (entry?: PettyCashEntry) => {
            if (entry?.coverage && entry.coverage.pending_to_assess > 0) {
                setRecoveryCoverage(entry.coverage);
                setRecoverySourceEntryId(entry.id);
                // Do NOT call fetchAll here — the recovery offer is shown first.
                // fetchAll is called after the user acts or dismisses.
            } else {
                // No coverage or not needed: refresh normally
                fetchAll();
            }
        },
        [fetchAll]
    );

    const dismissRecoveryOffer = () => {
        setRecoveryCoverage(null);
        setRecoverySourceEntryId(null);
        fetchAll();
    };

    const openExpressFromOffer = () => {
        setExpressDialogOpen(true);
    };

    const openGeneralFromOffer = () => {
        setAssessmentDialogOpen(true);
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
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => setExportDialogOpen(true)}
                    >
                        <Download className="h-4 w-4 text-primary" />
                        Exportar reporte (PDF / CSV)
                    </Button>
                    {canEdit && (
                        <>
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
                            <Button
                                variant="outline"
                                className="gap-2"
                                onClick={() => setContributionDialogOpen(true)}
                            >
                                <HandCoins className="h-4 w-4 text-chart-1" />
                                Registrar aporte
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* B12: Post-expense recovery offer — shown INSTEAD of the normal pending banner */}
            {recoveryCoverage && canEdit ? (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 shrink-0 text-primary" />
                            <div>
                                <h3 className="font-semibold text-foreground">
                                    Egreso registrado — ¿querés cobrar este gasto a las unidades?
                                </h3>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    Hay {formatMoney(recoveryCoverage.pending_to_assess)} pendiente
                                    de cobrar. Podés generar una factura express inmediata o iniciar
                                    un prorrateo general.
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={dismissRecoveryOffer}
                            aria-label="Descartar"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            className="gap-2"
                            onClick={openExpressFromOffer}
                        >
                            <Zap className="h-4 w-4" />
                            Factura express
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            onClick={openGeneralFromOffer}
                        >
                            <LayoutList className="h-4 w-4" />
                            Prorrateo general
                        </Button>
                    </div>
                </div>
            ) : (
                /* Normal pending-to-assess banner — only show when no recovery offer is active */
                assessmentPreview && assessmentPreview.pending_to_assess > 0 && canEdit && (
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
                )
            )}

            <div className="grid gap-6 md:grid-cols-2">
                <BalanceCard
                    balance={balance}
                    isLoading={isLoading}
                    onRefresh={fetchAll}
                    targetFund={targetFund > 0 ? targetFund : undefined}
                />
                {canEdit && (
                    <Card className="border-border/50 bg-card/50 backdrop-blur-xl md:max-w-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                Tasa del edificio
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Moneda de cambio para convertir bolívares a la unidad base del edificio.
                            </p>
                            <Select
                                value={building?.default_rate_source ?? 'dolar_oficial'}
                                onValueChange={(v) => handleRateChange(v as RateSource)}
                                disabled={savingRate}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="dolar_oficial">Dólar oficial (BCV)</SelectItem>
                                    <SelectItem value="euro_oficial">Euro oficial (BCV)</SelectItem>
                                    <SelectItem value="dolar_paralelo">Paralelo</SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* B14: Target fund card — only shown to editors */}
            {canEdit && (
                <TargetFundCard
                    targetFund={targetFund}
                    onSave={handleSaveTargetFund}
                />
            )}

            <TransparencyView
                transparency={transparency}
                period={period}
                canEdit={canEdit}
                onCancelExpressBatch={openCancelExpressDialog}
            />

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
                                    const alreadyReversed = entry.is_reversed ?? false;
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

            {/* TransactionDialog: expense success now passes entry for coverage detection */}
            <TransactionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                entryType={dialogType}
                buildingId={buildingId}
                onSuccess={handleExpenseSuccess}
            />

            <AssessmentPreviewDialog
                open={assessmentDialogOpen}
                onOpenChange={(o) => {
                    setAssessmentDialogOpen(o);
                    if (!o && recoveryCoverage) {
                        // User closed general dialog from recovery offer — dismiss offer and refresh
                        setRecoveryCoverage(null);
                        setRecoverySourceEntryId(null);
                        fetchAll();
                    }
                }}
                preview={assessmentPreview}
                existingBatches={transparency?.assessments ?? []}
                period={period}
                isGenerating={isGenerating}
                onConfirm={async (dto) => {
                    await handleGenerateAssessments(dto);
                    if (recoveryCoverage) {
                        setRecoveryCoverage(null);
                        setRecoverySourceEntryId(null);
                    }
                }}
            />

            {/* B13: Express assessment dialog */}
            {recoverySourceEntryId && (
                <ExpressAssessmentDialog
                    open={expressDialogOpen}
                    onOpenChange={(o) => {
                        setExpressDialogOpen(o);
                        if (!o && recoveryCoverage) {
                            // User dismissed express dialog — keep recovery offer visible
                        }
                    }}
                    preview={assessmentPreview}
                    sourceEntryId={recoverySourceEntryId}
                    coverageAmount={recoveryCoverage?.pending_to_assess ?? 0}
                    currentBalance={recoveryCoverage?.balance}
                    isSubmitting={isSubmittingExpress}
                    onConfirm={handleExpressAssessmentSubmit}
                />
            )}

            {/* B13: Cancel express dialog */}
            {batchToCancel && (
                <CancelExpressDialog
                    open={cancelExpressDialogOpen}
                    onOpenChange={(o) => {
                        setCancelExpressDialogOpen(o);
                        if (!o) setBatchToCancel(null);
                    }}
                    batchDescription={batchToCancel.description}
                    isSubmitting={isCancellingExpress}
                    onConfirm={handleCancelExpress}
                />
            )}

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

            {/* Direct contribution dialog */}
            <ContributionDialog
                open={contributionDialogOpen}
                onOpenChange={setContributionDialogOpen}
                buildingId={buildingId}
                onSuccess={(_result: ContributionResponse) => {
                    fetchAll();
                }}
            />

            <ExportPettyCashPaymentsDialog
                open={exportDialogOpen}
                onOpenChange={setExportDialogOpen}
                buildingId={buildingId}
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
