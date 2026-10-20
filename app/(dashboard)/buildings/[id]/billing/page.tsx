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
import { Card } from '@/components/ui/card';
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
import { Paginator } from '@/components/ui/paginator';
import {
    groupInvoicesByBudget,
    parseBudgetFromDescription,
    type BudgetInvoiceGroup,
    type ActiveBudgetOption,
} from '@/lib/utils/budget-helpers';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
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
    FolderKanban,
    List,
    X,
    Filter,
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
    const [filterBudget, setFilterBudget] = useState<string>('all');
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState<string>('all');

    // Pagination for flat table
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Build query params: status is filtered client-side so partial payments and totals are always accurate
            const query: Parameters<typeof billingService.getInvoices>[0] = { building_id: buildingId };
            if (filterUnitId && filterUnitId !== 'all') query.unit_id = filterUnitId;
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
    }, [buildingId, filterUnitId, filterYear, filterMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Extract available budget and concept options from all loaded invoices
    const availableBudgets = useMemo(() => {
        const groups = groupInvoicesByBudget(invoices);
        return groups.map((g) => ({
            id: g.id,
            title: g.title,
            count: g.count,
            isBudget: g.isBudget,
            baseBudget: g.baseBudget,
        }));
    }, [invoices]);

    const budgetOptions = useMemo(() => [
        { value: 'all', label: 'Todos los presupuestos / conceptos' },
        ...availableBudgets.map((b) => ({
            value: b.title,
            label: `${b.title} (${b.count} facturas)`,
            icon: b.isBudget ? Calculator : FolderKanban,
        })),
    ], [availableBudgets]);

    const unitFilterOptions = useMemo(() => [
        { value: 'all', label: 'Todas las unidades' },
        ...units.map((u) => {
            const coprop = getGranadaCoproprietor(u.name);
            const label = coprop
                ? `Apartamento ${coprop.apto} (${u.name}) - ${coprop.propietario}`
                : `Apartamento ${u.name}${u.floor ? ` (Piso ${u.floor})` : ''}`;
            return {
                value: u.id,
                label,
                icon: Home,
            };
        }),
    ], [units]);

    // Reset pagination to first page when any filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filterUnitId, filterBudget, selectedStatuses, filterYear, filterMonth]);

    const toggleStatus = (status: string) => {
        setSelectedStatuses((prev) => {
            if (prev.includes(status)) {
                return prev.filter((s) => s !== status);
            } else {
                return [...prev, status];
            }
        });
    };

    const statusFilterLabel = useMemo(() => {
        if (selectedStatuses.length === 0) return 'Todos los estados';
        if (
            selectedStatuses.length === 2 &&
            selectedStatuses.includes('PAID') &&
            selectedStatuses.includes('PARTIAL')
        ) {
            return 'Pagados + Abonos';
        }
        if (selectedStatuses.length === 1) {
            switch (selectedStatuses[0]) {
                case 'PAID':
                    return 'Solo Pagados 100%';
                case 'PARTIAL':
                    return 'Solo Abonos Parciales';
                case 'PENDING':
                    return 'Pendientes';
                case 'CANCELLED':
                    return 'Cancelados';
            }
        }
        return `${selectedStatuses.length} estados seleccionados`;
    }, [selectedStatuses]);

    // Filter invoices by selected status and budget
    const filteredInvoices = useMemo(() => {
        let result = invoices;

        // 1. Status filter (multi-select combinable)
        if (selectedStatuses.length > 0) {
            result = result.filter((inv) => {
                const isPartial =
                    inv.status === 'PARTIAL' ||
                    (inv.paid_amount > 0 && inv.paid_amount < inv.amount);
                const isPaidFull =
                    (inv.status === 'PAID' && !isPartial) ||
                    (inv.paid_amount >= inv.amount && inv.amount > 0);
                const isPending =
                    inv.status === 'PENDING' &&
                    (!inv.paid_amount || inv.paid_amount === 0);
                const isCancelled = inv.status === 'CANCELLED';

                if (selectedStatuses.includes('PAID') && isPaidFull) return true;
                if (selectedStatuses.includes('PARTIAL') && isPartial) return true;
                if (selectedStatuses.includes('PENDING') && isPending) return true;
                if (selectedStatuses.includes('CANCELLED') && isCancelled) return true;

                return false;
            });
        }

        // 2. Budget filter
        if (filterBudget && filterBudget !== 'all') {
            const target = filterBudget.toLowerCase().trim();
            const isEarthquakeOrRepairsTarget =
                /terremoto|reparaci[oó]n.*pintura|reparaciones mayores|pintura/i.test(
                    target
                );

            result = result.filter((inv) => {
                const parsed = parseBudgetFromDescription(inv.description, inv);
                const groupKey = parsed.title
                    .toLowerCase()
                    .replace(/[^a-z0-9]/g, '-');
                const targetKey = target.replace(/[^a-z0-9]/g, '-');

                if (groupKey === targetKey) return true;
                if (parsed.title.toLowerCase() === target) return true;
                if (
                    inv.description &&
                    inv.description.toLowerCase().includes(target)
                )
                    return true;

                // Specifically handle terremoto and reparaciones mayores / pintura interchangeably
                if (isEarthquakeOrRepairsTarget) {
                    if (
                        inv.description &&
                        /terremoto|reparaci[oó]n.*pintura|reparaciones mayores|pintura/i.test(
                            inv.description
                        )
                    ) {
                        return true;
                    }
                    if (
                        /terremoto|reparaci[oó]n.*pintura|reparaciones mayores|pintura/i.test(
                            parsed.title
                        )
                    ) {
                        return true;
                    }
                }

                return false;
            });
        }

        // 3. Natural unit sort
        return [...result].sort((a, b) => {
            const copropA = getGranadaCoproprietor(a.unit?.name || '');
            const copropB = getGranadaCoproprietor(b.unit?.name || '');
            const aptoA = copropA?.apto || a.unit?.name || '';
            const aptoB = copropB?.apto || b.unit?.name || '';
            return aptoA.localeCompare(aptoB, undefined, { numeric: true });
        });
    }, [invoices, selectedStatuses, filterBudget]);

    // Group invoices based on filtered invoices
    const invoiceGroups = useMemo(() => {
        return groupInvoicesByBudget(filteredInvoices);
    }, [filteredInvoices]);

    // Financial totals across all currently filtered invoices
    const globalSummary = useMemo(() => {
        const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
        const totalPaid = filteredInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
        const totalPending = totalAmount - totalPaid;
        const progress = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
        return {
            totalAmount,
            totalPaid,
            totalPending,
            progress: Math.min(100, Math.round(progress * 10) / 10),
            count: filteredInvoices.length,
        };
    }, [filteredInvoices]);

    // Pagination calculations for flat table
    const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
    const paginatedInvoices = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        return filteredInvoices.slice(startIndex, startIndex + pageSize);
    }, [filteredInvoices, currentPage, pageSize]);

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
                    <div className="w-full md:w-60">
                        <SearchableSelect
                            options={unitFilterOptions}
                            value={filterUnitId}
                            onValueChange={setFilterUnitId}
                            placeholder="Todas las unidades"
                            searchPlaceholder="Buscar unidad (ej. 2-3, 23)..."
                            triggerIcon={Home}
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <SearchableSelect
                            options={budgetOptions}
                            value={filterBudget}
                            onValueChange={setFilterBudget}
                            placeholder="Todos los presupuestos"
                            searchPlaceholder="Filtrar por presupuesto..."
                            triggerIcon={FolderKanban}
                        />
                    </div>
                    <div className="w-full md:w-52">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-between text-xs font-normal h-9 bg-background/50 border-input"
                                >
                                    <span className="flex items-center gap-1.5 truncate">
                                        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="truncate">{statusFilterLabel}</span>
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56">
                                <DropdownMenuLabel className="text-xs">Estado de la Factura</DropdownMenuLabel>
                                <div className="p-1 flex gap-1 border-b border-border/50 mb-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] flex-1 px-1 font-medium text-primary hover:bg-primary/10"
                                        onClick={() => setSelectedStatuses(['PAID', 'PARTIAL'])}
                                    >
                                        Pagados + Abonos
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-[10px] flex-1 px-1 font-medium text-muted-foreground hover:bg-muted"
                                        onClick={() => setSelectedStatuses([])}
                                    >
                                        Todos (Limpiar)
                                    </Button>
                                </div>
                                <DropdownMenuCheckboxItem
                                    checked={selectedStatuses.includes('PAID')}
                                    onCheckedChange={() => toggleStatus('PAID')}
                                    className="text-xs"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Pagados 100%
                                    </span>
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={selectedStatuses.includes('PARTIAL')}
                                    onCheckedChange={() => toggleStatus('PARTIAL')}
                                    className="text-xs"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                                        Abonos Parciales
                                    </span>
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={selectedStatuses.includes('PENDING')}
                                    onCheckedChange={() => toggleStatus('PENDING')}
                                    className="text-xs"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                                        Pendientes por Pagar
                                    </span>
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={selectedStatuses.includes('CANCELLED')}
                                    onCheckedChange={() => toggleStatus('CANCELLED')}
                                    className="text-xs"
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                                        Cancelados
                                    </span>
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="w-full md:w-28">
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

                {/* View Mode Segmented Controls & Active Budget Chip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-lg border border-border/60">
                            <Button
                                variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grouped')}
                                className="h-7 text-xs font-medium gap-1.5 px-3"
                            >
                                <FolderKanban className="w-3.5 h-3.5" />
                                Agrupadas por Presupuesto
                            </Button>
                            <Button
                                variant={viewMode === 'flat' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('flat')}
                                className="h-7 text-xs font-medium gap-1.5 px-3"
                            >
                                <List className="w-3.5 h-3.5" />
                                Lista Plana ({filteredInvoices.length})
                            </Button>
                        </div>

                        {filterBudget !== 'all' && (
                            <Badge variant="outline" className="h-7 text-xs bg-primary/10 text-primary border-primary/30 gap-1 pl-2.5 pr-1 font-normal animate-in fade-in-50">
                                <span className="font-semibold">Presupuesto:</span> {filterBudget}
                                <button
                                    type="button"
                                    onClick={() => setFilterBudget('all')}
                                    className="hover:bg-primary/20 rounded-full p-0.5 ml-0.5"
                                    title="Quitar filtro de presupuesto"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}

                        {selectedStatuses.length > 0 && (
                            <Badge variant="outline" className="h-7 text-xs bg-primary/10 text-primary border-primary/30 gap-1 pl-2.5 pr-1 font-normal animate-in fade-in-50">
                                <span className="font-semibold">Estados:</span> {statusFilterLabel}
                                <button
                                    type="button"
                                    onClick={() => setSelectedStatuses([])}
                                    className="hover:bg-primary/20 rounded-full p-0.5 ml-0.5"
                                    title="Quitar filtro de estados"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        )}
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
            ) : filteredInvoices.length === 0 ? (
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
                                                {group.partialCount > 0 && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                                                            {group.partialCount} con abono
                                                        </span>
                                                    </>
                                                )}
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
                                    <GroupInvoicesTable
                                        invoices={group.invoices}
                                        onSelectInvoice={(id) => {
                                            setSelectedInvoiceId(id);
                                            setIsDetailsOpen(true);
                                        }}
                                        onOpenReceipt={(inv) => {
                                            setReceiptInvoice(inv);
                                            setIsReceiptOpen(true);
                                        }}
                                        onOpenAviso={(inv) => {
                                            setAvisoInvoice(inv);
                                            setIsAvisoOpen(true);
                                        }}
                                    />
                                )}
                            </Card>
                        );
                    })}
                </div>
            ) : (
                /* ═══════════════════════════════════════════════════════════════════
                   FLAT TABLE VIEW (Lista Plana Tradicional)
                   ═══════════════════════════════════════════════════════════════════ */
                <div className="space-y-4">
                    <div className="border border-border/70 rounded-xl overflow-hidden bg-card/60 backdrop-blur-sm">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30">
                                    <TableHead className="text-xs">Número / Recibo</TableHead>
                                    <TableHead className="text-xs">Unidad / Usuario</TableHead>
                                    <TableHead className="text-xs">Concepto</TableHead>
                                    <TableHead className="text-xs">Período</TableHead>
                                    <TableHead className="text-xs">Monto</TableHead>
                                    <TableHead className="text-xs">Progreso</TableHead>
                                    <TableHead className="text-xs">Estado</TableHead>
                                    <TableHead className="text-xs text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedInvoices.map((invoice) => {
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
                                            className="cursor-pointer group hover:bg-muted/40"
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
                    </div>

                    {/* Pagination Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4 px-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Filas por página:</span>
                            <Select
                                value={pageSize.toString()}
                                onValueChange={(val) => {
                                    setPageSize(Number(val));
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="h-8 w-16 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                            <span className="ml-2">
                                Total: {filteredInvoices.length} facturas
                            </span>
                        </div>

                        <Paginator
                            metadata={{
                                page: currentPage,
                                limit: pageSize,
                                total: filteredInvoices.length,
                                totalPages: totalPages,
                                hasNextPage: currentPage < totalPages,
                                hasPrevPage: currentPage > 1,
                            }}
                            isLoading={isLoading}
                            onPageChange={setCurrentPage}
                            className="p-0"
                        />
                    </div>
                </div>
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
                buildingName="Residencias Granada"
                unitName={
                    invoices.find((i) => i.id === selectedInvoiceId)?.unit?.name ||
                    units.find((u) => u.id === invoices.find((i) => i.id === selectedInvoiceId)?.unit_id)?.name
                }
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

interface GroupInvoicesTableProps {
    invoices: Invoice[];
    onSelectInvoice: (id: string) => void;
    onOpenReceipt: (invoice: Invoice) => void;
    onOpenAviso: (invoice: Invoice) => void;
}

function GroupInvoicesTable({
    invoices,
    onSelectInvoice,
    onOpenReceipt,
    onOpenAviso,
}: GroupInvoicesTableProps) {
    const [page, setPage] = useState(1);
    const [showAll, setShowAll] = useState(false);
    const pageSize = 15;
    const totalPages = Math.ceil(invoices.length / pageSize);

    const displayedInvoices = useMemo(() => {
        if (showAll || invoices.length <= pageSize) return invoices;
        return invoices.slice((page - 1) * pageSize, page * pageSize);
    }, [invoices, page, pageSize, showAll]);

    return (
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
                    {displayedInvoices.map((invoice) => {
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
                                onClick={() => onSelectInvoice(invoice.id)}
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
                                                    onOpenReceipt(invoice);
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
                                                onOpenAviso(invoice);
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
                                                onSelectInvoice(invoice.id);
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
            {invoices.length > pageSize && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 border-t border-border/60 text-xs text-muted-foreground bg-muted/20">
                    <div className="flex items-center gap-2">
                        <span>
                            {showAll
                                ? `Mostrando todas las ${invoices.length} facturas`
                                : `Mostrando ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, invoices.length)} de ${invoices.length}`}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAll(!showAll)}
                            className="h-6 text-[11px] px-2 text-primary hover:text-primary/80 font-medium"
                        >
                            {showAll ? 'Paginar (15 por pág)' : 'Ver todas'}
                        </Button>
                    </div>
                    {!showAll && totalPages > 1 && (
                        <div className="flex items-center gap-1.5">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage((p) => p - 1)}
                                className="h-6 px-2 text-xs"
                            >
                                Anterior
                            </Button>
                            <span className="tabular-nums">
                                Página {page} de {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => setPage((p) => p + 1)}
                                className="h-6 px-2 text-xs"
                            >
                                Siguiente
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
