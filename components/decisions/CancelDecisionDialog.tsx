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
import type { Decision } from '@/types/models';

const schema = z.object({
    reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
});

type FormValues = z.infer<typeof schema>;

interface CancelDecisionDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    decisionTitle: string;
    onCancelled: (decision: Decision) => void;
}

export function CancelDecisionDialog({
    open,
    onOpenChange,
    decisionId,
    decisionTitle,
    onCancelled,
}: CancelDecisionDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: { reason: '' },
    });

    const handleSubmit = async (values: FormValues) => {
        setIsLoading(true);
        try {
            const decision = await decisionsService.cancel(decisionId, { reason: values.reason });
            toast.success('Decisión cancelada.');
            form.reset();
            onOpenChange(false);
            onCancelled(decision);
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
                    <AlertDialogTitle>Cancelar decisión</AlertDialogTitle>
                    <AlertDialogDescription>
                        Estás a punto de cancelar{' '}
                        <span className="font-semibold">&ldquo;{decisionTitle}&rdquo;</span>. Esta
                        acción es irreversible. Las cotizaciones y votos quedarán archivados.
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
                                    <FormLabel>Motivo de cancelación</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            rows={3}
                                            placeholder="Explica el motivo..."
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
                            <Button type="submit" variant="destructive" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Cancelar decisión
                            </Button>
                        </AlertDialogFooter>
                    </form>
                </Form>
            </AlertDialogContent>
        </AlertDialog>
    );
}
