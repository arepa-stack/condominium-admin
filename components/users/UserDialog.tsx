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
    FormDescription,
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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usersService } from '@/lib/services/users.service';
import { unitsService } from '@/lib/services/units.service';
import { Shield, User as UserIcon, Phone, Mail, Building2, Home } from 'lucide-react';
import type { User, Building, Unit } from '@/types/models';

interface UserDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    buildings: Building[];
    onSuccess: () => void;
}

export function UserDialog({ open, onOpenChange, user, buildings, onSuccess }: UserDialogProps) {
    const [units, setUnits] = useState<Unit[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(false);

    // Different schemas for create vs edit
    const createSchema = z.object({
        name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
        email: z.string().email('Email inválido'),
        password: z.string().min(6, 'La contraseña es obligatoria'),
        phone: z.string().optional(),
        building_id: z.string().min(1, 'El edificio es obligatorio'),
        unit_id: z.string().optional(),
        role: z.enum(['resident', 'board', 'admin']),
        status: z.enum(['active', 'pending', 'inactive', 'rejected']),
    });

    const editSchema = z.object({
        name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
        email: z.string().email('Email inválido'),
        password: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(['resident', 'board', 'admin']),
        status: z.enum(['active', 'pending', 'inactive', 'rejected']),
    });

    const schema = user ? editSchema : createSchema;
    type UserFormData = z.infer<typeof schema>;

    const form = useForm<UserFormData>({
        resolver: zodResolver(schema),
        defaultValues: user ? {
            name: '',
            email: '',
            password: '',
            phone: '',
            role: 'resident',
            status: 'active',
        } : {
            name: '',
            email: '',
            password: '',
            phone: '',
            building_id: '',
            unit_id: '',
            role: 'resident',
            status: 'active',
        },
    });

    const selectedBuildingId = form.watch('building_id');

    // Fetch units when building is selected (only for create mode)
    useEffect(() => {
        const fetchUnits = async () => {
            if (!user && selectedBuildingId) {
                setLoadingUnits(true);
                try {
                    const fetchedUnits = await unitsService.getUnits(selectedBuildingId);
                    setUnits(fetchedUnits);
                } catch (error) {
                    console.error('Failed to fetch units', error);
                    toast.error('No se pudieron cargar las unidades del edificio seleccionado');
                    setUnits([]);
                } finally {
                    setLoadingUnits(false);
                }
            } else {
                setUnits([]);
            }
        };
        fetchUnits();
    }, [selectedBuildingId, user]);

    // Reset form when user/dialog state changes
    useEffect(() => {
        if (user) {
            // Edit mode - profile only
            form.reset({
                name: user.name,
                email: user.email,
                password: '',
                phone: user.phone || '',
                role: user.role,
                status: user.status || 'active',
            });
        } else {
            // Create mode - includes building/unit
            form.reset({
                name: '',
                email: '',
                password: '',
                phone: '',
                building_id: '',
                unit_id: '',
                role: 'resident',
                status: 'active',
            });
        }
    }, [user, open, form]);

    const onSubmit = async (data: any) => {
        try {
            if (user) {
                // PATCH /users/:id - Only profile data
                const updateData: any = {
                    name: data.name,
                    phone: data.phone,
                    role: data.role,
                };

                if (data.password) {
                    updateData.password = data.password;
                }

                await usersService.updateUser(user.id, updateData);
                toast.success('Perfil de usuario actualizado correctamente');
            } else {
                // POST /users - Requires building_id
                await usersService.createUser({
                    name: data.name,
                    email: data.email,
                    password: data.password,
                    phone: data.phone,
                    building_id: data.building_id,
                    unit_id: data.unit_id, // Optional
                    role: data.role,
                });
                toast.success('¡Usuario creado correctamente! Usá "Gestionar roles" para agregar más unidades.');
            }
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error(user ? 'Error al actualizar el usuario' : 'Error al crear el usuario');
        }
    };

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'admin':
                return 'bg-primary/15 text-primary border-primary/30';
            case 'board':
                return 'bg-chart-2/15 text-chart-2 border-chart-2/30';
            default:
                return 'bg-muted/50 text-muted-foreground border-border/50';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] border-border/50 bg-card backdrop-blur">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {user ? (
                            <>
                                <UserIcon className="h-5 w-5 text-primary" />
                                Editar perfil de usuario
                            </>
                        ) : (
                            <>
                                <Shield className="h-5 w-5 text-primary" />
                                Crear nuevo usuario
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        {user
                            ? 'Actualizá la información del perfil. Usá "Gestionar roles" para asignar unidades y permisos del edificio.'
                            : 'Creá una cuenta de usuario. Podés asignar unidades después de la creación.'}
                    </DialogDescription>
                </DialogHeader>

                {user && user.units && user.units.length > 0 && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-primary">Unidades actuales ({user.units.length})</p>
                        <div className="flex flex-wrap gap-1">
                            {user.units.slice(0, 3).map((unit) => (
                                <Badge
                                    key={unit.unit_id}
                                    variant="outline"
                                    className="text-xs bg-background/50"
                                >
                                    {unit.unit_name || unit.unit_id.slice(0, 8)}
                                </Badge>
                            ))}
                            {user.units.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                    +{user.units.length - 3} más
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Usá "Gestionar roles" para editar las asignaciones de unidades
                        </p>
                    </div>
                )}

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <UserIcon className="h-4 w-4 text-muted-foreground" />
                                        Nombre
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="Juan Pérez"
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
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
                                    <FormLabel className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        Email
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="email"
                                            placeholder="juan@ejemplo.com"
                                            disabled={!!user}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    {user && <p className="text-[0.8rem] text-amber-400/80">⚠️ El email no se puede cambiar</p>}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{user ? 'Nueva contraseña (opcional)' : 'Contraseña'}</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            type="password"
                                            placeholder={user ? 'Dejá en blanco para conservar la actual' : '******'}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        Teléfono (opcional)
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="+507 6000-0000"
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Only show building/unit for CREATE mode */}
                        {!user && (
                            <>
                                <FormField
                                    control={form.control}
                                    name="building_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                Edificio <span className="text-destructive">*</span>
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-background/50 border-border/50">
                                                        <SelectValue placeholder="Seleccionar edificio" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {buildings.map((b) => (
                                                        <SelectItem key={b.id} value={b.id}>
                                                            <div className="flex items-center gap-2">
                                                                <Building2 className="h-4 w-4 text-primary" />
                                                                {b.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs">
                                                Requerido para crear el usuario
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="unit_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center gap-2">
                                                <Home className="h-4 w-4 text-muted-foreground" />
                                                Unidad (opcional)
                                            </FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                disabled={!selectedBuildingId || loadingUnits}
                                            >
                                                <FormControl>
                                                    <SelectTrigger className="bg-background/50 border-border/50">
                                                        <SelectValue placeholder={
                                                            !selectedBuildingId
                                                                ? "Primero seleccioná un edificio"
                                                                : loadingUnits
                                                                    ? "Cargando unidades..."
                                                                    : "Seleccionar unidad (opcional)"
                                                        } />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {units.map((unit) => (
                                                        <SelectItem key={unit.id} value={unit.id}>
                                                            <div className="flex items-center gap-2">
                                                                <Home className="h-4 w-4 text-primary" />
                                                                {unit.name}
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription className="text-xs">
                                                Podés asignar más unidades después desde "Gestionar roles"
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="role"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-muted-foreground" />
                                            Rol global
                                        </FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-background/50 border-border/50">
                                                    <SelectValue placeholder="Seleccionar rol" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="resident">
                                                    <Badge variant="outline" className={getRoleBadgeColor('resident')}>
                                                        Residente
                                                    </Badge>
                                                </SelectItem>
                                                <SelectItem value="board">
                                                    <Badge variant="outline" className={getRoleBadgeColor('board')}>
                                                        Junta
                                                    </Badge>
                                                </SelectItem>
                                                <SelectItem value="admin">
                                                    <Badge variant="outline" className={getRoleBadgeColor('admin')}>
                                                        Administrador
                                                    </Badge>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estado</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className="bg-background/50 border-border/50">
                                                    <SelectValue placeholder="Seleccionar estado" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="active">Activo</SelectItem>
                                                <SelectItem value="pending">Pendiente</SelectItem>
                                                <SelectItem value="inactive">Inactivo</SelectItem>
                                                <SelectItem value="rejected">Rechazado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="submit">
                                {user ? 'Guardar cambios' : 'Crear usuario'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
