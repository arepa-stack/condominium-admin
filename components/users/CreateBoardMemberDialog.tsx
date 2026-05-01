'use client';

import { useState } from 'react';
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
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { usersService } from '@/lib/services/users.service';
import { toast } from 'sonner';
import { Crown, Loader2, Mail, User, Phone, Building2 } from 'lucide-react';
import type { Building } from '@/types/models';

const boardMemberSchema = z.object({
    name: z.string().min(1, 'El nombre es requerido'),
    email: z.string().email('Email inválido'),
    phone: z.string().optional(),
    buildingId: z.string().min(1, 'Debe seleccionar un edificio'),
    board_position: z.string().optional(),
});

type BoardMemberFormData = z.infer<typeof boardMemberSchema>;

interface CreateBoardMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildings: Building[];
    onSuccess: () => void;
}

export function CreateBoardMemberDialog({
    open,
    onOpenChange,
    buildings,
    onSuccess
}: CreateBoardMemberDialogProps) {
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<BoardMemberFormData>({
        resolver: zodResolver(boardMemberSchema),
    });

    const buildingId = watch('buildingId');

    const onSubmit = async (data: BoardMemberFormData) => {
        try {
            await usersService.createBoardMember(data);
            toast.success('Miembro de junta creado. Se ha enviado un correo con sus credenciales.');
            onSuccess();
            onOpenChange(false);
            reset();
        } catch (error: any) {
            toast.error(error.message || 'Error al crear el miembro de junta');
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) reset();
            onOpenChange(val);
        }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Crown className="h-5 w-5 text-primary" />
                        Nuevo Miembro de Junta
                    </DialogTitle>
                    <DialogDescription>
                        Crea un usuario con rol de Junta para un edificio. Recibirá una contraseña temporal por email.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nombre Completo</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="name"
                                placeholder="Ej: María González"
                                className="pl-10"
                                {...register('name')}
                            />
                        </div>
                        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Correo Electrónico</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="email"
                                type="email"
                                placeholder="maria@ejemplo.com"
                                className="pl-10"
                                {...register('email')}
                            />
                        </div>
                        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono (Opcional)</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="phone"
                                placeholder="+58 412 0000000"
                                className="pl-10"
                                {...register('phone')}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="board_position">Cargo (Opcional)</Label>
                        <Select onValueChange={(val) => setValue('board_position', val)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Seleccionar cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Presidente">Presidente</SelectItem>
                                <SelectItem value="Vicepresidente">Vicepresidente</SelectItem>
                                <SelectItem value="Tesorero">Tesorero</SelectItem>
                                <SelectItem value="Secretario">Secretario</SelectItem>
                                <SelectItem value="Vocal">Vocal</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.board_position && <p className="text-xs text-destructive">{errors.board_position.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Edificio Asignado</Label>
                        <Select value={buildingId} onValueChange={(val) => setValue('buildingId', val)}>
                            <SelectTrigger className="w-full">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <SelectValue placeholder="Seleccionar edificio" />
                                </div>
                            </SelectTrigger>
                            <SelectContent>
                                {buildings.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.buildingId && <p className="text-xs text-destructive">{errors.buildingId.message}</p>}
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Crown className="mr-2 h-4 w-4" />}
                            Crear y Enviar Acceso
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
