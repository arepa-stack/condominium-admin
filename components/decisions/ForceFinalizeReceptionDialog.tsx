'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { Decision } from '@/types/models';

const schema = z.object({
    reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
});

type FormValues = z.infer<typeof schema>;

interface ForceFinalizeReceptionDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    activeQuoteCount: number;
    onFinalized: (decision: Decision) => void;
}

export function ForceFinalizeReceptionDialog({
    open,
    onOpenChange,
    decisionId,
    activeQuoteCount,
    onFinalized,
}: ForceFinalizeReceptionDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: { reason: '' },
    });

    const handleSubmit = async (values: FormValues) => {
        setIsLoading(true);
        try {
            const decision = await decisionsService.finalize(decisionId, {
                force: true,
                reason: values.reason,
            });
            toast.success('Votación abierta.');
            form.reset();
            onOpenChange(false);
            onFinalized(decision);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Pasar a votación ahora</AlertDialogTitle>
                    <AlertDialogDescription>
                        Vas a cerrar la recepción antes de que venza el plazo y abrir
                        la votación con las <strong>{activeQuoteCount}</strong>{' '}
                        {activeQuoteCount === 1
                            ? 'cotización activa'
                            : 'cotizaciones activas'}
                        . Quedará registrado en la auditoría.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4 pt-2"
                    >
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Motivo</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            rows={3}
                                            placeholder="Ej: Todos los presupuestos ya fueron confirmados por los proveedores."
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <AlertDialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isLoading}
                            >
                                Volver
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Abrir votación
                            </Button>
                        </AlertDialogFooter>
                    </form>
                </Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
