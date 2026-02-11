'use client';

import { useCallback, useEffect, useState } from 'react';
import { paymentsService } from '@/lib/services/payments.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
import { billingService } from '@/lib/services/billing.service';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import type { Payment, Unit } from '@/types/models';
import { formatCurrency, formatDate, formatPaymentMethod, formatPeriod } from '@/lib/utils/format';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Eye, CheckCircle, XCircle, Info, Home, DollarSign, Loader2 } from 'lucide-react';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import Image from 'next/image';
import { useParams } from 'next/navigation';

export default function BuildingPaymentsPage() {
    const { isSuperAdmin, isBoardMember, user } = usePermissions();
    const params = useParams();
    const buildingId = params.id as string;

    const [payments, setPayments] = useState<Payment[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterUnitId, setFilterUnitId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterPeriod, setFilterPeriod] = useState<string>('');

    // Proof Dialog
    const [proofUrl, setProofUrl] = useState<string | null>(null);

    // Approval Dialog State
    const [approvalPayment, setApprovalPayment] = useState<Payment | null>(null);
    const [availablePeriods, setAvailablePeriods] = useState<string[]>([]);
    const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
    const [paymentAllocations, setPaymentAllocations] = useState<any[]>([]);
    const [isAllocationsLoading, setIsAllocationsLoading] = useState(false);


    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            const query: Record<string, string> = {
                building_id: buildingId,
                year: filterYear
            };

            if (filterUnitId && filterUnitId !== 'all') query.unit_id = filterUnitId;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;
            if (filterPeriod) query.period = filterPeriod;

            const [paymentsData, unitsData] = await Promise.all([
                paymentsService.getPayments(query),
                unitsService.getUnits(buildingId)
            ]);

            setPayments(paymentsData);
            setUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to fetch payments');
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterUnitId, filterStatus, filterPeriod, filterYear]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openApprovalDialog = async (payment: Payment) => {
        setApprovalPayment(payment);
        setDetailedPayment(null);
        setPaymentAllocations([]);
        setIsAllocationsLoading(true);

        try {
            // Parallel fetch: basic payment details AND real allocations from the new endpoint
            const [detailed, allocations] = await Promise.all([
                paymentsService.getPaymentById(payment.id),
                billingService.getPaymentInvoices(payment.id)
            ]);
            setDetailedPayment(detailed);
            setPaymentAllocations(allocations);
            const periods = detailed.periods || (detailed.period ? [detailed.period] : []);
            setAvailablePeriods(periods);
            setSelectedPeriods(periods);
        } catch (e) {
            console.error("Failed to fetch payment details or allocations", e);
            // Fallback: try to just show detailed payment if allocations fail
            try {
                const detailed = await paymentsService.getPaymentById(payment.id);
                setDetailedPayment(detailed);
            } catch (inner) {
                toast.error("Could not load payment details");
                setApprovalPayment(null);
            }
        } finally {
            setIsAllocationsLoading(false);
        }
    };

    const togglePeriod = (period: string) => {
        setSelectedPeriods(prev =>
            prev.includes(period)
                ? prev.filter(p => p !== period)
                : [...prev, period]
        );
    };

    const handleConfirmApprove = async () => {
        if (!approvalPayment) return;

        try {
            const isSubset = selectedPeriods.length < availablePeriods.length;
            const periodsToSend = isSubset ? selectedPeriods : undefined;

            await paymentsService.approvePayment(approvalPayment.id, undefined, periodsToSend);
            toast.success('Payment approved successfully');
            setApprovalPayment(null);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Failed to approve payment');
        }
    };

    const handleReject = async (paymentId: string) => {
        const reason = prompt('Reason for rejection:');
        if (reason === null) return;

        try {
            await paymentsService.rejectPayment(paymentId, reason);
            toast.success('Payment rejected');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Failed to reject payment');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight text-white">Payments</h1>
                    <p className="text-muted-foreground mt-1">Review and manage payments for this building</p>
                </div>
                <Button onClick={() => setIsPaymentDialogOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all">
                    <DollarSign className="h-4 w-4" />
                    Register Payment
                </Button>
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
                    <div className="w-full md:w-48">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="bg-background/50 border-white/5">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="PENDING">Pending</SelectItem>
                                <SelectItem value="APPROVED">Approved</SelectItem>
                                <SelectItem value="REJECTED">Rejected</SelectItem>
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
                    <div className="w-full md:w-48">
                        <Input
                            placeholder="Period (e.g. 2024-01)"
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value)}
                            className="bg-background/50 border-white/5"
                        />
                    </div>
                </div>
            </Card>

            <Card className="border-white/5 bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">User / Unit</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Period</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ref / Method</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proof</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                                <span>Loading payments...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : payments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">No payments found.</td>
                                    </tr>
                                ) : (
                                    payments.map((payment) => (
                                        <tr
                                            key={payment.id}
                                            className="hover:bg-white/5 transition-colors group cursor-pointer"
                                            onClick={() => openApprovalDialog(payment)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                                                {formatDate(payment.payment_date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="font-semibold text-white">{payment.user?.name || 'Unknown'}</div>
                                                <span className="text-xs text-muted-foreground">
                                                    {(() => {
                                                        const unitId = payment.unit_id || payment.user?.unit_id;
                                                        // Try to find unit name in local units list
                                                        const unitName = unitId ? units.find(u => u.id === unitId)?.name : null;
                                                        // Fallback to user's unit_name from units array if exists
                                                        const userUnitName = payment.user?.units?.find(u => u.unit_id === unitId)?.unit_name;
                                                        const finalUnitName = unitName || userUnitName || payment.user?.unit;
                                                        return finalUnitName ? `Unit ${finalUnitName}` : '';
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-white tabular-nums">
                                                {formatCurrency(payment.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                                                {payment.period || (payment.periods && payment.periods.length > 0 ? payment.periods.join(', ') : '-')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                <div className="text-white font-medium">{formatPaymentMethod(payment.method)}</div>
                                                <span className="text-xs">{payment.reference}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {payment.proof_url ? (
                                                    <Button variant="ghost" size="sm" onClick={() => setProofUrl(payment.proof_url!)} className="hover:bg-primary/20 hover:text-primary">
                                                        <Eye className="h-4 w-4 mr-2" /> View
                                                    </Button>
                                                ) : <span className="text-muted-foreground text-xs italic">No proof</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge
                                                    className={
                                                        payment.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                            payment.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                                                'bg-red-500/20 text-red-400 border-red-500/30'
                                                    }
                                                >
                                                    {payment.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex justify-end gap-2">
                                                    {payment.status === 'PENDING' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => openApprovalDialog(payment)}
                                                                className="bg-green-600 hover:bg-green-500 text-white h-8 w-8 p-0 rounded-lg shadow-lg shadow-green-600/20"
                                                            >
                                                                <CheckCircle className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="destructive"
                                                                onClick={() => handleReject(payment.id)}
                                                                className="h-8 w-8 p-0 rounded-lg shadow-lg shadow-red-600/20"
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                    <Button variant="ghost" size="sm" onClick={() => openApprovalDialog(payment)} className="h-8 w-8 p-0 hover:bg-white/10">
                                                        <Info className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Proof Dialog */}
            <Dialog open={!!proofUrl} onOpenChange={(open) => !open && setProofUrl(null)}>
                <DialogContent className="max-w-3xl bg-card border-white/10 backdrop-blur-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">Payment Proof</DialogTitle>
                    </DialogHeader>
                    {proofUrl && (
                        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-white/5 shadow-2xl">
                            <Image
                                src={proofUrl}
                                alt="Payment Proof"
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Approval Dialog */}
            <Dialog open={!!approvalPayment} onOpenChange={(open) => !open && setApprovalPayment(null)}>
                <DialogContent className="sm:max-w-[500px] bg-card border-white/10 backdrop-blur-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">Review Payment</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Verify the details and allocations before approving.
                        </DialogDescription>
                    </DialogHeader>

                    {!detailedPayment ? (
                        <div className="py-12 flex justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        </div>
                    ) : (
                        <div className="py-4 space-y-6">
                            <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-white/5 border border-white/5">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-1">Amount</span>
                                    <span className="text-2xl font-black text-white">{formatCurrency(detailedPayment.amount)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block mb-1">Method</span>
                                    <span className="text-lg font-semibold text-white">{formatPaymentMethod(detailedPayment.method)}</span>
                                </div>
                            </div>

                            {isAllocationsLoading ? (
                                <div className="py-8 flex justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                                </div>
                            ) : paymentAllocations.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="flex items-center gap-2 font-black text-xs text-primary uppercase tracking-widest">
                                        <Info className="h-4 w-4" />
                                        Impacted Invoices
                                    </h3>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {paymentAllocations.map(alloc => (
                                            <div key={alloc.id} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-white">Invoice #{alloc.receipt_number || alloc.number || alloc.id.slice(0, 8)}</span>
                                                    <span className="text-[9px] text-muted-foreground uppercase">
                                                        {alloc.period ? formatPeriod(alloc.period) : (alloc.year && alloc.month ? formatPeriod(`${alloc.year}-${alloc.month}`) : '--')}
                                                    </span>
                                                </div>
                                                <span className="font-black text-sm text-primary tabular-nums">{formatCurrency(alloc.allocated_amount || alloc.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {availablePeriods.length > 0 && (
                                <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                                    <h4 className="font-bold text-sm text-white flex items-center justify-between">
                                        <span>Indicated Periods</span>
                                        <Badge variant="outline" className="text-[10px] uppercase border-primary/20 text-primary">Informative</Badge>
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {availablePeriods.map((period) => (
                                            <div key={period} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    id={period}
                                                    checked={selectedPeriods.includes(period)}
                                                    onChange={() => togglePeriod(period)}
                                                    className="w-4 h-4 rounded border-white/10 bg-black/20 text-primary focus:ring-primary/20 cursor-pointer"
                                                />
                                                <label htmlFor={period} className="text-sm font-medium text-white cursor-pointer select-none">
                                                    {period}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                        <Button variant="ghost" onClick={() => setApprovalPayment(null)} className="text-muted-foreground hover:text-white">Cancel</Button>
                        {detailedPayment?.status === 'PENDING' && (
                            <Button onClick={handleConfirmApprove} disabled={!detailedPayment} className="shadow-lg shadow-primary/20 px-8">
                                Approve Payment
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <PaymentDialog
                open={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                buildingId={buildingId}
                onSuccess={fetchData}
            />
        </div>
    );
}
