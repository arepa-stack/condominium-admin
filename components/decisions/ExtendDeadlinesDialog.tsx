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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { Decision, DecisionStatus } from '@/types/models';

const schema = z
    .object({
        reception_deadline: z.string().optional(),
        voting_deadline: z.string().optional(),
        reason: z.string().min(5, 'El motivo debe tener al menos 5 caracteres'),
    })
    .superRefine((val, ctx) => {
        if (!val.reception_deadline && !val.voting_deadline) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['voting_deadline'],
                message: 'Debes modificar al menos una fecha',
            });
        }
        if (
            val.reception_deadline &&
            val.voting_deadline &&
            new Date(val.voting_deadline) <= new Date(val.reception_deadline)
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['voting_deadline'],
                message: 'La votación debe ser posterior a la recepción',
            });
        }
    });

type FormValues = z.infer<typeof schema>;

interface ExtendDeadlinesDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    currentStatus: DecisionStatus;
    currentReceptionDeadline: string;
    currentVotingDeadline: string;
    onExtended: (decision: Decision) => void;
}

export function ExtendDeadlinesDialog({
    open,
    onOpenChange,
    decisionId,
    currentStatus,
    currentReceptionDeadline,
    currentVotingDeadline,
    onExtended,
}: ExtendDeadlinesDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const isVoting = currentStatus === 'VOTING';

    const toLocalDatetime = (iso: string) => {
        const d = new Date(iso);
        const offset = d.getTimezoneOffset();
        const local = new Date(d.getTime() - offset * 60000);
        return local.toISOString().slice(0, 16);
    };

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            reception_deadline: isVoting ? '' : toLocalDatetime(currentReceptionDeadline),
            voting_deadline: toLocalDatetime(currentVotingDeadline),
            reason: '',
        },
    });

    const handleSubmit = async (values: FormValues) => {
        setIsLoading(true);
        try {
            const decision = await decisionsService.extendDeadlines(decisionId, {
                reception_deadline: values.reception_deadline
                    ? new Date(values.reception_deadline).toISOString()
                    : undefined,
                voting_deadline: values.voting_deadline
                    ? new Date(values.voting_deadline).toISOString()
                    : undefined,
                reason: values.reason,
            });
            toast.success('Plazos extendidos correctamente.');
            form.reset();
            onOpenChange(false);
            onExtended(decision);
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
                    <DialogTitle>Extender plazos</DialogTitle>
                    <DialogDescription>
                        Modifica las fechas límite de esta decisión. El motivo queda registrado en
                        el historial de auditoría.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        {!isVoting && (
                            <FormField
                                control={form.control}
                                name="reception_deadline"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Límite de recepción</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="voting_deadline"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Límite de votación</FormLabel>
                                    <FormControl>
                                        <Input type="datetime-local" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Motivo de la extensión</FormLabel>
                                    <FormControl>
                                        <Textarea rows={3} placeholder="Explica el motivo..." {...field} />
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
                                Extender plazos
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
