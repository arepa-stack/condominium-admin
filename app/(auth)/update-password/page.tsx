'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/lib/services/auth.service';
import { toast } from 'sonner';
import { KeyRound, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCheckingToken, setIsCheckingToken] = useState(true);
    const [tokenError, setTokenError] = useState(false);

    useEffect(() => {
        // Supabase sends the token in the URL fragment (#access_token=...)
        // We need to extract it and save it to localStorage so the apiClient can use it
        const hash = window.location.hash;
        if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken) {
                localStorage.setItem('access_token', accessToken);
                if (refreshToken) {
                    localStorage.setItem('refresh_token', refreshToken);
                }
                setIsCheckingToken(false);
            } else {
                setTokenError(true);
                setIsCheckingToken(false);
            }
        } else {
            // If no hash, check if we already have a token (maybe the user refreshed or is already loged in)
            if (authService.isAuthenticated()) {
                setIsCheckingToken(false);
            } else {
                setTokenError(true);
                setIsCheckingToken(false);
            }
        }
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authService.changePassword(newPassword);
            if (res.success) {
                toast.success('¡Contraseña actualizada! Ya puedes iniciar sesión.');
                // Clear the temporary tokens so they have to log in with the new password
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                router.push('/login');
            }
        } catch (error: any) {
            console.error('Error updating password:', error);
            toast.error(error.message || 'Error al actualizar la contraseña. El enlace puede haber expirado.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isCheckingToken) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse">Verificando enlace de seguridad...</p>
                </div>
            </div>
        );
    }

    if (tokenError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-sm border-destructive/20 bg-destructive/5 backdrop-blur-sm">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                            <Lock className="w-6 h-6 text-destructive" />
                        </div>
                        <CardTitle className="text-destructive font-display">Enlace Inválido</CardTitle>
                        <CardDescription>
                            El enlace para restablecer tu contraseña parece ser inválido o ha expirado.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center">
                        <Button variant="outline" onClick={() => router.push('/login')}>
                            Volver al inicio de sesión
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
             {/* Background glows consistent with login page */}
             <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/8 blur-[150px] rounded-full pointer-events-none" />

            <Card className="w-full max-w-sm border-border/40 bg-card/90 backdrop-blur-sm relative z-10 animate-threshold">
                <CardHeader>
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-4">
                        <KeyRound className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-display font-bold text-center">Nueva Contraseña</CardTitle>
                    <CardDescription className="text-center">
                        Crea una contraseña segura para volver a entrar a tu cuenta.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">Nueva Contraseña</Label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Mínimo 6 caracteres"
                                    className="pl-10 h-10 bg-background/50"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <Button type="submit" className="w-full h-10 font-bold" disabled={isSubmitting || newPassword.length < 6}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Restablecer Contraseña
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
