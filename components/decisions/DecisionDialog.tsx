'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type { Decision } from '@/types/models';

const DECISION_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const DECISION_PHOTO_MIME_ALLOWED = [
    'image/jpeg',
    'image/png',
    'image/webp',
] as const;

const schema = z
    .object({
        building_id: z.string().min(1, 'Selecciona un edificio'),
        title: z
            .string()
            .min(5, 'El título debe tener al menos 5 caracteres')
            .max(200, 'El título no puede superar 200 caracteres'),
        description: z.string().optional(),
        reception_deadline: z.string().min(1, 'La fecha límite de recepción es obligatoria'),
        voting_deadline: z.string().min(1, 'La fecha límite de votación es obligatoria'),
        tiebreak_duration_hours: z.coerce.number().int().min(1).max(720),
        photo: z
            .instanceof(File)
            .optional()
            .refine(
                (f) =>
                    !f ||
                    (DECISION_PHOTO_MIME_ALLOWED as readonly string[]).includes(f.type),
                'Solo se aceptan JPEG, PNG o WebP.',
            )
            .refine(
                (f) => !f || f.size <= DECISION_PHOTO_MAX_BYTES,
                'La foto supera el tamaño máximo de 5 MB.',
            ),
    })
    .superRefine((val, ctx) => {
        if (val.reception_deadline && val.voting_deadline) {
            if (new Date(val.voting_deadline) <= new Date(val.reception_deadline)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['voting_deadline'],
                    message: 'La votación debe ser posterior a la recepción',
                });
            }
        }
        const now = new Date();
        if (val.reception_deadline && new Date(val.reception_deadline) <= now) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['reception_deadline'],
                message: 'La fecha de recepción debe ser en el futuro',
            });
        }
    });

interface FormValues {
    building_id: string;
    title: string;
    description: string;
    reception_deadline: string;
    voting_deadline: string;
    tiebreak_duration_hours: number;
    photo?: File;
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
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            building_id: buildingId ?? '',
            title: '',
            description: '',
            reception_deadline: '',
            voting_deadline: '',
            tiebreak_duration_hours: 48,
            photo: undefined,
        },
    });

    // Sincronizar buildingId si cambia desde el contexto superior (ej. selección en el dashboard)
    useEffect(() => {
        if (buildingId) {
            form.setValue('building_id', buildingId);
        }
    }, [buildingId, form]);

    // Resetear el formulario cuando el diálogo se cierra
    useEffect(() => {
        if (!open) form.reset();
    }, [open, form]);

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

    const handleSubmit = async (values: FormValues) => {
        setIsLoading(true);
        try {
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

            toast.success('Decisión creada correctamente.');
            form.reset();
            onOpenChange(false);
            onCreated(decision);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Nueva decisión</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(handleSubmit)}
                        className="space-y-4"
                    >
                        {/* Selector de edificio: solo visible cuando el admin está en vista global */}
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
                                                {availableBuildings.map((b) => (
                                                    <SelectItem key={b.id} value={b.id}>
                                                        {b.name ?? b.id}
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
                                                onChange={(e) =>
                                                    onChange(e.target.files?.[0] ?? undefined)
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
                                Crear decisión
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
