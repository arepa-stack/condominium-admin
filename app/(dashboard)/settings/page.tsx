'use client';

import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Monitor, Moon, Sun, Palette, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { authService } from '@/lib/services/auth.service';

export default function SettingsPage() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Evitar errores de hidratación mostrando nada hasta que esté montado el cliente
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const themeOptions = [
        {
            id: 'light',
            label: 'Claro',
            desc: 'Ideal para ambientes con mucha luz natural.',
            icon: Sun,
            color: 'bg-[#FBFBF9] border-[#E5E5E0]',
        },
        {
            id: 'dark',
            label: 'Oscuro',
            desc: 'Perfecto para trabajar de noche o en interiores.',
            icon: Moon,
            color: 'bg-[#1A1D23] border-[#2E333C]',
        },
        {
            id: 'system',
            label: 'Sistema',
            desc: 'Se adapta automáticamente según tu dispositivo.',
            icon: Monitor,
            color: 'bg-gradient-to-br from-[#FBFBF9] to-[#1A1D23]',
        },
    ];

    return (
        <div className="max-w-4xl space-y-8 animate-fade-in">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-foreground font-display tracking-tight flex items-center gap-3">
                    <Palette className="h-8 w-8 text-primary" />
                    Ajustes del Sistema
                </h1>
                <p className="text-muted-foreground">Personaliza tu experiencia y configuración visual.</p>
            </div>

            <Card className="border-border/50 bg-card backdrop-blur shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Palette className="h-5 w-5 text-primary" />
                        Apariencia
                    </CardTitle>
                    <CardDescription>
                        Elige el tema que mejor se adapte a tu estilo de trabajo.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <RadioGroup 
                        value={theme} 
                        onValueChange={setTheme}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        {themeOptions.map((option) => {
                            const Icon = option.icon;
                            const isSelected = theme === option.id;
                            
                            return (
                                <div key={option.id}>
                                    <RadioGroupItem
                                        value={option.id}
                                        id={option.id}
                                        className="peer sr-only"
                                    />
                                    <Label
                                        htmlFor={option.id}
                                        onClick={() => setTheme(option.id)}
                                        className={cn(
                                            "flex flex-col gap-4 rounded-xl border-2 bg-muted/20 p-4 transition-all cursor-pointer",
                                            "hover:bg-muted/40 hover:border-border",
                                            isSelected 
                                                ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                                                : "border-transparent"
                                        )}
                                    >
                                        <div className={cn(
                                            "aspect-video w-full rounded-lg border shadow-sm flex items-center justify-center overflow-hidden",
                                            option.color
                                        )}>
                                            <Icon className={cn(
                                                "h-10 w-10",
                                                option.id === 'light' ? 'text-[#B45309]' : 'text-primary'
                                            )} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-bold leading-none tracking-tight">
                                                {option.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {option.desc}
                                            </p>
                                        </div>
                                    </Label>
                                </div>
                            );
                        })}
                    </RadioGroup>
                </CardContent>
            </Card>

            <Card className="border-border/50 bg-card backdrop-blur shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Lock className="h-5 w-5 text-primary" />
                        Seguridad
                    </CardTitle>
                    <CardDescription>
                        Gestiona el acceso a tu cuenta y cambia tu contraseña.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4 max-w-md">
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nueva Contraseña</Label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    id="new-password"
                                    type="password"
                                    placeholder="Mínimo 6 caracteres"
                                    className="pl-10"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                El backend requiere al menos 6 caracteres.
                            </p>
                        </div>
                        
                        <Button 
                            className="w-full sm:w-auto font-bold"
                            disabled={isSubmitting || newPassword.length < 6}
                            onClick={async () => {
                                try {
                                    setIsSubmitting(true);
                                    const res = await authService.changePassword(newPassword);
                                    if (res.success) {
                                        toast.success('Contraseña actualizada correctamente', {
                                            icon: <ShieldCheck className="h-5 w-5 text-green-500" />
                                        });
                                        setNewPassword('');
                                    }
                                } catch (error: any) {
                                    console.error('Error changing password:', error);
                                    toast.error(error.message || 'Error al actualizar la contraseña');
                                } finally {
                                    setIsSubmitting(false);
                                }
                            }}
                        >
                            {isSubmitting ? 'Actualizando...' : 'Actualizar Contraseña'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="p-8 border-2 border-dashed border-border/30 rounded-2xl flex flex-col items-center justify-center text-center gap-2 opacity-60">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Palette className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                    <p className="font-semibold text-sm">Más ajustes próximamente</p>
                    <p className="text-xs text-muted-foreground">Estamos trabajando en opciones de idioma y notificaciones.</p>
                </div>
            </div>
        </div>
    );
}
