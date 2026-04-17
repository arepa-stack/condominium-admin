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
import { Loader2, Undo2 } from 'lucide-react';
import { formatMoney } from '@/lib/utils/format';
import type { PettyCashEntry } from '@/types/models';

interface ReverseEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    entry: PettyCashEntry | null;
    isReversing: boolean;
    onConfirm: (entryId: string, reason: string) => void;
}

const MIN_REASON = 10;
const MAX_REASON = 500;

export function ReverseEntryDialog({
    open,
    onOpenChange,
    entry,
    isReversing,
    onConfirm,
}: ReverseEntryDialogProps) {
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (open) setReason('');
    }, [open]);

    if (!entry) return null;

    const trimmed = reason.trim();
    const reasonTooShort = trimmed.length > 0 && trimmed.length < MIN_REASON;
    const reasonTooLong = trimmed.length > MAX_REASON;
    const canSubmit =
        trimmed.length >= MIN_REASON &&
        trimmed.length <= MAX_REASON &&
        !isReversing;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onConfirm(entry.id, trimmed);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Undo2 className="h-5 w-5 text-destructive" />
                        Revertir movimiento
                    </DialogTitle>
                    <DialogDescription>
                        Se generará un asiento contrario ({entry.type} → reversa) que
                        devuelve el balance. La entrada original queda marcada como
                        reversada y no se puede volver a reversar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Entrada original
                        </p>
                        <div className="mt-1 flex items-center justify-between">
                            <p className="text-sm font-medium">{entry.description}</p>
                            <span
                                className={
                                    entry.amount < 0
                                        ? 'text-sm font-bold tabular-nums text-destructive'
                                        : 'text-sm font-bold tabular-nums text-chart-1'
                                }
                            >
                                {formatMoney(entry.amount)}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="reverse-reason">Motivo</Label>
                        <Textarea
                            id="reverse-reason"
                            placeholder="Explicá por qué revertís este movimiento (mínimo 10 caracteres)."
                            rows={4}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            maxLength={MAX_REASON + 50}
                            disabled={isReversing}
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
                                {reasonTooLong &&
                                    `Pasate de ${MAX_REASON} caracteres`}
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
                        disabled={isReversing}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                    >
                        {isReversing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Revertir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
