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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Info } from 'lucide-react';
import { formatMoney } from '@/lib/utils/format';
import { PETTY_CASH_CATEGORIES } from '@/lib/utils/constants';
import type {
    PettyCashAssessmentPreview,
    PettyCashCategory,
    PettyCashTransparencyBatch,
    CreatePettyCashAssessmentDto,
} from '@/types/models';

interface AssessmentPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    preview: PettyCashAssessmentPreview | null;
    existingBatches?: PettyCashTransparencyBatch[];
    period: string;
    isGenerating: boolean;
    onConfirm: (dto: CreatePettyCashAssessmentDto) => void;
}

const NO_CATEGORY = '__none__';

export function AssessmentPreviewDialog({
    open,
    onOpenChange,
    preview,
    existingBatches = [],
    period,
    isGenerating,
    onConfirm,
}: AssessmentPreviewDialogProps) {
    const [description, setDescription] = useState('');
    const [amountStr, setAmountStr] = useState('');
    const [category, setCategory] = useState<string>(NO_CATEGORY);

    useEffect(() => {
        if (open && preview) {
            setDescription('');
            setAmountStr(String(preview.pending_to_assess || ''));
            setCategory(NO_CATEGORY);
        }
    }, [open, preview]);

    const amount = useMemo(() => {
        const n = Number(amountStr);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }, [amountStr]);

    const unitCount = preview?.units.length ?? 0;
    const perUnit = unitCount > 0 ? amount / unitCount : 0;

    const amountInCents = Math.round(amount * 100);
    const tooSmallToDistribute =
        amount > 0 && unitCount > 0 && amountInCents < unitCount;
    const exceedsPending =
        !!preview && amount > 0 && amount > preview.pending_to_assess;
    const descriptionValid = description.trim().length > 0;

    const duplicateByDescription = existingBatches.some(
        (b) =>
            b.id !== '__legacy__' &&
            b.description.trim().toLowerCase() === description.trim().toLowerCase() &&
            description.trim().length > 0
    );

    const canSubmit =
        !!preview &&
        descriptionValid &&
        amount > 0 &&
        !tooSmallToDistribute &&
        unitCount > 0 &&
        !isGenerating;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onConfirm({
            description: description.trim(),
            amount,
            category: category === NO_CATEGORY ? undefined : (category as PettyCashCategory),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[92vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Generar prorrateo</DialogTitle>
                    <DialogDescription>
                        Cobra un gasto o conjunto de gastos a las unidades como facturas
                        PETTY_CASH del período {period}. Podés emitir varios prorrateos
                        nombrados (p. ej. &quot;Ascensor abril&quot; y &quot;Agua abril&quot;
                        por separado).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    {preview && (
                        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-muted/20 p-4 sm:grid-cols-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Saldo actual
                                </p>
                                <p
                                    className={
                                        preview.current_balance < 0
                                            ? 'mt-1 text-sm font-bold tabular-nums text-destructive'
                                            : 'mt-1 text-sm font-bold tabular-nums'
                                    }
                                >
                                    {formatMoney(preview.current_balance)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Descubierto
                                </p>
                                <p className="mt-1 text-sm font-bold tabular-nums">
                                    {formatMoney(preview.total_overage)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Ya prorrateado
                                </p>
                                <p className="mt-1 text-sm font-bold tabular-nums">
                                    {formatMoney(preview.already_assessed)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                    Pendiente
                                </p>
                                <p className="mt-1 text-sm font-bold tabular-nums text-primary">
                                    {formatMoney(preview.pending_to_assess)}
                                </p>
                            </div>
                        </div>
                    )}

                    {existingBatches.length > 0 && (
                        <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                            <div className="mb-2 flex items-center gap-2">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    Prorrateos ya emitidos en {period}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {existingBatches.map((b) => (
                                    <Badge
                                        key={b.id}
                                        variant="secondary"
                                        className="border-border/50 bg-background/50"
                                    >
                                        {b.description}
                                        {b.category && ` · ${b.category}`}
                                        {' · '}
                                        {formatMoney(b.total_to_collect)}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="pc-batch-description">Descripción</Label>
                            <Input
                                id="pc-batch-description"
                                placeholder='Ej: "Ascensor abril", "Agua abril"'
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={120}
                            />
                            <p className="text-xs text-muted-foreground">
                                Aparece literal en cada factura generada.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="pc-batch-amount">Monto a prorratear</Label>
                                <Input
                                    id="pc-batch-amount"
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    placeholder="0.00"
                                    value={amountStr}
                                    onChange={(e) => setAmountStr(e.target.value)}
                                />
                                {preview && (
                                    <p className="text-xs text-muted-foreground">
                                        Máximo sugerido:{' '}
                                        {formatMoney(preview.pending_to_assess)}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="pc-batch-category">
                                    Categoría (opcional)
                                </Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger id="pc-batch-category">
                                        <SelectValue placeholder="Sin categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_CATEGORY}>
                                            Sin categoría
                                        </SelectItem>
                                        {PETTY_CASH_CATEGORIES.map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {unitCount > 0 && amount > 0 && (
                        <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                            <p className="text-xs text-muted-foreground">
                                Se generarán <strong>{unitCount}</strong> facturas de{' '}
                                <strong>{formatMoney(perUnit)}</strong> cada una.
                            </p>
                        </div>
                    )}

                    {tooSmallToDistribute && (
                        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                            <div className="text-sm">
                                <p className="font-semibold text-amber-500">
                                    Monto demasiado bajo para repartir
                                </p>
                                <p className="mt-1 text-muted-foreground">
                                    El total en centavos ({amountInCents}) es menor que el
                                    número de unidades ({unitCount}). Subí el monto para
                                    poder prorratearlo.
                                </p>
                            </div>
                        </div>
                    )}

                    {exceedsPending && (
                        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                            <p className="text-sm text-muted-foreground">
                                El monto supera el pendiente ({formatMoney(
                                    preview?.pending_to_assess ?? 0
                                )}). Se va a igual, pero vas a cobrar de más.
                            </p>
                        </div>
                    )}

                    {duplicateByDescription && (
                        <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                            <p className="text-sm text-muted-foreground">
                                Ya existe un prorrateo con esa descripción en {period}. El
                                backend no bloquea duplicados — vas a crear otro batch igual.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isGenerating}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                    >
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Emitir prorrateo
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
