'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { PETTY_CASH_CATEGORIES } from '@/lib/utils/constants';
import { formatCurrency } from '@/lib/utils/format';
import type { Decision, DecisionChargeType } from '@/types/models';

const schema = z.object({
    type: z.enum(['INVOICE', 'ASSESSMENT'] as const),
    amount_override: z.coerce.number().positive().optional(),
    category: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface GenerateChargeDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    winnerAmount: number;
    onGenerated: (decision: Decision) => void;
}

export function GenerateChargeDialog({
    open,
    onOpenChange,
    decisionId,
    winnerAmount,
    onGenerated,
}: GenerateChargeDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: { type: 'INVOICE', amount_override: undefined, category: '' },
    });

    const selectedType = form.watch('type') as DecisionChargeType;

    const handleSubmit = async (values: FormValues) => {
        setIsLoading(true);
        try {
            const result = await decisionsService.generateCharge(decisionId, {
                type: values.type,
                amount_override:
                    values.amount_override && values.amount_override > 0
                        ? values.amount_override
                        : undefined,
                category:
                    values.type === 'ASSESSMENT' && values.category
                        ? values.category
                        : undefined,
            });
            toast.success(
                `Cargo generado correctamente (${result.charge_type}: ${result.charge_id.slice(0, 8)}…).`,
            );
            form.reset();
            onOpenChange(false);
            // Reload decision from parent via callback
            const decision = await decisionsService.getById(decisionId);
            onGenerated(decision.decision);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Generar cargo</DialogTitle>
                    <DialogDescription>
                        Emite un cargo a partir de la cotización ganadora (
                        {formatCurrency(winnerAmount)}).
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de cargo</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex gap-6"
                                        >
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem value="INVOICE" id="type-invoice" />
                                                <label
                                                    htmlFor="type-invoice"
                                                    className="text-sm font-medium cursor-pointer"
                                                >
                                                    Factura (billing)
                                                </label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <RadioGroupItem
                                                    value="ASSESSMENT"
                                                    id="type-assessment"
                                                />
                                                <label
                                                    htmlFor="type-assessment"
                                                    className="text-sm font-medium cursor-pointer"
                                                >
                                                    Cobro colectivo (caja chica)
                                                </label>
                                            </div>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="amount_override"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>
                                        Monto (dejar vacío para usar el monto de la cotización)
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            placeholder={String(winnerAmount)}
                                            {...field}
                                            value={field.value ?? ''}
                                            onChange={(e) =>
                                                field.onChange(
                                                    e.target.value === ''
                                                        ? undefined
                                                        : e.target.value,
                                                )
                                            }
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedType === 'ASSESSMENT' && (
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría (opcional)</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value ?? ''}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Sin categoría" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {PETTY_CASH_CATEGORIES.map((cat) => (
                                                    <SelectItem key={cat} value={cat}>
                                                        {cat}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Generar cargo
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
