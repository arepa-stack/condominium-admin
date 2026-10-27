'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Coins, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { billingService } from '@/lib/services/billing.service';
import { paymentsService } from '@/lib/services/payments.service';
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { formatCurrency } from '@/lib/utils/format';
import type { Invoice, RateSet, RateSource, RecordInvoicePaymentPayload } from '@/types/models';
import type { InvoicePdfPaymentDetails } from '@/lib/utils/invoice-pdf';

const roundCents = (value: number) => Math.round(value * 100) / 100;

const RATE_SOURCE: Record<'EUR_BCV' | 'USD_BCV', RateSource> = {
    EUR_BCV: 'euro_oficial',
    USD_BCV: 'dolar_oficial',
};

const createSchema = (remaining: number) => z.object({
    amount: z.string()
        .refine(v => Number(v) > 0, 'El monto debe ser mayor a cero')
        .refine(v => roundCents(Number(v)) <= remaining, `El abono no puede superar el saldo pendiente (${formatCurrency(remaining)})`),
    payment_method: z.enum(['PAGO_MOVIL', 'TRANSFER', 'CASH']),
    payment_date: z.string().min(1, 'La fecha es obligatoria'),
    payment_currency: z.enum(['USD', 'VES']),
    rate_type: z.enum(['EUR_BCV', 'USD_BCV', 'CUSTOM']),
    exchange_rate: z.string().optional(),
    amount_ves: z.string().optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.payment_currency !== 'VES') return;
    if (!(Number(data.exchange_rate) > 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exchange_rate'], message: 'Indica la tasa' });
    }
    if (!(Number(data.amount_ves) > 0)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount_ves'], message: 'Indica el monto en Bs.' });
    }
});

type FormData = z.infer<ReturnType<typeof createSchema>>;

interface RecordInvoicePaymentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice;
    // Called with the details for the receipt of the recorded payment.
    onRecorded: (receipt: InvoicePdfPaymentDetails) => void;
}

