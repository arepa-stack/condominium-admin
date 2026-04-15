'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { directoryService } from '@/lib/services/directory.service';
import { getErrorMessage } from '@/lib/utils/errors';
import type { Worker } from '@/types/models';

const schema = z.object({
    first_name: z.string().min(2, 'Mínimo 2 caracteres'),
    last_name: z.string().min(2, 'Mínimo 2 caracteres'),
    role: z.string().min(2, 'El cargo/rol es obligatorio'),
    phone: z.string().optional(),
    work_schedule: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    worker: Worker | null;
    onSuccess: () => void;
}

export function WorkerDialog({ open, onOpenChange, buildingId, worker, onSuccess }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            first_name: '',
            last_name: '',
            role: '',
            phone: '',
            work_schedule: '',
        },
    });

    useEffect(() => {
        if (worker) {
            form.reset({
                first_name: worker.first_name,
                last_name: worker.last_name,
                role: worker.role,
                phone: worker.phone ?? '',
                work_schedule: worker.work_schedule ?? '',
            });
        } else {
            form.reset({
                first_name: '',
                last_name: '',
                role: '',
                phone: '',
                work_schedule: '',
            });
        }
    }, [worker, form]);

    const onSubmit = async (data: FormData) => {
        const payload = {
            ...data,
            phone: data.phone?.trim() || undefined,
            work_schedule: data.work_schedule?.trim() || undefined,
        };
        setIsSubmitting(true);
        try {
            if (worker) {
                await directoryService.updateWorker(buildingId, worker.id, payload);
                toast.success('Trabajador actualizado');
            } else {
                await directoryService.createWorker(buildingId, payload);
                toast.success('Trabajador creado');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Error al guardar'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>{worker ? 'Editar trabajador' : 'Nuevo trabajador'}</DialogTitle>
                    <DialogDescription>
                        {worker ? 'Actualizá los datos de este trabajador.' : 'Agregá un trabajador al personal del edificio.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="first_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl><Input {...field} placeholder="Carlos" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="last_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Apellido</FormLabel>
                                    <FormControl><Input {...field} placeholder="Gómez" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="role" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cargo / Rol</FormLabel>
                                <FormControl><Input {...field} placeholder="Conserje, Vigilante..." /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Teléfono</FormLabel>
                                <FormControl><Input {...field} placeholder="+58 412..." /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="work_schedule" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Horario de trabajo</FormLabel>
                                <FormControl><Input {...field} placeholder="Lun-Vie 8:00 – 17:00" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {worker ? 'Guardar cambios' : 'Crear trabajador'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
