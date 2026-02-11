'use client';

import { useEffect, useState, useCallback } from 'react';
import { billingService } from '@/lib/services/billing.service';
import { unitsService } from '@/lib/services/units.service';
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
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { InvoiceDialog } from '@/components/billing/InvoiceDialog';
import { InvoiceDetailsDialog } from '@/components/billing/InvoiceDetailsDialog';
import { ExcelInvoiceLoader } from '@/components/billing/ExcelInvoiceLoader';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Eye, Plus, FileSpreadsheet, Home } from 'lucide-react';
import type { Invoice, Unit } from '@/types/models';

export default function BuildingBillingPage() {
    const { isSuperAdmin, isBoardMember, user } = usePermissions();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const buildingId = params.id as string;

    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [isExcelLoaderOpen, setIsExcelLoaderOpen] = useState(false);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
                unitsService.getUnits(buildingId)
            ]);

            setInvoices(invoicesData);
            setUnits(unitsData);

        } catch (error) {
            console.error('Failed to fetch billing data:', error);
            toast.error('Failed to load invoices');
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterUnitId, filterStatus, filterYear, filterMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PAID': return 'bg-green-500 hover:bg-green-600';
            case 'PENDING': return 'bg-yellow-500 hover:bg-yellow-600';
            case 'CANCELLED': return 'bg-gray-500 hover:bg-gray-600';
            default: return 'bg-gray-500';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight text-white">Billing</h1>
                    <p className="text-muted-foreground mt-1">Manage invoices and debts for this building</p>
                </div>
                {(isSuperAdmin || isBoardMember) && (
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setIsExcelLoaderOpen(true)}
                            className="gap-2 border-green-600/20 text-green-400 hover:bg-green-500/10 hover:text-green-300 backdrop-blur-sm"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Import Excel
                        </Button>
                        <Button onClick={() => setIsInvoiceDialogOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
                            <Plus className="h-4 w-4" />
                            Create Invoice
                        </Button>
                    </div>
                )}
            </div>

            {/* Filters */}
            <Card className="p-4 border-white/5 bg-card/50 backdrop-blur-xl">
                <div className="flex flex-wrap gap-4">
                    <div className="w-full md:w-64">
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
                            triggerIcon={Home}
                        />
                    </div>
                    <div className="w-full md:w-40">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="bg-background/50 border-white/5">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="PAID">Paid</SelectItem>
                                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-32">
                        <Select value={filterYear} onValueChange={setFilterYear}>
                            <SelectTrigger className="bg-background/50 border-white/5">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="2024">2024</SelectItem>
                                <SelectItem value="2025">2025</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-32">
                        <Select value={filterMonth} onValueChange={setFilterMonth}>
                            <SelectTrigger className="bg-background/50 border-white/5">
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

            <Card className="border-white/5 bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unit / User</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                            <span>Loading invoices...</span>
                                        </div>
                                    </td></tr>
                                ) : invoices.length === 0 ? (
                                    <tr><td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">No invoices found.</td></tr>
                                ) : (
                                    invoices.map((invoice) => {
                                        const progress = (invoice.paid_amount / invoice.amount) * 100;
                                        return (
                                            <tr
                                                key={invoice.id}
                                                className="hover:bg-white/5 transition-colors group cursor-pointer"
                                                onClick={() => {
                                                    setSelectedInvoiceId(invoice.id);
                                                    setIsDetailsOpen(true);
                                                }}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{invoice.number}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{invoice.unit?.name || 'Unknown Unit'}</div>
                                                    <div className="text-xs text-muted-foreground">{invoice.user?.name}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                                                    {invoice.year}-{invoice.month.toString().padStart(2, '0')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm tabular-nums">
                                                    <div className="font-semibold text-white">{formatCurrency(invoice.amount)}</div>
                                                    {invoice.paid_amount > 0 && invoice.paid_amount < invoice.amount && (
                                                        <div className="text-[10px] text-green-400">Paid: {formatCurrency(invoice.paid_amount)}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap align-middle">
                                                    <div className="w-24">
                                                        <Progress value={progress} className="h-1.5" />
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">{Math.round(progress)}%</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <Badge className={`${getStatusColor(invoice.status)} text-white border-0 shadow-sm`}>
                                                        {invoice.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                                    <Button variant="ghost" size="sm" onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedInvoiceId(invoice.id);
                                                        setIsDetailsOpen(true);
                                                    }} className="hover:bg-primary/20 hover:text-primary">
                                                        <Eye className="h-4 w-4 mr-2" /> View
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
                buildingId={buildingId}
                onSuccess={fetchData}
            />

            <ExcelInvoiceLoader
                open={isExcelLoaderOpen}
                onOpenChange={setIsExcelLoaderOpen}
                buildingId={buildingId}
                buildings={[]} // Not needed in contextual view or could fetch if needed
                onSuccess={fetchData}
            />
            <InvoiceDetailsDialog
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                invoiceId={selectedInvoiceId}
            />
        </div >
    );
}