export function RecordInvoicePaymentDialog({ open, onOpenChange, invoice, onRecorded }: RecordInvoicePaymentDialogProps) {
    const remaining = roundCents(invoice.amount - (invoice.paid_amount || 0));
    const today = new Date().toISOString().slice(0, 10);

    const [ratesData, setRatesData] = useState<RateSet | null>(null);
    const [isLoadingRates, setIsLoadingRates] = useState(false);
    const [proofFile, setProofFile] = useState<File | null>(null);
    // Blocks a second submit while the first is in flight: each submit records a payment.
    const submittingRef = useRef(false);

    const form = useForm<FormData>({
        resolver: zodResolver(createSchema(remaining)),
        defaultValues: {
            amount: remaining.toFixed(2),
            payment_method: 'PAGO_MOVIL',
            payment_date: today,
            payment_currency: 'VES',
            rate_type: 'EUR_BCV',
            exchange_rate: '',
            amount_ves: '',
            reference: '',
            notes: '',
        },
    });

    const amount = form.watch('amount');
    const paymentCurrency = form.watch('payment_currency');
    const rateType = form.watch('rate_type');
    const paymentDate = form.watch('payment_date');
    const exchangeRate = form.watch('exchange_rate');

    useEffect(() => {
        if (open) {
            form.reset({ ...form.getValues(), amount: remaining.toFixed(2), payment_date: today, exchange_rate: '', amount_ves: '', reference: '', notes: '' });
            setProofFile(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, invoice.id]);

    const fetchRates = useCallback(async (dateStr?: string) => {
        try {
            setIsLoadingRates(true);
            setRatesData(await pettyCashService.getRates(dateStr));
        } catch (error) {
            console.warn('Could not fetch exchange rates from backend API', error);
        } finally {
            setIsLoadingRates(false);
        }
    }, []);

    useEffect(() => {
        if (open && paymentCurrency === 'VES') fetchRates(paymentDate);
    }, [open, paymentCurrency, paymentDate, fetchRates]);

    useEffect(() => {
        if (paymentCurrency !== 'VES' || rateType === 'CUSTOM') return;
        const rate = rateType === 'EUR_BCV'
            ? ratesData?.rates?.euro_oficial?.bs_per_unit
            : ratesData?.rates?.dolar_oficial?.bs_per_unit;
        if (rate) form.setValue('exchange_rate', rate.toFixed(4), { shouldValidate: true });
    }, [paymentCurrency, rateType, ratesData, form]);

    useEffect(() => {
        if (paymentCurrency !== 'VES') return;
        const usd = Number(amount);
        const rate = Number(exchangeRate);
        if (usd > 0 && rate > 0) form.setValue('amount_ves', (usd * rate).toFixed(2));
    }, [paymentCurrency, amount, exchangeRate, form]);

    const onSubmit = async (values: FormData) => {
        if (submittingRef.current) return;
        submittingRef.current = true;
        try {
            const usd = roundCents(Number(values.amount));
            const isVes = values.payment_currency === 'VES';
            const rate = isVes ? Number(values.exchange_rate) : undefined;
            const amountVes = isVes ? Number(values.amount_ves) : undefined;

            const payload: RecordInvoicePaymentPayload = {
                amount: usd,
                method: values.payment_method,
                payment_date: values.payment_date,
                reference: values.reference?.trim() || undefined,
                notes: values.notes?.trim() || undefined,
                ...(isVes && {
                    amount_ves: amountVes,
                    exchange_rate: rate,
                    rate_source: values.rate_type === 'CUSTOM' ? undefined : RATE_SOURCE[values.rate_type],
                }),
            };

            const { invoice: updated, payment } = await billingService.recordInvoicePayment(invoice.id, payload);

            if (proofFile) {
                const fd = new FormData();
                fd.append('proof_image', proofFile);
                // The payment is already recorded; a failed upload can be retried from the payment detail
                await paymentsService.uploadPaymentProof(payment.id, fd)
                    .catch(() => toast.warning('Pago registrado, pero no se pudo subir el comprobante'));
            }

            toast.success(updated.status === 'PAID' ? 'Pago registrado. La factura quedó PAGADA.' : 'Abono registrado correctamente');
            onOpenChange(false);
            onRecorded({
                paymentMethod: values.payment_method,
                paymentDate: values.payment_date,
                currency: values.payment_currency,
                rateType: values.rate_type,
                exchangeRate: rate,
                amountVes,
                amountUsd: usd,
                paidAmountUsd: updated.paid_amount,
                totalAmountUsd: updated.amount,
                remainingBalanceUsd: Math.max(0, roundCents(updated.amount - updated.paid_amount)),
            });
        } catch (error: unknown) {
            console.error('Failed to record invoice payment', error);
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al registrar el pago');
        } finally {
            submittingRef.current = false;
        }
    };

    const isSubmitting = form.formState.isSubmitting;

    return (
        <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
            <DialogContent className="sm:max-w-[520px] bg-card border-border/30">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-foreground">
                        <Wallet className="h-5 w-5 text-primary" />
                        Registrar pago
                    </DialogTitle>
                    <DialogDescription>
                        Se aplica a esta factura. Saldo pendiente: <strong>{formatCurrency(remaining)}</strong> de {formatCurrency(invoice.amount)}.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Monto acreditado (USD)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" min="0" {...field} className="h-9 font-mono font-semibold" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="payment_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Fecha en que se pagó</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} className="h-9" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="payment_method"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Método de pago</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="PAGO_MOVIL">Pago Móvil</SelectItem>
                                                <SelectItem value="TRANSFER">Transferencia Bancaria</SelectItem>
                                                <SelectItem value="CASH">Efectivo / Zelle</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="payment_currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Moneda del pago</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="VES">Bolívares (VES a Tasa)</SelectItem>
                                                <SelectItem value="USD">Dólares (USD Directo)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                )}
                            />
                        </div>

                        {paymentCurrency === 'VES' && (
                            <div className="p-3 rounded-lg border border-border bg-muted/40 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold flex items-center gap-1.5">
                                        <Coins className="h-3.5 w-3.5 text-primary" />
                                        Tasa de cambio
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => fetchRates(paymentDate)}
                                        disabled={isLoadingRates}
                                        className="h-6 px-2 text-[10px] gap-1"
                                    >
                                        <RefreshCw className={`h-3 w-3 ${isLoadingRates ? 'animate-spin' : ''}`} />
                                        Actualizar tasa
                                    </Button>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <FormField
                                        control={form.control}
                                        name="rate_type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[11px] text-muted-foreground">Tipo de tasa</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-8 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="EUR_BCV" className="text-xs">Euro Oficial (BCV)</SelectItem>
                                                        <SelectItem value="USD_BCV" className="text-xs">Dólar Oficial (BCV)</SelectItem>
                                                        <SelectItem value="CUSTOM" className="text-xs">Tasa Personalizada</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="exchange_rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[11px] text-muted-foreground">Tasa (Bs./unidad)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.0001" {...field} className="h-8 text-xs font-mono" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="amount_ves"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[11px] text-muted-foreground">Monto en Bs.</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} className="h-8 text-xs font-mono font-bold" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="reference"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Referencia (opcional)</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="h-9" />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs">Nota (opcional)</FormLabel>
                                        <FormControl>
                                            <Input {...field} className="h-9" />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="proof_image" className="text-xs font-medium">Comprobante (opcional)</label>
                            <Input
                                id="proof_image"
                                type="file"
                                accept="image/jpeg,image/png,image/webp,application/pdf"
                                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                                className="h-9 text-xs"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
                                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                Registrar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
