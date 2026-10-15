'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { billingService } from '@/lib/services/billing.service';
import { unitsService } from '@/lib/services/units.service';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeletons';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils/format';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useParams } from 'next/navigation';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
import { InvoiceDetailsDialog } from '@/components/billing/InvoiceDetailsDialog';
import { ExcelInvoiceLoader } from '@/components/billing/ExcelInvoiceLoader';
import { GenerateByAliquotDialog } from '@/components/billing/GenerateByAliquotDialog';
import { AliquotTableDialog } from '@/components/buildings/AliquotTableDialog';
import { AvisoDeCobroDialog } from '@/components/billing/AvisoDeCobroDialog';
import { InvoiceReceiptDialog } from '@/components/billing/InvoiceReceiptDialog';
import { getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
    groupInvoicesByBudget,
    type BudgetInvoiceGroup,
    type ActiveBudgetOption,
} from '@/lib/utils/budget-helpers';
import {
    Eye,
    Plus,
    FileSpreadsheet,
    Home,
    FileText,
    Calculator,
    TableProperties,
    Layers,
    ChevronDown,
    ChevronRight,
    Droplets,
    Printer,
    Receipt,
    Sparkles,
    FolderKanban,
    List,
    LayoutGrid,
} from 'lucide-react';
import type { Invoice, Unit } from '@/types/models';

