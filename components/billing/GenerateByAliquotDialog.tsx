'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, CheckSquare, Square, Search, DollarSign, Calendar, FileText, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/format';
import { getUnitInfo } from '@/lib/utils/unit-display';
import { billingService } from '@/lib/services/billing.service';
import { chargeConceptsService } from '@/lib/services/charge-concepts.service';
import { ChargeConceptSelect } from '@/components/billing/ChargeConceptSelect';
import {
    apiErrorMessage, conceptInvoiceDescription, splitConceptAmount, DISTRIBUTION_LABELS,
} from '@/lib/utils/charge-concepts';
import { toast } from 'sonner';
import type { ChargeConcept, Unit } from '@/types/models';

interface GenerateByAliquotDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    units: Unit[];
    onSuccess: () => void;
}

interface UnitCalculation {
    unit: Unit;
    apto: string;
    ownerName: string;
    aliquot: number;
    amount: number;
    selected: boolean;
}

export function GenerateByAliquotDialog({
    open,
    onOpenChange,
    buildingId,
    units,
    onSuccess,
}: GenerateByAliquotDialogProps) {
    // Form parameters
    const [concept, setConcept] = useState<ChargeConcept | null>(null);
    const [totalBudget, setTotalBudget] = useState<string>('');
    const [period, setPeriod] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [description, setDescription] = useState<string>('');
    const [dueDate, setDueDate] = useState<string>(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
    });
    const [markAsPaid, setMarkAsPaid] = useState<boolean>(false);

    // Selection & filter
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());

    // Generation State
    const [isGenerating, setIsGenerating] = useState(false);
    const [progressCurrent, setProgressCurrent] = useState(0);
    const [progressTotal, setProgressTotal] = useState(0);

    // Initialize all units as selected when dialog opens or units change
    useEffect(() => {
        if (open && units.length > 0) {
            setSelectedUnitIds(new Set(units.map(u => u.id)));
        }
    }, [open, units]);

    useEffect(() => {
        if (!open) {
            setConcept(null);
            setTotalBudget('');
            setDescription('');
            setMarkAsPaid(false);
        }
    }, [open]);

    // A concept brings its base amount and a default description
    const handleConceptChange = (next: ChargeConcept | null) => {
        setConcept(next);
        setTotalBudget(next?.base_amount ? String(next.base_amount) : '');
        setDescription(next ? conceptInvoiceDescription(next, period) : '');
    };

    const distribution = concept?.distribution ?? 'ALIQUOT';

    // Parse budget as number
    const numericBudget = useMemo(() => {
        const parsed = parseFloat(totalBudget.replace(/,/g, '.'));
        return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }, [totalBudget]);

    const allSelected = units.length > 0 && units.every(u => selectedUnitIds.has(u.id));

    // Same split the API applies. EQUAL divides among the selected units.
    const shares = useMemo(() => {
        const base = distribution === 'EQUAL' ? units.filter(u => selectedUnitIds.has(u.id)) : units;
        return splitConceptAmount(
            distribution,
            numericBudget,
            base.map(u => ({ id: u.id, name: u.name, aliquot: getUnitInfo(u).aliquot ?? null })),
        );
    }, [units, distribution, numericBudget, selectedUnitIds]);

    // Compute calculations for each unit
    const calculations: UnitCalculation[] = useMemo(() => {
        return units.map(unit => {
            const unitInfo = getUnitInfo(unit);
            // Units without a registered aliquot yield amount 0 and are skipped on generate ("Sin alícuota" in preview).
            const aliquot = unitInfo.aliquot ?? 0;
            const apto = unitInfo.unitName;
            // Owner contact is not part of the unit payload; no linked user data available here.
            const ownerName = '--';

            return {
                unit,
                apto,
                ownerName,
                aliquot,
                amount: shares.get(unit.id) ?? 0,
                selected: selectedUnitIds.has(unit.id),
            };
        });
    }, [units, shares, selectedUnitIds]);

    // Filter calculations by search
    const filteredCalculations = useMemo(() => {
        if (!searchQuery.trim()) return calculations;
        const q = searchQuery.toLowerCase();
        return calculations.filter(
            c => c.apto.toLowerCase().includes(q) ||
                c.unit.name.toLowerCase().includes(q) ||
                c.ownerName.toLowerCase().includes(q)
        );
    }, [calculations, searchQuery]);

    // Summary metrics
    const summary = useMemo(() => {
        const selected = calculations.filter(c => c.selected);
        const totalAmount = selected.reduce((sum, c) => sum + Math.round(c.amount * 100), 0) / 100;
        const totalAliquot = selected.reduce((sum, c) => sum + c.aliquot, 0);

        return {
            selectedCount: selected.length,
            totalUnits: calculations.length,
            totalAmount,
            totalAliquot,
        };
    }, [calculations]);

    const handleToggleUnit = (unitId: string) => {
        setSelectedUnitIds(prev => {
            const next = new Set(prev);
            if (next.has(unitId)) {
                next.delete(unitId);
            } else {
                next.add(unitId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        setSelectedUnitIds(new Set(units.map(u => u.id)));
    };

    const handleDeselectAll = () => {
        setSelectedUnitIds(new Set());
    };

    // Whole building, unpaid: the API bills it in one request and refuses a second run for the period.
    const billWholeBuilding = async (selectedConcept: ChargeConcept) => {
        const result = await chargeConceptsService.bill(buildingId, selectedConcept.id, {
            period,
            amount: numericBudget,
            description: description.trim() || undefined,
            due_date: dueDate || undefined,
        });
        toast.success(`Se generaron ${result.count} facturas por un total de ${formatCurrency(result.total)}`);
        onSuccess();
        onOpenChange(false);
    };

    // Some units, or already paid: one invoice per unit, each linked to the concept.
    const billUnitByUnit = async (selectedConcept: ChargeConcept, toGenerate: UnitCalculation[]) => {
        setProgressCurrent(0);
        setProgressTotal(toGenerate.length);

        let successCount = 0;
        let failCount = 0;
        const invoiceDescription = description.trim() || conceptInvoiceDescription(selectedConcept, period);

        for (let i = 0; i < toGenerate.length; i++) {
            const item = toGenerate[i];
            try {
                await billingService.loadDebt({
                    unit_id: item.unit.id,
                    amount: item.amount,
                    period: period,
                    description: invoiceDescription,
                    concept_id: selectedConcept.id,
                    due_date: dueDate || undefined,
                    status: markAsPaid ? 'PAID' : 'PENDING',
                    paid_amount: markAsPaid ? item.amount : 0,
                    payment_method: markAsPaid ? 'CASH' : undefined,
                });
                successCount++;
            } catch (err) {
                console.error(`Failed to load debt for unit ${item.unit.name}:`, err);
                failCount++;
            }
            setProgressCurrent(i + 1);
        }

        if (successCount > 0) {
            toast.success(`Se generaron ${successCount} facturas correctamente`);
            onSuccess();
            onOpenChange(false);
        }

        if (failCount > 0) {
            toast.error(`Ocurrió un error al generar ${failCount} facturas`);
        }
    };

    const handleGenerate = async () => {
        if (!concept) {
            toast.error('Selecciona el concepto de cobro');
            return;
        }

        const toGenerate = calculations.filter(c => c.selected && c.amount > 0);

        if (toGenerate.length === 0) {
            toast.error('Seleccioná al menos una unidad con monto mayor a cero');
            return;
        }

        if (!period || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
            toast.error('El período debe tener el formato AAAA-MM (ej. 2026-10)');
            return;
        }

        setIsGenerating(true);
        try {
            if (allSelected && !markAsPaid) {
                await billWholeBuilding(concept);
            } else {
                await billUnitByUnit(concept, toGenerate);
            }
        } catch (err) {
            toast.error(apiErrorMessage(err, 'Error al generar las facturas'));
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={isGenerating ? undefined : onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 border-border bg-card">
                <DialogHeader className="p-6 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                            <Calculator className="h-6 w-6" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold font-display">
                                Facturación Masiva por Concepto
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                Genera un recibo por unidad para un concepto de cobro, repartido según su distribución (alícuota, partes iguales o monto fijo).
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Concepto de cobro
                        </Label>
                        <ChargeConceptSelect
                            buildingId={buildingId}
                            value={concept?.id ?? null}
                            onChange={handleConceptChange}
                            disabled={isGenerating}
                            required
                        />
                        {concept && (
                            <span className="text-[11px] text-muted-foreground">
                                {DISTRIBUTION_LABELS[concept.distribution]}
                                {concept.distribution === 'EQUAL' && ' entre las unidades seleccionadas'}
                            </span>
                        )}
                    </div>

                    {/* Input parameters grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="totalBudget" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                {distribution === 'FIXED' ? 'Monto por unidad ($ USD)' : 'Monto total ($ USD)'}
                            </Label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="totalBudget"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={totalBudget}
                                    onChange={(e) => setTotalBudget(e.target.value)}
                                    placeholder="3100.00"
                                    className="pl-9 font-mono font-bold text-base bg-background/50"
                                    disabled={isGenerating}
                                />
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                                {distribution === 'FIXED' ? 'Se cobra igual a cada unidad' : 'Monto a repartir entre las unidades'}
                            </span>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="period" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Período (AAAA-MM)
                            </Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="period"
                                    type="text"
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value)}
                                    placeholder="2026-10"
                                    className="pl-9 font-mono bg-background/50"
                                    disabled={isGenerating}
                                />
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                                Período al que corresponde el cobro
                            </span>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dueDate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Fecha de Vencimiento
                            </Label>
                            <Input
                                id="dueDate"
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="bg-background/50"
                                disabled={isGenerating}
                            />
                            <span className="text-[11px] text-muted-foreground">
                                Límite de recolección de la cuota
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Descripción (aparece en el recibo)
                        </Label>
                        <Input
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={concept ? conceptInvoiceDescription(concept, period) : 'Condominio 2026-10'}
                            className="bg-background/50"
                            disabled={isGenerating}
                        />
                    </div>

                    {/* Mark as pre-paid toggle */}
                    <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                        markAsPaid
                            ? 'bg-emerald-500/10 border-emerald-500/30'
                            : 'bg-muted/30 border-border/60 hover:border-border'
                    }`}>
                        <div className="flex items-center gap-2.5">
                            <Checkbox
                                id="markAsPaidBatch"
                                checked={markAsPaid}
                                onCheckedChange={(val) => setMarkAsPaid(!!val)}
                                disabled={isGenerating}
                            />
                            <label htmlFor="markAsPaidBatch" className="text-xs font-semibold cursor-pointer">
                                <span>Marcar facturas generadas como ya pagadas</span>
                                <span className="block text-[11px] font-normal text-muted-foreground mt-0.5">
                                    Útil si las cuotas (ej. cisterna de agua) ya fueron recolectadas previamente. Saldo pendiente quedará en $0.00.
                                </span>
                            </label>
                        </div>
                        {markAsPaid && (
                            <Badge className="bg-emerald-600 text-white text-[10px] shrink-0 self-start sm:self-center">
                                Generar como PAGADAS
                            </Badge>
                        )}
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Card className="bg-muted/40 border-border/60">
                            <CardContent className="p-3.5">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Monto</span>
                                <span className="text-lg font-bold font-mono text-foreground">
                                    {formatCurrency(numericBudget)}
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-muted/40 border-border/60">
                            <CardContent className="p-3.5">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Seleccionadas</span>
                                <span className="text-lg font-bold text-foreground">
                                    {summary.selectedCount} / {summary.totalUnits}
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-muted/40 border-border/60">
                            <CardContent className="p-3.5">
                                <span className="text-[11px] font-medium text-muted-foreground uppercase block">Alícuota Total</span>
                                <span className="text-lg font-bold font-mono text-primary">
                                    {summary.totalAliquot.toFixed(4)}%
                                </span>
                            </CardContent>
                        </Card>

                        <Card className="bg-primary/10 border-primary/20">
                            <CardContent className="p-3.5">
                                <span className="text-[11px] font-medium text-primary uppercase block">Total a Facturar</span>
                                <span className="text-lg font-black font-mono text-primary">
                                    {formatCurrency(summary.totalAmount)}
                                </span>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Progress Bar during generation */}
                    {isGenerating && (
                        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-2 animate-in fade-in">
                            <div className="flex justify-between text-xs font-semibold text-primary">
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generando recibos de cobro...
                                </span>
                                <span>{progressCurrent} de {progressTotal} facturas</span>
                            </div>
                            <Progress value={(progressCurrent / progressTotal) * 100} className="h-2" />
                        </div>
                    )}

                    {/* Table Toolbar */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
                        <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por apto o propietario..."
                                className="pl-9 h-9 text-xs bg-background/50"
                                disabled={isGenerating}
                            />
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectAll}
                                disabled={isGenerating}
                                className="text-xs h-9 gap-1.5"
                            >
                                <CheckSquare className="h-3.5 w-3.5" />
                                Seleccionar Todas
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeselectAll}
                                disabled={isGenerating}
                                className="text-xs h-9 gap-1.5"
                            >
                                <Square className="h-3.5 w-3.5" />
                                Deseleccionar
                            </Button>
                        </div>
                    </div>

                    {/* Units Calculation Preview Table */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card/50">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-12 text-center">Sel.</TableHead>
                                    <TableHead className="w-24">Inmueble</TableHead>
                                    <TableHead>Propietario(s)</TableHead>
                                    <TableHead className="text-right">Alícuota</TableHead>
                                    <TableHead className="text-right">Importe a Pagar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCalculations.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                            No se encontraron unidades que coincidan con la búsqueda.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredCalculations.map((item) => (
                                        <TableRow
                                            key={item.unit.id}
                                            className={`cursor-pointer transition-colors ${item.selected ? 'bg-primary/5 hover:bg-primary/10' : 'opacity-60 hover:opacity-100'}`}
                                            onClick={() => !isGenerating && handleToggleUnit(item.unit.id)}
                                        >
                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={item.selected}
                                                    onCheckedChange={() => handleToggleUnit(item.unit.id)}
                                                    disabled={isGenerating}
                                                />
                                            </TableCell>
                                            <TableCell className="font-bold text-foreground">
                                                Apartamento {item.apto}
                                                <span className="block text-[11px] text-muted-foreground font-normal">
                                                    ({item.unit.name})
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-sm font-medium text-foreground">
                                                {item.ownerName}
                                            </TableCell>
                                            <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                                {item.aliquot > 0 ? `${item.aliquot.toFixed(6)}%` : (
                                                    <span className="text-yellow-700 dark:text-yellow-500 font-semibold">0% (Sin alícuota)</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono font-bold text-base text-foreground">
                                                {formatCurrency(item.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter className="p-4 md:p-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3 bg-muted/20">
                    <div className="text-xs text-muted-foreground text-center sm:text-left">
                        Se generará una factura {markAsPaid ? 'pagada' : 'pendiente'} para cada una de las <strong className="text-foreground">{summary.selectedCount}</strong> unidades seleccionadas.
                        {allSelected && !markAsPaid && ' Si el concepto ya se facturó en este período, no se vuelve a generar.'}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isGenerating}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating || !concept || summary.selectedCount === 0 || numericBudget <= 0}
                            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4" />
                                    Generar {summary.selectedCount} Facturas ({formatCurrency(summary.totalAmount)})
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
