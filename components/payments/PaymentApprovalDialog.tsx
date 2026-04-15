'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Eye, Info, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { paymentsService } from '@/lib/services/payments.service';
import { billingService } from '@/lib/services/billing.service';
import { formatCurrency, formatDate, formatPaymentMethod, formatPeriod } from '@/lib/utils/format';
import type { Payment } from '@/types/models';
import { toast } from 'sonner';

interface PaymentApprovalDialogProps {
    payment: Payment | null;
    onClose: () => void;
    onSuccess: () => void;
    allowReject?: boolean;
}

interface Allocation {
    id: string;
    receipt_number?: string;
    number?: string;
    period?: string;
    year?: number;
    month?: number;
    allocated_amount?: number;
    amount?: number;
}

export function PaymentApprovalDialog({
    payment,
    onClose,
    onSuccess,
    allowReject = true,
}: PaymentApprovalDialogProps) {
    const [detailedPayment, setDetailedPayment] = useState<Payment | null>(null);
    const [allocations, setAllocations] = useState<Allocation[]>([]);
    const [isAllocationsLoading, setIsAllocationsLoading] = useState(false);
    const [proofUrl, setProofUrl] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadDetails = useCallback(async (id: string) => {
        setDetailedPayment(null);
        setAllocations([]);
        setIsAllocationsLoading(true);
        try {
            const [detailed, allocs] = await Promise.all([
                paymentsService.getPaymentById(id),
                billingService.getPaymentInvoices(id),
            ]);
            setDetailedPayment(detailed);
            setAllocations(allocs);
        } catch (e) {
            console.error('Failed to fetch payment details', e);
            try {
                setDetailedPayment(await paymentsService.getPaymentById(id));
            } catch {
                toast.error('No se pudieron cargar los detalles del pago');
                onClose();
            }
        } finally {
            setIsAllocationsLoading(false);
        }
    }, [onClose]);

    useEffect(() => {
        if (payment) {
            loadDetails(payment.id);
        } else {
            setDetailedPayment(null);
            setAllocations([]);
            setProofUrl(null);
        }
    }, [payment, loadDetails]);

    const handleApprove = async () => {
        if (!payment) return;
        setIsSubmitting(true);
        try {
            await paymentsService.approvePayment(payment.id, undefined);
            toast.success('Pago aprobado correctamente');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al aprobar el pago');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!payment) return;
        const reason = prompt('Motivo del rechazo:');
        if (reason === null) return;
        setIsSubmitting(true);
        try {
            await paymentsService.rejectPayment(payment.id, reason);
            toast.success('Pago rechazado');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('Error al rechazar el pago');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <Dialog open={!!payment} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[560px]">
                    <DialogHeader>
                        <DialogTitle>Revisar Pago</DialogTitle>
                        <DialogDescription>
                            Verificá los detalles y las imputaciones antes de aprobar.
                        </DialogDescription>
                    </DialogHeader>

                    {!detailedPayment ? (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="py-4 space-y-6">
                            <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-muted/30 border border-border/50">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider block mb-1">Monto</span>
                                    <span className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(detailedPayment.amount)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider block mb-1">Método</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-semibold text-foreground">{formatPaymentMethod(detailedPayment.method)}</span>
                                        {detailedPayment.proof_url && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setProofUrl(detailedPayment.proof_url!)}
                                                className="h-7 px-2 text-[10px]"
                                            >
                                                <Eye className="h-3 w-3 mr-1" /> Ver Comprobante
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {isAllocationsLoading ? (
                                <div className="py-6 flex justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                                </div>
                            ) : allocations.length > 0 ? (
                                <div className="space-y-3">
                                    <h3 className="flex items-center gap-2 font-semibold text-xs text-primary uppercase tracking-widest">
                                        <Info className="h-4 w-4" />
                                        Facturas Impactadas
                                    </h3>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                                        {allocations.map((alloc) => (
                                            <div key={alloc.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-semibold text-foreground">Factura #{alloc.receipt_number || alloc.number || alloc.id.slice(0, 8)}</span>
                                                    <span className="text-[9px] text-muted-foreground uppercase">
                                                        {alloc.period ? formatPeriod(alloc.period) : (alloc.year && alloc.month ? formatPeriod(`${alloc.year}-${alloc.month}`) : '--')}
                                                    </span>
                                                </div>
                                                <span className="font-bold text-sm text-primary tabular-nums">{formatCurrency(alloc.allocated_amount || alloc.amount || 0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">Sin información detallada de imputación.</p>
                            )}

                            {detailedPayment.status !== 'PENDING' && (
                                <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h3 className="flex items-center gap-2 font-semibold text-xs text-muted-foreground uppercase tracking-widest">
                                        Información del Procesamiento
                                    </h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Procesado por:</span>
                                            <span className="text-foreground font-semibold">{detailedPayment.processor?.name || 'Desconocido'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">Fecha:</span>
                                            <span className="text-foreground tabular-nums">{detailedPayment.processed_at ? formatDate(detailedPayment.processed_at) : '-'}</span>
                                        </div>
                                        {detailedPayment.notes && (
                                            <div className="pt-2 border-t border-border/50">
                                                <span className="text-muted-foreground text-xs block mb-1">Notas:</span>
                                                <p className="text-sm text-foreground italic">{detailedPayment.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
                        {detailedPayment?.status === 'PENDING' && (
                            <>
                                {allowReject && (
                                    <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                                        Rechazar
                                    </Button>
                                )}
                                <Button onClick={handleApprove} disabled={!detailedPayment || isSubmitting} className="px-6">
                                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aprobar Pago'}
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!proofUrl} onOpenChange={(open) => !open && setProofUrl(null)}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Comprobante de Pago</DialogTitle>
                        <DialogDescription className="sr-only">Vista previa del comprobante de pago.</DialogDescription>
                    </DialogHeader>
                    {proofUrl && (
                        <div className="relative w-full h-[70vh] rounded-lg overflow-hidden bg-muted/30">
                            <Image src={proofUrl} alt="Comprobante" fill className="object-contain" unoptimized />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