export default function BuildingBillingPage() {
    const { isSuperAdmin, isBoardMember } = usePermissions();
    const params = useParams();
    const buildingId = params.id as string;

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog states
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [isExcelLoaderOpen, setIsExcelLoaderOpen] = useState(false);
    const [isAliquotDialogOpen, setIsAliquotDialogOpen] = useState(false);
    const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [avisoInvoice, setAvisoInvoice] = useState<Invoice | null>(null);
    const [isAvisoOpen, setIsAvisoOpen] = useState(false);
    const [receiptInvoice, setReceiptInvoice] = useState<Invoice | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    // Active budget to attach when creating invoice from a specific group
    const [selectedBudgetForNewInvoice, setSelectedBudgetForNewInvoice] = useState<ActiveBudgetOption | null>(null);

    // View mode: 'grouped' by budget/concept or 'flat' list
    const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

    // Accordion state for grouped view (set of expanded group IDs)
    const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

    // Filters
    const [filterUnitId, setFilterUnitId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState<string>('all');

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Build query params
            const query: any = { building_id: buildingId };
            if (filterUnitId && filterUnitId !== 'all') query.unit_id = filterUnitId;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;
            if (filterYear) query.year = parseInt(filterYear);
            if (filterMonth && filterMonth !== 'all') query.month = parseInt(filterMonth);

            const [invoicesData, unitsData] = await Promise.all([
                billingService.getInvoices(query),
                unitsService.getUnits(buildingId),
            ]);

            setInvoices(invoicesData);
            setUnits(unitsData);

            // Automatically expand all groups by default on first load
            const groups = groupInvoicesByBudget(invoicesData);
            setExpandedGroupIds(new Set(groups.map((g) => g.id)));
        } catch (error) {
            console.error('Failed to fetch billing data:', error);
            toast.error('Error al cargar las facturas');
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterUnitId, filterStatus, filterYear, filterMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Group invoices
    const invoiceGroups = useMemo(() => {
        return groupInvoicesByBudget(invoices);
    }, [invoices]);

    // Financial totals across all currently shown invoices
    const globalSummary = useMemo(() => {
        const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
        const totalPending = totalAmount - totalPaid;
        const progress = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
        return {
            totalAmount,
            totalPaid,
            totalPending,
            progress: Math.min(100, Math.round(progress * 10) / 10),
            count: invoices.length,
        };
    }, [invoices]);

    const toggleGroup = (groupId: string) => {
        setExpandedGroupIds((prev) => {
            const next = new Set(prev);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    };

    const handleExpandAll = () => {
        setExpandedGroupIds(new Set(invoiceGroups.map((g) => g.id)));
    };

    const handleCollapseAll = () => {
        setExpandedGroupIds(new Set());
    };

    const handleOpenCreateForBudget = (group: BudgetInvoiceGroup) => {
        setSelectedBudgetForNewInvoice({
            id: `camp-${group.id}`,
            title: group.title,
            baseBudget: group.baseBudget,
            details: group.details,
            source: 'invoice_campaign',
        });
        setIsInvoiceDialogOpen(true);
    };

    const handleOpenStandardCreate = () => {
        setSelectedBudgetForNewInvoice(null);
        setIsInvoiceDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Header & Main Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Facturación</h1>
                    <p className="text-muted-foreground mt-1">
                        Gestioná presupuestos, facturas masivas por alícuotas y cobros del edificio
                    </p>
                </div>
                {(isSuperAdmin || isBoardMember) && (
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsTableDialogOpen(true)}
                            className="gap-2 text-xs"
                        >
                            <TableProperties className="h-4 w-4" />
                            Cuadro de Alícuotas
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsExcelLoaderOpen(true)}
                            className="gap-2 border-chart-1/30 text-chart-1 hover:bg-chart-1/10 text-xs"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Importar Excel
                        </Button>
                        <Button
                            onClick={() => setIsAliquotDialogOpen(true)}
                            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm text-xs"
                        >
                            <Calculator className="h-4 w-4" />
                            Generar por Alícuotas
                        </Button>
                        <Button
                            variant="outline"
                            onClick={handleOpenStandardCreate}
                            className="gap-2 text-xs"
                        >
                            <Plus className="h-4 w-4" />
                            Factura Individual
                        </Button>
                    </div>
                )}
            </div>

            {/* Global Financial Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                        Total Facturado
                    </span>
                    <span className="text-xl font-bold font-mono text-foreground">
                        {formatCurrency(globalSummary.totalAmount)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">{globalSummary.count} facturas emitidas</span>
                </Card>

                <Card className="border-border/60 bg-emerald-500/5 border-emerald-500/20 p-4 space-y-1">
                    <span className="text-[11px] font-medium text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">
                        Total Recaudado
                    </span>
                    <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(globalSummary.totalPaid)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                        {globalSummary.progress}% del total facturado
                    </span>
                </Card>

                <Card className="border-border/60 bg-card/60 backdrop-blur-sm p-4 space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                        Saldo Pendiente
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                        {formatCurrency(globalSummary.totalPending)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Por cobrar</span>
                </Card>

                <Card className="border-border/60 bg-primary/5 border-primary/20 p-4 space-y-1">
                    <span className="text-[11px] font-medium text-primary uppercase tracking-wider block">
                        Presupuestos Activos
                    </span>
                    <span className="text-xl font-bold font-mono text-foreground">
                        {invoiceGroups.filter((g) => g.isBudget).length || invoiceGroups.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Campañas registradas</span>
                </Card>
            </div>

            {/* Filter Bar & View Toggle */}
            <div className="space-y-3">
                <FilterBar>
                    <div className="w-full md:w-64">
                        <SearchableSelect
                            options={[
                                { value: 'all', label: 'Todas las unidades' },
                                ...units.map((u) => ({
                                    value: u.id,
                                    label: u.name,
                                    icon: Home,
                                })),
                            ]}
                            value={filterUnitId}
                            onValueChange={setFilterUnitId}
                            placeholder="Todas las unidades"
                            searchPlaceholder="Buscar unidad..."
                            triggerIcon={Home}
                        />
                    </div>
                    <div className="w-full md:w-40">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los estados</SelectItem>
                                <SelectItem value="PENDING">Pendiente</SelectItem>
                                <SelectItem value="PAID">Pagado</SelectItem>
                                <SelectItem value="CANCELLED">Cancelado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-32">
                        <Select value={filterYear} onValueChange={setFilterYear}>
                            <SelectTrigger>
                                <SelectValue placeholder="Año" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                                <SelectItem value="2026">2026</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-32">
                        <Select value={filterMonth} onValueChange={setFilterMonth}>
                            <SelectTrigger>
                                <SelectValue placeholder="Mes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los meses</SelectItem>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                        {new Date(0, i).toLocaleString('es', { month: 'long' })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </FilterBar>

                {/* View Mode Segmented Controls */}
                <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border/60">
                        <Button
                            variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('grouped')}
                            className="h-7 text-xs font-medium gap-1.5 px-3"
                        >
                            <FolderKanban className="w-3.5 h-3.5" />
                            Agrupadas por Presupuesto / Concepto
                        </Button>
                        <Button
                            variant={viewMode === 'flat' ? 'default' : 'ghost'}
                            size="sm"
                            onClick={() => setViewMode('flat')}
                            className="h-7 text-xs font-medium gap-1.5 px-3"
                        >
                            <List className="w-3.5 h-3.5" />
                            Lista Plana
                        </Button>
                    </div>

                    {viewMode === 'grouped' && invoiceGroups.length > 0 && (
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleExpandAll}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                                Expandir todos
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCollapseAll}
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            >
                                Colapsar todos
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Invoices Rendering */}
            {isLoading ? (
                <TableSkeleton rows={5} columns={7} />
            ) : invoices.length === 0 ? (
                <EmptyState icon={FileText} message="No se encontraron facturas para los filtros seleccionados" variant="inline" />
            ) : viewMode === 'grouped' ? (
                /* ═══════════════════════════════════════════════════════════════════
                   GROUPED VIEW (Agrupadas por Presupuesto / Concepto)
                   ═══════════════════════════════════════════════════════════════════ */
                <div className="space-y-4">
                    {invoiceGroups.map((group) => {
                        const isExpanded = expandedGroupIds.has(group.id);
                        const isWater = /cisterna/i.test(group.title);
                        const isAllPaid = group.paidCount === group.count && group.count > 0;

                        return (
                            <Card
                                key={group.id}
                                className={`border transition-all overflow-hidden ${
                                    isExpanded ? 'shadow-md border-border' : 'border-border/70 hover:border-border'
                                }`}
                            >
                                {/* Group Header Accordion */}
                                <div
                                    onClick={() => toggleGroup(group.id)}
                                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                                >
                                    {/* Left: Icon, Title, Badges */}
                                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                                        <div
                                            className={`p-2.5 rounded-xl border shrink-0 ${
                                                group.isBudget
                                                    ? 'bg-primary/10 border-primary/20 text-primary'
                                                    : isWater
                                                    ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400'
                                                    : 'bg-muted border-border text-muted-foreground'
                                            }`}
                                        >
                                            {group.isBudget ? (
                                                <Calculator className="h-5 w-5" />
                                            ) : isWater ? (
                                                <Droplets className="h-5 w-5" />
                                            ) : (
                                                <Layers className="h-5 w-5" />
                                            )}
                                        </div>

                                        <div className="min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-bold text-base font-display text-foreground truncate">
                                                    {group.title}
                                                </h3>
                                                {group.baseBudget && (
                                                    <Badge className="bg-primary/15 text-primary border-primary/30 font-mono text-[11px]">
                                                        Presupuesto: ${group.baseBudget.toFixed(2)} USD
                                                    </Badge>
                                                )}
                                                {isAllPaid && (
                                                    <Badge className="bg-emerald-600 text-white text-[10px]">
                                                        100% Recaudado
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                                <span>{group.count} unidades / facturas</span>
                                                <span>•</span>
                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                    {group.paidCount} pagadas
                                                </span>
                                                {group.pendingCount > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                            {group.pendingCount} pendientes
                                                        </span>
                                                    </>
                                                )}
                                                {group.details && (
                                                    <span className="hidden lg:inline text-[11px] italic truncate max-w-md">
                                                        ({group.details})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Financial Aggregates & Actions */}
                                    <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                                        <div className="text-right">
                                            <div className="font-mono font-bold text-base text-foreground">
                                                {formatCurrency(group.totalAmount)}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center justify-end gap-1.5">
                                                <span>Cobrado: {formatCurrency(group.totalPaid)}</span>
                                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                                    ({group.progress}%)
                                                </span>
                                            </div>
                                            <div className="w-32 mt-1 hidden sm:block">
                                                <Progress value={group.progress} className="h-1.5" />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {(isSuperAdmin || isBoardMember) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenCreateForBudget(group);
                                                    }}
                                                    className="h-8 px-2.5 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                                                    title="Agregar una factura individual a este presupuesto"
                                                >
                                                    <Plus className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">Agregar Factura</span>
                                                </Button>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Invoices Table */}
                                {isExpanded && (
                                    <div className="border-t border-border bg-card/40 animate-in fade-in-50 duration-150">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30">
                                                    <TableHead className="text-xs">Número / Recibo</TableHead>
                                                    <TableHead className="text-xs">Unidad / Propietario</TableHead>
                                                    <TableHead className="text-xs">Alícuota</TableHead>
                                                    <TableHead className="text-xs">Período</TableHead>
                                                    <TableHead className="text-xs">Monto ($ USD)</TableHead>
                                                    <TableHead className="text-xs">Progreso</TableHead>
                                                    <TableHead className="text-xs">Estado</TableHead>
                                                    <TableHead className="text-xs text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {group.invoices.map((invoice) => {
                                                    const progress =
                                                        invoice.amount > 0
                                                            ? (invoice.paid_amount / invoice.amount) * 100
                                                            : 0;
                                                    const coprop = getGranadaCoproprietor(invoice.unit?.name || '');
                                                    const unitDisplayName = coprop
                                                        ? `Apartamento ${coprop.apto}`
                                                        : invoice.unit?.name || 'Unidad desconocida';
                                                    const ownerDisplayName =
                                                        invoice.user?.name || coprop?.propietario || 'Copropietario';
                                                    const aliquotVal =
                                                        coprop?.aliquot ?? (invoice.unit?.aliquot || 0);

                                                    return (
                                                        <TableRow
                                                            key={invoice.id}
                                                            className="cursor-pointer group hover:bg-muted/40"
                                                            onClick={() => {
                                                                setSelectedInvoiceId(invoice.id);
                                                                setIsDetailsOpen(true);
                                                            }}
                                                        >
                                                            <TableCell className="font-mono text-xs">
                                                                {invoice.number || invoice.receipt_number || '--'}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="font-semibold text-xs group-hover:text-primary transition-colors flex items-center gap-1.5">
                                                                    {unitDisplayName}
                                                                    {coprop && (
                                                                        <span className="text-[10px] text-muted-foreground font-normal">
                                                                            ({invoice.unit?.name})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-muted-foreground">
                                                                    {ownerDisplayName}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs font-mono text-muted-foreground">
                                                                {aliquotVal > 0 ? `${aliquotVal.toFixed(4)}%` : '--'}
                                                            </TableCell>
                                                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                                                                {invoice.period ||
                                                                    (invoice.year && invoice.month
                                                                        ? `${invoice.year}-${String(invoice.month).padStart(2, '0')}`
                                                                        : '--')}
                                                            </TableCell>
                                                            <TableCell className="tabular-nums">
                                                                <div className="font-semibold text-xs">
                                                                    {formatCurrency(invoice.amount)}
                                                                </div>
                                                                {invoice.paid_amount > 0 &&
                                                                    invoice.paid_amount < invoice.amount && (
                                                                        <div className="text-[10px] text-chart-1">
                                                                            Pagado: {formatCurrency(invoice.paid_amount)}
                                                                        </div>
                                                                    )}
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="w-20">
                                                                    <Progress value={progress} className="h-1.5" />
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                                                                    {Math.round(progress)}%
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <StatusBadge status={invoice.status} />
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-1">
                                                                    {invoice.status === 'PAID' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setReceiptInvoice(invoice);
                                                                                setIsReceiptOpen(true);
                                                                            }}
                                                                            title="Descargar Factura / Recibo Oficial"
                                                                            className="h-8 px-2 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 hover:bg-emerald-500/10 font-semibold"
                                                                        >
                                                                            <Receipt className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Recibo
                                                                        </Button>
                                                                    )}
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setAvisoInvoice(invoice);
                                                                            setIsAvisoOpen(true);
                                                                        }}
                                                                        title="Ver Aviso de Cobro"
                                                                        className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                                                    >
                                                                        <Printer className="h-3.5 w-3.5 mr-1" /> Aviso
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedInvoiceId(invoice.id);
                                                                            setIsDetailsOpen(true);
                                                                        }}
                                                                        className="h-8 px-2 text-xs"
                                                                    >
                                                                        <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            ) : (
                /* ═══════════════════════════════════════════════════════════════════
                   FLAT TABLE VIEW (Lista Plana Tradicional)
                   ═══════════════════════════════════════════════════════════════════ */
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número / Recibo</TableHead>
                            <TableHead>Unidad / Usuario</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Progreso</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => {
                            const progress =
                                invoice.amount > 0 ? (invoice.paid_amount / invoice.amount) * 100 : 0;
                            const coprop = getGranadaCoproprietor(invoice.unit?.name || '');
                            const unitDisplayName = coprop
                                ? `Apartamento ${coprop.apto}`
                                : invoice.unit?.name || 'Unidad desconocida';
                            const ownerDisplayName =
                                invoice.user?.name || coprop?.propietario || 'Copropietario';

                            return (
                                <TableRow
                                    key={invoice.id}
                                    className="cursor-pointer group"
                                    onClick={() => {
                                        setSelectedInvoiceId(invoice.id);
                                        setIsDetailsOpen(true);
                                    }}
                                >
                                    <TableCell className="font-medium font-mono text-xs">
                                        {invoice.number || invoice.receipt_number || '--'}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold group-hover:text-primary transition-colors flex items-center gap-1.5">
                                            {unitDisplayName}
                                            {coprop && (
                                                <span className="text-[10px] text-muted-foreground font-normal">
                                                    ({invoice.unit?.name})
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{ownerDisplayName}</div>
                                    </TableCell>
                                    <TableCell className="text-xs max-w-xs truncate text-muted-foreground">
                                        {invoice.description || '--'}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground tabular-nums text-xs">
                                        {invoice.period ||
                                            (invoice.year && invoice.month
                                                ? `${invoice.year}-${String(invoice.month).padStart(2, '0')}`
                                                : '--')}
                                    </TableCell>
                                    <TableCell className="tabular-nums">
                                        <div className="font-semibold">{formatCurrency(invoice.amount)}</div>
                                        {invoice.paid_amount > 0 && invoice.paid_amount < invoice.amount && (
                                            <div className="text-[10px] text-chart-1">
                                                Pagado: {formatCurrency(invoice.paid_amount)}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="w-24">
                                            <Progress value={progress} className="h-1.5" />
                                        </div>
                                        <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                                            {Math.round(progress)}%
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={invoice.status} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {invoice.status === 'PAID' && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReceiptInvoice(invoice);
                                                        setIsReceiptOpen(true);
                                                    }}
                                                    title="Descargar Factura / Recibo Oficial"
                                                    className="h-8 px-2 text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 hover:bg-emerald-500/10 font-semibold"
                                                >
                                                    <Receipt className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Recibo
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setAvisoInvoice(invoice);
                                                    setIsAvisoOpen(true);
                                                }}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <Printer className="h-3.5 w-3.5 mr-1" /> Aviso
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedInvoiceId(invoice.id);
                                                    setIsDetailsOpen(true);
                                                }}
                                                className="h-8 px-2 text-xs"
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}

            {/* Modals & Dialogs */}
            <InvoiceDialog
                open={isInvoiceDialogOpen}
                onOpenChange={setIsInvoiceDialogOpen}
                buildingId={buildingId}
                initialBudgetOption={selectedBudgetForNewInvoice}
                existingInvoices={invoices}
                onSuccess={fetchData}
            />

            <ExcelInvoiceLoader
                open={isExcelLoaderOpen}
                onOpenChange={setIsExcelLoaderOpen}
                buildingId={buildingId}
                buildings={[]}
                onSuccess={fetchData}
            />

            <InvoiceDetailsDialog
                isOpen={isDetailsOpen}
                onClose={() => {
                    setIsDetailsOpen(false);
                    fetchData();
                }}
                invoiceId={selectedInvoiceId}
                onPaymentApproved={fetchData}
            />

            <AvisoDeCobroDialog
                open={isAvisoOpen}
                onOpenChange={setIsAvisoOpen}
                invoice={avisoInvoice}
            />

            <InvoiceReceiptDialog
                open={isReceiptOpen}
                onOpenChange={setIsReceiptOpen}
                invoice={receiptInvoice}
                buildingName="Edificio Granada"
            />

            <GenerateByAliquotDialog
                open={isAliquotDialogOpen}
                onOpenChange={setIsAliquotDialogOpen}
                buildingId={buildingId}
                units={units}
                onSuccess={fetchData}
            />

            <AliquotTableDialog
                open={isTableDialogOpen}
                onOpenChange={setIsTableDialogOpen}
                buildingId={buildingId}
                units={units}
                onUnitsUpdated={fetchData}
                onOpenBillingDialog={() => setIsAliquotDialogOpen(true)}
            />
        </div>
    );
}
