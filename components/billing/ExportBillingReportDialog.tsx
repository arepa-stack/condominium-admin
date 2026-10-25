'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ShieldCheck,
    Users,
    FileText,
    FileSpreadsheet,
    Building2,
    EyeOff,
    Eye,
    CheckCircle2,
    Download,
    DollarSign,
    Filter,
} from 'lucide-react';
import {
    generateBillingReportPDF,
    exportBillingReportExcel,
} from '@/lib/utils/billing-report-export';
import { formatCurrency } from '@/lib/utils/format';
import type { Invoice } from '@/types/models';
import { toast } from 'sonner';

interface ExportBillingReportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingName?: string;
    budgetTitle?: string;
    statusFilterLabel?: string;
    invoices: Invoice[];
    summary: {
        totalAmount: number;
        totalPaid: number;
        totalPending: number;
        progress: number;
        count: number;
    };
    defaultFormat?: 'pdf' | 'excel';
}

export function ExportBillingReportDialog({
    open,
    onOpenChange,
    buildingName = 'Residencias Granada',
    budgetTitle = 'Todos los conceptos',
    statusFilterLabel = 'Todos los Estados',
    invoices,
    summary,
    defaultFormat = 'pdf',
}: ExportBillingReportDialogProps) {
    // Default to hiding sensitive data (recommended for public boards & WhatsApp)
    const [hideSensitiveData, setHideSensitiveData] = useState<boolean>(true);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    const handleDownloadPDF = () => {
        try {
            setIsGenerating(true);
            generateBillingReportPDF({
                buildingName,
                budgetTitle,
                statusFilterLabel,
                invoices,
                summary,
                hideSensitiveData,
            });
            const modeText = hideSensitiveData ? 'Modo Cartelera (datos protegidos)' : 'Modo Administrativo completo';
            toast.success(`Reporte PDF generado (${modeText}) con ${invoices.length} facturas`);
            onOpenChange(false);
        } catch (error) {
            console.error('Error al generar PDF:', error);
            toast.error('Ocurrió un error al generar el reporte PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadExcel = () => {
        try {
            setIsGenerating(true);
            exportBillingReportExcel({
                buildingName,
                budgetTitle,
                invoices,
                hideSensitiveData,
            });
            const modeText = hideSensitiveData ? 'Modo Cartelera (datos protegidos)' : 'Modo Administrativo completo';
            toast.success(`Archivo Excel generado (${modeText}) con ${invoices.length} facturas`);
            onOpenChange(false);
        } catch (error) {
            console.error('Error al exportar a Excel:', error);
            toast.error('Ocurrió un error al exportar a Excel');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl p-0 overflow-hidden border-border/80 shadow-2xl">
                {/* Header Banner */}
                <div className="bg-slate-900 text-white p-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                            <Download className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                                Exportar Reporte de Facturación
                            </DialogTitle>
                            <DialogDescription className="text-slate-300 text-xs mt-0.5">
                                {buildingName} • {invoices.length} {invoices.length === 1 ? 'factura seleccionada' : 'facturas seleccionadas (todas las páginas)'}
                            </DialogDescription>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4 text-sm">
                    {/* Filter & Summary Context Banner */}
                    <div className="bg-muted/40 rounded-xl p-3 border border-border/60 text-xs space-y-2">
                        <div className="flex items-center justify-between text-muted-foreground">
                            <span className="flex items-center gap-1.5 font-medium text-foreground">
                                <Filter className="w-3.5 h-3.5 text-primary" />
                                Concepto:
                            </span>
                            <span className="font-semibold text-foreground text-right truncate max-w-[280px]">
                                {budgetTitle !== 'all' ? budgetTitle : 'Todos los conceptos'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-border/40 text-muted-foreground">
                            <span>Total Facturado: <strong className="text-foreground">{formatCurrency(summary.totalAmount)}</strong></span>
                            <span>Total Recaudado: <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(summary.totalPaid)} ({summary.progress}%)</strong></span>
                        </div>
                    </div>

                    {/* Privacy Option Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Nivel de Privacidad de los Datos
                        </label>
                        <p className="text-xs text-muted-foreground">
                            Elige si deseas proteger los datos personales para divulgación pública o incluir la información completa.
                        </p>

                        <div className="grid grid-cols-1 gap-2.5 pt-1">
                            {/* Option 1: Protect Sensitive Data */}
                            <div
                                onClick={() => setHideSensitiveData(true)}
                                className={`cursor-pointer rounded-xl p-3.5 border transition-all flex items-start gap-3 ${
                                    hideSensitiveData
                                        ? 'border-emerald-500/80 bg-emerald-500/5 ring-2 ring-emerald-500/20'
                                        : 'border-border/70 hover:bg-muted/30'
                                }`}
                            >
                                <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                                    hideSensitiveData
                                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                    <EyeOff className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            Modo Cartelera / WhatsApp
                                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 text-[10px] px-1.5 py-0 h-4">
                                                Recomendado
                                            </Badge>
                                        </div>
                                        {hideSensitiveData && (
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        <strong className="text-foreground font-medium">Solo muestra el número de apartamento</strong> (ej. <em>Apto 23</em>), alícuota, forma de pago y saldo. Oculta y tapa nombres de propietarios, correos y números telefónicos para compartir en cartelera o grupos vecinales.
                                    </p>
                                </div>
                            </div>

                            {/* Option 2: Full Administrative Data */}
                            <div
                                onClick={() => setHideSensitiveData(false)}
                                className={`cursor-pointer rounded-xl p-3.5 border transition-all flex items-start gap-3 ${
                                    !hideSensitiveData
                                        ? 'border-indigo-500/80 bg-indigo-500/5 ring-2 ring-indigo-500/20'
                                        : 'border-border/70 hover:bg-muted/30'
                                }`}
                            >
                                <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                                    !hideSensitiveData
                                        ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                                        : 'bg-muted text-muted-foreground'
                                }`}>
                                    <Users className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                                            Modo Administrativo Completo
                                            <Badge variant="outline" className="border-indigo-500/40 text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 text-[10px] px-1.5 py-0 h-4">
                                                Junta y Administración
                                            </Badge>
                                        </div>
                                        {!hideSensitiveData && (
                                            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Incluye <strong className="text-foreground font-medium">nombres completos de propietarios, correos y teléfonos</strong>. Para auditoría interna, archivo y gestiones oficiales de la administración.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer with Direct Download Actions */}
                <div className="bg-muted/20 px-5 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="text-xs h-9 w-full sm:w-auto"
                        disabled={isGenerating}
                    >
                        Cancelar
                    </Button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadExcel}
                            disabled={isGenerating || invoices.length === 0}
                            className="text-xs h-9 gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 flex-1 sm:flex-initial"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            Descargar Excel
                        </Button>

                        <Button
                            type="button"
                            size="sm"
                            onClick={handleDownloadPDF}
                            disabled={isGenerating || invoices.length === 0}
                            className="text-xs h-9 gap-1.5 bg-rose-600 hover:bg-rose-700 text-white flex-1 sm:flex-initial shadow-sm"
                        >
                            <FileText className="w-4 h-4 text-white" />
                            Descargar Reporte PDF
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
