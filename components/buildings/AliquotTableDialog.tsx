'use client';

import { useState, useMemo } from 'react';
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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    TableProperties,
    Search,
    Edit2,
    Check,
    X,
    Loader2,
    Mail,
    Phone,
    UserCheck,
    Calculator,
    AlertCircle
} from 'lucide-react';
import { GRANADA_COPROPRIETORS, getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import { unitsService } from '@/lib/services/units.service';
import { toast } from 'sonner';
import type { Unit } from '@/types/models';

interface AliquotTableDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    buildingId: string;
    units: Unit[];
    onUnitsUpdated: () => void;
    onOpenBillingDialog?: () => void;
}

export function AliquotTableDialog({
    open,
    onOpenChange,
    buildingId,
    units,
    onUnitsUpdated,
    onOpenBillingDialog
}: AliquotTableDialogProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
    const [editAliquotValue, setEditAliquotValue] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Merge units with official coproprietor data
    const rows = useMemo(() => {
        return units.map(unit => {
            const coprop = getGranadaCoproprietor(unit.name);
            const apto = coprop?.apto ?? unit.name.replace('-', '');
            const owner = coprop?.propietario ?? 'Sin propietario asignado';
            const email = coprop?.email ?? null;
            const phone = coprop?.phone ?? null;
            const aliquot = unit.aliquot ?? (coprop?.aliquot || 0);

            return {
                unit,
                apto,
                owner,
                email,
                phone,
                aliquot,
            };
        });
    }, [units]);

    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return rows;
        const q = searchQuery.toLowerCase();
        return rows.filter(r =>
            r.apto.toLowerCase().includes(q) ||
            r.unit.name.toLowerCase().includes(q) ||
            r.owner.toLowerCase().includes(q) ||
            (r.email && r.email.toLowerCase().includes(q)) ||
            (r.phone && r.phone.toLowerCase().includes(q))
        );
    }, [rows, searchQuery]);

    const totalAliquotSum = useMemo(() => {
        return rows.reduce((sum, r) => sum + (r.aliquot || 0), 0);
    }, [rows]);

    const handleStartEdit = (unit: Unit, currentAliquot: number) => {
        setEditingUnitId(unit.id);
        setEditAliquotValue(currentAliquot ? currentAliquot.toString() : '');
    };

    const handleCancelEdit = () => {
        setEditingUnitId(null);
        setEditAliquotValue('');
    };

    const handleSaveAliquot = async (unit: Unit) => {
        const val = parseFloat(editAliquotValue.replace(/,/g, '.'));
        if (isNaN(val) || val < 0 || val > 100) {
            toast.error('Ingresá una alícuota válida entre 0 y 100%');
            return;
        }

        try {
            setIsSaving(true);
            await unitsService.updateUnit(buildingId, unit.id, { aliquot: val });
            toast.success(`Alícuota de Unidad ${unit.name} actualizada a ${val}%`);
            setEditingUnitId(null);
            onUnitsUpdated();
        } catch (error) {
            console.error('Failed to update unit aliquot:', error);
            toast.error('Error al actualizar la alícuota');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[92vh] flex flex-col p-0 border-border bg-card">
                <DialogHeader className="p-6 pb-4 border-b border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                                <TableProperties className="h-6 w-6" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold font-display">
                                    Cuadro de Alícuotas y Copropietarios
                                </DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                                    Listado oficial de inmuebles, alícuotas porcentuales y datos de contacto de copropietarios.
                                </DialogDescription>
                            </div>
                        </div>

                        {onOpenBillingDialog && (
                            <Button
                                onClick={() => {
                                    onOpenChange(false);
                                    onOpenBillingDialog();
                                }}
                                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs self-start sm:self-auto"
                            >
                                <Calculator className="h-4 w-4" />
                                Facturar por Alícuotas
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {/* Header stats & search */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar por apto, propietario, correo..."
                                className="pl-9 h-9 text-xs bg-background/50"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="px-3 py-1 bg-muted/50 border-border gap-2 text-xs">
                                <span>Total Unidades:</span>
                                <strong className="font-mono text-foreground">{rows.length}</strong>
                            </Badge>

                            <Badge
                                variant="outline"
                                className={`px-3 py-1 gap-2 text-xs ${Math.abs(totalAliquotSum - 100) < 0.05 ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20' : 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-500 border-yellow-500/20'}`}
                            >
                                <span>Suma Alícuotas:</span>
                                <strong className="font-mono font-bold">{totalAliquotSum.toFixed(4)}%</strong>
                            </Badge>
                        </div>
                    </div>

                    {/* Aliquot Table */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card/50">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-24">Apto #</TableHead>
                                    <TableHead>Nombre / Apellido Propietario(a)</TableHead>
                                    <TableHead className="text-right w-36">Alícuota (%)</TableHead>
                                    <TableHead>Correo Electrónico</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead className="w-20 text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRows.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                                            No se encontraron registros.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRows.map((row) => {
                                        const isEditing = editingUnitId === row.unit.id;

                                        return (
                                            <TableRow key={row.unit.id} className="hover:bg-muted/30">
                                                <TableCell className="font-bold text-foreground font-mono">
                                                    Apto {row.apto}
                                                    <span className="block text-[10px] text-muted-foreground font-normal">
                                                        ({row.unit.name})
                                                    </span>
                                                </TableCell>

                                                <TableCell className="font-medium text-foreground text-sm">
                                                    {row.owner}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Input
                                                                type="number"
                                                                step="0.000001"
                                                                value={editAliquotValue}
                                                                onChange={(e) => setEditAliquotValue(e.target.value)}
                                                                className="h-8 w-24 text-right font-mono text-xs p-1"
                                                                autoFocus
                                                            />
                                                            <span className="text-xs text-muted-foreground">%</span>
                                                        </div>
                                                    ) : (
                                                        <span className="font-mono font-semibold text-xs text-foreground">
                                                            {row.aliquot > 0 ? `${row.aliquot.toFixed(6)}%` : (
                                                                <span className="text-yellow-700 dark:text-yellow-500 font-bold">0%</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-xs text-muted-foreground">
                                                    {row.email ? (
                                                        <span className="flex items-center gap-1.5 font-mono">
                                                            <Mail className="h-3 w-3 text-muted-foreground/70" />
                                                            {row.email}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 italic">--</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-xs text-muted-foreground font-mono">
                                                    {row.phone ? (
                                                        <span className="flex items-center gap-1.5">
                                                            <Phone className="h-3 w-3 text-muted-foreground/70" />
                                                            {row.phone}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground/40 italic">--</span>
                                                    )}
                                                </TableCell>

                                                <TableCell className="text-right">
                                                    {isEditing ? (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() => handleSaveAliquot(row.unit)}
                                                                disabled={isSaving}
                                                                className="h-7 w-7 p-0 text-green-700 hover:text-green-800 hover:bg-green-100"
                                                            >
                                                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={handleCancelEdit}
                                                                disabled={isSaving}
                                                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-100"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleStartEdit(row.unit, row.aliquot)}
                                                            className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
                                                            title="Editar Alícuota"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t border-border flex justify-end bg-muted/20">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
