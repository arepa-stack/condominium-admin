'use client';

import { useEffect, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { unitsService } from '@/lib/services/units.service';
import type { Unit, ContributionResponse } from '@/types/models';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
    unit_id: z.string().min(1, 'Selecciona una unidad'),
    amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
    description: z.string().min(1, 'La descripción es obligatoria'),
    currency: z.enum(['USD', 'VES']),
});

type FormValues = z.infer<typeof schema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContributionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    onSuccess?: (result: ContributionResponse) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContributionDialog({
    open,
    onOpenChange,
    buildingId,
    onSuccess,
}: ContributionDialogProps) {
    const [units, setUnits] = useState<Unit[]>([]);
    const [proofFile, setProofFile] = useState<File | null>(null);

    const currentPeriod = new Date().toISOString().substring(0, 7); // YYYY-MM
    const defaultDescription = `Aporte caja chica — ${currentPeriod}`;

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as Resolver<FormValues>,
        defaultValues: {
            unit_id: '',
            amount: undefined as unknown as number,
            description: defaultDescription,
            currency: 'USD',
        },
    });

    // Fetch building units when dialog opens
    useEffect(() => {
        if (!open || !buildingId) return;
        unitsService.getUnits(buildingId)
            .then(setUnits)
            .catch(() => setUnits([]));
        form.reset({
            unit_id: '',
            amount: undefined as unknown as number,
            description: defaultDescription,
            currency: 'USD',
        });
        setProofFile(null);
    }, [open, buildingId]);

    const onSubmit = async (data: FormValues) => {
        const fd = new FormData();
        fd.append('unit_id', data.unit_id);
        fd.append('amount', String(data.amount));
        fd.append('description', data.description);
        fd.append('currency', data.currency);
        if (proofFile) {
            fd.append('proof_image', proofFile);
        }

        try {
            const result = await pettyCashService.registerContribution(buildingId, fd);
            toast.success('Aporte directo registrado correctamente');
            onOpenChange(false);
            onSuccess?.(result);
        } catch {
            toast.error('No se pudo registrar el aporte directo');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Registrar aporte directo</DialogTitle>
                    <DialogDescription>
                        Registra un aporte directo de una unidad al fondo de caja chica.
                        El pago se aprueba automáticamente. Periodo: <strong>{currentPeriod}</strong>.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="unit_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Unidad</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Seleccionar unidad" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {units.map((u) => (
                                                <SelectItem key={u.id} value={u.id}>
                                                    {u.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                            name="currency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Moneda</FormLabel>
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
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={defaultDescription}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="space-y-2">
                            <FormLabel>
                                Comprobante de pago <span className="text-muted-foreground font-normal">(opcional)</span>
                            </FormLabel>
                            <Input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Puedes adjuntar un comprobante si lo deseas.
                            </p>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Registrar aporte
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
