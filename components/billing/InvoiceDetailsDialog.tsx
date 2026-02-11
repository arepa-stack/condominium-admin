'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
    Info,
    Building as BuildingIcon,
    Hash,
    Eye,
    CreditCard,
    Calendar,
    ArrowUpRight,
    Loader2
} from 'lucide-react';
import { billingService } from '@/lib/services/billing.service';
import { paymentsService } from '@/lib/services/payments.service';
import { formatCurrency, formatDate, formatPeriod, formatPaymentMethod } from '@/lib/utils/format';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import Image from 'next/image';
import type { Invoice, InvoicePayment, Payment } from '@/types/models';
import { toast } from 'sonner';

interface InvoiceDetailsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    invoiceId: string | null;
    buildingName?: string;
    unitName?: string;
}

export function InvoiceDetailsDialog({ isOpen, onClose, invoiceId, buildingName, unitName }: InvoiceDetailsDialogProps) {
    const { availableBuildings } = useBuildingContext();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [payments, setPayments] = useState<InvoicePayment[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Nested Payment Detail
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
    const [paymentAllocations, setPaymentAllocations] = useState<any[]>([]);
    const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
    const [isAllocationsLoading, setIsAllocationsLoading] = useState(false);
    const [proofUrl, setProofUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && invoiceId) {
            fetchData();
        } else {
            // Reset state when closing
            setInvoice(null);
            setPayments([]);
        }
    }, [isOpen, invoiceId]);

    const fetchData = async () => {
        if (!invoiceId) return;
        try {
            setIsLoading(true);
            const [invoiceData, paymentsData] = await Promise.all([
                billingService.getInvoiceById(invoiceId),
                billingService.getInvoicePayments(invoiceId)
            ]);
            setInvoice(invoiceData);
            setPayments(paymentsData);
        } catch (error) {
            console.error('Failed to fetch invoice details:', error);
            toast.error('Failed to load invoice details');
            onClose();
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenPaymentDetail = async (payment: Payment) => {
        setDetailedPayment(null);
        setPaymentAllocations([]);
        setSelectedPayment(payment);
        setIsPaymentDetailsOpen(true);
        setIsAllocationsLoading(true);

        try {
            // Parallel fetch: basic payment details AND real allocations from the new endpoint
            const [detailed, allocations] = await Promise.all([
                paymentsService.getPaymentById(payment.id),
                billingService.getPaymentInvoices(payment.id)
            ]);
            setDetailedPayment(detailed);
            setPaymentAllocations(allocations);
        } catch (error) {
            console.error('Failed to fetch payment details or allocations:', error);
            // Fallback: try to just show detailed payment if allocations fail
            try {
                const detailed = await paymentsService.getPaymentById(payment.id);
                setDetailedPayment(detailed);
            } catch (innerError) {
                toast.error('Could not load payment details');
            }
        } finally {
            setIsAllocationsLoading(false);
        }
    };

    if (!isOpen) return null;

    const progress = invoice ? (invoice.paid_amount / invoice.amount) * 100 : 0;
    const isPaid = invoice?.status === 'PAID';

    const periodDisplay = invoice
        ? invoice.period
            ? formatPeriod(invoice.period)
            : (invoice.year && invoice.month)
                ? formatPeriod(`${invoice.year}-${String(invoice.month).padStart(2, '0')}`)
                : '--'
        : '--';

    const displayId = invoice?.receipt_number || invoice?.number || invoice?.id.slice(0, 8);
    const title = invoice ? `Invoice #${displayId}` : 'Invoice Details';

    const fallbackBuilding = invoice ? availableBuildings.find((b: any) =>
        b.id === invoice.unit?.building_id || b.id === invoice.user?.building_id
    ) : null;

    const resolvedBuildingName = buildingName || fallbackBuilding?.name || 'Building details N/A';

    const resolvedUnitName = unitName ||
        invoice?.unit?.name ||
        invoice?.user?.units?.find((u: any) => u.unit_id === invoice.unit_id)?.unit_name ||
        '--';

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-2xl bg-card border-white/10 backdrop-blur-2xl shadow-2xl p-0 overflow-hidden">
                    {isLoading || !invoice ? (
                        <div className="py-24 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading invoice details...</p>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full max-h-[85vh]">
                            {/* Header Section */}
                            <div className="p-6 bg-gradient-to-br from-primary/10 to-transparent border-b border-white/5">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge variant="outline" className="text-[10px] uppercase font-black border-primary/20 bg-primary/5 text-primary">
                                                {periodDisplay}
                                            </Badge>
                                            {isPaid && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] uppercase font-black">PAID</Badge>}
                                        </div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">{title}</h2>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                                            <BuildingIcon className="h-3 w-3" /> {resolvedBuildingName}
                                            <Separator orientation="vertical" className="h-3 bg-white/10" />
                                            <Hash className="h-3 w-3" /> Unit {resolvedUnitName}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block mb-1">Total Amount</span>
                                        <span className="text-3xl font-black text-white tabular-nums">{formatCurrency(invoice.amount)}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between text-[11px] text-white/70 font-bold uppercase tracking-tight">
                                        <span>Payment Progress</span>
                                        <span>{formatCurrency(invoice.paid_amount)} / {formatCurrency(invoice.amount)}</span>
                                    </div>
                                    <Progress value={progress} className="h-2 bg-white/5" indicatorClassName={isPaid ? "bg-green-500" : "bg-primary shadow-[0_0_10px_rgba(var(--primary),0.3)]"} />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                {/* Details Grid */}
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                                            <Calendar className="h-3 w-3 text-primary" />
                                            Dates
                                        </h3>
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Issued</span>
                                                <span className="text-white font-medium">{formatDate(invoice.issue_date || invoice.created_at)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-muted-foreground">Due Date</span>
                                                <span className={`font-bold ${invoice.due_date && new Date(invoice.due_date) < new Date() && !isPaid ? 'text-red-400' : 'text-white'}`}>
                                                    {invoice.due_date ? formatDate(invoice.due_date) : '--'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-3 flex items-center gap-2">
                                            <Info className="h-3 w-3 text-primary" />
                                            Description
                                        </h3>
                                        <p className="text-xs text-white/80 italic leading-relaxed">
                                            {invoice.description || 'Monthly maintenance fee for condominium services and common areas management.'}
                                        </p>
                                    </div>
                                </div>

                                <Separator className="bg-white/5" />

                                {/* Associated Payments */}
                                <div>
                                    <h3 className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-4 flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-primary" />
                                        Associated Payments
                                    </h3>
                                    {payments.length === 0 ? (
                                        <div className="py-12 flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
                                            <Info className="h-8 w-8 text-muted-foreground/20 mb-2" />
                                            <p className="text-xs text-muted-foreground italic">No payments recorded yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {payments.map((p) => (
                                                <div
                                                    key={p.id}
                                                    className="group flex flex-col sm:flex-row items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all cursor-pointer"
                                                    onClick={() => handleOpenPaymentDetail(p)}
                                                >
                                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                                                            <CreditCard className="h-4 w-4" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-black text-white">{formatCurrency(p.allocated_amount)}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase tracking-tighter">
                                                                On {formatDate(p.allocated_at || p.payment_date)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-3 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                                                        <Badge variant="outline" className="text-[9px] uppercase font-black border-white/10 text-muted-foreground">
                                                            {formatPaymentMethod(p.method)}
                                                        </Badge>
                                                        <ArrowUpRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end">
                                <Button variant="ghost" onClick={onClose} className="hover:bg-white/10 font-bold uppercase tracking-widest text-[10px]">
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Nested Payment Details Dialog */}
            <Dialog open={isPaymentDetailsOpen} onOpenChange={setIsPaymentDetailsOpen}>
                <DialogContent className="sm:max-w-[450px] bg-card border-white/10 backdrop-blur-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">Transaction Details</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Complete breakdown of the payment and its allocations.
                        </DialogDescription>
                    </DialogHeader>

                    {!detailedPayment ? (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="py-4 space-y-6">
                            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                <div>
                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block mb-1">Total Payment</span>
                                    <span className="text-2xl font-black text-white tabular-nums">{formatCurrency(detailedPayment.amount)}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest block mb-1">Date</span>
                                    <span className="text-sm font-bold text-white">{formatDate(detailedPayment.payment_date)}</span>
                                </div>
                            </div>

                            <div className="space-y-3 px-1">
                                <h4 className="flex items-center gap-2 font-black text-xs text-primary uppercase tracking-widest">
                                    <Info className="h-4 w-4" />
                                    Allocations
                                </h4>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {isAllocationsLoading ? (
                                        <div className="py-8 flex justify-center">
                                            <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                                        </div>
                                    ) : paymentAllocations.length > 0 ? (
                                        paymentAllocations.map((alloc: any) => (
                                            <div
                                                key={alloc.id}
                                                className={`flex justify-between items-center p-3 rounded-lg border transition-colors ${alloc.id === invoiceId || alloc.invoice_id === invoiceId ? 'bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-white">
                                                        Invoice #{alloc.receipt_number || alloc.number || (alloc.id === invoiceId ? displayId : alloc.id.slice(0, 8))}
                                                        {(alloc.id === invoiceId || alloc.invoice_id === invoiceId) && <Badge className="ml-2 text-[8px] bg-primary text-primary-foreground h-4 py-0 uppercase">Current</Badge>}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground uppercase">
                                                        {alloc.period ? formatPeriod(alloc.period) : (alloc.year && alloc.month ? formatPeriod(`${alloc.year}-${alloc.month}`) : '--')}
                                                    </span>
                                                </div>
                                                <span className="font-black text-sm text-white tabular-nums">{formatCurrency(alloc.allocated_amount || alloc.amount)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center flex flex-col items-center gap-2">
                                            <Info className="h-8 w-8 text-muted-foreground/20" />
                                            <p className="text-[11px] text-muted-foreground italic">No detailed allocations found.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {detailedPayment.proof_url && (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 border-white/10 hover:bg-white/5 transition-all"
                                    onClick={() => setProofUrl(detailedPayment.proof_url!)}
                                >
                                    <Eye className="h-4 w-4" /> View Full Proof
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Proof Modal */}
            <Dialog open={!!proofUrl} onOpenChange={(open) => !open && setProofUrl(null)}>
                <DialogContent className="max-w-3xl bg-card border-white/10 backdrop-blur-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="text-white">Payment Proof</DialogTitle>
                    </DialogHeader>
                    {proofUrl && (
                        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-white/5 shadow-2xl mt-4">
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
        </>
    );
}
