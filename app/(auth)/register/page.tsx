'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, CheckCircle2, Home, Loader2, FileText, User, Mail, Phone } from 'lucide-react';
import { publicService } from '@/lib/services/public.service';
import type { Building, Unit } from '@/types/models';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const registerSchema = z.object({
    firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
    lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    documentId: z.string().min(4, 'Documento de identidad requerido'),
    phone: z.string().optional(),
    unitId: z.string().min(1, 'Debe seleccionar una unidad/apartamento'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

function RegisterPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const code = searchParams.get('code');

    const [building, setBuilding] = useState<Building | null>(null);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const selectedUnitId = watch('unitId');

    useEffect(() => {
        if (!code) {
            setError('No se proporcionó un código de edificio válido en la URL.');
            setIsLoading(false);
            return;
        }

        const fetchBuildingData = async () => {
            try {
                setIsLoading(true);
                const fetchedBuilding = await publicService.getBuildingByCode(code);
                setBuilding(fetchedBuilding);
                
                try {
                    const fetchedUnits = await publicService.getBuildingUnitsByCode(code);
                    setUnits(fetchedUnits);
                } catch (unitError) {
                    console.error('Error fetching units', unitError);
                    toast.error('No se pudieron cargar las unidades del edificio.');
                }
            } catch (err: any) {
                console.error('Error fetching building', err);
                setError('No se encontró el edificio o el código es inválido.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchBuildingData();
    }, [code]);

    const onSubmit = async (data: RegisterFormData) => {
        if (!building || !code) return;
        
        setIsSubmitting(true);
        try {
            await publicService.submitRegistrationRequest({
                buildingCode: code,
                unitId: data.unitId,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                documentId: data.documentId,
                phone: data.phone,
            });
            setIsSuccess(true);
        } catch (err: any) {
            console.error('Submit error:', err);
            toast.error(err.response?.data?.message || 'Error al enviar la solicitud. Por favor intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
                <Card className="w-full max-w-md shadow-lg border-border/50">
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                        <p className="text-muted-foreground font-medium animate-pulse">Verificando código de edificio...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error || !building) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
                <Card className="w-full max-w-md shadow-lg border-destructive/20">
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl text-destructive flex items-center justify-center gap-2">
                            <Building2 className="h-6 w-6" />
                            Edificio No Encontrado
                        </CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-center text-sm text-muted-foreground">
                        Por favor, solicita un nuevo código QR a la junta de condominio o administración.
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button onClick={() => router.push('/login')} variant="outline">Ir al inicio de sesión</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
                <Card className="w-full max-w-md shadow-lg border-primary/20 bg-primary/5">
                    <CardHeader className="text-center">
                        <div className="flex justify-center mb-4">
                            <CheckCircle2 className="h-16 w-16 text-primary" />
                        </div>
                        <CardTitle className="text-2xl text-foreground">¡Solicitud Enviada!</CardTitle>
                        <CardDescription className="text-base mt-2">
                            Tu solicitud para unirte a <strong>{building.name}</strong> ha sido enviada con éxito.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center text-sm text-muted-foreground space-y-4">
                        <p>La junta del condominio o la administración revisará tus datos. Recibirás una notificación por correo electrónico cuando tu solicitud sea aprobada.</p>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Button onClick={() => router.push('/login')} className="w-full">Volver al inicio</Button>
                    </CardFooter>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4 py-8">
            <div className="w-full max-w-md mb-6 text-center">
                <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
                    <Building2 className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{building.name}</h1>
                <p className="text-muted-foreground mt-1">Registro de Nuevo Residente</p>
                {building.address && <p className="text-xs text-muted-foreground mt-1">{building.address}</p>}
            </div>

            <Card className="w-full max-w-md shadow-lg border-border/50">
                <CardHeader>
                    <CardTitle className="text-xl">Completa tus datos</CardTitle>
                    <CardDescription>
                        Ingresa la información solicitada para verificar tu residencia en el edificio.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        
                        <div className="space-y-2">
                            <Label htmlFor="unitId">Apartamento / Unidad</Label>
                            <Select value={selectedUnitId} onValueChange={(val) => setValue('unitId', val)}>
                                <SelectTrigger className="w-full bg-background/50 border-border/50">
                                    <div className="flex items-center gap-2">
                                        <Home className="h-4 w-4 text-muted-foreground" />
                                        <SelectValue placeholder="Seleccionar unidad" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {units.length === 0 ? (
                                        <SelectItem value="none" disabled>No hay unidades disponibles</SelectItem>
                                    ) : (
                                        units.map((u) => (
                                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            {errors.unitId && <p className="text-xs text-destructive">{errors.unitId.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">Nombre</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input id="firstName" placeholder="Carlos" className="pl-10 bg-background/50 border-border/50 focus:border-primary" {...register('firstName')} />
                                </div>
                                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Apellido</Label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0" />
                                    <Input id="lastName" placeholder="Pérez" className="pl-3 bg-background/50 border-border/50 focus:border-primary" {...register('lastName')} />
                                </div>
                                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="documentId">Documento de Identidad (Cédula/DNI)</Label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="documentId" placeholder="V-12345678" className="pl-10 bg-background/50 border-border/50 focus:border-primary" {...register('documentId')} />
                            </div>
                            {errors.documentId && <p className="text-xs text-destructive">{errors.documentId.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="email" type="email" placeholder="carlos@ejemplo.com" className="pl-10 bg-background/50 border-border/50 focus:border-primary" {...register('email')} />
                            </div>
                            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono (Opcional)</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="phone" placeholder="+58 414 1234567" className="pl-10 bg-background/50 border-border/50 focus:border-primary" {...register('phone')} />
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Enviando solicitud...
                                    </>
                                ) : (
                                    'Enviar Solicitud de Registro'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function RegisterPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-muted/30">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        }>
            <RegisterPageContent />
        </Suspense>
    );
}
