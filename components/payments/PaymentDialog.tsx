'use client';

import { useState, useEffect } from 'react';
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
import { toast } from 'sonner';
import { Loader2, Upload, Building2, Home, CreditCard, Calendar, DollarSign, FileText } from 'lucide-react';
import type { Building, Unit } from '@/types/models';

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
    const [amount, setAmount] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [method, setMethod] = useState<string>('TRANSFER');
    const [reference, setReference] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [proofFile, setProofFile] = useState<File | null>(null);

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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setProofFile(file);
        }
    };

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
            formData.append('payment_date', date);
            formData.append('method', method);
            formData.append('reference', reference);
            formData.append('notes', notes);
            if (proofFile) {
                formData.append('file', proofFile);
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
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setMethod('TRANSFER');
        setReference('');
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
                                options={units.map(u => ({
                                    value: u.id,
                                    label: u.name,
                                    icon: Home
                                }))}
                                value={selectedUnitId}
                                onValueChange={setSelectedUnitId}
                                placeholder="Select unit"
                                disabled={!selectedBuildingId}
                            />
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
                        <div className="space-y-2">
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
        </Dialog>
    );
}
