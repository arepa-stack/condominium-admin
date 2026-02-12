import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button'; // [NEW]
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { Unit, User, Payment, Invoice } from '@/types/models';
import { useEffect, useState, useMemo } from 'react';
import { usersService } from '@/lib/services/users.service';
import { paymentsService } from '@/lib/services/payments.service';
import { billingService } from '@/lib/services/billing.service'; // [NEW]
import { Loader2, User as UserIcon, CreditCard, History, Users, FileText, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface UnitDetailsSheetProps {
    unit: Unit | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UnitDetailsSheet({ unit, open, onOpenChange }: UnitDetailsSheetProps) {
    const [residents, setResidents] = useState<User[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]); // [NEW]
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (unit && open) {
            fetchDetails();
        }
    }, [unit, open]);

    const fetchDetails = async () => {
        if (!unit) return;
        try {
            setIsLoading(true);

            // Parallel fetching
            const [unitResidents, unitPayments, unitInvoices] = await Promise.all([
                usersService.getUsers({ building_id: unit.building_id, unit_id: unit.id }),
                paymentsService.getPayments({ building_id: unit.building_id, unit_id: unit.id }),
                billingService.getInvoices({ building_id: unit.building_id, unit_id: unit.id })
            ]);

            setResidents(unitResidents);
            setPayments(unitPayments);
            setInvoices(unitInvoices);

        } catch (error) {
            console.error("Failed to fetch unit details", error);
        } finally {
            setIsLoading(false);
        }
    };

    const totalPaid = useMemo(() =>
        payments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + p.amount, 0),
        [payments]);

    const pendingDebt = useMemo(() =>
        invoices.filter(i => i.status === 'PENDING').reduce((sum, i) => sum + (i.amount - (i.paid_amount || 0)), 0),
        [invoices]);

    if (!unit) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="mb-6">
                    <SheetTitle className="text-2xl">Unit {unit.name}</SheetTitle>
                    <SheetDescription>
                        Floor {unit.floor} • Aliquot {unit.aliquot}%
                    </SheetDescription>
                </SheetHeader>

                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4">
                            <Card>
                                <CardContent className="p-4 pt-4">
                                    <div className="text-sm font-medium text-muted-foreground">Total Paid</div>
                                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4 pt-4">
                                    <div className="text-sm font-medium text-muted-foreground">Pending Debt</div>
                                    <div className="text-2xl font-bold text-red-600">{formatCurrency(pendingDebt)}</div>
                                </CardContent>
                            </Card>
                        </div>

                        <Tabs defaultValue="residents">
                            <TabsList className="w-full">
                                <TabsTrigger value="residents" className="flex-1">Residents</TabsTrigger>
                                <TabsTrigger value="invoices" className="flex-1">Invoices</TabsTrigger>
                                <TabsTrigger value="payments" className="flex-1">Payments</TabsTrigger>
                            </TabsList>

                            <TabsContent value="residents" className="mt-4 space-y-4">
                                <h3 className="text-sm font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Current Residents
                                </h3>
                                {residents.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No residents assigned to this unit.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {residents.map(resident => (
                                            <div key={resident.id} className="flex items-center justify-between p-3 border rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                        <UserIcon className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{resident.name}</p>
                                                        <p className="text-xs text-muted-foreground">{resident.email}</p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="capitalize">{resident.role}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="invoices" className="mt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium flex items-center gap-2">
                                        <FileText className="h-4 w-4" /> Invoices
                                    </h3>
                                    <Link href={`/billing?unit_id=${unit.id}&building_id=${unit.building_id}`} passHref>
                                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                                            View All <ArrowUpRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </div>

                                {invoices.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No invoices found for this unit.</p>
                                ) : (
                                    <div className="h-[300px] w-full pr-2 overflow-y-auto">
                                        <div className="space-y-3">
                                            {invoices.map(inv => (
                                                <div key={inv.id} className="flex flex-col p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="font-medium text-sm">#{inv.number || inv.id.slice(0, 6)}</span>
                                                        <Badge variant={inv.status === 'PAID' ? 'default' : 'secondary'} className={inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : ''}>
                                                            {inv.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-muted-foreground text-xs">{inv.year}-{inv.month}</span>
                                                        <span className="font-semibold">{formatCurrency(inv.amount)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="payments" className="mt-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium flex items-center gap-2">
                                        <History className="h-4 w-4" /> Payment History
                                    </h3>
                                    <Link href={`/payments?unit_id=${unit.id}&building_id=${unit.building_id}`} passHref>
                                        <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                                            View All <ArrowUpRight className="h-3 w-3" />
                                        </Button>
                                    </Link>
                                </div>

                                {payments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No payments found for this unit.</p>
                                ) : (
                                    <div className="h-[300px] w-full pr-2 overflow-y-auto">
                                        <div className="space-y-3">
                                            {payments.map(payment => (
                                                <div key={payment.id} className="flex flex-col p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <p className="font-medium text-sm">
                                                                Payment #{payment.id.slice(0, 8)}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">{formatDate(payment.payment_date)}</p>
                                                        </div>
                                                        <Badge variant={
                                                            payment.status === 'APPROVED' ? 'default' :
                                                                payment.status === 'PENDING' ? 'secondary' : 'destructive'
                                                        }>
                                                            {payment.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-muted-foreground">{payment.method}</span>
                                                        <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                                                    </div>
                                                    {payment.user && (
                                                        <p className="text-xs text-muted-foreground mt-1 pt-1 border-t">
                                                            By: {payment.user.name}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
