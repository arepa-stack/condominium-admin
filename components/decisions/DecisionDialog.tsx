'use client';

import { useEffect, useState } from 'react';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import {
    DECISION_QUOTE_MAX_BYTES,
    DECISION_QUOTE_MIME_ALLOWED,
} from '@/lib/utils/constants';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { Decision, DecisionProcessType } from '@/types/models';

const DECISION_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const DECISION_PHOTO_MIME_ALLOWED = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

const commonFields = {
    building_id: z.string().min(1, 'Selecciona un edificio'),
    title: z
        .string()
        .min(5, 'El título debe tener al menos 5 caracteres')
        .max(200, 'El título no puede superar 200 caracteres'),
    description: z.string(),
};

const votingSchema = z.object({
    ...commonFields,
    process_type: z.literal('VOTING'),
    reception_deadline: z.string().min(1, 'La fecha límite de recepción es obligatoria'),
    voting_deadline: z.string().min(1, 'La fecha límite de votación es obligatoria'),
    tiebreak_duration_hours: z.coerce.number().int().min(1).max(720),
    photo: z
        .instanceof(File)
        .optional()
        .refine(
            (file) =>
                !file ||
                (DECISION_PHOTO_MIME_ALLOWED as readonly string[]).includes(file.type),
            'Solo se aceptan JPEG, PNG o WebP.',
        )
        .refine(
            (file) => !file || file.size <= DECISION_PHOTO_MAX_BYTES,
            'La foto supera el tamaño máximo de 5 MB.',
        ),
});

const directAwardSchema = z.object({
    ...commonFields,
    process_type: z.literal('DIRECT_AWARD'),
    provider_name: z.string().trim().min(2, 'Ingresa el nombre del proveedor'),
    amount: z.string().trim().refine(
        (value) => value !== '' && Number.isFinite(Number(value)) && Number(value) > 0,
        'Ingresa un monto mayor a cero',
    ),
    notes: z.string(),
    quote_file: z
        .instanceof(File)
        .optional()
        .refine(
            (file) =>
                !file ||
                (DECISION_QUOTE_MIME_ALLOWED as readonly string[]).includes(file.type),
            'Solo se aceptan PDF, JPEG, PNG o WebP.',
        )
        .refine(
            (file) => !file || file.size <= DECISION_QUOTE_MAX_BYTES,
            'La cotización supera el tamaño máximo de 5 MB.',
        ),
    reason: z
        .string()
        .trim()
        .min(5, 'Explica brevemente por qué se adjudica sin votación'),
});

const schema = z
    .discriminatedUnion('process_type', [votingSchema, directAwardSchema])
    .superRefine((values, ctx) => {
        if (values.process_type === 'VOTING') {
            if (new Date(values.voting_deadline) <= new Date(values.reception_deadline)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['voting_deadline'],
                    message: 'La votación debe ser posterior a la recepción',
                });
            }
            if (new Date(values.reception_deadline) <= new Date()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['reception_deadline'],
                    message: 'La fecha de recepción debe ser en el futuro',
                });
            }
        }
    });

interface FormValues {
    process_type: DecisionProcessType;
    building_id: string;
    title: string;
    description: string;
    reception_deadline: string;
    voting_deadline: string;
    tiebreak_duration_hours: number;
    photo?: File;
    provider_name: string;
    amount: string;
    notes: string;
    quote_file?: File;
    reason: string;
}

interface DecisionDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    /** Pre-selecciona el edificio. Si es undefined el admin puede elegirlo en el formulario. */
    buildingId?: string;
    /** Lista de edificios disponibles para el selector (solo necesaria cuando buildingId no está fijo) */
    availableBuildings?: Array<{ id: string; name?: string }>;
    onCreated: (decision: Decision) => void;
}

