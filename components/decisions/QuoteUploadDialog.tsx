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
import {
    DECISION_QUOTE_MAX_BYTES,
    DECISION_QUOTE_MIME_ALLOWED,
} from '@/lib/utils/constants';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { DecisionQuote } from '@/types/models';

const schema = z.object({
    provider_name: z
        .string()
        .min(2, 'El nombre del proveedor debe tener al menos 2 caracteres')
        .max(200, 'El nombre del proveedor no puede superar 200 caracteres'),
    amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
    notes: z.string().optional(),
    file: z
        .instanceof(File, { message: 'El archivo es obligatorio' })
        .refine(
            (f) => (DECISION_QUOTE_MIME_ALLOWED as readonly string[]).includes(f.type),
            'Tipo de archivo no permitido. Solo PDF, JPEG, PNG o WebP.',
        )
        .refine(
            (f) => f.size <= DECISION_QUOTE_MAX_BYTES,
            'El archivo supera el límite de 5 MB.',
        ),
});

type FormValues = z.infer<typeof schema>;

interface QuoteUploadDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    onUploaded: (quote: DecisionQuote) => void;
}

export function QuoteUploadDialog({
    open,
    onOpenChange,
    decisionId,
    onUploaded,
}: QuoteUploadDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            provider_name: '',
            amount: 0,
            notes: '',
        },
    });

    const handleSubmit = async (values: FormValues) => {
        setIsLoading(true);
        try {
            const fd = new FormData();
            fd.append('provider_name', values.provider_name);
            fd.append('amount', String(values.amount));
            if (values.notes) fd.append('notes', values.notes);
            fd.append('file', values.file);

            const quote = await decisionsService.uploadQuote(decisionId, fd);
            toast.success('Cotización subida correctamente.');
            form.reset();
            onOpenChange(false);
            onUploaded(quote);
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
                    <DialogTitle>Subir cotización</DialogTitle>
                    <DialogDescription>
                        Adjunta el documento del proveedor (PDF o imagen, máx. 5 MB).
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        <FormField
                            control={form.control}
                            name="provider_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre del proveedor</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Constructora ABC" {...field} />
                                    </FormControl>
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
                                            min={0}
                                            step="0.01"
                                            placeholder="0.00"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notas adicionales (opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea rows={2} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="file"
                            render={({ field: { onChange, value: _value, ...rest } }) => (
                                <FormItem>
                                    <FormLabel>Documento de cotización</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept="application/pdf,image/jpeg,image/png,image/webp"
                                            onChange={(e) =>
                                                onChange(e.target.files?.[0] ?? undefined)
                                            }
                                            {...rest}
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
                                Subir cotización
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
