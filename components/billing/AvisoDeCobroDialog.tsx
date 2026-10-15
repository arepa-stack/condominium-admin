'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Download, Building2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import type { Invoice } from '@/types/models';

interface AvisoDeCobroDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    invoice: Invoice | null;
}

export function AvisoDeCobroDialog({ open, onOpenChange, invoice }: AvisoDeCobroDialogProps) {
    if (!invoice) return null;

    const unitName = invoice.unit?.name || '';
    const coprop = getGranadaCoproprietor(unitName);
    const aptoNumber = coprop?.apto || unitName.replace('-', '');
    const ownerName = coprop?.propietario || invoice.user?.name || 'Copropietario';
    const aliquot = coprop?.aliquot || invoice.unit?.aliquot || 0;

    const reference = invoice.receipt_number || invoice.number || `CE-${new Date().getFullYear()}-${aptoNumber.padStart(3, '0')}`;
    const issueDate = invoice.issue_date
        ? new Date(invoice.issue_date).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })
        : new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });

    // Try to extract base budget from description if present
    const budgetMatch = invoice.description?.match(/Base:\s*\$([0-9.,]+)/i) || invoice.description?.match(/Presupuesto:\s*\$([0-9.,]+)/i);
    const baseBudget = budgetMatch ? budgetMatch[1] : (aliquot > 0 ? ((invoice.amount / (aliquot / 100))).toFixed(2) : '3,100.00');

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 bg-white text-zinc-900 border border-zinc-200">
                <div className="p-6 md:p-8 space-y-6 print:p-0 print:m-0" id="aviso-de-cobro-printable">
                    {/* Header Controls (Hidden on print) */}
                    <div className="flex justify-between items-center pb-4 border-b border-zinc-200 print:hidden">
                        <DialogTitle className="text-xl font-bold text-zinc-800">
                            Vista Previa de Aviso de Cobro
                        </DialogTitle>
                        <div className="flex gap-2">
                            <Button onClick={handlePrint} variant="outline" className="gap-2">
                                <Printer className="h-4 w-4" />
                                Imprimir / PDF
                            </Button>
                        </div>
                    </div>

                    {/* Document Header */}
                    <div className="flex justify-between items-start pt-2">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-blue-900 uppercase">
                                EDIFICIO GRANADA
                            </h1>
                            <p className="text-sm font-medium text-zinc-600">
                                Administración de Condominio
                            </p>
                        </div>
                        <div className="text-right">
                            <h2 className="text-2xl font-black tracking-tight text-blue-900">
                                AVISO DE COBRO
                            </h2>
                            <p className="text-xs font-semibold text-zinc-600">
                                Referencia: <span className="font-mono font-bold text-zinc-900">{reference}</span>
                            </p>
                            <p className="text-xs text-zinc-500">
                                Fecha de Emisión: {issueDate}
                            </p>
                        </div>
                    </div>

                    <div className="h-0.5 bg-blue-900 w-full" />

                    {/* Property & Owner Information */}
                    <div className="border border-zinc-200 rounded-lg p-5 bg-zinc-50/50 space-y-3">
                        <h3 className="text-xs font-bold tracking-wider text-blue-900 uppercase">
                            DATOS DEL PROPIETARIO / INMUEBLE
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-xs text-zinc-500 block uppercase font-medium">Propietario(s)</span>
                                <span className="font-bold text-zinc-900 text-base">{ownerName}</span>
                            </div>
                            <div>
                                <span className="text-xs text-zinc-500 block uppercase font-medium">Inmueble</span>
                                <span className="font-bold text-zinc-900 text-base">Apartamento {aptoNumber}</span>
                            </div>
                            <div>
                                <span className="text-xs text-zinc-500 block uppercase font-medium">Porcentaje de Alícuota</span>
                                <span className="font-bold text-zinc-900">{aliquot.toFixed(6)}%</span>
                            </div>
                            {coprop?.phone && (
                                <div>
                                    <span className="text-xs text-zinc-500 block uppercase font-medium">Teléfono de Contacto</span>
                                    <span className="text-zinc-800 font-mono">{coprop.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Concept Description and Calculation */}
                    <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <div className="bg-blue-900 text-white px-5 py-2.5 flex justify-between text-xs font-bold uppercase tracking-wider">
                            <span>Descripción del Concepto</span>
                            <div className="flex gap-12">
                                <span>Base Presupuesto</span>
                                <span>Importe a Pagar</span>
                            </div>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1 max-w-md">
                                    <h4 className="font-bold text-zinc-900">
                                        {invoice.description || 'Cuota Especial de Condominio'}
                                    </h4>
                                    <p className="text-xs text-zinc-600 leading-relaxed">
                                        Período correspondiente: <span className="font-semibold text-zinc-800">{invoice.period}</span>.
                                        Cálculo proporcional a la alícuota legal del inmueble ({aliquot.toFixed(6)}%).
                                    </p>
                                    <p className="text-xs font-mono text-zinc-500 pt-1">
                                        Cálculo: Presupuesto Total (${baseBudget}) × Alícuota ({aliquot.toFixed(6)}%)
                                    </p>
                                </div>
                                <div className="flex gap-12 text-right">
                                    <span className="font-mono text-zinc-700 font-medium">${baseBudget}</span>
                                    <span className="font-mono text-zinc-900 font-bold text-base">
                                        {formatCurrency(invoice.amount)}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-zinc-200 flex justify-between items-center">
                                <span className="font-bold text-base text-zinc-900 uppercase">
                                    Total a Pagar (Referencia USD):
                                </span>
                                <span className="text-2xl font-black text-blue-900 font-mono">
                                    {formatCurrency(invoice.amount)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Conditions and Notes */}
                    <div className="border border-zinc-200 rounded-lg p-5 space-y-2.5 text-xs text-zinc-700 bg-zinc-50/50">
                        <h4 className="font-bold uppercase tracking-wider text-blue-900">
                            Condiciones y Métodos de Pago
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-zinc-600">
                            <li>
                                <strong className="text-zinc-800">Plazo de Recolección:</strong> Dispone de un plazo máximo de un (1) mes para cancelar el importe de esta cuota.
                            </li>
                            <li>
                                <strong className="text-zinc-800">Moneda y Tasa de Cambio:</strong> El pago se calculará en base a la tasa del Banco Central de Venezuela (BCV) o Euro oficial a la fecha efectiva de pago, o en su defecto, Pago Móvil / Transferencia.
                            </li>
                            <li>
                                <strong className="text-zinc-800">Reporte de Pago:</strong> Puede registrar su comprobante de pago cómodamente desde la aplicación o plataforma web de residentes.
                            </li>
                        </ul>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                        <strong>Nota Importante:</strong> Finalizado el plazo estipulado de un (1) mes, cualquier saldo pendiente de esta cuota será reflejado en el estado de cuenta y recibo de condominio regular de la unidad.
                    </div>

                    {/* Footer */}
                    <div className="pt-4 border-t border-zinc-200 flex justify-between items-center text-[10px] text-zinc-400">
                        <span>Edificio Granada - Administración de Condominio</span>
                        <span>Aviso de Cobro Oficial - Apartamento {aptoNumber}</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
