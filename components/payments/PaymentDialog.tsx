'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { paymentsService } from '@/lib/services/payments.service';
import { unitsService } from '@/lib/services/units.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { billingService } from '@/lib/services/billing.service';
import { toast } from 'sonner';
import { Loader2, Upload, Building2, Home, CreditCard, Calendar, DollarSign, FileText, ReceiptText, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPeriod } from '@/lib/utils/format';
import type { Building, Unit, Invoice } from '@/types/models';

interface PaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId?: string;
    buildings?: Building[];
    onSuccess?: () => void;
}

export function PaymentDialog({
    open,
    onOpenChange,
    buildingId,
    buildings = [],
    onSuccess,
}: PaymentDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [units, setUnits] = useState<Unit[]>([]);

    // Form State
    const [selectedBuildingId, setSelectedBuildingId] = useState<string>(buildingId || '');
    const [selectedUnitId, setSelectedUnitId] = useState<string>('');
    const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
    const [amount, setAmount] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [method, setMethod] = useState<string>('TRANSFER');
    const [reference, setReference] = useState<string>('');
    const [bank, setBank] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [proofFile, setProofFile] = useState<File | null>(null);

    // Memoized derived data
    const unitOptions = useMemo(() => units.map(u => ({
        value: u.id,
        label: u.name,
        icon: Home
    })), [units]);

    const invoicesOptions = useMemo(() => pendingInvoices.map(inv => ({
        id: inv.id,
        label: inv.period ? formatPeriod(inv.period) : (inv.month ? formatPeriod(`${inv.year}-${inv.month}`) : "Balance"),
        subLabel: `#${inv.receipt_number || inv.number || inv.id.slice(0, 6)}`,
        amount: Number(inv.amount || 0) - Number(inv.paid_amount || 0)
    })), [pendingInvoices]);

    useEffect(() => {
        if (open && buildingId) {
            setSelectedBuildingId(buildingId);
        }
    }, [open, buildingId]);

    useEffect(() => {
        const fetchUnits = async () => {
            if (!selectedBuildingId) {
                setUnits([]);
                return;
            }
            try {
                const data = await unitsService.getUnits(selectedBuildingId);
                setUnits(data);
            } catch (error) {
                console.error("Failed to fetch units", error);
            }
        };
        fetchUnits();
    }, [selectedBuildingId]);

    useEffect(() => {
        const fetchInvoices = async () => {
            if (!selectedUnitId || selectedUnitId === 'all') {
                setPendingInvoices([]);
                setSelectedInvoiceIds([]);
                return;
            }
            try {
                const data = await billingService.getInvoices({
                    unit_id: selectedUnitId,
                    status: 'PENDING'
                });

                setPendingInvoices(data);

                // Auto-select if there's only one pending invoice
                if (data.length === 1) {
                    setSelectedInvoiceIds([data[0].id]);
                } else {
                    setSelectedInvoiceIds([]);
                }
            } catch (error) {
                console.error("Failed to fetch pending invoices", error);
            }
        };
        fetchInvoices();
    }, [selectedUnitId]);

    // Sync amount based on selection
    useEffect(() => {
        const total = pendingInvoices
            .filter(inv => selectedInvoiceIds.includes(inv.id))
            .reduce((sum, inv) => sum + (Number(inv.amount || 0) - Number(inv.paid_amount || 0)), 0);

        const nextAmount = total > 0 ? total.toFixed(2) : '';
        if (nextAmount !== amount) {
            setAmount(nextAmount);
        }
    }, [selectedInvoiceIds, pendingInvoices]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProofFile(file);
        }
    };

    const toggleInvoice = useCallback((id: string) => {
        setSelectedInvoiceIds(prev => prev.includes(id)
            ? prev.filter(i => i !== id)
            : [...prev, id]
        );
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUnitId || !amount || !date || !method) {
            toast.error("Please fill in all required fields");
            return;
        }

        setIsLoading(true);
        try {
            const formData = new FormData();
            formData.append('unit_id', selectedUnitId);
            formData.append('building_id', selectedBuildingId);
            formData.append('amount', amount);
            formData.append('date', date);
            formData.append('method', method);
            formData.append('reference', reference);
            formData.append('bank', bank);
            formData.append('notes', notes);

            if (selectedInvoiceIds.length > 0) {
                // Formatting as JSON string as per spec: [{"invoice_id": "...", "amount": 25.0}]
                const allocations = selectedInvoiceIds.map(id => {
                    const inv = pendingInvoices.find(i => i.id === id);
                    return {
                        invoice_id: id,
                        amount: inv ? (Number(inv.amount || 0) - Number(inv.paid_amount || 0)) : 0
                    };
                });
                formData.append('allocations', JSON.stringify(allocations));
            }

            if (proofFile) {
                formData.append('proof_image', proofFile);
            }

            await paymentsService.createPayment(formData);
            toast.success("Payment registered successfully");
            onOpenChange(false);
            resetForm();
            onSuccess?.();
        } catch (error) {
            console.error("Failed to register payment", error);
            toast.error("Failed to register payment");
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        if (!buildingId) setSelectedBuildingId('');
        setSelectedUnitId('');
        setPendingInvoices([]);
        setSelectedInvoiceIds([]);
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setMethod('TRANSFER');
        setReference('');
        setBank('');
        setNotes('');
        setProofFile(null);
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            onOpenChange(val);
            if (!val) resetForm();
        }}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        Register Manual Payment
                    </DialogTitle>
                    <DialogDescription>
                        Manually record a payment received from a resident.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                Building
                            </Label>
                            <Select
                                value={selectedBuildingId}
                                onValueChange={setSelectedBuildingId}
                                disabled={!!buildingId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select building" />
                                </SelectTrigger>
                                <SelectContent>
                                    {buildings.map(b => (
                                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 col-span-2 md:col-span-1">
                            <Label className="flex items-center gap-2">
                                <Home className="h-4 w-4 text-muted-foreground" />
                                Unit
                            </Label>
                            <SearchableSelect
                                options={unitOptions}
                                value={selectedUnitId}
                                onValueChange={setSelectedUnitId}
                                placeholder="Select unit"
                                disabled={!selectedBuildingId}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 col-span-2">
                        <Label className="flex items-center gap-2 mb-2">
                            <ReceiptText className="h-4 w-4 text-muted-foreground" />
                            Select Invoices to Pay ({selectedInvoiceIds.length})
                        </Label>

                        <div className="space-y-2 border rounded-xl p-3 bg-white/5 max-h-[180px] overflow-y-auto custom-scrollbar">
                            {invoicesOptions.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic text-center py-4">
                                    {!selectedUnitId || selectedUnitId === 'all' ? "Select a unit first" : "No pending invoices found for this unit"}
                                </p>
                            ) : (
                                invoicesOptions.map((inv: { id: string; label: string; subLabel: string; amount: number }) => (
                                    <div
                                        key={inv.id}
                                        className={cn(
                                            "flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer hover:bg-white/10",
                                            selectedInvoiceIds.includes(inv.id) ? "bg-primary/10 border border-primary/20" : "border border-transparent"
                                        )}
                                        onClick={() => toggleInvoice(inv.id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                                                selectedInvoiceIds.includes(inv.id) ? "bg-primary border-primary" : "border-primary/40 bg-transparent"
                                            )}>
                                                {selectedInvoiceIds.includes(inv.id) && <CheckCircle2 className="h-3 w-3 text-white" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-white uppercase tracking-tighter">
                                                    {inv.label}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">{inv.subLabel}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-white tabular-nums">
                                                {formatCurrency(inv.amount)}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                Amount
                            </Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                required
                                className="font-bold text-lg"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                Date
                            </Label>
                            <Input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                Method
                            </Label>
                            <Select value={method} onValueChange={setMethod}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="TRANSFER">Transfer</SelectItem>
                                    <SelectItem value="PAGO_MOVIL">Pago Móvil</SelectItem>
                                    <SelectItem value="CASH">Cash</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                Reference
                            </Label>
                            <Input
                                placeholder="Ref number"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 text-muted-foreground" />
                            Bank Name
                        </Label>
                        <Input
                            placeholder="e.g. Banesco, Mercantil..."
                            value={bank}
                            onChange={(e) => setBank(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Input
                            placeholder="Optional notes or details"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Upload className="h-4 w-4 text-muted-foreground" />
                            Proof of Payment (Optional)
                        </Label>
                        <div className="flex items-center gap-2">
                            <Input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                className="cursor-pointer"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !selectedUnitId}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Register Payment
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
