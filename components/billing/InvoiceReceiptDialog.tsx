'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, Building2, CheckCircle2, FileText, ArrowDownToLine } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import {
    generateInvoicePDF,
    parseInvoicePaymentInfo,
    type InvoicePdfPaymentDetails,
} from '@/lib/utils/invoice-pdf';
import type { Invoice, Unit } from '@/types/models';
import { toast } from 'sonner';

interface InvoiceReceiptDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice | null;
    buildingName?: string;
    unit?: Unit | null;
    paymentDetails?: InvoicePdfPaymentDetails;
}

export function InvoiceReceiptDialog({
    open,
    onOpenChange,
    invoice,
    buildingName = 'Edificio Granada',
    unit,
    paymentDetails,
}: InvoiceReceiptDialogProps) {
    const [isDownloading, setIsDownloading] = useState(false);

    if (!invoice) return null;

    const unitName = invoice.unit?.name || unit?.name || '';
    const coprop = getGranadaCoproprietor(unitName);
    const aptoNumber = coprop?.apto || unitName.replace('-', '');
    const ownerName = coprop?.propietario || invoice.user?.name || 'Copropietario';
    const aliquot = coprop?.aliquot ?? (invoice.unit?.aliquot || unit?.aliquot || 0);

    const paymentInfo = parseInvoicePaymentInfo(invoice, paymentDetails);
    const isPaid = invoice.status === 'PAID';

    const referenceNumber = invoice.receipt_number || invoice.number || `REC-${new Date().getFullYear()}-${aptoNumber.padStart(3, '0')}`;
    const issueDateStr = invoice.issue_date
        ? new Date(invoice.issue_date).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
    const paymentDateStr = paymentInfo.paymentDate
        ? new Date(paymentInfo.paymentDate + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
        : issueDateStr;

    const baseBudgetMatch = invoice.description?.match(/Base:\s*\$([0-9.,]+)/i);
    const baseBudgetStr = baseBudgetMatch ? `$${baseBudgetMatch[1]}` : (aliquot > 0 ? `$${((invoice.amount / (aliquot / 100))).toFixed(2)}` : '--');
    const cleanDescription = (invoice.description || 'Cuota Especial de Condominio').split(' | Pago')[0];

    const rateLabel = paymentInfo.rateType === 'EUR_BCV'
        ? 'Tasa Euro Oficial (BCV)'
        : paymentInfo.rateType === 'USD_BCV'
        ? 'Tasa Dólar Oficial (BCV)'
        : 'Tasa Personalizada';

    const methodLabel = paymentInfo.paymentMethod === 'PAGO_MOVIL'
        ? 'Pago Móvil'
        : paymentInfo.paymentMethod === 'TRANSFER'
        ? 'Transferencia Bancaria'
        : 'Efectivo / Zelle';

    const handleDownloadPdf = () => {
        try {
            setIsDownloading(true);
            generateInvoicePDF({
                invoice,
                buildingName,
                unit,
                paymentDetails: paymentInfo,
            });
            toast.success('Factura descargada en PDF');
        } catch (error) {
            console.error('Error al descargar PDF:', error);
            toast.error('Error al generar el documento PDF');
        } finally {
            setIsDownloading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 bg-white text-zinc-900 border border-zinc-200 shadow-2xl">
                <div className="p-6 md:p-8 space-y-6 print:p-0 print:m-0" id="factura-recibo-printable">
                    {/* Header Controls (Hidden on Print) */}
                    <div className="flex flex-wrap justify-between items-center pb-4 border-b border-zinc-200 print:hidden gap-3">
                        <DialogTitle className="text-lg font-bold text-zinc-800 flex items-center gap-2">
                            <FileText className="h-5 w-5 text-emerald-600" />
                            Factura / Recibo de Pago Oficial
                        </DialogTitle>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleDownloadPdf}
                                disabled={isDownloading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-semibold shadow-sm"
                            >
                                <ArrowDownToLine className="h-4 w-4" />
                                Descargar PDF
                            </Button>
                            <Button onClick={handlePrint} variant="outline" className="gap-1.5 h-8 text-xs border-zinc-300">
                                <Printer className="h-4 w-4" />
                                Imprimir
                            </Button>
                        </div>
                    </div>

                    {/* Document Header */}
                    <div className="flex justify-between items-start pt-1">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                                {buildingName}
                            </h1>
                            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                Administración de Condominio
                            </p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-xl font-black tracking-tight text-slate-900">
                                RECIBO DE PAGO / FACTURA
                            </h2>
                            <p className="text-xs font-mono font-bold text-zinc-700">
                                N°: <span className="text-emerald-700">{referenceNumber}</span>
                            </p>
                            <p className="text-xs text-zinc-500">
                                Período: <span className="font-semibold text-zinc-800">{invoice.period || '--'}</span>
                            </p>
                        </div>
                    </div>

                    <div className="h-1 bg-slate-800 w-full rounded-full" />

                    {/* Paid Solvency Banner */}
                    {isPaid && (
                        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-300 rounded-lg">
                            <div className="flex items-center gap-2.5">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                                <div>
                                    <span className="font-bold text-sm text-emerald-900 block leading-tight">
                                        DOCUMENTO CANCELADO / TOTALMENTE SOLVENTE
                                    </span>
                                    <span className="text-xs text-emerald-700">
                                        El importe facturado ha sido cancelado satisfactoriamente.
                                    </span>
                                </div>
                            </div>
                            <Badge className="bg-emerald-600 text-white text-xs px-2.5 py-0.5">
                                Pagado el {paymentDateStr}
                            </Badge>
                        </div>
                    )}

                    {/* Property and Coproprietor Details */}
                    <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/70 space-y-3">
                        <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase">
                            DATOS DEL INMUEBLE Y PROPIETARIO
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                            <div>
                                <span className="text-zinc-500 block uppercase font-medium text-[10px]">Apartamento</span>
                                <span className="font-bold text-zinc-900 text-sm">Apto {aptoNumber} {unitName ? `(${unitName})` : ''}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500 block uppercase font-medium text-[10px]">Propietario / Pagador</span>
                                <span className="font-bold text-zinc-900 text-sm">{ownerName}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500 block uppercase font-medium text-[10px]">Alícuota Legal</span>
                                <span className="font-bold text-zinc-900 text-sm">{aliquot.toFixed(6)}%</span>
                            </div>
                            <div>
                                <span className="text-zinc-500 block uppercase font-medium text-[10px]">Teléfono de Contacto</span>
                                <span className="font-mono text-zinc-900 text-sm">{coprop?.phone || '--'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Concept Table */}
                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-800 text-white px-4 py-2.5 flex justify-between text-xs font-bold uppercase tracking-wider">
                            <span>Concepto / Trabajo Facturado</span>
                            <div className="flex gap-8">
                                <span>Base Presupuesto</span>
                                <span>Importe a Pagar</span>
                            </div>
                        </div>
                        <div className="p-4 flex justify-between items-start text-xs border-b border-zinc-100">
                            <div className="space-y-1 max-w-md">
                                <h4 className="font-bold text-zinc-900 text-sm">
                                    {cleanDescription}
                                </h4>
                                <p className="text-zinc-600 text-xs">
                                    Cuota asignada proporcional a la alícuota del inmueble ({aliquot.toFixed(6)}%).
                                </p>
                            </div>
                            <div className="flex gap-8 text-right font-mono">
                                <span className="text-zinc-600 font-medium">{baseBudgetStr}</span>
                                <span className="font-bold text-zinc-900 text-sm">
                                    {formatCurrency(invoice.amount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment & Exchange Rate Settlement Box */}
                    <div className="border border-zinc-200 rounded-lg p-4 bg-slate-50 space-y-3">
                        <h3 className="text-xs font-bold tracking-wider text-slate-800 uppercase flex items-center justify-between">
                            <span>LIQUIDACIÓN DEL PAGO Y TASA DE CAMBIO APLICADA</span>
                            {paymentInfo.currency === 'VES' && (
                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                                    Pago en Bolívares a Tasa de Cambio
                                </Badge>
                            )}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1">
                            <div>
                                <span className="text-zinc-500 block font-medium">Método de Pago:</span>
                                <span className="font-semibold text-zinc-800">{methodLabel}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500 block font-medium">Fecha Efectiva:</span>
                                <span className="font-semibold text-zinc-800">{paymentDateStr}</span>
                            </div>
                            <div>
                                <span className="text-zinc-500 block font-medium">Moneda Utilizada:</span>
                                <span className="font-semibold text-zinc-800">
                                    {paymentInfo.currency === 'VES' ? 'Bolívares (VES)' : 'Dólares (USD)'}
                                </span>
                            </div>
                        </div>

                        {(paymentInfo.currency === 'VES' || paymentInfo.exchangeRate) && (
                            <div className="p-3 bg-white border border-zinc-200 rounded-md grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                                <div>
                                    <span className="text-[11px] text-zinc-500 block">Tasa de Cambio de Referencia:</span>
                                    <span className="font-bold text-sm text-slate-900 font-mono">
                                        {rateLabel}: {paymentInfo.exchangeRate != null ? `${paymentInfo.exchangeRate.toFixed(4)} Bs.` : 'Al día'}
                                    </span>
                                </div>
                                <div className="text-left sm:text-right">
                                    <span className="text-[11px] text-zinc-500 block">Monto Cancelado en Bolívares:</span>
                                    <span className="font-black text-base text-emerald-700 font-mono">
                                        {paymentInfo.amountVes != null
                                            ? `Bs. ${paymentInfo.amountVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                            : '--'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-zinc-200 text-xs">
                            <span className="font-bold text-zinc-700">Monto Acreditado a la Factura:</span>
                            <span className="font-mono font-bold text-zinc-900 text-base">
                                {formatCurrency(invoice.amount)} USD
                            </span>
                        </div>
                    </div>

                    {/* Signatures */}
                    <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                        <div className="space-y-1">
                            <div className="border-t border-zinc-400 w-4/5 mx-auto pt-1" />
                            <p className="font-bold text-zinc-800">ADMINISTRACIÓN DEL CONDOMINIO</p>
                            <p className="text-[11px] text-zinc-500">{buildingName}</p>
                        </div>
                        <div className="space-y-1">
                            <div className="border-t border-zinc-400 w-4/5 mx-auto pt-1" />
                            <p className="font-bold text-zinc-800">COPROPIETARIO / PAGADOR</p>
                            <p className="text-[11px] text-zinc-500">Apto. {aptoNumber} - {ownerName}</p>
                        </div>
                    </div>

                    {/* Footer note */}
                    <div className="pt-4 border-t border-zinc-200 text-center text-[10px] text-zinc-400">
                        Documento oficial emitido por el Sistema de Administración de Condominio • {buildingName}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
