'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingService } from '@/lib/services/billing.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useRouter, useSearchParams } from 'next/navigation';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
import { ExcelInvoiceLoader } from '@/components/billing/ExcelInvoiceLoader';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Eye, Building2, Plus, FileSpreadsheet, Home } from 'lucide-react';
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
            toast.error('Failed to load invoices');
        } finally {
            setIsLoading(false);
        }
    }, [isSuperAdmin, activeBuildingId, filterUnitId, filterStatus, filterYear, filterMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-green-500 hover:bg-green-600';
            case 'PARTIAL': return 'bg-amber-500 hover:bg-amber-600';
            case 'PENDING': return 'bg-yellow-500 hover:bg-yellow-600'; // Make sure text is readable if using standard badge
            case 'CANCELLED': return 'bg-gray-500 hover:bg-gray-600';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Billing</h1>
                    <p className="text-muted-foreground mt-1">Manage invoices and debts</p>
                </div>
                {(isSuperAdmin || isBoardMember) && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsExcelLoaderOpen(true)}
                            className="gap-2 border-green-600/20 text-green-600 hover:bg-green-50 hover:text-green-700"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Import Excel
                        </Button>
                        <Button onClick={() => setIsInvoiceDialogOpen(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Create Invoice
                        </Button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <Card className="p-4 border-border/50 bg-card">
                <div className="flex flex-wrap gap-4">
                    {isSuperAdmin && (
                        <div className="w-full md:w-64">
                            <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Buildings" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Buildings</SelectItem>
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
                                        <SelectValue placeholder="Select Building" />
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
                                { value: 'all', label: 'All Units' },
                                ...units.map(u => ({
                                    value: u.id,
                                    label: u.name,
                                    icon: Home
                                }))
                            ]}
                            value={filterUnitId}
                            onValueChange={setFilterUnitId}
                            placeholder="All Units"
                            searchPlaceholder="Search unit..."
                            disabled={!activeBuildingId && isSuperAdmin}
                            triggerIcon={Home}
                        />
                    </div>
                    <div className="w-full md:w-40">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="PARTIAL">Partial</SelectItem>
                                <SelectItem value="PAID">Paid</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-32">
                        <Select value={filterYear} onValueChange={setFilterYear}>
                            <SelectTrigger>
                                <SelectValue placeholder="Year" />
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
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Months</SelectItem>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                        {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            <Card className="border-border/50 bg-card">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Number</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit / User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50 bg-card">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">Loading...</td></tr>
                                ) : invoices.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">No invoices found.</td></tr>
                                ) : (
                                    invoices.map((invoice) => {
                                        const progress = (invoice.paid_amount / invoice.amount) * 100;
                                        return (
                                            <tr key={invoice.id} className="hover:bg-accent/50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{invoice.number || invoice.receipt_number || '--'}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="font-medium">{invoice.unit?.name || 'Unknown Unit'}</div>
                                                    <div className="text-xs text-muted-foreground">{invoice.user?.name}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                    {invoice.period || (invoice.year && invoice.month ? `${invoice.year}-${String(invoice.month).padStart(2, '0')}` : '--')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div>{formatCurrency(invoice.amount)}</div>
                                                    {invoice.paid_amount > 0 && invoice.paid_amount < invoice.amount && (
                                                        <div className="text-xs text-green-600">Paid: {formatCurrency(invoice.paid_amount)}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap align-middle">
                                                    <div className="w-24">
                                                        <Progress value={progress} className="h-2" />
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-1 text-center">{Math.round(progress)}%</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge className={`${getStatusColor(invoice.status)} text-white`}>
                                                        {invoice.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <Button variant="ghost" size="sm" onClick={() => router.push(`/billing/invoices/${invoice.id}`)}>
                                                        <Eye className="h-4 w-4 mr-1" /> View
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

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
