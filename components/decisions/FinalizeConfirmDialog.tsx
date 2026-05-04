'use client';

import { useState } from 'react';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { decisionsService } from '@/lib/services/decisions.service';
import { getDecisionErrorMessage } from '@/lib/utils/decision-errors';
import type {
    Decision,
    DecisionEarlyFinalizeReason,
    DecisionStatus,
} from '@/types/models';

const PHASE_LABELS: Partial<Record<DecisionStatus, string>> = {
    RECEPTION: 'recepción de cotizaciones',
    VOTING: 'votación',
};

const EARLY_FINALIZE_COPY: Record<DecisionEarlyFinalizeReason, string> = {
    ALL_VOTED: 'Todos los apartamentos ya emitieron su voto.',
    MATHEMATICALLY_DECIDED:
        'El resultado ya está matemáticamente decidido — los votos restantes no pueden cambiar al ganador.',
};

interface FinalizeConfirmDialogProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    decisionId: string;
    currentStatus: DecisionStatus;
    onFinalized: (decision: Decision) => void;
    /** When set, dialog shows the reason early finalize is enabled (advisory). */
    earlyFinalizeReason?: DecisionEarlyFinalizeReason | null;
}

export function FinalizeConfirmDialog({
    open,
    onOpenChange,
    decisionId,
    currentStatus,
    onFinalized,
    earlyFinalizeReason,
}: FinalizeConfirmDialogProps) {
    const [isLoading, setIsLoading] = useState(false);

    const phaseLabel = PHASE_LABELS[currentStatus] ?? 'fase actual';
    const earlyCopy =
        currentStatus === 'VOTING' && earlyFinalizeReason
            ? EARLY_FINALIZE_COPY[earlyFinalizeReason]
            : null;

    const handleFinalize = async () => {
        setIsLoading(true);
        try {
            const decision = await decisionsService.finalize(decisionId);
            toast.success('Fase finalizada correctamente.');
            onOpenChange(false);
            onFinalized(decision);
        } catch (err) {
            toast.error(getDecisionErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Finalizar {phaseLabel}</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción cerrará la fase de{' '}
                        <span className="font-semibold">{phaseLabel}</span> y avanzará la decisión
                        al siguiente estado. No se podrán recibir más{' '}
                        {currentStatus === 'RECEPTION' ? 'cotizaciones' : 'votos'}.
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {earlyCopy && (
                    <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                        {earlyCopy}
                    </p>
                )}

                <AlertDialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancelar
                    </Button>
                    <Button onClick={handleFinalize} disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar finalización
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
