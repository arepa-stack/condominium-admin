'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/lib/services/auth.service';
import { toast } from 'sonner';
import { KeyRound, Lock, Loader2, CheckCircle2 } from 'lucide-react';

export default function ChangePasswordFirstLoginPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword.length < 8) {
            toast.error('La contraseña debe tener al menos 8 caracteres');
            return;
        }

        if (newPassword !== confirmPassword) {
            toast.error('Las contraseñas no coinciden');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authService.changePasswordFirstLogin(newPassword);
            if (res.success) {
                toast.success('¡Contraseña actualizada con éxito!');
                // We don't need to re-login, the token is still valid and must_change_password is cleared in backend
                router.push('/dashboard');
            }
        } catch (error: any) {
            console.error('Error updating password:', error);
            toast.error(error.message || 'Error al actualizar la contraseña.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
             {/* Background glows consistent with login page */}
             <div className="absolute top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/8 blur-[150px] rounded-full pointer-events-none" />

            <Card className="w-full max-w-sm border-border/40 bg-card/90 backdrop-blur-sm relative z-10 animate-threshold">
                <CardHeader>
                    <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 mb-4">
                        <KeyRound className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-display font-bold text-center">Bienvenido</CardTitle>
                    <CardDescription className="text-center">
                        Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
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
                                    placeholder="Mínimo 8 caracteres"
                                    className="pl-10 h-10 bg-background/50"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground px-1">
                                Mínimo 8 caracteres, una mayúscula y un número.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="confirm-password"
                                    type="password"
                                    placeholder="Repite la contraseña"
                                    className="pl-10 h-10 bg-background/50"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-10 font-bold" 
                            disabled={isSubmitting || newPassword.length < 8 || newPassword !== confirmPassword}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Actualizar y Entrar
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
