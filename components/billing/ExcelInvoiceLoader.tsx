'use client';

import { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { billingService } from '@/lib/services/billing.service';
import { formatCurrency } from '@/lib/utils/format';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, Building2 } from 'lucide-react';
import type { ProposedInvoice, PreviewInvoicesResponse, Building } from '@/types/models';

interface ExcelInvoiceLoaderProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId?: string;
    buildings?: Building[];
    onSuccess?: () => void;
}

export function ExcelInvoiceLoader({
    open,
    onOpenChange,
    buildingId,
    buildings = [],
    onSuccess,
}: ExcelInvoiceLoaderProps) {
    const [step, setStep] = useState<'upload' | 'preview' | 'processing'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<PreviewInvoicesResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedBuildingId, setSelectedBuildingId] = useState<string | undefined>(buildingId);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync selectedBuildingId with buildingId prop
    useEffect(() => {
        if (buildingId) {
            setSelectedBuildingId(buildingId);
        }
    }, [buildingId]);

    const resetState = () => {
        setStep('upload');
        setFile(null);
        setPreviewData(null);
        setIsLoading(false);
        if (!buildingId) setSelectedBuildingId(undefined);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.name.endsWith('.xlsx')) {
                setFile(selectedFile);
                handlePreview(selectedFile);
            } else {
                toast.error('Solo se permiten archivos .xlsx');
            }
        }
    };

    const handlePreview = async (selectedFile: File) => {
        if (!selectedBuildingId) {
            toast.error('Debe seleccionar un edificio primero');
            return;
        }

        setIsLoading(true);
        try {
            const data = await billingService.previewInvoices(selectedBuildingId, selectedFile);
            setPreviewData(data);
            setStep('preview');
        } catch (error) {
            console.error('Error previewing invoices:', error);
            toast.error('Error al procesar la previsualización del archivo');
            setFile(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedBuildingId || !previewData) return;

        setIsLoading(true);
        setStep('processing');
        try {
            // Map invoices to ensure receiptNumber is set (might come as receipt_number from API)
            const invoicesToConfirm = previewData.invoices.map(inv => ({
                ...inv,
                receiptNumber: inv.receiptNumber || inv.receipt_number || ''
            }));

            await billingService.confirmInvoices(selectedBuildingId, invoicesToConfirm);
            toast.success('Facturas y unidades procesadas exitosamente');
            onSuccess?.();
            onOpenChange(false);
            resetState();
        } catch (error) {
            //...
            console.error('Error confirming invoices:', error);
            toast.error('Error al confirmar las facturas');
            setStep('preview');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            if (droppedFile.name.endsWith('.xlsx')) {
                setFile(droppedFile);
                handlePreview(droppedFile);
            } else {
                toast.error('Solo se permiten archivos .xlsx');
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!isLoading) {
                onOpenChange(val);
                if (!val) resetState();
            }
        }}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                        Carga Masiva desde Excel
                    </DialogTitle>
                    <DialogDescription>
                        Sube un archivo Excel para crear múltiples facturas y unidades automáticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            {!buildingId && buildings.length > 0 && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        Seleccionar Edificio
                                    </label>
                                    <select
                                        value={selectedBuildingId || ''}
                                        onChange={(e) => setSelectedBuildingId(e.target.value)}
                                        className="w-full p-2 rounded-md border border-border bg-background"
                                    >
                                        <option value="" disabled>Seleccione un edificio...</option>
                                        {buildings.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div
                                onDragOver={handleDragOver}
                                onDrop={handleDrop}
                                onClick={() => {
                                    if (!selectedBuildingId) {
                                        toast.error('Debe seleccionar un edificio primero');
                                        return;
                                    }
                                    fileInputRef.current?.click();
                                }}
                                className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer group ${!selectedBuildingId
                                    ? 'border-muted bg-muted/20 opacity-60 cursor-not-allowed'
                                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
                                    }`}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".xlsx"
                                    className="hidden"
                                    disabled={!selectedBuildingId}
                                />
                                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    {isLoading ? (
                                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                                    ) : (
                                        <Upload className="h-8 w-8 text-primary" />
                                    )}
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-medium">Click o arrastra para subir</p>
                                    <p className="text-sm text-muted-foreground">Solo archivos Excel (.xlsx)</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && previewData && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card className="bg-primary/5 border-primary/20">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                                            <FileSpreadsheet className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Facturas Detectadas</p>
                                            <p className="text-2xl font-bold">{previewData.invoices.length}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-yellow-500/5 border-yellow-500/20">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground uppercase font-semibold">Nuevas Unidades</p>
                                            <p className="text-2xl font-bold">{previewData.unitsToCreate.length}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="rounded-md border border-border/50">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead>Unidad</TableHead>
                                            <TableHead>Recibo</TableHead>
                                            <TableHead>Periodo</TableHead>
                                            <TableHead>Monto</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {previewData.invoices.map((inv, idx) => (
                                            <TableRow key={idx} className={inv.status === 'TO_BE_CREATED' ? 'bg-yellow-500/5' : ''}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        {inv.unitName}
                                                        {inv.warning && (
                                                            <span title={inv.warning}>
                                                                <AlertCircle className="h-4 w-4 text-yellow-500 cursor-help" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs font-mono">{inv.receipt_number || inv.receiptNumber}</TableCell>
                                                <TableCell>{inv.period}</TableCell>
                                                <TableCell>{formatCurrency(inv.amount)}</TableCell>
                                                <TableCell>
                                                    {inv.status === 'TO_BE_CREATED' ? (
                                                        <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 hover:bg-yellow-100">
                                                            Nueva Unidad
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                                            Existente
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="py-12 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-12 w-12 text-primary animate-spin" />
                            <div className="text-center">
                                <p className="text-lg font-medium">Procesando facturas...</p>
                                <p className="text-sm text-muted-foreground">Esto puede tomar unos segundos.</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-2 border-t border-border/50">
                    {step === 'preview' && (
                        <div className="flex w-full items-center justify-between gap-4">
                            <Button variant="ghost" onClick={resetState} disabled={isLoading}>
                                Cancelar y volver a subir
                            </Button>
                            <Button onClick={handleConfirm} disabled={isLoading} className="gap-2">
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                Confirmar y Procesar
                            </Button>
                        </div>
                    )}
                    {step === 'upload' && (
                        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
                            Cerrar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
