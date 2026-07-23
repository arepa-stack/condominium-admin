'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { PETTY_CASH_CATEGORIES } from '@/lib/utils/constants';
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { PettyCashCategory, PettyCashCurrency, PettyCashEntry, RateSet } from '@/types/models';

export type PettyCashManualEntryType = 'income' | 'expense';

function buildSchema(entryType: PettyCashManualEntryType) {
    const base = {
        amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
        currency: z.enum(['USD', 'VES']),
        description: z.string().min(1, 'La descripción es obligatoria'),
    };
    if (entryType === 'income') {
        return z.object(base);
    }
    return z.object({
        ...base,
        category: z.string().min(1, 'Selecciona una categoría'),
    });
}

interface TransactionFormValues {
    amount: number;
    currency: PettyCashCurrency;
    description: string;
    category?: string;
}

interface TransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entryType: PettyCashManualEntryType;
    buildingId: string;
    /**
     * Called after a successful submit. Receives the created entry so callers
     * can inspect `entry.coverage` (B12: post-expense recovery offer).
     */
    onSuccess?: (entry?: PettyCashEntry) => void;
}

export function TransactionDialog({
    open,
    onOpenChange,
    entryType,
    buildingId,
    onSuccess,
}: TransactionDialogProps) {
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [rates, setRates] = useState<RateSet | null>(null);
    const schema = useMemo(() => buildSchema(entryType), [entryType]);

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(schema) as Resolver<TransactionFormValues>,
        defaultValues: {
            amount: undefined as unknown as number,
            currency: 'USD',
            description: '',
            category: '',
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                amount: undefined as unknown as number,
                currency: 'USD',
                description: '',
                category: '',
            });
            setEvidenceFile(null);
            pettyCashService.getRates().then(setRates).catch(() => setRates(null));
        }
    }, [open, entryType, form]);

    const currency = form.watch('currency');
    const amount = form.watch('amount');

    const onSubmit = async (data: TransactionFormValues) => {
        if (!buildingId) {
            toast.error('Selecciona un edificio');
            return;
        }
        try {
            if (entryType === 'income') {
                const incomeEntry = await pettyCashService.registerIncome({
                    building_id: buildingId,
                    amount: data.amount,
                    currency: data.currency,
                    description: data.description,
                });
                toast.success('Ingreso registrado');
                onSuccess?.(incomeEntry);
                onOpenChange(false);
            } else {
                const fd = new FormData();
                fd.append('building_id', buildingId);
                fd.append('amount', String(data.amount));
                fd.append('currency', data.currency);
                fd.append('description', data.description);
                fd.append(
                    'category',
                    ((data as { category: string }).category as PettyCashCategory) || 'OTHER'
                );
                if (evidenceFile) {
                    fd.append('evidence_image', evidenceFile);
                }
                const expenseEntry = await pettyCashService.registerExpense(fd);
                toast.success('Egreso registrado');
                // Close the dialog before showing the recovery offer
                onOpenChange(false);
                // Pass the entry back so the caller can inspect coverage (B12)
                onSuccess?.(expenseEntry);
            }
        } catch (e) {
            console.error(e);
            toast.error(
                entryType === 'income'
                    ? 'No se pudo registrar el ingreso'
                    : 'No se pudo registrar el egreso'
            );
        }
    };

    const isExpense = entryType === 'expense';
    const title = isExpense ? 'Registrar egreso' : 'Registrar ingreso';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px]">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        {isExpense
                            ? 'Registra un gasto de caja chica. Puedes adjuntar comprobante.'
                            : 'Registra un ingreso al fondo de caja chica.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="currency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>¿Cómo se cargó el monto?</FormLabel>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={field.value === 'USD' ? 'default' : 'outline'}
                                            onClick={() => field.onChange('USD')}
                                        >
                                            En físico (USD)
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={field.value === 'VES' ? 'default' : 'outline'}
                                            onClick={() => field.onChange('VES')}
                                        >
                                            En bolívares (Bs)
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        {currency === 'VES' ? 'Monto en bolívares (Bs)' : 'Monto en físico (USD)'}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min={0}
                                            placeholder="0.00"
                                            {...field}
                                            value={field.value === undefined || Number.isNaN(field.value) ? '' : field.value}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                field.onChange(v === '' ? undefined : Number(v));
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {currency === 'VES' && amount > 0 && (
                            <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                                <p className="font-medium">Bs {amount.toLocaleString('es-VE')} equivalen a:</p>
                                {rates?.rates.dolar_oficial && (
                                    <p>Dólar oficial: ${(amount / rates.rates.dolar_oficial.bs_per_unit).toFixed(2)}</p>
                                )}
                                {rates?.rates.dolar_paralelo && (
                                    <p>Paralelo: ${(amount / rates.rates.dolar_paralelo.bs_per_unit).toFixed(2)}</p>
                                )}
                                {rates?.rates.euro_oficial && (
                                    <p>Euro oficial: €{(amount / rates.rates.euro_oficial.bs_per_unit).toFixed(2)}</p>
                                )}
                                {!rates && <p>Tasas no disponibles por ahora.</p>}
                                <p className="italic">Se guardará con la tasa por defecto del edificio.</p>
                            </div>
                        )}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Concepto del movimiento" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {isExpense && (
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value || ''}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Seleccionar" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {PETTY_CASH_CATEGORIES.map((c) => (
                                                    <SelectItem key={c} value={c}>
                                                        {c.replace(/_/g, ' ')}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        {isExpense && (
                            <div className="space-y-2">
                                <FormLabel>Comprobante (opcional)</FormLabel>
                                <Input
                                    type="file"
                                    accept="image/*,.pdf"
                                    onChange={(e) =>
                                        setEvidenceFile(e.target.files?.[0] ?? null)
                                    }
                                />
                            </div>
                        )}
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
