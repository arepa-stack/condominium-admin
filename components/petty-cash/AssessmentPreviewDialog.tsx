'use client';

import { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import { formatMoney } from '@/lib/utils/format';
import type { PettyCashAssessmentPreview } from '@/types/models';

interface AssessmentPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    preview: PettyCashAssessmentPreview | null;
    currency: string;
    isGenerating: boolean;
    onConfirm: () => void;
}

export function AssessmentPreviewDialog({
    open,
    onOpenChange,
    preview,
    currency,
    isGenerating,
    onConfirm,
}: AssessmentPreviewDialogProps) {
    const perUnit = useMemo(() => {
        if (!preview || preview.units.length === 0) return 0;
        return preview.pending_to_assess / preview.units.length;
    }, [preview]);

    const tooSmallToDistribute = perUnit > 0 && perUnit < 0.01;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Previsualizar recibos de reposición</DialogTitle>
                    <DialogDescription>
                        Revisá los montos antes de emitir las cuentas por cobrar.
                        Esta acción genera facturas en PETTY_CASH para los residentes.
                    </DialogDescription>
                </DialogHeader>

                {preview && (
                    <div className="flex-1 space-y-4 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                    Total a repartir
                                </p>
                                <p className="mt-1 text-xl font-bold tabular-nums">
                                    {formatMoney(preview.pending_to_assess, currency)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                    Por unidad ({preview.units.length})
                                </p>
                                <p className="mt-1 text-xl font-bold tabular-nums">
                                    {formatMoney(perUnit, currency)}
                                </p>
                            </div>
                        </div>

                        {tooSmallToDistribute && (
                            <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                                <div className="text-sm">
                                    <p className="font-semibold text-amber-500">
                                        Monto demasiado bajo para repartir
                                    </p>
                                    <p className="mt-1 text-muted-foreground">
                                        Cada unidad tocaría menos de {formatMoney(0.01, currency)}.
                                        Acumulá más gastos antes de generar los recibos.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="rounded-lg border border-border/50 overflow-hidden">
                            <div className="max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Unidad</th>
                                            <th className="px-4 py-2 text-right">Monto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {preview.units.map((u) => (
                                            <tr key={u.id}>
                                                <td className="px-4 py-2">{u.name}</td>
                                                <td className="px-4 py-2 text-right tabular-nums">
                                                    {formatMoney(u.amount, currency)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isGenerating}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onConfirm}
                        disabled={isGenerating || tooSmallToDistribute || !preview}
                    >
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar y generar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
