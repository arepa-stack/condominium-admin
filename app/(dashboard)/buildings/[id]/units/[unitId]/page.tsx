'use client';

import { useEffect, useState, useMemo, use } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2,
    User as UserIcon,
    CreditCard,
    History,
    Users,
    FileText,
    ArrowUpRight,
    ArrowLeft,
    Building2,
    Home,
    MapPin,
    Percent,
    Eye,
    Info,
    Download,
    ExternalLink
} from 'lucide-react';
import { formatCurrency, formatDate, formatPeriod, formatPaymentMethod } from '@/lib/utils/format';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { unitsService } from '@/lib/services/units.service';
import { usersService } from '@/lib/services/users.service';
import { paymentsService } from '@/lib/services/payments.service';
import { billingService } from '@/lib/services/billing.service';
import type { Unit, User, Payment, Invoice, UnitBalance } from '@/types/models';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { InvoiceDetailsDialog } from '@/components/billing/InvoiceDetailsDialog';
import { toast } from 'sonner';
import Image from 'next/image';

export default function UnitDetailsPage({ params }: { params: Promise<{ id: string; unitId: string }> }) {
    const { id: buildingId, unitId } = use(params);
    const router = useRouter();

    const [unit, setUnit] = useState<Unit | null>(null);
    const [residents, setResidents] = useState<User[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [balance, setBalance] = useState<UnitBalance | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog States
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
    const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
    const [paymentAllocations, setPaymentAllocations] = useState<any[]>([]);
    const [isAllocationsLoading, setIsAllocationsLoading] = useState(false);

    const [proofUrl, setProofUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchAllData = async () => {
            try {
                setIsLoading(true);
                // Fetch basic unit data first as it's critical
                const unitData = await unitsService.getUnitById(unitId);
                setUnit(unitData);

                // Fetch other data in parallel, failing gracefully for single items
                const [unitResidents, unitPayments, unitInvoices, unitBalance] = await Promise.allSettled([
                    usersService.getUsers({ building_id: buildingId, unit_id: unitId }),
                    paymentsService.getPayments({ building_id: buildingId, unit_id: unitId }),
                    billingService.getUnitInvoices(unitId),
                    billingService.getUnitBalance(unitId)
                ]);

                if (unitResidents.status === 'fulfilled') setResidents(unitResidents.value);
                if (unitPayments.status === 'fulfilled') setPayments(unitPayments.value);
                if (unitInvoices.status === 'fulfilled') setInvoices(unitInvoices.value);
                if (unitBalance.status === 'fulfilled') setBalance(unitBalance.value);

            } catch (error) {
                console.error("Critical failure fetching unit data:", error);
                setUnit(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllData();
    }, [buildingId, unitId]);

    const handleOpenPaymentDetail = async (payment: Payment) => {
        setDetailedPayment(null);
        setPaymentAllocations([]);
        setSelectedPayment(payment);
        setIsPaymentDialogOpen(true);
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
                setIsPaymentDialogOpen(false);
            }
        } finally {
            setIsAllocationsLoading(false);
        }
    };

    const handleOpenInvoiceDetail = (id: string) => {
        setSelectedInvoiceId(id);
        setIsInvoiceDialogOpen(true);
    };

    const totalPaid = useMemo(() =>
        payments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + p.amount, 0),
        [payments]);

    const pendingDebt = useMemo(() =>
        balance ? balance.totalDebt :
            invoices.filter(i => i.status === 'PENDING').reduce((sum, i) => sum + (i.amount - (i.paid_amount || 0)), 0),
        [balance, invoices]);

    if (isLoading && !unit) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse text-sm font-medium">Loading unit details...</p>
            </div>
        );
    }

    if (!unit) {
        return (
            <div className="text-center py-24">
                <p className="text-muted-foreground">Unit not found.</p>
                <Button variant="link" onClick={() => router.back()}>Go back</Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header & Breadcrumbs... same as before */}
            <div className="flex flex-col gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-fit -ml-2 text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Units
                </Button>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                                <Home className="h-6 w-6 text-primary" />
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tight">Unit {unit.name}</h1>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground mt-2 ml-1">
                            <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full text-xs font-semibold">
                                <MapPin className="h-3 w-3 text-primary" />
                                Floor {unit.floor}
                            </span>
                            <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full text-xs font-semibold">
                                <Percent className="h-3 w-3 text-purple-400" />
                                Aliquot {unit.aliquot}%
                            </span>
                        </div>
                    </div>

                    <Link href={`/buildings/${buildingId}/billing?unit_id=${unitId}`} passHref>
                        <Button className="shadow-lg shadow-primary/20 gap-2 px-6">
                            <FileText className="h-4 w-4" />
                            Generate Statement
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Overview... same as before */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-green-500/5 border-green-500/10 shadow-2xl shadow-green-500/5 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-green-500/20">
                                <CreditCard className="w-5 h-5 text-green-400" />
                            </div>
                            <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Total Collections</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-white tabular-nums">{formatCurrency(totalPaid)}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 uppercase">Approved payments to date</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-red-500/5 border-red-500/10 shadow-2xl shadow-red-500/5 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-red-500/20">
                                <History className="w-5 h-5 text-red-400" />
                            </div>
                            <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Outstanding Debt</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-white tabular-nums">{formatCurrency(pendingDebt)}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 uppercase">Authoritative balance</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/10 shadow-2xl shadow-primary/5 backdrop-blur-sm">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-primary/20">
                                <Users className="w-5 h-5 text-primary" />
                            </div>
                            <span className="text-xs font-bold text-primary uppercase tracking-widest">Residents</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-3xl font-black text-white tabular-nums">{residents.length}</span>
                            <span className="text-[10px] text-muted-foreground mt-1 uppercase">Active memberships</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs Content */}
            <div className="bg-card/30 backdrop-blur-xl rounded-3xl border border-white/5 p-2 shadow-2xl">
                <Tabs defaultValue="residents" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-white/5 p-1 rounded-2xl h-14">
                        <TabsTrigger value="residents" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                            <Users className="h-4 w-4" />
                            Residents
                        </TabsTrigger>
                        <TabsTrigger value="billing" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                            <FileText className="h-4 w-4" />
                            Billing
                        </TabsTrigger>
                        <TabsTrigger value="history" className="rounded-xl font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all gap-2 h-full">
                            <History className="h-4 w-4" />
                            Payments
                        </TabsTrigger>
                    </TabsList>

                    <div className="p-6">
                        <TabsContent value="residents" className="mt-0 space-y-6 focus-visible:outline-none">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {residents.length === 0 ? (
                                    <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                        <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4" />
                                        <p className="text-muted-foreground text-sm font-medium">No active residents found for this unit.</p>
                                    </div>
                                ) : (
                                    residents.map(resident => (
                                        <div key={resident.id} className="group relative p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-primary/20 transition-all duration-300">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center text-primary font-black text-xl shadow-lg shadow-black/40">
                                                    {resident.name[0].toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-white truncate">{resident.name}</h4>
                                                    <p className="text-xs text-muted-foreground truncate opacity-70">{resident.email}</p>
                                                </div>
                                                <Badge variant="outline" className="h-5 text-[10px] uppercase font-black border-primary/20 bg-primary/5 text-primary shrink-0">
                                                    {resident.role}
                                                </Badge>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="billing" className="mt-0 space-y-6 focus-visible:outline-none">
                            <div className="space-y-3">
                                {invoices.length === 0 ? (
                                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                        <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4" />
                                        <p className="text-muted-foreground text-sm font-medium">No billing history available.</p>
                                    </div>
                                ) : (
                                    invoices.map(inv => (
                                        <div
                                            key={inv.id}
                                            className="cursor-pointer group block"
                                            onClick={() => handleOpenInvoiceDetail(inv.id)}
                                        >
                                            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl group-hover:bg-white/10 group-hover:border-primary/30 transition-all">
                                                <div className="flex items-center gap-5 w-full sm:w-auto">
                                                    <div className="text-xs font-black p-2 bg-primary/10 rounded-lg text-primary tabular-nums border border-primary/20">
                                                        #{inv.receipt_number || inv.number || inv.id.slice(0, 6)}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-white uppercase tracking-tighter">
                                                            {formatPeriod(inv.period || `${inv.year}-${String(inv.month).padStart(2, '0')}`)}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground mt-0.5">Issued: {formatDate(inv.issue_date || inv.created_at)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-8 mt-4 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end">
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-base font-black text-white tabular-nums">{formatCurrency(inv.amount)}</span>
                                                        {inv.paid_amount > 0 && (
                                                            <span className="text-[10px] font-bold text-green-400">Paid: {formatCurrency(inv.paid_amount)}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <Badge className={`px-4 py-1 font-bold text-[10px] uppercase tracking-widest ${inv.status === 'PAID' ? 'bg-green-500/20 text-green-400 border-green-500/20' :
                                                            inv.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' :
                                                                'bg-gray-500/20 text-gray-400 border-gray-500/20'
                                                            }`}>
                                                            {inv.status}
                                                        </Badge>
                                                        <ArrowUpRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="history" className="mt-0 space-y-6 focus-visible:outline-none">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {payments.length === 0 ? (
                                    <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                        <History className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4" />
                                        <p className="text-muted-foreground text-sm font-medium">No approved payments found.</p>
                                    </div>
                                ) : (
                                    payments.map(payment => (
                                        <div
                                            key={payment.id}
                                            className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-primary/20 transition-all flex flex-col gap-4 cursor-pointer group"
                                            onClick={() => handleOpenPaymentDetail(payment)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-white uppercase tracking-tighter">
                                                        Payment #{payment.id.slice(0, 8)}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mt-1">
                                                        {formatDate(payment.payment_date)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Badge className={`px-3 py-1 font-black text-[9px] uppercase tracking-tighter ${payment.status === 'APPROVED' ? 'bg-green-500/20 text-green-400 border-green-500/20' :
                                                        payment.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20' :
                                                            'bg-red-500/20 text-red-500 border-red-500/20'
                                                        }`}>
                                                        {payment.status}
                                                    </Badge>
                                                    <Info className="h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <div className="p-1.5 rounded-md bg-white/5 border border-white/5">
                                                        <CreditCard className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-xs font-bold uppercase tracking-wider">{formatPaymentMethod(payment.method)}</span>
                                                </div>
                                                <span className="text-xl font-black text-primary tabular-nums">{formatCurrency(payment.amount)}</span>
                                            </div>

                                            {payment.user && (
                                                <div className="flex items-center gap-2 opacity-40">
                                                    <UserIcon className="h-2.5 w-2.5" />
                                                    <span className="text-[9px] font-bold uppercase italic">Reported by: {payment.user.name}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>

            {/* Payment Details Dialog */}
            <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
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
                                                className="flex justify-between items-center p-3 rounded-lg border bg-white/5 border-white/5 hover:bg-white/10 transition-colors"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-white">
                                                        Invoice #{alloc.receipt_number || alloc.number || alloc.id.slice(0, 8)}
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

            {/* Invoice Details Dialog */}
            <InvoiceDetailsDialog
                isOpen={isInvoiceDialogOpen}
                onClose={() => setIsInvoiceDialogOpen(false)}
                invoiceId={selectedInvoiceId}
                unitName={unit.name}
            // Building name will be resolved from context inside if not passed, 
            // but we can try to find it in the URL or context if needed.
            />

            {/* Proof Modal */}
            <Dialog open={!!proofUrl} onOpenChange={(open) => !open && setProofUrl(null)}>
                <DialogContent className="max-w-5xl bg-card border-white/10 backdrop-blur-2xl">
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <DialogTitle className="text-white">Payment Proof</DialogTitle>
                        {proofUrl && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-white/10 hover:bg-white/5 text-white"
                                onClick={() => window.open(proofUrl, '_blank')}
                            >
                                <ExternalLink className="h-4 w-4" />
                                Open Full Size
                            </Button>
                        )}
                    </div>
                    {proofUrl && (
                        <div className="relative w-full h-[75vh] min-h-[400px] rounded-xl overflow-hidden border border-white/5 shadow-2xl mt-4">
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
        </div>
    );
}
