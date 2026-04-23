'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
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

interface QuoteDeleteDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    quoteId: string;
    providerName: string;
    /** Si true, el usuario es el uploader Y la decision está en RECEPTION → no se exige reason */
    isSelfDelete: boolean;
    onDeleted: (quoteId: string) => void;
}

const reasonSchema = z.object({
    reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
});
type ReasonValues = z.infer<typeof reasonSchema>;

export function QuoteDeleteDialog({
    open,
    onOpenChange,
    decisionId,
    quoteId,
    providerName,
    isSelfDelete,
    onDeleted,
}: QuoteDeleteDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<ReasonValues>({
        resolver: isSelfDelete ? undefined : (zodResolver(reasonSchema) as any),
        defaultValues: { reason: '' },
    });

    const handleDelete = async (values: ReasonValues) => {
        setIsLoading(true);
        try {
            await decisionsService.deleteQuote(
                decisionId,
                quoteId,
                isSelfDelete ? undefined : values.reason,
            );
            toast.success('Cotización eliminada.');
            form.reset();
            onOpenChange(false);
            onDeleted(quoteId);
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
                    <AlertDialogTitle>Eliminar cotización</AlertDialogTitle>
                    <AlertDialogDescription>
                        Estás a punto de eliminar la cotización de{' '}
                        <span className="font-semibold">&ldquo;{providerName}&rdquo;</span>. Esta
                        acción no se puede deshacer.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleDelete)}
                        className="space-y-4 pt-2"
                    >
                        {!isSelfDelete && (
                            <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Motivo</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                rows={3}
                                                placeholder="Explica el motivo de la eliminación..."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <AlertDialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isLoading}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" variant="destructive" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Eliminar cotización
                            </Button>
                        </AlertDialogFooter>
                    </form>
                </Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
