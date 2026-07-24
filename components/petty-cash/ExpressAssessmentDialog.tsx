'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Loader2, Zap } from 'lucide-react';
import { formatMoney } from '@/lib/utils/format';
import type {
    PettyCashAssessmentPreview,
    CreateExpressAssessmentDto,
} from '@/types/models';

interface ExpressAssessmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    preview: PettyCashAssessmentPreview | null;
    /** The expense entry that triggered this assessment. */
    sourceEntryId: string;
    /** Pre-filled coverage amount from the expense response. */
    coverageAmount: number;
    /**
     * Fresh post-expense balance from the recovery coverage state. When present,
     * it is shown as "Saldo actual" instead of the (stale, pre-expense)
     * preview.current_balance.
     */
    currentBalance?: number;
    isSubmitting: boolean;
    onConfirm: (dto: CreateExpressAssessmentDto) => void;
}

export function ExpressAssessmentDialog({
    open,
    onOpenChange,
    preview,
    sourceEntryId,
    coverageAmount,
    currentBalance,
    isSubmitting,
    onConfirm,
}: ExpressAssessmentDialogProps) {
    const [description, setDescription] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
    // Per-unit amount strings: keyed by unit id, user-editable
    const [unitAmountStrs, setUnitAmountStrs] = useState<Record<string, string>>({});
    const [unitAmountsEdited, setUnitAmountsEdited] = useState(false);

    useEffect(() => {
        if (open && preview) {
            setDescription('');
            setAmountStr(coverageAmount > 0 ? String(coverageAmount) : '');
            setSelectedUnitIds(preview.units.map((u) => u.id));
            setUnitAmountStrs({});
            setUnitAmountsEdited(false);
        }
    }, [open, preview, coverageAmount]);

    const amount = useMemo(() => {
        const n = Number(amountStr);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }, [amountStr]);

    // Work in cents to avoid float drift
    const amountInCents = Math.round(amount * 100);

    const selectedUnits = useMemo(
        () => preview?.units.filter((u) => selectedUnitIds.includes(u.id)) ?? [],
        [preview, selectedUnitIds]
    );

    // Compute equal-split amounts per unit (cents)
    const equalSplitCents = useMemo(() => {
        const map = new Map<string, number>();
        if (selectedUnits.length === 0 || amountInCents <= 0) return map;
        const base = Math.floor(amountInCents / selectedUnits.length);
        const remainder = amountInCents - base * selectedUnits.length;
        selectedUnits.forEach((u, i) => {
            map.set(u.id, base + (i < remainder ? 1 : 0));
        });
        return map;
    }, [amountInCents, selectedUnits]);

    // Resolve displayed amount per unit (user-edited or equal split)
    const resolvedUnitCents = useMemo(() => {
        const map = new Map<string, number>();
        for (const u of selectedUnits) {
            if (unitAmountsEdited && unitAmountStrs[u.id] !== undefined) {
                const n = Math.round(Number(unitAmountStrs[u.id]) * 100);
                map.set(u.id, Number.isFinite(n) ? Math.max(0, n) : 0);
            } else {
                map.set(u.id, equalSplitCents.get(u.id) ?? 0);
            }
        }
        return map;
    }, [selectedUnits, equalSplitCents, unitAmountStrs, unitAmountsEdited]);

    const sumUnitCents = useMemo(() => {
        let total = 0;
        for (const v of resolvedUnitCents.values()) total += v;
        return total;
    }, [resolvedUnitCents]);

    const sumMismatch = unitAmountsEdited && selectedUnits.length > 0 && sumUnitCents !== amountInCents;
    const tooSmall = amount > 0 && selectedUnits.length > 0 && amountInCents < selectedUnits.length;
    // A selected unit must receive a positive amount. Guards against a 0/empty
    // per-unit value that still sums to the total (e.g. one unit absorbs everything).
    const hasZeroUnit =
        amount > 0 &&
        selectedUnits.length > 0 &&
        selectedUnits.some((u) => (resolvedUnitCents.get(u.id) ?? 0) <= 0);
    const descriptionValid = description.trim().length > 0;
    const allUnitsSelected =
        !!preview && preview.units.length > 0 && selectedUnitIds.length === preview.units.length;

    const canSubmit =
        !!preview &&
        descriptionValid &&
        amount > 0 &&
        !tooSmall &&
        selectedUnits.length > 0 &&
        !sumMismatch &&
        !hasZeroUnit &&
        !isSubmitting;

    const toggleUnit = (unitId: string) => {
        setSelectedUnitIds((cur) =>
            cur.includes(unitId) ? cur.filter((id) => id !== unitId) : [...cur, unitId]
        );
    };

    const toggleAll = () => {
        if (!preview) return;
        setSelectedUnitIds(allUnitsSelected ? [] : preview.units.map((u) => u.id));
    };

    const handleUnitAmountChange = (unitId: string, value: string) => {
        setUnitAmountsEdited(true);
        setUnitAmountStrs((cur) => ({ ...cur, [unitId]: value }));
    };

    const handleSubmit = () => {
        if (!canSubmit) return;

        // Only send unit_amounts when the user manually edited the split
        let unit_amounts: Record<string, number> | undefined;
        if (unitAmountsEdited) {
            unit_amounts = {};
            for (const u of selectedUnits) {
                unit_amounts[u.id] = (resolvedUnitCents.get(u.id) ?? 0) / 100;
            }
        }

        onConfirm({
            description: description.trim(),
            amount,
            source_entry_id: sourceEntryId,
            unit_ids: selectedUnits.map((u) => u.id),
            unit_amounts,
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-primary" />
                        Factura express
                    </DialogTitle>
                    <DialogDescription>
                        Cobra el egreso directamente a las unidades con un prorrateo express.
                        Podés ajustar el monto por unidad si el split igual no aplica.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    {preview && (
                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-muted/20 p-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Pendiente a cobrar
                                </p>
                                <p className="mt-1 text-sm font-bold tabular-nums text-primary">
                                    {formatMoney(coverageAmount > 0 ? coverageAmount : preview.pending_to_assess)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Saldo actual
                                </p>
                                {(() => {
                                    // Prefer the fresh post-expense balance from the recovery
                                    // coverage; fall back to the preview balance otherwise.
                                    const displayBalance =
                                        currentBalance ?? preview.current_balance;
                                    return (
                                        <p
                                            className={
                                                displayBalance < 0
                                                    ? 'mt-1 text-sm font-bold tabular-nums text-destructive'
                                                    : 'mt-1 text-sm font-bold tabular-nums'
                                            }
                                        >
                                            {formatMoney(displayBalance)}
                                        </p>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="ea-description">Descripción</Label>
                            <Input
                                id="ea-description"
                                placeholder='Ej: "Plomería 23 julio"'
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={120}
                            />
                            <p className="text-xs text-muted-foreground">
                                Aparece literal en cada factura generada.
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="ea-amount">Monto total a cobrar</Label>
                            <Input
                                id="ea-amount"
                                type="number"
                                step="0.01"
                                min={0}
                                placeholder="0.00"
                                value={amountStr}
                                onChange={(e) => {
                                    setAmountStr(e.target.value);
                                    // Reset manual edits when total changes
                                    if (unitAmountsEdited) {
                                        setUnitAmountsEdited(false);
                                        setUnitAmountStrs({});
                                    }
                                }}
                            />
                        </div>
                    </div>

                    {preview && preview.units.length > 0 && (
                        <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Apartamentos destinatarios
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        Ajustá el monto por unidad si el split igual no corresponde.
                                    </p>
                                </div>
                                <Button type="button" variant="ghost" size="sm" onClick={toggleAll}>
                                    {allUnitsSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                                </Button>
                            </div>

                            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border/50 bg-background/50 p-2">
                                {preview.units.map((unit) => {
                                    const checked = selectedUnitIds.includes(unit.id);
                                    const displayCents = checked ? resolvedUnitCents.get(unit.id) ?? 0 : null;
                                    const editedStr = unitAmountStrs[unit.id] ?? '';
                                    const displayValue = unitAmountsEdited && editedStr !== ''
                                        ? editedStr
                                        : checked && displayCents !== null
                                            ? String(displayCents / 100)
                                            : '';

                                    return (
                                        <div
                                            key={unit.id}
                                            className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/50"
                                        >
                                            <label className="flex cursor-pointer items-center gap-2">
                                                <Checkbox
                                                    checked={checked}
                                                    onCheckedChange={() => toggleUnit(unit.id)}
                                                />
                                                <span className="text-sm font-medium">{unit.name}</span>
                                            </label>
                                            {checked ? (
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    min={0}
                                                    className="h-7 w-28 text-right text-xs"
                                                    value={displayValue}
                                                    placeholder="0.00"
                                                    onChange={(e) => handleUnitAmountChange(unit.id, e.target.value)}
                                                    aria-label={`Monto para ${unit.name}`}
                                                />
                                            ) : (
                                                <span className="text-xs text-muted-foreground">Sin factura</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedUnits.length > 0 && amount > 0 && !sumMismatch && !tooSmall && (
                                <p className="text-xs text-muted-foreground">
                                    Se generarán <strong>{selectedUnits.length}</strong> facturas por un total de{' '}
                                    <strong>{formatMoney(amountInCents / 100)}</strong>.
                                </p>
                            )}
                        </div>
                    )}

                    {selectedUnits.length === 0 && (
                        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                            <p className="text-sm text-muted-foreground">
                                Seleccioná al menos un apartamento para generar el prorrateo.
                            </p>
                        </div>
                    )}

                    {tooSmall && (
                        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                            <p className="text-sm text-muted-foreground">
                                El monto en centavos ({amountInCents}) es menor al número de
                                unidades seleccionadas ({selectedUnits.length}). Subí el monto.
                            </p>
                        </div>
                    )}

                    {sumMismatch && (
                        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                            <div className="text-sm">
                                <p className="font-semibold text-destructive">
                                    La suma no es igual al total
                                </p>
                                <p className="mt-0.5 text-muted-foreground">
                                    Suma actual: {formatMoney(sumUnitCents / 100)} · Total:{' '}
                                    {formatMoney(amountInCents / 100)}
                                </p>
                            </div>
                        </div>
                    )}

                    {hasZeroUnit && !sumMismatch && (
                        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                            <div className="text-sm">
                                <p className="font-semibold text-destructive">
                                    Hay unidades sin monto
                                </p>
                                <p className="mt-0.5 text-muted-foreground">
                                    Cada unidad debe tener un monto mayor a 0.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                    >
                        Cancelar
                    </Button>
                    <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Emitir factura express
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
