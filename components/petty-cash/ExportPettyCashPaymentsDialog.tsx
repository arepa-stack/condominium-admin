'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Download, FileText, Loader2 } from 'lucide-react';
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { unitsService } from '@/lib/services/units.service';
import type { Unit, PettyCashPaymentReportItem } from '@/types/models';
import { toast } from 'sonner';

interface ExportPettyCashPaymentsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
}

export function ExportPettyCashPaymentsDialog({
    open,
    onOpenChange,
    buildingId,
}: ExportPettyCashPaymentsDialogProps) {
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [receiptNumber, setReceiptNumber] = useState<string>('');

    useEffect(() => {
        if (open && buildingId) {
            setIsLoadingUnits(true);
            unitsService
                .getUnits(buildingId)
                .then((res) => setUnits(res))
                .catch((err) => {
                    console.error('Error al cargar unidades:', err);
                })
                .finally(() => setIsLoadingUnits(false));
        }
    }, [open, buildingId]);

    const handleReset = () => {
        setSelectedUnitId('all');
        setStartDate('');
        setEndDate('');
        setReceiptNumber('');
    };

    const generateCSV = (items: PettyCashPaymentReportItem[]) => {
        const headers = [
            'Fecha',
            'Tipo',
            'Unidad',
            'Propietario / Residente',
            'Nº Recibo',
            'Concepto / Evaluación',
            'Método de Pago',
            'Referencia',
            'Banco',
            'Monto ($ USD)',
            'Moneda Original',
            'Monto Original',
            'Tasa de Cambio',
        ];

        const rows = items.map((item) => {
            const dateStr = item.date ? new Date(item.date).toLocaleString('es-VE') : '';
            const typeStr = item.type === 'collection' ? 'Cobro Cuota' : item.type === 'income' ? 'Ingreso Directo' : item.type;
            const unitStr = item.unit_name || '—';
            const ownerStr = item.owner_name || '—';
            const receiptStr = item.receipt_number || '—';
            const conceptStr = item.assessment_description || item.description || '—';
            const methodStr = item.payment_method || '—';
            const refStr = item.payment_reference || '—';
            const bankStr = item.bank || '—';
            const amountStr = item.amount != null ? item.amount.toFixed(2) : '0.00';
            const origCurrStr = item.original_currency || 'USD';
            const origAmountStr = item.original_amount != null ? item.original_amount.toFixed(2) : '—';
            const rateStr = item.exchange_rate != null ? item.exchange_rate.toFixed(4) : '—';

            return [
                dateStr,
                typeStr,
                unitStr,
                ownerStr,
                receiptStr,
                conceptStr,
                methodStr,
                refStr,
                bankStr,
                amountStr,
                origCurrStr,
                origAmountStr,
                rateStr,
            ];
        });

        // Add UTF-8 BOM for Microsoft Excel compatibility
        const csvContent =
            '\uFEFF' +
            [
                headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
                ...rows.map((row) =>
                    row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
                ),
            ].join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const todayStr = new Date().toISOString().split('T')[0];

        link.setAttribute('href', url);
        link.setAttribute('download', `pagos_caja_chica_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const reportData = await pettyCashService.getPaymentsReport(buildingId, {
                unit_id: selectedUnitId !== 'all' ? selectedUnitId : undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                receipt_number: receiptNumber || undefined,
            });

            if (!reportData || reportData.length === 0) {
                toast.warning('No se encontraron pagos con los filtros seleccionados');
                return;
            }

            generateCSV(reportData);
            toast.success(`Se exportaron ${reportData.length} registros en CSV`);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast.error('Error al generar el reporte de pagos');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg border-border bg-card">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        Exportar Pagos de Caja Chica (CSV)
                    </DialogTitle>
                    <DialogDescription>
                        Filtra los pagos e ingresos a la caja chica por propietario/unidad, rango de fechas o número de recibo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Propietario / Unidad */}
                    <div className="space-y-2">
                        <Label htmlFor="unit-filter">Propietario / Unidad</Label>
                        <Select
                            value={selectedUnitId}
                            onValueChange={setSelectedUnitId}
                            disabled={isLoadingUnits}
                        >
                            <SelectTrigger id="unit-filter">
                                <SelectValue placeholder="Todas las unidades" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas las unidades</SelectItem>
                                {units.map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                        {unit.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Rango de Fechas */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="start-date">Fecha desde</Label>
                            <Input
                                id="start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end-date">Fecha hasta</Label>
                            <Input
                                id="end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Nº de Recibo / Referencia */}
                    <div className="space-y-2">
                        <Label htmlFor="receipt-filter">Nº de Recibo / Referencia</Label>
                        <Input
                            id="receipt-filter"
                            type="text"
                            placeholder="Ej. REC-001 o ref. bancaria"
                            value={receiptNumber}
                            onChange={(e) => setReceiptNumber(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between sm:space-x-2 gap-2">
                    <Button variant="ghost" type="button" onClick={handleReset}>
                        Limpiar filtros
                    </Button>
                    <div className="flex gap-2 justify-end">
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleExport}
                            disabled={isExporting}
                            className="gap-2"
                        >
                            {isExporting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                            Descargar CSV
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
