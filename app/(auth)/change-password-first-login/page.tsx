'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/lib/services/auth.service';
import { toast } from 'sonner';
import { KeyRound, Lock, Loader2, CheckCircle2, Eye, EyeOff, Check, X } from 'lucide-react';

const PASSWORD_EXAMPLE = 'Caracas2024';

export default function ChangePasswordFirstLoginPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const rules = [
        { id: 'length', label: 'Al menos 8 caracteres', valid: newPassword.length >= 8 },
        { id: 'uppercase', label: 'Una letra mayúscula', valid: /[A-Z]/.test(newPassword) },
        { id: 'number', label: 'Un número', valid: /[0-9]/.test(newPassword) },
    ];

    const allRulesValid = rules.every((r) => r.valid);
    const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
    const canSubmit = allRulesValid && passwordsMatch && !isSubmitting;

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!allRulesValid) {
            toast.error('La contraseña no cumple los requisitos.');
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
                                    type={showNewPassword ? 'text' : 'password'}
                                    placeholder={`Ej: ${PASSWORD_EXAMPLE}`}
                                    className="pl-10 pr-10 h-10 bg-background/50"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={showNewPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    tabIndex={-1}
                                >
                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            {/* Live validation checklist */}
                            <ul className="space-y-1 pt-1">
                                {rules.map((rule) => (
                                    <li
                                        key={rule.id}
                                        className={`flex items-center gap-1.5 text-[11px] transition-colors ${
                                            rule.valid ? 'text-chart-1' : 'text-muted-foreground'
                                        }`}
                                    >
                                        {rule.valid ? (
                                            <Check className="h-3 w-3 shrink-0" />
                                        ) : (
                                            <X className="h-3 w-3 shrink-0 opacity-50" />
                                        )}
                                        {rule.label}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="confirm-password"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="Repite la contraseña"
                                    className="pl-10 pr-10 h-10 bg-background/50"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {confirmPassword.length > 0 && !passwordsMatch && (
                                <p className="flex items-center gap-1.5 text-[11px] text-destructive px-1">
                                    <X className="h-3 w-3 shrink-0" />
                                    Las contraseñas no coinciden
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-10 font-bold"
                            disabled={!canSubmit}
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
