'use client';

import { useEffect, useState } from 'react';
import { CreditCard, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { paymentInfoService } from '@/lib/services/payment-info.service';
import type { BuildingPaymentInfoFields } from '@/types/models';

const MAX_QR_BYTES = 2 * 1024 * 1024;

const EMPTY: BuildingPaymentInfoFields = {
    bank_name: '',
    bank_code: '',
    account_holder: '',
    rif: '',
    account_number: '',
    pago_movil_phone: '',
    email: '',
};

const FIELDS: Array<{ key: keyof BuildingPaymentInfoFields; label: string; placeholder: string; hint?: string }> = [
    { key: 'bank_name', label: 'Banco', placeholder: 'Bancaribe' },
    { key: 'bank_code', label: 'Código del banco', placeholder: '0114', hint: '4 dígitos' },
    { key: 'account_holder', label: 'Titular', placeholder: 'Edificio Residencias ...' },
    { key: 'rif', label: 'RIF', placeholder: 'J-123456789' },
    { key: 'account_number', label: 'Número de cuenta', placeholder: '0114-0000-0000-0000-0000', hint: '20 dígitos' },
    { key: 'pago_movil_phone', label: 'Teléfono Pago Móvil', placeholder: '0412-1234567', hint: '11 dígitos' },
    { key: 'email', label: 'Correo', placeholder: 'condominio@correo.com' },
];

export function PaymentInfoPage({ buildingId: propBuildingId }: { buildingId?: string }) {
    const { selectedBuildingId } = useBuildingContext();
    const buildingId = propBuildingId || selectedBuildingId || undefined;

    const [fields, setFields] = useState<BuildingPaymentInfoFields>(EMPTY);
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [qrFile, setQrFile] = useState<File | null>(null);
    const [qrPreview, setQrPreview] = useState<string | null>(null);
    const [removeQr, setRemoveQr] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!buildingId) return;
        let cancelled = false;
        setLoading(true);
        paymentInfoService.get(buildingId)
            .then(info => {
                if (cancelled) return;
                setFields(Object.fromEntries(
                    (Object.keys(EMPTY) as Array<keyof BuildingPaymentInfoFields>).map(key => [key, info[key] ?? ''])
                ) as BuildingPaymentInfoFields);
                setQrUrl(info.qr_url);
                setQrFile(null);
                setRemoveQr(false);
            })
            .catch(error => toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los datos de pago'))
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [buildingId]);

    // Local preview for a just-picked file; the object URL is revoked when replaced.
    useEffect(() => {
        if (!qrFile) { setQrPreview(null); return; }
        const url = URL.createObjectURL(qrFile);
        setQrPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [qrFile]);

    if (!buildingId) {
        return (
            <EmptyState
                icon={CreditCard}
                title="Selecciona un edificio"
                message="Elige un edificio en el selector de la barra lateral para configurar sus datos de pago."
            />
        );
    }

    const shownQr = qrPreview ?? (removeQr ? null : qrUrl);
    const busy = loading || saving;

    const save = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        try {
            const info = await paymentInfoService.update(buildingId, fields, qrFile, removeQr && !qrFile);
            setQrUrl(info.qr_url);
            setQrFile(null);
            setRemoveQr(false);
            toast.success('Datos de pago guardados');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los datos de pago');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={save} className="max-w-4xl space-y-6 animate-fade-in">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-foreground font-display tracking-tight flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-primary" />
                    Datos de pago
                </h1>
                <p className="text-muted-foreground">
                    Los residentes ven estos datos en &quot;Pagar ahora&quot; de la app para hacer su transferencia o Pago Móvil.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Cuenta bancaria y Pago Móvil</CardTitle>
                    <CardDescription>Deja en blanco lo que no aplique; no se mostrará en la app.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                    {FIELDS.map(({ key, label, placeholder, hint }) => (
                        <div key={key} className="space-y-1.5">
                            <Label htmlFor={key}>{label}</Label>
                            <Input
                                id={key}
                                value={fields[key] ?? ''}
                                placeholder={placeholder}
                                disabled={busy}
                                type={key === 'email' ? 'email' : 'text'}
                                onChange={event => setFields(prev => ({ ...prev, [key]: event.target.value }))}
                            />
                            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Código QR de Pago Móvil</CardTitle>
                    <CardDescription>PNG, JPG o WebP de hasta 2 MB. Se muestra en la pestaña Pago Móvil de la app.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-6 items-start">
                    <div className="h-48 w-48 shrink-0 rounded-xl border border-border bg-white flex items-center justify-center overflow-hidden">
                        {shownQr
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={shownQr} alt="Código QR de Pago Móvil" className="h-full w-full object-contain" />
                            : <span className="text-sm text-muted-foreground px-4 text-center">Sin código QR</span>}
                    </div>
                    <div className="flex flex-col gap-3">
                        <Label
                            htmlFor="qr-file"
                            className={`inline-flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent ${busy ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
                        >
                            <ImagePlus className="h-4 w-4" />
                            {shownQr ? 'Cambiar imagen' : 'Subir imagen'}
                        </Label>
                        <input
                            id="qr-file"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            disabled={busy}
                            onChange={event => {
                                const file = event.target.files?.[0] ?? null;
                                event.target.value = '';
                                if (file && file.size > MAX_QR_BYTES) {
                                    toast.error('La imagen supera 2 MB');
                                    return;
                                }
                                setQrFile(file);
                                setRemoveQr(false);
                            }}
                        />
                        {shownQr && (
                            <Button
                                type="button"
                                variant="ghost"
                                className="text-destructive justify-start"
                                disabled={busy}
                                onClick={() => { setQrFile(null); setRemoveQr(true); }}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Quitar código QR
                            </Button>
                        )}
                        {(qrFile || removeQr) && (
                            <p className="text-xs text-muted-foreground">El cambio del QR se aplica al guardar.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" disabled={busy}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Guardar datos de pago
                </Button>
            </div>
        </form>
    );
}
