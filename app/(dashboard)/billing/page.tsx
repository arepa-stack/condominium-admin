'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingService } from '@/lib/services/billing.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
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
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/utils/format';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useRouter, useSearchParams } from 'next/navigation';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
import { ExcelInvoiceLoader } from '@/components/billing/ExcelInvoiceLoader';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Eye, Building2, Plus, FileSpreadsheet, Home, FileText } from 'lucide-react';
import type { Invoice, Building, Unit } from '@/types/models';

export default function BillingPage() {
    const { isSuperAdmin, isBoardMember, user, buildingId } = usePermissions();
    const { availableBuildings } = useBuildingContext();
    const router = useRouter();

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [isExcelLoaderOpen, setIsExcelLoaderOpen] = useState(false);

    // Filters
    const [filterBuildingId, setFilterBuildingId] = useState<string>('all');
    const [filterUnitId, setFilterUnitId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterMonth, setFilterMonth] = useState<string>('all');
    const searchParams = useSearchParams();

    // Determine active building ID for both UI and Data loading
    const activeBuildingId = isSuperAdmin
        ? (filterBuildingId !== 'all' ? filterBuildingId : undefined)
        : (filterBuildingId !== 'all' ? filterBuildingId : buildingId);

    // Initial filter setup from query params
    useEffect(() => {
        const bId = searchParams.get('building_id');
        const uId = searchParams.get('unit_id');
        const year = searchParams.get('year');
        const month = searchParams.get('month');
        const status = searchParams.get('status');

        if (bId) setFilterBuildingId(bId);
        if (uId) setFilterUnitId(uId);
        if (year) setFilterYear(year);
        if (month) setFilterMonth(month);
        if (status) setFilterStatus(status);
    }, [searchParams]);

    // Sync filterBuildingId with buildingId for board members on init
    useEffect(() => {
        if (!isSuperAdmin && buildingId && (filterBuildingId === 'all' || !filterBuildingId)) {
            setFilterBuildingId(buildingId);
        }
    }, [buildingId, isSuperAdmin, filterBuildingId]);

    // Reset unit filter when building changes
    useEffect(() => {
        setFilterUnitId('all');
    }, [filterBuildingId, isSuperAdmin]);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Build query params
            const query: any = {};
            if (activeBuildingId) query.building_id = activeBuildingId;
            if (filterUnitId && filterUnitId !== 'all') query.unit_id = filterUnitId;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;
            if (filterYear) query.year = parseInt(filterYear);
            if (filterMonth && filterMonth !== 'all') query.month = parseInt(filterMonth);

            const promises: Promise<any>[] = [
                billingService.getInvoices(query),
                isSuperAdmin ? buildingsService.getBuildings() : Promise.resolve([])
            ];

            if (activeBuildingId) {
                promises.push(unitsService.getUnits(activeBuildingId));
            } else {
                promises.push(Promise.resolve([]));
            }

            const [invoicesData, buildingsData, unitsData] = await Promise.all(promises);

            setInvoices(invoicesData);
            setBuildings(buildingsData);
            setUnits(unitsData);

        } catch (error) {
            console.error('Failed to fetch billing data:', error);
            toast.error('Error al cargar las facturas');
        } finally {
            setIsLoading(false);
        }
    }, [isSuperAdmin, activeBuildingId, filterUnitId, filterStatus, filterYear, filterMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Facturación</h1>
                    <p className="text-muted-foreground mt-1">Gestioná facturas y deudas</p>
                </div>
                {(isSuperAdmin || isBoardMember) && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsExcelLoaderOpen(true)}
                            className="gap-2 border-chart-1/30 text-chart-1 hover:bg-chart-1/10"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Importar Excel
                        </Button>
                        <Button onClick={() => setIsInvoiceDialogOpen(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Crear Factura
                        </Button>
                    </div>
                )}
            </div>

            <FilterBar>
                {isSuperAdmin && (
                    <div className="w-full md:w-64">
                        <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todos los edificios" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los edificios</SelectItem>
                                {buildings.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {(isBoardMember && !isSuperAdmin) && (
                    <div className="w-full md:w-64">
                        <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                            <SelectTrigger>
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <SelectValue placeholder="Seleccionar edificio" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {availableBuildings.map((b: any) => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="w-full md:w-56">
                    <SearchableSelect
                        options={[
                            { value: 'all', label: 'Todas las unidades' },
                            ...units.map(u => ({
                                value: u.id,
                                label: u.name,
                                icon: Home
                            }))
                        ]}
                        value={filterUnitId}
                        onValueChange={setFilterUnitId}
                        placeholder="Todas las unidades"
                        searchPlaceholder="Buscar unidad..."
                        disabled={!activeBuildingId && isSuperAdmin}
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
                            <SelectItem value="PARTIAL">Parcial</SelectItem>
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

            {isLoading ? (
                <TableSkeleton rows={5} columns={7} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Unidad / Usuario</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Progreso</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <EmptyState icon={FileText} message="No se encontraron facturas" variant="inline" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            invoices.map((invoice) => {
                                const progress = (invoice.paid_amount / invoice.amount) * 100;
                                return (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.number || invoice.receipt_number || '--'}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{invoice.unit?.name || 'Unidad desconocida'}</div>
                                            <div className="text-xs text-muted-foreground">{invoice.user?.name}</div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">
                                            {invoice.period || (invoice.year && invoice.month ? `${invoice.year}-${String(invoice.month).padStart(2, '0')}` : '--')}
                                        </TableCell>
                                        <TableCell>
                                            <div>{formatCurrency(invoice.amount)}</div>
                                            {invoice.paid_amount > 0 && invoice.paid_amount < invoice.amount && (
                                                <div className="text-xs text-chart-1">Pagado: {formatCurrency(invoice.paid_amount)}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="w-24">
                                                <Progress value={progress} className="h-2" />
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-1 text-center">{Math.round(progress)}%</div>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={invoice.status} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" onClick={() => router.push(`/billing/invoices/${invoice.id}`)}>
                                                <Eye className="h-4 w-4 mr-1" /> Ver
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            )}

            <InvoiceDialog
                open={isInvoiceDialogOpen}
                onOpenChange={setIsInvoiceDialogOpen}
                buildingId={isSuperAdmin ? (filterBuildingId !== 'all' ? filterBuildingId : undefined) : buildingId}
                onSuccess={fetchData}
            />

            <ExcelInvoiceLoader
                open={isExcelLoaderOpen}
                onOpenChange={setIsExcelLoaderOpen}
                buildingId={isSuperAdmin ? (filterBuildingId !== 'all' ? filterBuildingId : undefined) : buildingId}
                buildings={buildings}
                onSuccess={fetchData}
            />
        </div >
    );
}
