'use client';

import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, XCircle } from 'lucide-react';
import { formatMoney } from '@/lib/utils/format';

interface CancelExpressDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Display name of the assessment being cancelled (shown in UI). */
    batchDescription: string;
    isSubmitting: boolean;
    onConfirm: (reason: string) => void;
}

const MIN_REASON = 10;
const MAX_REASON = 500;

export function CancelExpressDialog({
    open,
    onOpenChange,
    batchDescription,
    isSubmitting,
    onConfirm,
}: CancelExpressDialogProps) {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (open) setReason('');
    }, [open]);

    const trimmed = reason.trim();
    const reasonTooShort = trimmed.length > 0 && trimmed.length < MIN_REASON;
    const reasonTooLong = trimmed.length > MAX_REASON;
    const canSubmit = trimmed.length >= MIN_REASON && trimmed.length <= MAX_REASON && !isSubmitting;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onConfirm(trimmed);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-destructive" />
                        Cancelar factura express
                    </DialogTitle>
                    <DialogDescription>
                        Cancelará todas las facturas activas del prorrateo{' '}
                        <strong>&quot;{batchDescription}&quot;</strong>. Las facturas ya pagadas no
                        se ven afectadas. Esta acción no se puede deshacer.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="cancel-reason">Motivo de cancelación</Label>
                        <Textarea
                            id="cancel-reason"
                            placeholder="Explicá por qué cancelás este prorrateo (mínimo 10 caracteres)."
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={MAX_REASON + 50}
                            disabled={isSubmitting}
                        />
                        <div className="flex justify-between text-xs">
                            <span
                                className={
                                    reasonTooShort || reasonTooLong
                                        ? 'text-destructive'
                                        : 'text-muted-foreground'
                                }
                            >
                                {reasonTooShort && `Faltan ${MIN_REASON - trimmed.length} caracteres`}
                                {reasonTooLong && `Pasaste de ${MAX_REASON} caracteres`}
                                {!reasonTooShort && !reasonTooLong && 'Entre 10 y 500 caracteres'}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                                {trimmed.length}/{MAX_REASON}
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Volver
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Cancelar prorrateo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Success summary shown after successful cancellation ───────────────────────

interface CancelSuccessSummaryProps {
    cancelledInvoices: number;
    totalRemainderReturned: number;
}

/**
 * Inline summary component shown as a toast body or confirmation text
 * after a successful EXPRESS assessment cancellation.
 */
export function CancelSuccessSummary({
    cancelledInvoices,
    totalRemainderReturned,
}: CancelSuccessSummaryProps) {
    return (
        <span>
            {cancelledInvoices} factura{cancelledInvoices !== 1 ? 's' : ''} cancelada
            {cancelledInvoices !== 1 ? 's' : ''}.
            {totalRemainderReturned > 0 && (
                <> Saldo devuelto: {formatMoney(totalRemainderReturned)}.</>
            )}
        </span>
    );
}
