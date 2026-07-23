'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Target } from 'lucide-react';
import { formatMoney } from '@/lib/utils/format';

interface TargetFundCardProps {
    /** Current target fund value. 0 means "not configured". */
    targetFund: number;
    onSave: (value: number) => Promise<void>;
}

export function TargetFundCard({ targetFund, onSave }: TargetFundCardProps) {
    const [valueStr, setValueStr] = useState(() => (targetFund > 0 ? String(targetFund) : ''));
    const [isSaving, setIsSaving] = useState(false);

    // Resync when the targetFund prop resolves after the initial load, so the
    // input reflects the configured value instead of staying empty.
    useEffect(() => {
        setValueStr(targetFund > 0 ? String(targetFund) : '');
    }, [targetFund]);

    // An empty input is NOT an intentional 0 — clearing the target requires
    // typing an explicit "0". This prevents a stray Guardar click from
    // overwriting a configured target with 0.
    const parsedValue = Number(valueStr);
    const isValid = valueStr !== '' && Number.isFinite(parsedValue) && parsedValue >= 0;
    const hasChange = isValid && parsedValue !== targetFund;

    const handleSave = async () => {
        if (!isValid || !hasChange || isSaving) return;
        setIsSaving(true);
        try {
            await onSave(parsedValue);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-border/50 bg-card/50 backdrop-blur-xl md:max-w-md">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Fondo objetivo
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                    Monto mínimo que el fondo debe mantener. El prorrateo cobrará la
                    diferencia además del descubierto. Cero desactiva el objetivo.
                </p>
                {targetFund > 0 && (
                    <p className="text-xs text-muted-foreground">
                        Actual: <span className="font-semibold text-foreground">{formatMoney(targetFund)}</span>
                    </p>
                )}
                <div className="flex gap-2">
                    <Input
                        type="number"
                        step="0.01"
                        min={0}
                        placeholder="0.00"
                        value={valueStr}
                        onChange={(e) => setValueStr(e.target.value)}
                        disabled={isSaving}
                        className="flex-1"
                        aria-label="Fondo objetivo"
                    />
                    <Button
                        type="button"
                        size="sm"
                        disabled={!isValid || !hasChange || isSaving}
                        onClick={handleSave}
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            'Guardar'
                        )}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
