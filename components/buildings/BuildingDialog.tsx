'use client';

import { useEffect, useState } from 'react';
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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildingsService } from '@/lib/services/buildings.service';
import type { Building } from '@/types/models';

const buildingSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    address: z.string().min(5, 'La dirección debe tener al menos 5 caracteres'),
    rif: z.string().optional(),
});

type BuildingFormData = z.infer<typeof buildingSchema>;

interface BuildingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    building: Building | null;
    onSuccess: () => void;
}

export function BuildingDialog({ open, onOpenChange, building, onSuccess }: BuildingDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<BuildingFormData>({
        resolver: zodResolver(buildingSchema),
        defaultValues: {
            name: '',
            address: '',
            rif: '',
        },
    });

    useEffect(() => {
        if (building) {
            form.reset({
                name: building.name,
                address: building.address,
                rif: building.rif || '',
            });
        } else {
            form.reset({
                name: '',
                address: '',
                rif: '',
            });
        }
    }, [building, form]);

    const onSubmit = async (data: BuildingFormData) => {
        const payload = {
            ...data,
            rif: data.rif?.trim() ? data.rif.trim() : undefined,
        };
        setIsSubmitting(true);
        try {
            if (building) {
                await buildingsService.updateBuilding(building.id, payload);
                toast.success('Edificio actualizado correctamente');
            } else {
                await buildingsService.createBuilding(payload);
                toast.success('Edificio creado correctamente');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el edificio');
        } finally {
            setIsSubmitting(false);
        }
    };

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
