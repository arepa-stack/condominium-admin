'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loginSchema } from '@/lib/utils/validation';
import { Building2, Mail, Loader2, KeyRound } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { authService } from '@/lib/services/auth.service';
import { toast } from 'sonner';

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const [resetEmail, setResetEmail] = useState('');
    const [isResetting, setIsResetting] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const onSubmit = async (data: LoginFormData) => {
        setIsLoading(true);
        try {
            await login(data.email, data.password);
            toast.success('¡Sesión iniciada!');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error al iniciar sesión');
        } finally {
            setIsLoading(false);
        }
    };

    const onResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetEmail) return;

        setIsResetting(true);
        try {
            await authService.requestPasswordReset(resetEmail);
            toast.success('Si la cuenta existe, recibirás un correo con instrucciones.');
            setIsDialogOpen(false);
            setResetEmail('');
        } catch (error: any) {
            toast.error(error.message || 'Error al solicitar el restablecimiento');
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
            {/* Warm ambient glow — terracotta light spilling from above */}
            <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/8 blur-[150px] rounded-full pointer-events-none" />
            {/* Secondary warm glow bottom-right */}
            <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-primary/4 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-sm relative z-10 animate-threshold">
                {/* Brand mark */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-4">
                        <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">
                        Condominio
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Iniciá sesión para gestionar tu comunidad
                    </p>
                </div>

                <Card className="border-border/40 bg-card/90 backdrop-blur-sm">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@example.com"
                                    {...register('email')}
                                    disabled={isLoading}
                                    className="bg-background/50 border-border/50 focus:border-primary/30"
                                />
                                {errors.email && (
                                    <p className="text-sm text-destructive">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm text-muted-foreground">Contraseña</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    {...register('password')}
                                    disabled={isLoading}
                                    className="bg-background/50 border-border/50 focus:border-primary/30"
                                />
                                {errors.password && (
                                    <p className="text-sm text-destructive">{errors.password.message}</p>
                                )}
                            </div>

                            <Button type="submit" className="w-full mt-2" disabled={isLoading}>
                                {isLoading ? (
                                    <span className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Iniciando sesión...
                                    </span>
                                ) : (
                                    'Iniciar sesión'
                                )}
                            </Button>
                        </form>

                        <div className="mt-4 text-center">
                            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                                <DialogTrigger asChild>
                                    <button className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <KeyRound className="h-5 w-5 text-primary" />
                                            Recuperar Contraseña
                                        </DialogTitle>
                                        <DialogDescription>
                                            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={onResetPassword} className="space-y-4 pt-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="reset-email">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="reset-email"
                                                    type="email"
                                                    placeholder="tu@email.com"
                                                    className="pl-10"
                                                    value={resetEmail}
                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button 
                                                type="submit" 
                                                className="w-full" 
                                                disabled={isResetting || !resetEmail}
                                            >
                                                {isResetting ? (
                                                    <>
                                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        Enviando...
                                                    </>
                                                ) : 'Enviar instrucciones'}
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>

                <p className="text-xs text-muted-foreground/50 text-center mt-6">
                    Sistema de Administración de Condominios
                </p>
            </div>
        </div>
    );
}
