'use client';

import { useEffect, useState, use } from 'react';
import { billingService } from '@/lib/services/billing.service';
import { paymentsService } from '@/lib/services/payments.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Info, Building as BuildingIcon, Hash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatCurrency, formatDate, formatPeriod, formatPaymentMethod } from '@/lib/utils/format';
import { toast } from 'sonner';
import type { Invoice, InvoicePayment, Payment } from '@/types/models';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import Image from 'next/image';

interface InvoiceDetailPageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
    const router = useRouter();
    const { id } = use(params);
    const { availableBuildings } = useBuildingContext();

    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [payments, setPayments] = useState<InvoicePayment[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Payment Detail Dialog
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
    const [proofUrl, setProofUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [invoiceData, paymentsData] = await Promise.all([
                    billingService.getInvoiceById(id),
                    billingService.getInvoicePayments(id)
                ]);
                setInvoice(invoiceData);
                setPayments(paymentsData);
            } catch (error) {
                console.error('Failed to fetch invoice details:', error);
                toast.error('Failed to load invoice details');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            fetchData();
        }
    }, [id]);

    const openPaymentDetails = async (payment: Payment) => {
        setSelectedPayment(payment);
        setDetailedPayment(null);

        try {
            const detailed = await paymentsService.getPaymentById(payment.id);
            setDetailedPayment(detailed);
        } catch (e) {
            console.error("Failed to fetch payment details", e);
            toast.error("Could not load payment details");
            setSelectedPayment(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="space-y-6">
                <Button variant="ghost" onClick={() => router.back()} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Billing
                </Button>
                <div className="text-center py-12">
                    <h2 className="text-xl font-semibold">Invoice not found</h2>
                </div>
            </div>
        );
    }

    const progress = (invoice.paid_amount / invoice.amount) * 100;
    const isPaid = invoice.status === 'PAID';

    // Fallback for period display - Priority: invoice.period -> year/month -> fallback
    const periodDisplay = invoice.period
        ? formatPeriod(invoice.period)
        : (invoice.year && invoice.month)
            ? formatPeriod(`${invoice.year}-${String(invoice.month).padStart(2, '0')}`)
            : '--';

    // Fallback for Title - Priority: invoice.number -> invoice.receipt_number -> fallback
    const displayId = invoice.number || invoice.receipt_number;
    const title = displayId
        ? `Invoice #${displayId} — ${periodDisplay}`
        : `Recibo ${periodDisplay}`;

    // Get unit name logic
    const unitName = invoice.unit?.name ||
        invoice.user?.units?.find(u => u.unit_id === invoice.unit_id)?.unit_name ||
        (invoice.unit_id ? invoice.unit_id.slice(0, 8) : 'N/A');

    const currentBuilding = availableBuildings.find((b: { id: string; name?: string }) => b.id === invoice.unit?.building_id || b.id === invoice.user?.building_id);

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-primary/10">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                        {title}
                        {isPaid && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 ml-2">PAID</Badge>}
                    </h1>
                    <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                        <Hash className="h-3 w-3" /> Unit {unitName}
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Invoice Info */}
                <Card className="md:col-span-2 border-white/5 bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
                    <CardHeader className="pb-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block mb-1">Total Amount</span>
                                <CardTitle className="text-4xl font-black text-white">
                                    {formatCurrency(invoice.amount)}
                                </CardTitle>
                                {invoice.due_date && (
                                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                                        <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                                        Due Date: {formatDate(invoice.due_date)}
                                    </div>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block mb-1">Period</span>
                                <Badge variant="outline" className="text-lg font-bold border-primary/20 bg-primary/5 text-primary">
                                    {periodDisplay}
                                </Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div>
                            <div className="flex justify-between text-sm mb-2 text-white">
                                <span className="font-semibold">Payment Progress</span>
                                <span className="font-bold tabular-nums">
                                    {formatCurrency(invoice.paid_amount)} <span className="text-muted-foreground font-medium">/ {formatCurrency(invoice.amount)}</span>
                                </span>
                            </div>
                            <Progress value={progress} className="h-3 bg-white/5" indicatorClassName={isPaid ? "bg-green-500" : "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]"} />
                        </div>

                        <Separator className="bg-white/5" />

                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block mb-1">Details</span>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-white/90">
                                            <BuildingIcon className="h-4 w-4 text-primary" />
                                            {currentBuilding?.name || 'Building details N/A'}
                                        </div>
                                        {invoice.issue_date && (
                                            <div className="flex items-center gap-2 text-sm text-white/90">
                                                <div className="w-4 h-4 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /></div>
                                                Issued: {formatDate(invoice.issue_date)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest block mb-1">Description</span>
                                <p className="text-sm text-white/80 leading-relaxed italic">
                                    {invoice.description || 'Monthly Maintenance Fee & Services'}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Associated Payments */}
                <Card className="border-white/5 bg-card/50 backdrop-blur-xl shadow-2xl">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                            <Info className="h-5 w-5 text-primary" />
                            Payments
                        </CardTitle>
                        <CardDescription>Associated transactions</CardDescription>
                    </CardHeader>
                    <CardContent className="px-0">
                        {payments.length === 0 ? (
                            <div className="text-center py-12 px-6">
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                                    <Info className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground italic">
                                    No payments recorded yet.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {payments.map((payment) => (
                                    <div
                                        key={payment.id}
                                        className="group p-4 hover:bg-white/5 transition-all cursor-pointer relative"
                                        onClick={() => openPaymentDetails(payment)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <div className="text-sm font-bold text-white">{formatCurrency(payment.allocated_amount)}</div>
                                                <div className="text-[10px] text-muted-foreground uppercase tracking-tighter mt-0.5">
                                                    Allocated on {formatDate(payment.allocated_at || payment.payment_date)}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <Badge className="text-[9px] uppercase font-black bg-primary/10 text-primary border-primary/20">
                                                    {formatPaymentMethod(payment.method)}
                                                </Badge>
                                                {payment.proof_url && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 hover:bg-primary/20 hover:text-primary rounded-full"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setProofUrl(payment.proof_url!);
                                                        }}
                                                    >
                                                        <Eye className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-muted-foreground font-mono">Ref: {payment.reference || 'N/A'}</span>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-[9px] text-primary uppercase font-bold">Details</span>
                                                <Info className="h-3 w-3 text-primary" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

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

            {/* Payment Details Dialog */}
            <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
                <DialogContent className="sm:max-w-[450px] bg-card border-white/10 backdrop-blur-2xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-white">Transaction Details</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Complete breakdown of the payment and its allocations.
                        </DialogDescription>
                    </DialogHeader>

                    {!detailedPayment ? (
                        <div className="py-12 flex justify-center">
                            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
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
                                    <Hash className="h-4 w-4" />
                                    Allocations
                                </h4>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {detailedPayment.allocations && detailedPayment.allocations.length > 0 ? (
                                        detailedPayment.allocations.map(alloc => (
                                            <div
                                                key={alloc.id}
                                                className={`flex justify-between items-center p-3 rounded-lg border transition-colors ${alloc.invoice_id === id ? 'bg-primary/10 border-primary/30' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-white">
                                                        Invoice #{alloc.invoice?.number || alloc.invoice_id.slice(0, 8)}
                                                        {alloc.invoice_id === id && <Badge className="ml-2 text-[8px] bg-primary text-primary-foreground h-4 py-0">Current</Badge>}
                                                    </span>
                                                    <span className="text-[9px] text-muted-foreground uppercase">{formatPeriod(`${alloc.invoice?.year}-${alloc.invoice?.month}`)}</span>
                                                </div>
                                                <span className="font-black text-sm text-white tabular-nums">{formatCurrency(alloc.amount)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic text-center py-4">No allocations found.</p>
                                    )}
                                </div>
                            </div>

                            {detailedPayment.proof_url && (
                                <Button
                                    variant="outline"
                                    className="w-full gap-2 border-white/10 hover:bg-white/5"
                                    onClick={() => setProofUrl(detailedPayment.proof_url!)}
                                >
                                    <Eye className="h-4 w-4" /> View Full Proof
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
