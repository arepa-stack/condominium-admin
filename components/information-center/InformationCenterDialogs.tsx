'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton } from '@/components/ui/skeletons';
import { Textarea } from '@/components/ui/textarea';
import { informationCenterService } from '@/lib/services/information-center.service';
import type {
    Announcement,
    AnnouncementMetrics,
    AnnouncementReader,
    RecommendedService,
    Rule,
    RuleCategory,
} from '@/types/models';
import {
    announcementCategoryOptions,
    formatDateTime,
    validateInformationCenterAttachment,
} from './utils';

type BuildingOption = { id: string; name?: string };

const NO_CATEGORY = '__none__';

function toDateTimeLocal(value?: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
}

function getMinDateTimeLocal() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
}

function normalizeNullableText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}

function BuildingSelect({
    value,
    onChange,
    availableBuildings,
    disabled,
}: {
    value: string;
    onChange: (value: string) => void;
    availableBuildings: BuildingOption[];
    disabled?: boolean;
}) {
    return (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar edificio" />
            </SelectTrigger>
            <SelectContent>
                {availableBuildings.map((building) => (
                    <SelectItem key={building.id} value={building.id}>
                        {building.name || 'Edificio sin nombre'}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

const announcementSchema = z.object({
    building_id: z.string().min(1, 'Seleccioná un edificio'),
    title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
    content: z.string().min(1, 'El contenido es requerido'),
    category: z.enum(['INFO', 'URGENT', 'FINANCIAL', 'MAINTENANCE', 'NEWS']),
    is_pinned: z.boolean(),
    expires_at: z.string().optional(),
    attachment: z.any().optional(),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;

export function AnnouncementDialog({
    open,
    onOpenChange,
    announcement,
    buildingId,
    availableBuildings,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    announcement: Announcement | null;
    buildingId?: string;
    availableBuildings: BuildingOption[];
    onSuccess: () => void;
}) {
    const form = useForm<AnnouncementFormData>({
        resolver: zodResolver(announcementSchema),
        defaultValues: {
            building_id: buildingId || '',
            title: '',
            content: '',
            category: 'INFO',
            is_pinned: false,
            expires_at: '',
            attachment: null,
        },
    });

    useEffect(() => {
        form.reset({
            building_id: buildingId || announcement?.building_id || '',
            title: announcement?.title || '',
            content: announcement?.content || '',
            category: announcement?.category || 'INFO',
            is_pinned: announcement?.is_pinned || false,
            expires_at: toDateTimeLocal(announcement?.expires_at),
            attachment: null,
        });
    }, [announcement, buildingId, form, open]);

    const onSubmit = async (values: AnnouncementFormData) => {
        const attachment = values.attachment as File | null | undefined;
        const attachmentError = validateInformationCenterAttachment(attachment);
        if (attachmentError) {
            toast.error(attachmentError);
            return;
        }

        if (values.expires_at && new Date(values.expires_at) <= new Date()) {
            toast.error('La fecha de vencimiento debe ser posterior a la fecha actual.');
            return;
        }

        try {
            const payload = {
                ...values,
                expires_at: values.expires_at ? new Date(values.expires_at).toISOString() : null,
                attachment,
            };

            if (announcement) {
                await informationCenterService.updateAnnouncement(announcement.id, payload);
                toast.success('Anuncio actualizado correctamente');
            } else {
                await informationCenterService.createAnnouncement(payload);
                toast.success('Anuncio creado correctamente');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar el anuncio');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{announcement ? 'Editar anuncio' : 'Nuevo anuncio'}</DialogTitle>
                    <DialogDescription>
                        Publicá avisos para el edificio seleccionado y adjuntá documentos si hace falta.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="building_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Edificio</FormLabel>
                                    <FormControl>
                                        <BuildingSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            availableBuildings={availableBuildings}
                                            disabled={Boolean(buildingId)}
                                        />
                                    </FormControl>
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
                                        <Input {...field} placeholder="Corte de agua programado" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contenido</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={5} placeholder="Detalle del anuncio..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {announcementCategoryOptions.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
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
                                name="expires_at"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vence el</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="datetime-local" min={getMinDateTimeLocal()} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="attachment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adjunto</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept="application/pdf,image/jpeg,image/png,image/webp"
                                            onChange={(event) => field.onChange(event.target.files?.[0] ?? null)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="is_pinned"
                            render={({ field }) => (
                                <FormItem className="flex items-center gap-2 rounded-lg border border-border/50 p-3">
                                    <FormControl>
                                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                    </FormControl>
                                    <FormLabel className="mt-0!">Fijar anuncio arriba</FormLabel>
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit">Guardar</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const categorySchema = z.object({
    building_id: z.string().min(1, 'Seleccioná un edificio'),
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    description: z.string().optional(),
    icon: z.string().optional(),
    sort_order: z.number().min(0),
    is_active: z.boolean(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export function RuleCategoryDialog({
    open,
    onOpenChange,
    category,
    buildingId,
    availableBuildings,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category: RuleCategory | null;
    buildingId?: string;
    availableBuildings: BuildingOption[];
    onSuccess: () => void;
}) {
    const form = useForm<CategoryFormData>({
        resolver: zodResolver(categorySchema),
        defaultValues: {
            building_id: buildingId || '',
            name: '',
            description: '',
            icon: '',
            sort_order: 0,
            is_active: true,
        },
    });

    useEffect(() => {
        form.reset({
            building_id: buildingId || category?.building_id || '',
            name: category?.name || '',
            description: category?.description || '',
            icon: category?.icon || '',
            sort_order: category?.sort_order ?? 0,
            is_active: category?.is_active ?? true,
        });
    }, [buildingId, category, form, open]);

    const onSubmit = async (values: CategoryFormData) => {
        try {
            const payload = {
                ...values,
                description: normalizeNullableText(values.description),
                icon: normalizeNullableText(values.icon),
            };
            if (category) {
                await informationCenterService.updateRuleCategory(category.id, payload);
                toast.success('Categoría actualizada correctamente');
            } else {
                await informationCenterService.createRuleCategory(payload);
                toast.success('Categoría creada correctamente');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar la categoría');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{category ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
                    <DialogDescription>Ordená las reglas por temas visibles para la comunidad.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="building_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Edificio</FormLabel>
                                    <FormControl>
                                        <BuildingSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            availableBuildings={availableBuildings}
                                            disabled={Boolean(buildingId)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Convivencia" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="icon"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Icono</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="home" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} placeholder="Reglas generales de convivencia" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="sort_order"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Orden</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="number"
                                                min={0}
                                                onChange={(event) => field.onChange(Number(event.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 self-end rounded-lg border border-border/50 p-3">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="mt-0!">Activa</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit">Guardar</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const ruleSchema = z.object({
    building_id: z.string().min(1, 'Seleccioná un edificio'),
    category_id: z.string().optional(),
    title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
    content: z.string().min(1, 'El contenido es requerido'),
    attachment: z.any().optional(),
    is_published: z.boolean(),
    sort_order: z.number().min(0),
});

type RuleFormData = z.infer<typeof ruleSchema>;

export function RuleDialog({
    open,
    onOpenChange,
    rule,
    categories,
    buildingId,
    availableBuildings,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    rule: Rule | null;
    categories: RuleCategory[];
    buildingId?: string;
    availableBuildings: BuildingOption[];
    onSuccess: () => void;
}) {
    const form = useForm<RuleFormData>({
        resolver: zodResolver(ruleSchema),
        defaultValues: {
            building_id: buildingId || '',
            category_id: NO_CATEGORY,
            title: '',
            content: '',
            attachment: null,
            is_published: false,
            sort_order: 0,
        },
    });

    useEffect(() => {
        form.reset({
            building_id: buildingId || rule?.building_id || '',
            category_id: rule?.category_id || NO_CATEGORY,
            title: rule?.title || '',
            content: rule?.content || '',
            attachment: null,
            is_published: rule?.is_published ?? false,
            sort_order: rule?.sort_order ?? 0,
        });
    }, [buildingId, form, open, rule]);

    const onSubmit = async (values: RuleFormData) => {
        const attachment = values.attachment as File | null | undefined;
        const attachmentError = validateInformationCenterAttachment(attachment);
        if (attachmentError) {
            toast.error(attachmentError);
            return;
        }

        try {
            const payload = {
                ...values,
                category_id: values.category_id === NO_CATEGORY ? null : values.category_id,
                attachment,
            };
            if (rule) {
                await informationCenterService.updateRule(rule.id, payload);
                toast.success('Regla actualizada correctamente');
            } else {
                await informationCenterService.createRule(payload);
                toast.success('Regla creada correctamente');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar la regla');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{rule ? 'Editar regla' : 'Nueva regla'}</DialogTitle>
                    <DialogDescription>Publicá normas internas y mantené borradores si aún no están listas.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="building_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Edificio</FormLabel>
                                    <FormControl>
                                        <BuildingSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            availableBuildings={availableBuildings}
                                            disabled={Boolean(buildingId)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="title"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Título</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Uso de áreas comunes" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <FormControl>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                                                {categories.map((category) => (
                                                    <SelectItem key={category.id} value={category.id}>
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contenido</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={5} placeholder="Contenido de la regla..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="sort_order"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Orden</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="number"
                                                min={0}
                                                onChange={(event) => field.onChange(Number(event.target.value))}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="is_published"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 self-end rounded-lg border border-border/50 p-3">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="mt-0!">Publicada</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="attachment"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adjunto</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="file"
                                            accept="application/pdf,image/jpeg,image/png,image/webp"
                                            onChange={(event) => field.onChange(event.target.files?.[0] ?? null)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit">Guardar</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

const serviceSchema = z.object({
    building_id: z.string().min(1, 'Seleccioná un edificio'),
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    category: z.string().min(2, 'La categoría es requerida'),
    description: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email('Email inválido').or(z.literal('')).optional(),
    availability: z.string().optional(),
    rating: z.string().optional(),
    is_recommended: z.boolean(),
    is_active: z.boolean(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

export function RecommendedServiceDialog({
    open,
    onOpenChange,
    service,
    buildingId,
    availableBuildings,
    onSuccess,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    service: RecommendedService | null;
    buildingId?: string;
    availableBuildings: BuildingOption[];
    onSuccess: () => void;
}) {
    const form = useForm<ServiceFormData>({
        resolver: zodResolver(serviceSchema),
        defaultValues: {
            building_id: buildingId || '',
            name: '',
            category: '',
            description: '',
            phone: '',
            email: '',
            availability: '',
            rating: '',
            is_recommended: true,
            is_active: true,
        },
    });

    useEffect(() => {
        form.reset({
            building_id: buildingId || service?.building_id || '',
            name: service?.name || '',
            category: service?.category || '',
            description: service?.description || '',
            phone: service?.phone || '',
            email: service?.email || '',
            availability: service?.availability || '',
            rating: service?.rating == null ? '' : String(service.rating),
            is_recommended: service?.is_recommended ?? true,
            is_active: service?.is_active ?? true,
        });
    }, [buildingId, form, open, service]);

    const onSubmit = async (values: ServiceFormData) => {
        const rating = values.rating?.trim() ? Number(values.rating) : null;
        if (rating !== null && (Number.isNaN(rating) || rating < 0 || rating > 5)) {
            toast.error('La calificación debe estar entre 0 y 5');
            return;
        }

        try {
            const payload = {
                building_id: values.building_id,
                name: values.name,
                category: values.category,
                description: normalizeNullableText(values.description),
                phone: normalizeNullableText(values.phone),
                email: normalizeNullableText(values.email),
                availability: normalizeNullableText(values.availability),
                rating,
                is_recommended: values.is_recommended,
                is_active: values.is_active,
            };
            if (service) {
                await informationCenterService.updateRecommendedService(service.id, payload);
                toast.success('Servicio actualizado correctamente');
            } else {
                await informationCenterService.createRecommendedService(payload);
                toast.success('Servicio creado correctamente');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo guardar el servicio');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{service ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
                    <DialogDescription>Registrá contactos útiles recomendados por la administración.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="building_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Edificio</FormLabel>
                                    <FormControl>
                                        <BuildingSelect
                                            value={field.value}
                                            onChange={field.onChange}
                                            availableBuildings={availableBuildings}
                                            disabled={Boolean(buildingId)}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nombre</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Electricista recomendado" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Categoría</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Electricidad" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} placeholder="Detalle del servicio..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-4 sm:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teléfono</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="+58412..." />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="servicio@example.com" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="rating"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Rating</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="number" min={0} max={5} step="0.1" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="availability"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Disponibilidad</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Lunes a viernes" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="is_recommended"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 rounded-lg border border-border/50 p-3">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="mt-0!">Recomendado</FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="is_active"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-2 rounded-lg border border-border/50 p-3">
                                        <FormControl>
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel className="mt-0!">Activo</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit">Guardar</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

export function AnnouncementMetricsDialog({
    open,
    onOpenChange,
    announcement,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    announcement: Announcement | null;
}) {
    const [metrics, setMetrics] = useState<AnnouncementMetrics | null>(null);
    const [readers, setReaders] = useState<AnnouncementReader[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!open || !announcement) return;

        const load = async () => {
            setIsLoading(true);
            try {
                const [metricsData, readersData] = await Promise.all([
                    informationCenterService.getAnnouncementMetrics(announcement.id),
                    informationCenterService.listAnnouncementReaders(announcement.id),
                ]);
                setMetrics(metricsData);
                setReaders(readersData);
            } catch (error) {
                toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las métricas');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [announcement, open]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Métricas de anuncio</DialogTitle>
                    <DialogDescription>{announcement?.title}</DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <TableSkeleton rows={4} columns={4} />
                ) : (
                    <div className="space-y-4">
                        {metrics && (
                            <div className="grid gap-3 sm:grid-cols-4">
                                <Metric label="Residentes" value={metrics.total_residents} />
                                <Metric label="Leídos" value={metrics.reads_count} />
                                <Metric label="Pendientes" value={metrics.pending_count} />
                                <Metric label="Entendido" value={metrics.reactions_count} />
                            </div>
                        )}
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Residente</TableHead>
                                    <TableHead>Unidad</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Leído</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {readers.map((reader) => (
                                    <TableRow key={reader.user_id}>
                                        <TableCell>{reader.full_name}</TableCell>
                                        <TableCell>{reader.apartment || reader.tower || 'Sin unidad'}</TableCell>
                                        <TableCell>{reader.status === 'read' ? 'Leído' : 'Pendiente'}</TableCell>
                                        <TableCell>{formatDateTime(reader.read_at)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Metric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-border/50 bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
    );
}
