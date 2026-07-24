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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import { formatCurrency } from '@/lib/utils/format';
import type { Decision, DecisionQuote } from '@/types/models';

interface DirectAwardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    decisionId: string;
    quote: DecisionQuote;
    onAwarded: (decision: Decision) => void;
}

export function DirectAwardDialog({
    open,
    onOpenChange,
    decisionId,
    quote,
    onAwarded,
}: DirectAwardDialogProps) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const trimmedReason = reason.trim();

    useEffect(() => {
        if (!open) setReason('');
    }, [open]);

    const handleSubmit = async () => {
        if (trimmedReason.length < 5 || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const decision = await decisionsService.awardSoleQuote(
                decisionId,
                trimmedReason,
            );
            toast.success(`${quote.provider_name} fue adjudicado sin votación.`);
            onOpenChange(false);
            onAwarded(decision);
        } catch (error) {
            toast.error(getDecisionErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Adjudicar proveedor único</DialogTitle>
                    <DialogDescription>
                        La decisión quedará resuelta inmediatamente y no se abrirá una
                        votación. Después podrás generar el cargo con el flujo habitual.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
                        <Trophy className="h-5 w-5 shrink-0 text-amber-600" />
                        <div className="min-w-0">
                            <p className="truncate font-medium">{quote.provider_name}</p>
                            <p className="text-sm text-muted-foreground">
                                {formatCurrency(quote.amount)}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="direct-award-reason">Motivo</Label>
                        <Textarea
                            id="direct-award-reason"
                            rows={3}
                            maxLength={500}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Ej. Es el único proveedor disponible para este trabajo"
                            disabled={isSubmitting}
                        />
                        <p className="text-xs text-muted-foreground">
                            El motivo quedará registrado en el historial de auditoría.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={trimmedReason.length < 5 || isSubmitting}
                    >
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar adjudicación
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
