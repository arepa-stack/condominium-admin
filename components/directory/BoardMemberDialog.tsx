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
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { directoryService } from '@/lib/services/directory.service';
import { getErrorMessage } from '@/lib/utils/errors';
import type { BoardMember } from '@/types/models';

const schema = z.object({
    first_name: z.string().min(2, 'Mínimo 2 caracteres'),
    last_name: z.string().min(2, 'Mínimo 2 caracteres'),
    role: z.string().min(2, 'El cargo es obligatorio'),
    phone: z.string().optional(),
    email: z.string().email('Correo inválido').optional().or(z.literal('')),
    apartment_number: z.string().optional(),
    is_current_board: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    member: BoardMember | null;
    onSuccess: () => void;
}

export function BoardMemberDialog({ open, onOpenChange, buildingId, member, onSuccess }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<FormData>({
        resolver: zodResolver(schema),
        defaultValues: {
            first_name: '',
            last_name: '',
            role: '',
            phone: '',
            email: '',
            apartment_number: '',
            is_current_board: true,
        },
    });

    useEffect(() => {
        if (member) {
            form.reset({
                first_name: member.first_name,
                last_name: member.last_name,
                role: member.role,
                phone: member.phone ?? '',
                email: member.email ?? '',
                apartment_number: member.apartment_number ?? '',
                is_current_board: member.is_current_board,
            });
        } else {
            form.reset({
                first_name: '',
                last_name: '',
                role: '',
                phone: '',
                email: '',
                apartment_number: '',
                is_current_board: true,
            });
        }
    }, [member, form]);

    const onSubmit = async (data: FormData) => {
        const payload = {
            ...data,
            email: data.email?.trim() || undefined,
            phone: data.phone?.trim() || undefined,
            apartment_number: data.apartment_number?.trim() || undefined,
        };
        setIsSubmitting(true);
        try {
            if (member) {
                await directoryService.updateBoardMember(buildingId, member.id, payload);
                toast.success('Miembro actualizado');
            } else {
                await directoryService.createBoardMember(buildingId, payload);
                toast.success('Miembro creado');
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
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{member ? 'Editar miembro' : 'Nuevo miembro de junta'}</DialogTitle>
                    <DialogDescription>
                        {member ? 'Actualizá los datos de este miembro.' : 'Agregá un miembro a la junta del edificio.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="first_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre</FormLabel>
                                    <FormControl><Input {...field} placeholder="Juan" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="last_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Apellido</FormLabel>
                                    <FormControl><Input {...field} placeholder="Pérez" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="role" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cargo</FormLabel>
                                <FormControl><Input {...field} placeholder="Presidente, Tesorero..." /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="phone" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Teléfono</FormLabel>
                                    <FormControl><Input {...field} placeholder="+58 412..." /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="email" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Correo</FormLabel>
                                    <FormControl><Input {...field} placeholder="correo@ejemplo.com" type="email" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>

                        <FormField control={form.control} name="apartment_number" render={({ field }) => (
                            <FormItem>
                                <FormLabel>N.° Apartamento</FormLabel>
                                <FormControl><Input {...field} placeholder="Ej. 4B" /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="is_current_board" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3 border-border/50 bg-card/40">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Junta vigente</FormLabel>
                                    <p className="text-xs text-muted-foreground">Marcar si pertenece a la junta actual.</p>
                                </div>
                            </FormItem>
                        )} />

                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {member ? 'Guardar cambios' : 'Crear miembro'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
