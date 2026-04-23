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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { formatCurrency } from '@/lib/utils/format';
import type { Decision, DecisionQuote } from '@/types/models';

const schema = z.object({
    quote_id: z.string().min(1, 'Debes seleccionar una cotización'),
    reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
});

type FormValues = z.infer<typeof schema>;

interface ResolveTiebreakDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    activeQuotes: DecisionQuote[];
    onResolved: (decision: Decision) => void;
}

export function ResolveTiebreakDialog({
    open,
    onOpenChange,
    decisionId,
    activeQuotes,
    onResolved,
}: ResolveTiebreakDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: { quote_id: '', reason: '' },
    });

    const handleSubmit = async (values: FormValues) => {
        setIsLoading(true);
        try {
            const decision = await decisionsService.resolveTiebreak(decisionId, {
                quote_id: values.quote_id,
                reason: values.reason,
            });
            toast.success('Empate resuelto. Ganador declarado.');
            form.reset();
            onOpenChange(false);
            onResolved(decision);
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
                    <DialogTitle>Resolver empate</DialogTitle>
                    <DialogDescription>
                        Selecciona la cotización ganadora manualmente. El motivo quedará
                        registrado en el historial de auditoría.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="quote_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cotización ganadora</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona una cotización" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {activeQuotes.map((q) => (
                                                <SelectItem key={q.id} value={q.id}>
                                                    {q.provider_name} — {formatCurrency(q.amount)}
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
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Motivo de la decisión</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            rows={3}
                                            placeholder="Explica el criterio usado..."
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                Declarar ganador
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
