'use client';

import { useCallback, useEffect, useState } from 'react';
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { BalanceCard } from '@/components/petty-cash/BalanceCard';
import { TransactionDialog } from '@/components/petty-cash/TransactionDialog';
import { AssessmentPreviewDialog } from '@/components/petty-cash/AssessmentPreviewDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/dialog';
import type {
    PettyCashBalance,
    PettyCashTransaction,
    PettyCashTransactionType,
    PettyCashAssessmentPreview,
    PettyCashTransparency,
} from '@/types/models';
import { formatDate, formatMoney } from '@/lib/utils/format';
import { PETTY_CASH_CATEGORIES } from '@/lib/utils/constants';
import { toast } from 'sonner';
import { ArrowDownCircle, ArrowUpCircle, Eye, AlertTriangle, TrendingUp, Users, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { usePermissions } from '@/lib/hooks/usePermissions';

function currentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface PettyCashPageProps {
    buildingId: string;
    /** Darker styling when rendered inside building context */
    variant?: 'default' | 'building';
}

export function PettyCashPage({ buildingId, variant = 'default' }: PettyCashPageProps) {
    const { canManageBuilding } = usePermissions();
    const canEdit = canManageBuilding(buildingId);

    const [balance, setBalance] = useState<PettyCashBalance | null>(null);
    const [transactions, setTransactions] = useState<PettyCashTransaction[]>([]);
    const [assessmentPreview, setAssessmentPreview] = useState<PettyCashAssessmentPreview | null>(null);
    const [transparency, setTransparency] = useState<PettyCashTransparency | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [page, setPage] = useState(0);
    const pageSize = 20;

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogType, setDialogType] = useState<PettyCashTransactionType>('INCOME');
    const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
    const [assessmentDialogOpen, setAssessmentDialogOpen] = useState(false);

    const isBuildingVariant = variant === 'building';
    const cardClass = isBuildingVariant
        ? 'border-white/5 bg-card/50 backdrop-blur-xl'
        : 'border-border/50 bg-card';
    const tableHeadClass = isBuildingVariant
        ? 'bg-white/5 border-b border-white/5'
        : 'bg-muted/50 border-b border-border/50';

    const fetchAll = useCallback(async () => {
        if (!buildingId) return;
        try {
            setIsLoading(true);
            const [bal, history, preview, trans] = await Promise.all([
                pettyCashService.getBalance(buildingId),
                pettyCashService.getHistory(buildingId, {
                    type: filterType !== 'all' ? filterType : undefined,
                    category: filterCategory !== 'all' ? filterCategory : undefined,
                    page,
                    limit: pageSize,
                }),
                pettyCashService.getAssessmentPreview(buildingId),
                pettyCashService.getTransparency(buildingId, currentPeriod()),
            ]);
            setBalance(bal);
            setTransactions(history);
            setAssessmentPreview(preview);
            setTransparency(trans);
        } catch (e) {
            console.error(e);
            toast.error('No se pudo cargar la caja chica');
            setBalance(null);
            setTransactions([]);
            setAssessmentPreview(null);
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterType, filterCategory, page]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const openDialog = (type: PettyCashTransactionType) => {
        setDialogType(type);
        setDialogOpen(true);
    };

    const handleGenerateAssessments = async () => {
        setIsGenerating(true);
        try {
            const resp = await pettyCashService.generateAssessments(buildingId);
            toast.success(`Se generaron ${resp.invoices_created} recibos de reposición correctamente`);
            setAssessmentDialogOpen(false);
            await fetchAll();
        } catch (e) {
            console.error(e);
            toast.error('Error al generar los recibos');
        } finally {
            setIsGenerating(false);
        }
    };

    const formatTxAmount = (t: PettyCashTransaction) => {
        const cur = balance?.currency ?? 'USD';
        return formatMoney(t.amount, cur);
    };

    const typeLabel = (type: string) => {
        const u = type?.toUpperCase?.() ?? type;
        if (u === 'INCOME' || u === 'INGRESO') return 'Ingreso';
        if (u === 'EXPENSE' || u === 'EGRESO') return 'Egreso';
        return type;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1
                        className={
                            isBuildingVariant
                                ? 'font-display text-3xl font-bold tracking-tight text-white'
                                : 'text-3xl font-bold text-foreground'
                        }
                    >
                        Caja chica
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Saldo y movimientos del fondo del edificio
                    </p>
                </div>
                {canEdit && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            className="gap-2"
                            onClick={() => openDialog('INCOME')}
                        >
                            <ArrowUpCircle className="h-4 w-4 text-green-500" />
                            Registrar ingreso
                        </Button>
                        <Button className="gap-2" onClick={() => openDialog('EXPENSE')}>
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
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                            <div>
                                <h3 className="font-semibold text-white">Sobregiro detectado para reponer</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Faltan {formatMoney(assessmentPreview.pending_to_assess, balance?.currency ?? 'USD')} de reponer. 
                                    ({assessmentPreview.units.length} unidades pendientes por montos variables).
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="destructive"
                            disabled={isGenerating}
                            onClick={() => setAssessmentDialogOpen(true)}
                            className="whitespace-nowrap"
                        >
                            Generar Recibos de Reposición
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
                
                {/* Transparency Summary View */}
                <Card className={`p-4 flex flex-col justify-center ${cardClass}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest">Recaudación de Reposición</h3>
                        </div>
                        <span className="text-2xl font-black text-white">{transparency?.collection_percentage || 0}%</span>
                    </div>
                    <Progress value={transparency?.collection_percentage || 0} className="h-4" />
                    <div className="mt-3 flex justify-between items-center text-[10px] text-muted-foreground uppercase font-black">
                        <span>Recaudado: {formatMoney(transparency?.total_collected || 0, balance?.currency ?? 'USD')}</span>
                        <span>Meta: {formatMoney(transparency?.total_to_collect || 0, balance?.currency ?? 'USD')}</span>
                    </div>
                </Card>
            </div>

            {/* Transparency Details */}
            {transparency && transparency.units.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h2 className="text-sm font-black text-white uppercase tracking-widest">Estatus de Reposición por Unidad</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {transparency.units.map(u => {
                            const progress = (u.covered_amount / u.expected_amount) * 100;
                            return (
                                <Card key={u.unit_id} className="p-3 bg-white/5 border-white/5 relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold">Unidad</span>
                                            <span className="text-sm text-white font-black">{u.unit_name}</span>
                                        </div>
                                        {u.status === 'PAID' ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <Badge className={u.status === 'PARTIAL' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30' : 'bg-destructive/20 text-destructive border-destructive/30'}>
                                                {u.status}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                                            <span>Cobertura</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <Progress value={progress} className="h-1.5" indicatorClassName={u.status === 'PAID' ? 'bg-green-500' : u.status === 'PARTIAL' ? 'bg-amber-500' : 'bg-primary'} />
                                        <div className="flex justify-between text-[10px] text-white font-medium mt-1">
                                            <span>{formatMoney(u.covered_amount, balance?.currency ?? 'USD')}</span>
                                            <span className="text-muted-foreground">/ {formatMoney(u.expected_amount, balance?.currency ?? 'USD')}</span>
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            )}

            <Card className={`p-4 ${cardClass}`}>
                <div className="flex flex-wrap gap-4">
                    <div className="w-full md:w-48">
                        <Select value={filterType} onValueChange={(v) => { setPage(0); setFilterType(v); }}>
                            <SelectTrigger className={isBuildingVariant ? 'bg-background/50 border-white/5' : ''}>
                                <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los tipos</SelectItem>
                                <SelectItem value="INCOME">Ingreso</SelectItem>
                                <SelectItem value="EXPENSE">Egreso</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-56">
                        <Select value={filterCategory} onValueChange={(v) => { setPage(0); setFilterCategory(v); }}>
                            <SelectTrigger className={isBuildingVariant ? 'bg-background/50 border-white/5' : ''}>
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
                </div>
            </Card>

            <Card className={`${cardClass} overflow-hidden`}>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className={tableHeadClass}>
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Fecha
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Tipo
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Monto
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Descripción
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Categoría
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                        Evidencia
                                    </th>
                                </tr>
                            </thead>
                            <tbody
                                className={
                                    isBuildingVariant
                                        ? 'divide-y divide-white/5 bg-card/30'
                                        : 'divide-y divide-border/50 bg-card'
                                }
                            >
                                {isLoading ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-6 py-8 text-center text-muted-foreground"
                                        >
                                            Cargando movimientos…
                                        </td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-6 py-8 text-center text-muted-foreground"
                                        >
                                            No hay movimientos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    transactions.map((t) => {
                                        const isInc =
                                            t.type?.toUpperCase() === 'INCOME' ||
                                            t.type?.toUpperCase() === 'INGRESO';
                                        return (
                                            <tr
                                                key={t.id}
                                                className={
                                                    isBuildingVariant
                                                        ? 'hover:bg-white/5'
                                                        : 'hover:bg-accent/50'
                                                }
                                            >
                                                <td className="whitespace-nowrap px-6 py-4 text-sm text-foreground">
                                                    {t.created_at
                                                        ? formatDate(t.created_at)
                                                        : '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4">
                                                    <Badge
                                                        variant="secondary"
                                                        className={
                                                            isInc
                                                                ? 'border-green-500/30 bg-green-500/15 text-green-700 dark:text-green-400'
                                                                : 'border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-400'
                                                        }
                                                    >
                                                        {typeLabel(t.type)}
                                                    </Badge>
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium tabular-nums">
                                                    {formatTxAmount(t)}
                                                </td>
                                                <td className="max-w-xs truncate px-6 py-4 text-sm">
                                                    {t.description}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                                                    {t.category || '—'}
                                                </td>
                                                <td className="whitespace-nowrap px-6 py-4 text-sm">
                                                    {t.evidence_url ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="gap-1"
                                                            onClick={() =>
                                                                setEvidenceUrl(t.evidence_url || null)
                                                            }
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            Ver
                                                        </Button>
                                                    ) : (
                                                        '—'
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {transactions.length > 0 && (
                        <div className="flex items-center justify-end gap-2 border-t border-border/50 p-4">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 0 || isLoading}
                                onClick={() => setPage((p) => Math.max(0, p - 1))}
                            >
                                Anterior
                            </Button>
                            <span className="text-sm text-muted-foreground">
                                Página {page + 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={transactions.length < pageSize || isLoading}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Siguiente
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            <TransactionDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                transactionType={dialogType}
                buildingId={buildingId}
                onSuccess={fetchAll}
            />

            <AssessmentPreviewDialog
                open={assessmentDialogOpen}
                onOpenChange={setAssessmentDialogOpen}
                preview={assessmentPreview}
                currency={balance?.currency ?? 'USD'}
                isGenerating={isGenerating}
                onConfirm={handleGenerateAssessments}
            />

            <Dialog open={!!evidenceUrl} onOpenChange={(o) => !o && setEvidenceUrl(null)}>
                <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-card border-white/10">
                    <DialogHeader>
                        <DialogTitle>Comprobante</DialogTitle>
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
                                    Los archivos PDF no se previsualizan aquí. Usa el botón de arriba
                                    para abrirlos.
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