export function DecisionDialog({
    open,
    onOpenChange,
    buildingId,
    availableBuildings = [],
    onCreated,
}: DecisionDialogProps) {
    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
        defaultValues: {
            process_type: 'VOTING',
            building_id: buildingId ?? '',
            title: '',
            description: '',
            reception_deadline: '',
            voting_deadline: '',
            tiebreak_duration_hours: 48,
            photo: undefined,
            provider_name: '',
            amount: '',
            notes: '',
            quote_file: undefined,
            reason: '',
        },
    });

    useEffect(() => {
        if (buildingId) {
            form.setValue('building_id', buildingId);
        }
    }, [buildingId, form]);

    useEffect(() => {
        if (!open) form.reset();
    }, [open, form]);

    const processType = form.watch('process_type');
    const photoFile = form.watch('photo') as File | undefined;
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!photoFile) {
            setPhotoPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(photoFile);
        setPhotoPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [photoFile]);

    const finishCreation = (decision: Decision, message: string) => {
        toast.success(message);
        form.reset();
        onOpenChange(false);
        onCreated(decision);
    };

    const handleSubmit = async (values: FormValues) => {
        try {
            if (values.process_type === 'DIRECT_AWARD') {
                const formData = new FormData();
                formData.append('building_id', values.building_id);
                formData.append('title', values.title.trim());
                if (values.description.trim()) {
                    formData.append('description', values.description.trim());
                }
                formData.append('provider_name', values.provider_name.trim());
                formData.append('amount', values.amount);
                if (values.notes.trim()) {
                    formData.append('notes', values.notes.trim());
                }
                formData.append('reason', values.reason.trim());
                if (values.quote_file) {
                    formData.append('file', values.quote_file);
                }

                const { decision } = await decisionsService.createDirect(formData);
                finishCreation(decision, 'Decisión adjudicada directamente.');
                return;
            }

            const decision = await decisionsService.create({
                building_id: values.building_id,
                title: values.title,
                description: values.description || undefined,
                reception_deadline: new Date(values.reception_deadline).toISOString(),
                voting_deadline: new Date(values.voting_deadline).toISOString(),
                tiebreak_duration_hours: values.tiebreak_duration_hours,
            });

            if (values.photo) {
                try {
                    await decisionsService.uploadPhoto(decision.id, values.photo);
                } catch {
                    toast.warning('Decisión creada pero no se pudo subir la foto.');
                }
            }

            finishCreation(decision, 'Decisión creada correctamente.');
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        }
    };

    const handleInvalid = (errors: FieldErrors<FormValues>) => {
        const firstMessage = Object.values(errors)
            .map((error) => error?.message)
            .find((message): message is string => typeof message === 'string');

        toast.error(firstMessage ?? 'Revisa los campos requeridos antes de continuar.');
    };

    const { isSubmitting } = form.formState;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nueva decisión</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form
                        noValidate
                        onSubmit={form.handleSubmit(handleSubmit, handleInvalid)}
                        className="space-y-4"
                    >
                        {!buildingId && (
                            <FormField
                                control={form.control}
                                name="building_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Edificio</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona un edificio" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {availableBuildings.map((building) => (
                                                    <SelectItem key={building.id} value={building.id}>
                                                        {building.name ?? building.id}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="process_type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tipo de proceso</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="VOTING">Con votación</SelectItem>
                                            <SelectItem value="DIRECT_AWARD">
                                                Adjudicación directa
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        {processType === 'VOTING'
                                            ? 'Recibe cotizaciones y permite que los residentes elijan.'
                                            : 'Registra al único proveedor y adjudica sin abrir una votación.'}
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Título</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Reparación de ascensor" {...field} />
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
                                    <FormLabel>Descripción (opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea rows={3} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {processType === 'VOTING' ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
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
                                </div>

                                <FormField
                                    control={form.control}
                                    name="tiebreak_duration_hours"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Duración de desempate (horas)</FormLabel>
                                            <FormControl>
                                                <Input type="number" min={1} max={720} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="photo"
                                    render={({ field: { onChange, value, ...rest } }) => {
                                        const file = value as File | undefined;
                                        return (
                                            <FormItem>
                                                <FormLabel>Foto de referencia (opcional)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        onChange={(event) =>
                                                            onChange(
                                                                event.target.files?.[0] ?? undefined,
                                                            )
                                                        }
                                                        {...rest}
                                                    />
                                                </FormControl>
                                                {photoPreviewUrl && file && (
                                                    <div className="mt-2 flex items-center gap-3 rounded-md border border-border/50 bg-muted/30 p-2">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={photoPreviewUrl}
                                                            alt={`Vista previa de ${file.name}`}
                                                            className="h-16 w-16 rounded object-cover"
                                                        />
                                                        <div className="min-w-0 text-xs text-muted-foreground">
                                                            <p className="truncate font-medium text-foreground">
                                                                {file.name}
                                                            </p>
                                                            <p>
                                                                <span className="sr-only">Tamaño: </span>
                                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <FormField
                                        control={form.control}
                                        name="provider_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Proveedor</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Nombre del proveedor"
                                                        {...field}
                                                    />
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
                                                        min="0.01"
                                                        step="0.01"
                                                        placeholder="0.00"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Notas de la cotización (opcional)</FormLabel>
                                            <FormControl>
                                                <Textarea rows={2} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="quote_file"
                                    render={({ field: { onChange, value, ...rest } }) => (
                                        <FormItem>
                                            <FormLabel>Cotización (opcional)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="file"
                                                    accept="application/pdf,image/jpeg,image/png,image/webp"
                                                    onChange={(event) =>
                                                        onChange(
                                                            event.target.files?.[0] ?? undefined,
                                                        )
                                                    }
                                                    {...rest}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                {value
                                                    ? (value as File).name
                                                    : 'PDF o imagen, máximo 5 MB.'}
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="reason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Motivo de adjudicación directa</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    rows={3}
                                                    placeholder="Ej. Es el único proveedor disponible para este servicio."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Quedará registrado en el historial de la decisión.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {processType === 'DIRECT_AWARD'
                                    ? 'Crear y adjudicar'
                                    : 'Crear decisión'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
