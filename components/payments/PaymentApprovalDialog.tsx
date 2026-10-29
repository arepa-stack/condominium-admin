'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Eye, Info, Loader2, Upload, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { paymentsService } from '@/lib/services/payments.service';
import { billingService } from '@/lib/services/billing.service';
import { pettyCashService } from '@/lib/services/petty-cash.service';
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

    // Upload & Edit Proof State
    const [showUploadForm, setShowUploadForm] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [editReference, setEditReference] = useState('');
    const [editBank, setEditBank] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [isUploadingProof, setIsUploadingProof] = useState(false);

    // Currency the payment was received in, confirmed on approval. Bs = USD amount × rate, always:
    // the USD amount is what the invoices were paid with, so editing one field recomputes the other.
    const [paidCurrency, setPaidCurrency] = useState<'USD' | 'VES'>('VES');
    const [amountVes, setAmountVes] = useState('');
    const [rate, setRate] = useState('');
    // BCV references of the payment date: charges may be billed at the euro or the dollar rate.
    const [refRates, setRefRates] = useState<{ label: string; value: number }[]>([]);

    useEffect(() => {
        const p = detailedPayment;
        if (!p || p.status !== 'PENDING') return;
        const reportedVes = p.original_currency === 'VES' && !!p.exchange_rate;
        // Residents pay Pago Móvil/transfer in Bs; only cash is assumed to be dollars.
        setPaidCurrency(reportedVes || p.method !== 'CASH' ? 'VES' : 'USD');
        setAmountVes(reportedVes && p.original_amount ? String(p.original_amount) : '');
        setRate(reportedVes ? String(p.exchange_rate) : '');
        setRefRates([]);
        let cancelled = false;
        // No prefill: which rate applies depends on the charge, the approver types the Bs received or picks one.
        pettyCashService.getRates(p.payment_date?.slice(0, 10)).then((r) => {
            if (cancelled) return;
            setRefRates([
                { label: 'Euro BCV', value: r.rates.euro_oficial?.bs_per_unit ?? 0 },
                { label: 'Dólar BCV', value: r.rates.dolar_oficial?.bs_per_unit ?? 0 },
            ].filter((x) => x.value > 0));
        }).catch(() => { /* no reference rates: the approver types the rate */ });
        return () => { cancelled = true; };
    }, [detailedPayment]);

    const onAmountVesChange = (value: string) => {
        setAmountVes(value);
        const bs = parseFloat(value);
        if (detailedPayment && bs > 0) setRate((bs / detailedPayment.amount).toFixed(4));
    };

    const onRateChange = (value: string) => {
        setRate(value);
        const r = parseFloat(value);
        if (detailedPayment && r > 0) setAmountVes((detailedPayment.amount * r).toFixed(2));
    };

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
            if (detailed) {
                setEditReference(detailed.reference || '');
                setEditBank(detailed.bank || '');
                setEditNotes(detailed.notes || '');
            }
        } catch (e) {
            console.error('Failed to fetch payment details', e);
            try {
                const detailed = await paymentsService.getPaymentById(id);
                setDetailedPayment(detailed);
                if (detailed) {
                    setEditReference(detailed.reference || '');
                    setEditBank(detailed.bank || '');
                    setEditNotes(detailed.notes || '');
                }
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
            setShowUploadForm(false);
            setSelectedFile(null);
            setFilePreview(null);
        }
    }, [payment, loadDetails]);

    const handleUploadProof = async () => {
        if (!payment) return;
        if (!selectedFile && !editReference && !editBank && !editNotes) {
            toast.error('Selecciona una imagen o ingresa datos para actualizar');
            return;
        }

        setIsUploadingProof(true);
        try {
            const fd = new FormData();
            if (selectedFile) fd.append('proof_image', selectedFile);
            if (editReference.trim()) fd.append('reference', editReference.trim());
            if (editBank.trim()) fd.append('bank', editBank.trim());
            if (editNotes.trim()) fd.append('notes', editNotes.trim());

            await paymentsService.uploadPaymentProof(payment.id, fd);
            toast.success('Comprobante y datos de pago guardados correctamente');
            setShowUploadForm(false);
            setSelectedFile(null);
            setFilePreview(null);
            await loadDetails(payment.id);
            onSuccess();
        } catch (error) {
            console.error('Error uploading payment proof', error);
            toast.error('Error al subir el comprobante');
        } finally {
            setIsUploadingProof(false);
        }
    };

    const handleApprove = async () => {
        if (!payment) return;
        const bs = parseFloat(amountVes);
        const r = parseFloat(rate);
        if (paidCurrency === 'VES' && !(bs > 0 && r > 0)) {
            toast.error('Indica el monto en Bs y la tasa');
            return;
        }
        setIsSubmitting(true);
        try {
            await paymentsService.approvePayment(
                payment.id,
                undefined,
                paidCurrency === 'VES' ? { currency: 'VES', amount_ves: bs, exchange_rate: r } : { currency: 'USD' }
            );
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
                <DialogContent className="sm:max-w-[580px] max-h-[92vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalle del Pago</DialogTitle>
                        <DialogDescription>
                            Verifica el comprobante, imputaciones y datos del pago.
                        </DialogDescription>
                    </DialogHeader>

                    {!detailedPayment ? (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="py-4 space-y-5">
                            {/* Amount and Method Grid */}
                            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider block mb-1">Monto Pagado</span>
                                    <span className="text-2xl font-bold text-foreground tabular-nums">{formatCurrency(detailedPayment.amount)}</span>
                                    {detailedPayment.original_currency === 'VES' && detailedPayment.original_amount && (
                                        <span className="text-xs text-muted-foreground block mt-0.5">
                                            Equiv: {detailedPayment.original_amount.toLocaleString('es-VE')} Bs.
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider block mb-1">Método de Pago</span>
                                    <span className="text-base font-semibold text-foreground block">{formatPaymentMethod(detailedPayment.method)}</span>
                                    <span className="text-xs text-muted-foreground font-mono">
                                        Ref: {detailedPayment.reference || 'Sin ref'}
                                    </span>
                                </div>
                            </div>

                            {/* Comprobante de Pago Card with Upload / Replace */}
                            <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <ImageIcon className="h-4 w-4 text-primary" />
                                        Comprobante / Capture de Pago
                                    </span>
                                    <div className="flex items-center gap-2">
                                        {detailedPayment.proof_url && (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setProofUrl(detailedPayment.proof_url!)}
                                                className="h-7 px-2.5 text-xs gap-1 border-border/60"
                                            >
                                                <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                                Ver Comprobante
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setShowUploadForm(!showUploadForm)}
                                            className="h-7 px-2.5 text-xs gap-1 text-primary hover:bg-primary/10"
                                        >
                                            <Upload className="h-3.5 w-3.5" />
                                            {detailedPayment.proof_url ? 'Cambiar Foto' : 'Adjuntar Foto'}
                                        </Button>
                                    </div>
                                </div>

                                {/* Existing proof preview if available and not currently editing */}
                                {detailedPayment.proof_url && !showUploadForm && (
                                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-background/60 border border-border/40">
                                        <div
                                            className="relative h-16 w-16 rounded overflow-hidden cursor-pointer border border-border shrink-0 hover:opacity-80 transition-opacity"
                                            onClick={() => setProofUrl(detailedPayment.proof_url!)}
                                        >
                                            <Image src={detailedPayment.proof_url} alt="Comprobante" fill className="object-cover" unoptimized />
                                        </div>
                                        <div className="text-xs space-y-0.5 min-w-0 flex-1">
                                            <p className="font-semibold text-foreground truncate">
                                                Referencia: {detailedPayment.reference || 'Sin referencia'}
                                            </p>
                                            <p className="text-muted-foreground truncate">
                                                Banco: {detailedPayment.bank || 'No especificado'}
                                            </p>
                                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" /> Foto de comprobante registrada
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Notice when no proof is attached and form is closed */}
                                {!detailedPayment.proof_url && !showUploadForm && (
                                    <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300">
                                        <div className="flex items-center gap-2">
                                            <Info className="h-4 w-4 text-amber-600 shrink-0" />
                                            <span>No se ha adjuntado captura del pago móvil o transferencia.</span>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => setShowUploadForm(true)}
                                            className="h-7 px-2.5 text-xs border-amber-500/40 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20"
                                        >
                                            Subir ahora
                                        </Button>
                                    </div>
                                )}

                                {/* Upload / Edit Form */}
                                {showUploadForm && (
                                    <div className="p-3.5 rounded-lg bg-card border border-border space-y-3 animate-in fade-in-50 duration-150">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">Seleccionar Foto o Capture del Pago Móvil</Label>
                                            <Input
                                                type="file"
                                                accept="image/*,application/pdf"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0] || null;
                                                    setSelectedFile(file);
                                                    if (file && file.type.startsWith('image/')) {
                                                        setFilePreview(URL.createObjectURL(file));
                                                    } else {
                                                        setFilePreview(null);
                                                    }
                                                }}
                                                className="text-xs bg-background"
                                            />
                                        </div>

                                        {/* Local Preview */}
                                        {filePreview && (
                                            <div className="relative h-28 w-28 rounded border border-border overflow-hidden">
                                                <Image src={filePreview} alt="Vista previa" fill className="object-cover" unoptimized />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-muted-foreground">N° de Referencia / Operación</Label>
                                                <Input
                                                    value={editReference}
                                                    onChange={(e) => setEditReference(e.target.value)}
                                                    placeholder="Ej. 123456"
                                                    className="h-7 text-xs bg-background font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-[11px] font-medium text-muted-foreground">Banco Emisor</Label>
                                                <Input
                                                    value={editBank}
                                                    onChange={(e) => setEditBank(e.target.value)}
                                                    placeholder="Ej. Banesco, Venezuela"
                                                    className="h-7 text-xs bg-background"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-medium text-muted-foreground">Notas Adicionales (Opcional)</Label>
                                            <Input
                                                value={editNotes}
                                                onChange={(e) => setEditNotes(e.target.value)}
                                                placeholder="Ej. Pago móvil realizado desde cuenta de familiar..."
                                                className="h-7 text-xs bg-background"
                                            />
                                        </div>

                                        <div className="flex justify-end gap-2 pt-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => {
                                                    setShowUploadForm(false);
                                                    setSelectedFile(null);
                                                    setFilePreview(null);
                                                }}
                                                disabled={isUploadingProof}
                                                className="h-7 px-2.5 text-xs"
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleUploadProof}
                                                disabled={isUploadingProof || (!selectedFile && !editReference && !editBank && !editNotes)}
                                                className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
                                            >
                                                {isUploadingProof ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                                Guardar Comprobante
                                            </Button>
                                        </div>
                                    </div>
                                )}
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

                            {detailedPayment.status === 'PENDING' && (
                                <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-3">
                                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider block">
                                        Moneda en que se recibió
                                    </span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {(['VES', 'USD'] as const).map((c) => (
                                            <Button
                                                key={c}
                                                type="button"
                                                size="sm"
                                                variant={paidCurrency === c ? 'default' : 'outline'}
                                                onClick={() => setPaidCurrency(c)}
                                                aria-pressed={paidCurrency === c}
                                            >
                                                {c === 'VES' ? 'Bolívares (Bs)' : 'Dólares (USD)'}
                                            </Button>
                                        ))}
                                    </div>
                                    {paidCurrency === 'VES' && (
                                        <div className="grid grid-cols-2 gap-2.5">
                                            <div className="space-y-1">
                                                <Label htmlFor="approve-amount-ves" className="text-[11px] font-medium text-muted-foreground">Monto recibido (Bs)</Label>
                                                <Input
                                                    id="approve-amount-ves"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={amountVes}
                                                    onChange={(e) => onAmountVesChange(e.target.value)}
                                                    className="h-8 text-sm bg-background font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="approve-rate" className="text-[11px] font-medium text-muted-foreground">Tasa (Bs por USD)</Label>
                                                <Input
                                                    id="approve-rate"
                                                    type="number"
                                                    step="0.0001"
                                                    min="0"
                                                    value={rate}
                                                    onChange={(e) => onRateChange(e.target.value)}
                                                    className="h-8 text-sm bg-background font-mono"
                                                />
                                            </div>
                                            {refRates.length > 0 && (
                                                <div className="col-span-2 flex flex-wrap items-center gap-1.5">
                                                    <span className="text-[11px] text-muted-foreground">Tasas del {formatDate(detailedPayment.payment_date)}:</span>
                                                    {refRates.map((x) => (
                                                        <Button
                                                            key={x.label}
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-6 px-2 text-[11px]"
                                                            onClick={() => onRateChange(x.value.toFixed(4))}
                                                        >
                                                            {x.label} {x.value.toFixed(2)}
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}
                                            <p className="col-span-2 text-[11px] text-muted-foreground">
                                                Se aplican {formatCurrency(detailedPayment.amount)} a las facturas; el monto en Bs y la tasa quedan como registro.
                                            </p>
                                        </div>
                                    )}
                                </div>
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
