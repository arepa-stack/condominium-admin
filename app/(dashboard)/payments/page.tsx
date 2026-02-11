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
import type { Payment, Building, Unit } from '@/types/models';
import { formatCurrency, formatDate, formatPaymentMethod, formatPeriod } from '@/lib/utils/format';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Eye, CheckCircle, XCircle, Info, Building2, Home, DollarSign, Loader2 } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import Image from 'next/image';

import { useSearchParams } from 'next/navigation';

export default function PaymentsPage() {
    const { isSuperAdmin, isBoardMember, user, buildingId } = usePermissions();
    const searchParams = useSearchParams();
    const userIdParam = searchParams.get('user_id');

    const [payments, setPayments] = useState<Payment[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterBuildingId, setFilterBuildingId] = useState<string>('all');
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

    // Allocations for approval preview (if backend provides them on GET or if we simulate)
    // Actually backend prompt says: "Al revisar un pago (GET /payments/:id), verás... allocations (Real)"
    // So we don't need to fetch extra, just use the payment object or fetch detailed if list doesn't have it.
    // The list GET usually returns light objects. Let's fetch detail on open.
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
    const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
    const [paymentAllocations, setPaymentAllocations] = useState<any[]>([]);
    const [isAllocationsLoading, setIsAllocationsLoading] = useState(false);


    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            // Determine building ID
            let activeBuildingId = undefined;
            if (isSuperAdmin) {
                if (filterBuildingId && filterBuildingId !== 'all') {
                    activeBuildingId = filterBuildingId;
                }
            } else {
                activeBuildingId = buildingId;
            }

            const query: Record<string, string> = {};
            if (activeBuildingId) query.building_id = activeBuildingId;
            if (userIdParam) query.user_id = userIdParam;
            if (filterUnitId && filterUnitId !== 'all') query.unit_id = filterUnitId;
            if (filterYear) query.year = filterYear;

            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;
            if (filterPeriod) query.period = filterPeriod;

            const promises: Promise<any>[] = [
                paymentsService.getPayments(query),
                isSuperAdmin ? buildingsService.getBuildings() : Promise.resolve([])
            ];

            if (activeBuildingId) {
                promises.push(unitsService.getUnits(activeBuildingId));
            } else {
                promises.push(Promise.resolve([]));
            }

            const [paymentsData, buildingsData, unitsData] = await Promise.all(promises);

            let filteredPayments = paymentsData;
            if (userIdParam) {
                filteredPayments = paymentsData.filter((p: Payment) => p.user_id === userIdParam);
            }

            setPayments(filteredPayments);
            setBuildings(buildingsData);
            setUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to fetch payments');
        } finally {
            setIsLoading(false);
        }
    }, [isSuperAdmin, user, filterBuildingId, filterUnitId, filterStatus, filterPeriod, filterYear, userIdParam]);

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

            // Legacy periods support
            const periods = detailed.periods || (detailed.period ? [detailed.period] : []);
            setAvailablePeriods(periods);
            setSelectedPeriods(periods);
        } catch (e) {
            console.error("Failed to fetch payment details or allocations", e);
            // Fallback
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
            // We pass selected periods if legacy support needs it, otherwise backend uses allocations logic
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
                    <h1 className="text-3xl font-bold text-foreground">Payments</h1>
                    <p className="text-muted-foreground mt-1">Manage and review payments</p>
                </div>
                <Button onClick={() => setIsPaymentDialogOpen(true)} className="gap-2">
                    <DollarSign className="h-4 w-4" />
                    Register Payment
                </Button>
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
                                        <SelectItem key={b.id} value={b.id}>
                                            {b.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {(isBoardMember && !isSuperAdmin) && (
                        <div className="w-full md:w-64">
                            <div className="flex items-center px-3 h-10 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
                                <Building2 className="mr-2 h-4 w-4" />
                                Building Scoped
                            </div>
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
                            disabled={!isSuperAdmin && !buildingId && filterBuildingId === 'all'}
                            triggerIcon={Home}
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger>
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
                            <SelectTrigger>
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
                        />
                    </div>
                </div>
            </Card>

            <Card className="border-border/50 bg-card">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Periods (Info)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Ref</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Proof</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50 bg-card">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading payments...</td>
                                    </tr>
                                ) : payments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">No payments found.</td>
                                    </tr>
                                ) : (
                                    payments.map((payment) => (
                                        <tr
                                            key={payment.id}
                                            className="hover:bg-accent/50 transition-colors cursor-pointer group"
                                            onClick={() => openApprovalDialog(payment)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                                {formatDate(payment.payment_date)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                                {payment.user?.name || 'Unknown'} <br />
                                                <span className="text-xs text-muted-foreground">
                                                    {(() => {
                                                        const unitId = payment.unit_id || payment.user?.unit_id;
                                                        const unitName = unitId ? units.find(u => u.id === unitId)?.name : payment.user?.unit;
                                                        return unitName ? `Unit ${unitName}` : '';
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                                {formatCurrency(payment.amount)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {payment.periods ? payment.periods.join(', ') : (payment.period || '-')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {formatPaymentMethod(payment.method)} <br />
                                                <span className="text-xs">{payment.reference}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                                {payment.proof_url ? (
                                                    <Button variant="ghost" size="sm" onClick={() => setProofUrl(payment.proof_url!)}>
                                                        <Eye className="h-4 w-4 mr-1" /> View
                                                    </Button>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge
                                                    className={
                                                        payment.status === 'APPROVED' ? 'bg-green-500 hover:bg-green-600' :
                                                            payment.status === 'PENDING' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' :
                                                                'bg-red-500 hover:bg-red-600'
                                                    }
                                                >
                                                    {payment.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {payment.status === 'PENDING' && (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => openApprovalDialog(payment)}
                                                            className="bg-green-600 hover:bg-green-700 text-white h-8 w-8 p-0"
                                                            title="Approve"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() => handleReject(payment.id)}
                                                            className="h-8 w-8 p-0"
                                                            title="Reject"
                                                        >
                                                            <XCircle className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
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
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Payment Proof</DialogTitle>
                    </DialogHeader>
                    {proofUrl && (
                        <div className="relative w-full h-[600px]">
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
                <DialogContent className="sm:max-w-[500px] bg-background">
                    <DialogHeader>
                        <DialogTitle>Approve Payment</DialogTitle>
                        <DialogDescription>
                            Review details before approving.
                        </DialogDescription>
                    </DialogHeader>

                    {!detailedPayment ? (
                        <div className="py-8 flex justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="py-4 space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-muted-foreground block">Amount</span>
                                    <span className="font-semibold text-lg">{formatCurrency(detailedPayment.amount)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block">Method</span>
                                    <span className="font-medium">{formatPaymentMethod(detailedPayment.method)}</span>
                                </div>
                            </div>

                            {/* Allocations Section (Real Data) */}
                            {isAllocationsLoading ? (
                                <div className="py-8 flex justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                                </div>
                            ) : paymentAllocations.length > 0 && (
                                <div className="bg-muted/30 p-3 rounded-md border border-border/50">
                                    <h4 className="flex items-center gap-2 font-black text-xs mb-2 text-primary uppercase tracking-widest">
                                        <Info className="h-4 w-4" />
                                        Impacted Invoices
                                    </h4>
                                    <ul className="space-y-1">
                                        {paymentAllocations.map(alloc => (
                                            <li key={alloc.id} className="text-[11px] flex justify-between items-center p-2 rounded hover:bg-white/5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-white">Invoice #{alloc.receipt_number || alloc.number || alloc.id.slice(0, 8)}</span>
                                                    <span className="text-[9px] text-muted-foreground uppercase">
                                                        {alloc.period ? formatPeriod(alloc.period) : (alloc.year && alloc.month ? formatPeriod(`${alloc.year}-${alloc.month}`) : '--')}
                                                    </span>
                                                </div>
                                                <span className="font-black text-primary">{formatCurrency(alloc.allocated_amount || alloc.amount)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Legacy Periods Section (Info only if allocations exist, or fallback if not) */}
                            {availablePeriods.length > 0 && (
                                <div className={`p-3 rounded-md border ${(detailedPayment.allocations?.length || 0) > 0
                                    ? 'bg-yellow-50/50 border-yellow-200/50 dark:bg-yellow-900/10'
                                    : 'bg-background'
                                    }`}>
                                    <h4 className="font-medium text-sm mb-2 flex items-center justify-between">
                                        <span>Indicated Periods {(detailedPayment.allocations?.length || 0) > 0 && '(Info Only)'}</span>
                                    </h4>
                                    <div className="grid gap-2">
                                        {availablePeriods.map((period) => (
                                            <div key={period} className="flex items-center space-x-2">
                                                {/* If we have Allocations, we probably shouldn't let them edit periods as it's just info 
                                                     But if backend still relies on legacy, we keep it. 
                                                     Prompt says: "Mantén la visualización... como referencia visual rápida, pero aclara que es informativa."
                                                     We keep checkboxes just in case, or maybe read-only if we are sure allocations allow backend to handle it.
                                                     Let's keep checkboxes but maybe warn.
                                                  */}
                                                <input
                                                    type="checkbox"
                                                    id={period}
                                                    checked={selectedPeriods.includes(period)}
                                                    onChange={() => togglePeriod(period)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                                />
                                                <label
                                                    htmlFor={period}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                                >
                                                    {period}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(!detailedPayment.allocations?.length && availablePeriods.length === 0) && (
                                <p className="text-sm text-muted-foreground italic">No specific allocation or period info provided.</p>
                            )}

                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setApprovalPayment(null)}>Cancel</Button>
                        <Button onClick={handleConfirmApprove} disabled={!detailedPayment}>Confirm Approval</Button>
                    </div>
                </DialogContent>
            </Dialog>
            <PaymentDialog
                open={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                buildingId={buildingId}
                buildings={buildings}
                onSuccess={fetchData}
            />
        </div>
    );
}
