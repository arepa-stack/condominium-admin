'use client';

import { useCallback, useEffect, useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FolderKanban, Loader2, Pencil, Plus } from 'lucide-react';
import { chargeConceptsService } from '@/lib/services/charge-concepts.service';
import { apiErrorMessage, CONCEPT_KIND_LABELS, DISTRIBUTION_LABELS } from '@/lib/utils/charge-concepts';
import { formatCurrency } from '@/lib/utils/format';
import type { ChargeConcept, ChargeConceptKind, ChargeDistribution } from '@/types/models';

interface ChargeConceptsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    /** Called after a concept is created or changed. */
    onChanged?: () => void;
}

interface ConceptForm {
    name: string;
    kind: ChargeConceptKind;
    distribution: ChargeDistribution;
    baseAmount: string;
}

const EMPTY_FORM: ConceptForm = { name: '', kind: 'ORDINARY', distribution: 'ALIQUOT', baseAmount: '' };

export function ChargeConceptsDialog({ open, onOpenChange, buildingId, onChanged }: ChargeConceptsDialogProps) {
    const [concepts, setConcepts] = useState<ChargeConcept[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // null: creating a new concept; otherwise the concept being edited
    const [editing, setEditing] = useState<ChargeConcept | null>(null);
    const [form, setForm] = useState<ConceptForm>(EMPTY_FORM);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            setConcepts(await chargeConceptsService.list(buildingId));
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Error al cargar los conceptos'));
        } finally {
            setIsLoading(false);
        }
    }, [buildingId]);

    useEffect(() => {
        if (open) {
            load();
        } else {
            setEditing(null);
            setForm(EMPTY_FORM);
        }
    }, [open, load]);

    const startEdit = (concept: ChargeConcept) => {
        setEditing(concept);
        setForm({
            name: concept.name,
            kind: concept.kind,
            distribution: concept.distribution,
            baseAmount: concept.base_amount ? String(concept.base_amount) : '',
        });
    };

    const cancelEdit = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
    };

    const handleSave = async () => {
        const name = form.name.trim();
        const baseAmount = form.baseAmount.trim() === '' ? null : Number(form.baseAmount.replace(',', '.'));
        if (!name) {
            toast.error('El nombre es obligatorio');
            return;
        }
        if (baseAmount !== null && !(baseAmount > 0)) {
            toast.error('El monto base debe ser mayor a 0');
            return;
        }
        if (form.kind === 'EXTRAORDINARY' && baseAmount === null) {
            toast.error('Un concepto extraordinario necesita su meta como monto base');
            return;
        }

        setIsSaving(true);
        try {
            if (editing) {
                await chargeConceptsService.update(buildingId, editing.id, {
                    name,
                    distribution: form.distribution,
                    base_amount: baseAmount,
                });
                toast.success('Concepto actualizado');
            } else {
                await chargeConceptsService.create(buildingId, {
                    name,
                    kind: form.kind,
                    distribution: form.distribution,
                    base_amount: baseAmount,
                });
                toast.success('Concepto creado');
            }
            cancelEdit();
            await load();
            onChanged?.();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Error al guardar el concepto'));
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (concept: ChargeConcept) => {
        const status = concept.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
        try {
            await chargeConceptsService.update(buildingId, concept.id, { status });
            toast.success(status === 'CLOSED' ? 'Concepto cerrado' : 'Concepto reabierto');
            await load();
            onChanged?.();
        } catch (error) {
            toast.error(apiErrorMessage(error, 'Error al cambiar el estado del concepto'));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderKanban className="h-5 w-5 text-primary" />
                        Conceptos de cobro
                    </DialogTitle>
                    <DialogDescription>
                        Agrupan las facturas: el condominio de cada mes, una cuota especial, la cisterna... Los conceptos cerrados ya no se pueden facturar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 p-3 rounded-xl border border-border bg-muted/20">
                    <p className="text-sm font-semibold">{editing ? `Editar "${editing.name}"` : 'Nuevo concepto'}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="concept-name" className="text-xs">Nombre</Label>
                            <Input
                                id="concept-name"
                                value={form.name}
                                maxLength={120}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Condominio"
                                disabled={isSaving}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Tipo</Label>
                            <Select
                                value={form.kind}
                                onValueChange={(kind) => setForm({ ...form, kind: kind as ChargeConceptKind })}
                                disabled={isSaving || editing !== null}
                            >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ORDINARY">Ordinario (se agrupa por mes)</SelectItem>
                                    <SelectItem value="EXTRAORDINARY">Extraordinario (tiene una meta)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Distribución</Label>
                            <Select
                                value={form.distribution}
                                onValueChange={(distribution) => setForm({ ...form, distribution: distribution as ChargeDistribution })}
                                disabled={isSaving}
                            >
                                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {(Object.keys(DISTRIBUTION_LABELS) as ChargeDistribution[]).map((d) => (
                                        <SelectItem key={d} value={d}>{DISTRIBUTION_LABELS[d]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="concept-base" className="text-xs">
                                {form.kind === 'EXTRAORDINARY' ? 'Meta ($ USD)' : 'Monto base ($ USD, opcional)'}
                            </Label>
                            <Input
                                id="concept-base"
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.baseAmount}
                                onChange={(e) => setForm({ ...form, baseAmount: e.target.value })}
                                placeholder={form.distribution === 'FIXED' ? '10.00 por unidad' : '3100.00'}
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        {editing && (
                            <Button variant="outline" size="sm" onClick={cancelEdit} disabled={isSaving}>
                                Cancelar
                            </Button>
                        )}
                        <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-1.5">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : !editing && <Plus className="h-4 w-4" />}
                            {editing ? 'Guardar cambios' : 'Crear concepto'}
                        </Button>
                    </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead>Concepto</TableHead>
                                <TableHead>Distribución</TableHead>
                                <TableHead className="text-right">Monto base</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-6">
                                        <Loader2 className="h-5 w-5 animate-spin inline" />
                                    </TableCell>
                                </TableRow>
                            ) : concepts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                                        Este edificio todavía no tiene conceptos de cobro.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                concepts.map((concept) => (
                                    <TableRow key={concept.id} className={concept.status === 'CLOSED' ? 'opacity-60' : ''}>
                                        <TableCell>
                                            <span className="font-medium">{concept.name}</span>
                                            <span className="block text-[11px] text-muted-foreground">
                                                {CONCEPT_KIND_LABELS[concept.kind]}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs">{DISTRIBUTION_LABELS[concept.distribution]}</TableCell>
                                        <TableCell className="text-right font-mono text-xs">
                                            {concept.base_amount ? formatCurrency(concept.base_amount) : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={concept.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px]">
                                                {concept.status === 'ACTIVE' ? 'Activo' : 'Cerrado'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <Button variant="ghost" size="sm" onClick={() => startEdit(concept)} className="h-7 px-2">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => toggleStatus(concept)} className="h-7 px-2 text-xs">
                                                {concept.status === 'ACTIVE' ? 'Cerrar' : 'Reabrir'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}
