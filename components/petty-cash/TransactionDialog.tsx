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
import type { PettyCashTransactionType } from '@/types/models';

function buildSchema(transactionType: PettyCashTransactionType) {
    const base = {
        amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
        description: z.string().min(1, 'La descripción es obligatoria'),
    };
    if (transactionType === 'INCOME') {
        return z.object(base);
    }
    return z.object({
        ...base,
        category: z.string().min(1, 'Selecciona una categoría'),
    });
}

interface TransactionFormValues {
    amount: number;
    description: string;
    category?: string;
}

interface TransactionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    transactionType: PettyCashTransactionType;
    buildingId: string;
    onSuccess?: () => void;
}

export function TransactionDialog({
    open,
    onOpenChange,
    transactionType,
    buildingId,
    onSuccess,
}: TransactionDialogProps) {
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const schema = useMemo(() => buildSchema(transactionType), [transactionType]);

    const form = useForm<TransactionFormValues>({
        resolver: zodResolver(schema) as Resolver<TransactionFormValues>,
        defaultValues: {
            amount: undefined as unknown as number,
            description: '',
            category: '',
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                amount: undefined as unknown as number,
                description: '',
                category: '',
            });
            setEvidenceFile(null);
        }
    }, [open, transactionType, form]);

    const onSubmit = async (data: TransactionFormValues) => {
        if (!buildingId) {
            toast.error('Selecciona un edificio');
            return;
        }
        try {
            if (transactionType === 'INCOME') {
                await pettyCashService.registerIncome({
                    building_id: buildingId,
                    amount: data.amount,
                    description: data.description,
                });
                toast.success('Ingreso registrado');
            } else {
                const fd = new FormData();
                fd.append('building_id', buildingId);
                fd.append('amount', String(data.amount));
                fd.append('description', data.description);
                fd.append('category', (data as { category: string }).category);
                if (evidenceFile) {
                    fd.append('evidence_image', evidenceFile);
                }
                await pettyCashService.registerExpense(fd);
                toast.success('Egreso registrado');
            }
            onSuccess?.();
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            toast.error(
                transactionType === 'INCOME'
                    ? 'No se pudo registrar el ingreso'
                    : 'No se pudo registrar el egreso'
            );
        }
    };

    const isExpense = transactionType === 'EXPENSE';
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
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Monto</FormLabel>
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
