'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Eye, EyeOff, KeyRound, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/utils/constants';

const schema = z
    .object({
        password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
        confirm: z.string(),
    })
    .refine((d) => d.password === d.confirm, {
        message: 'Las contraseñas no coinciden',
        path: ['confirm'],
    });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
    const [token, setToken] = useState<string | null>(null);
    const [tokenError, setTokenError] = useState(false);
    const [done, setDone] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<FormData>({ resolver: zodResolver(schema) });

    useEffect(() => {
        const hash = window.location.hash.slice(1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const type = params.get('type');

        if (!accessToken || type !== 'recovery') {
            setTokenError(true);
            return;
        }
        setToken(accessToken);
    }, []);

    const onSubmit = async (data: FormData) => {
        if (!token) return;
        try {
            await axios.patch(
                `${API_BASE_URL}api/v1/app/users/me/password`,
                { new_password: data.password },
                { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
            );
            setDone(true);
            toast.success('Contraseña actualizada correctamente');
        } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || 'Error al actualizar la contraseña';
            toast.error(message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/8 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-primary/4 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-sm relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-4">
                        <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Condominio</h1>
                </div>

                <Card className="border-border/40 bg-card/90 backdrop-blur-sm">
                    <CardContent className="pt-6">
                        {tokenError ? (
                            <div className="text-center space-y-3 py-2">
                                <p className="text-sm text-destructive font-medium">Enlace inválido o expirado</p>
                                <p className="text-xs text-muted-foreground">
                                    Solicitá un nuevo email de recuperación desde la pantalla de inicio de sesión.
                                </p>
                                <Button variant="outline" className="w-full mt-2" onClick={() => (window.location.href = '/login')}>
                                    Volver al inicio de sesión
                                </Button>
                            </div>
                        ) : done ? (
                            <div className="text-center space-y-3 py-2">
                                <CheckCircle className="mx-auto h-10 w-10 text-chart-1" />
                                <p className="font-medium text-foreground">¡Contraseña actualizada!</p>
                                <p className="text-xs text-muted-foreground">Ya podés iniciar sesión con tu nueva contraseña.</p>
                                <Button className="w-full mt-2" onClick={() => (window.location.href = '/login')}>
                                    Iniciar sesión
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-4">
                                    <KeyRound className="h-5 w-5 text-primary" />
                                    <div>
                                        <p className="font-semibold text-foreground text-sm">Nueva contraseña</p>
                                        <p className="text-xs text-muted-foreground">Elegí una contraseña segura</p>
                                    </div>
                                </div>

                                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="password" className="text-sm text-muted-foreground">
                                            Nueva contraseña
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                {...register('password')}
                                                disabled={isSubmitting}
                                                className="bg-background/50 border-border/50 focus:border-primary/30 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                disabled={isSubmitting}
                                                tabIndex={-1}
                                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                            >
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {errors.password && (
                                            <p className="text-sm text-destructive">{errors.password.message}</p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirm" className="text-sm text-muted-foreground">
                                            Confirmar contraseña
                                        </Label>
                                        <div className="relative">
                                            <Input
                                                id="confirm"
                                                type={showConfirm ? 'text' : 'password'}
                                                placeholder="••••••••"
                                                {...register('confirm')}
                                                disabled={isSubmitting}
                                                className="bg-background/50 border-border/50 focus:border-primary/30 pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowConfirm((v) => !v)}
                                                disabled={isSubmitting}
                                                tabIndex={-1}
                                                aria-label={showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                            >
                                                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </button>
                                        </div>
                                        {errors.confirm && (
                                            <p className="text-sm text-destructive">{errors.confirm.message}</p>
                                        )}
                                    </div>

                                    <Button type="submit" className="w-full" disabled={isSubmitting || !token}>
                                        {isSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Actualizando...
                                            </span>
                                        ) : (
                                            'Establecer nueva contraseña'
                                        )}
                                    </Button>
                                </form>
                            </>
                        )}
                    </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground/50 text-center mt-6">
                    Sistema de Administración de Condominios
                </p>
            </div>
        </div>
    );
}
