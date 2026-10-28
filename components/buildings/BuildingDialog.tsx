'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { buildingsService } from '@/lib/services/buildings.service';
import type { Building } from '@/types/models';

const buildingSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres'),
    rif: z.string().optional(),
    building_code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{3,30}$/, 'Entre 3 y 30 caracteres: letras, números o guiones')
        .optional()
        .or(z.literal('')),
});

type BuildingFormData = z.infer<typeof buildingSchema>;

interface BuildingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    building: Building | null;
    onSuccess: () => void;
}

export function BuildingDialog({ open, onOpenChange, building, onSuccess }: BuildingDialogProps) {
    const form = useForm<BuildingFormData>({
        resolver: zodResolver(buildingSchema),
        defaultValues: {
            name: '',
            address: '',
            rif: '',
            building_code: '',
        },
    });

    useEffect(() => {
        if (building) {
            form.reset({
                name: building.name,
                address: building.address,
                rif: building.rif || '',
                building_code: building.building_code || '',
            });
        } else {
            form.reset({
                name: '',
                address: '',
                rif: '',
                building_code: '',
            });
        }
    }, [building, form]);

    const onSubmit = async ({ building_code, ...data }: BuildingFormData) => {
        try {
            if (building) {
                const codeChanged = !!building_code && building_code !== building.building_code;
                if (codeChanged && !window.confirm(
                    `Cambiar el código a ${building_code} invalida los QR impresos con ${building.building_code}. ¿Continuar?`
                )) return;
                await buildingsService.updateBuilding(building.id, {
                    ...data,
                    ...(codeChanged && { building_code }),
                });
                toast.success('Edificio actualizado correctamente');
            } else {
                await buildingsService.createBuilding(data);
                toast.success('Edificio creado correctamente');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.status === 409
                ? 'Ese código ya lo usa otro edificio'
                : 'Error al guardar el edificio');
        }
    };

    const { isSubmitting } = form.formState;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{building ? 'Editar edificio' : 'Crear edificio'}</DialogTitle>
                    <DialogDescription>
                        {building ? 'Actualizá los datos del edificio.' : 'Agregá un nuevo edificio al sistema.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Residencias Ejemplo" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Dirección</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="Calle 123..." />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="rif"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>RIF (opcional)</FormLabel>
                                    <FormControl>
                                        <Input {...field} placeholder="J-12345678-9" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        {building && (
                            <FormField
                                control={form.control}
                                name="building_code"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Código del edificio (QR)</FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                                placeholder="COND-XXXX"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
