'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { billingService } from '@/lib/services/billing.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Building2, Home, DollarSign, FileText, Calendar } from 'lucide-react';
import type { Unit, Building } from '@/types/models';

// Schema defined outside component to avoid re-creation
// Schema defined outside component to avoid re-creation
const createInvoiceSchema = (needsBuildingSelector: boolean) => z.object({
    building_id: z.string().optional(),
    unit_id: z.string().min(1, 'La unidad es obligatoria'),
    amount: z.string().min(1, 'El monto es obligatorio'),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'El período debe estar en formato AAAA-MM'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    due_date: z.string().optional(),
}).refine(data => !needsBuildingSelector || (data.building_id && data.building_id.length > 0), {
    message: "El edificio es obligatorio",
    path: ["building_id"],
});

type InvoiceFormData = {
    building_id?: string;
    unit_id: string;
    amount: string;
    period: string;
    description: string;
    due_date?: string;
};

interface InvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialUnitId?: string;
    buildingId?: string; // Pre-selected building (for board members)
}

export function InvoiceDialog({ open, onOpenChange, onSuccess, initialUnitId, buildingId: propBuildingId }: InvoiceDialogProps) {
    const { isSuperAdmin } = usePermissions();
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);

    // Admin needs to select building, board has it pre-selected
    const needsBuildingSelector = isSuperAdmin && !propBuildingId;

    const form = useForm<InvoiceFormData>({
        resolver: zodResolver(createInvoiceSchema(needsBuildingSelector)),
        defaultValues: {
            building_id: propBuildingId || '',
            unit_id: initialUnitId || '',
            amount: '',
            period: new Date().toISOString().slice(0, 7),
            description: '',
            due_date: '',
        },
    });

    const selectedBuildingId = form.watch('building_id') || propBuildingId;

    // Fetch all buildings for admin
    useEffect(() => {
        const fetchBuildings = async () => {
            if (open && needsBuildingSelector) {
                try {
                    setIsLoadingBuildings(true);
                    const data = await buildingsService.getBuildings();
                    setBuildings(data);
                } catch (error) {
                    console.error('Failed to fetch buildings', error);
                    toast.error('Error al cargar los edificios');
                } finally {
                    setIsLoadingBuildings(false);
                }
            }
        };
        fetchBuildings();
    }, [open, needsBuildingSelector]);

    // Fetch units when building is selected
    useEffect(() => {
        const fetchUnits = async () => {
            if (open && selectedBuildingId) {
                try {
                    setIsLoadingUnits(true);
                    const data = await unitsService.getUnits(selectedBuildingId);
                    setUnits(data);
                } catch (error) {
                    console.error('Failed to fetch units', error);
                    toast.error('Error al cargar las unidades');
                    setUnits([]);
                } finally {
                    setIsLoadingUnits(false);
                }
            }
        };
        fetchUnits();
    }, [open, selectedBuildingId]);

    // Set initial unit if provided
    useEffect(() => {
        if (initialUnitId && open) {
            form.setValue('unit_id', initialUnitId);
        }
    }, [initialUnitId, open, form]);

    const onSubmit = async (values: InvoiceFormData) => {
        try {
            // Check building_id if admin
            if (needsBuildingSelector && !values.building_id) {
                toast.error('Seleccioná un edificio');
                return;
            }

            // POST /billing/debt - Only needs unit_id
            const payload = {
                unit_id: values.unit_id,
                amount: Number(values.amount),
                period: values.period,
                description: values.description,
                due_date: values.due_date || undefined,
            };

            await billingService.loadDebt(payload);
            toast.success('Factura creada correctamente');
            onSuccess();
            onOpenChange(false);
            form.reset();
        } catch (error: any) {
            console.error('Failed to create invoice', error);
            toast.error(error.response?.data?.message || 'Error al crear la factura');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] border-border/50 bg-gradient-to-br from-card/95 to-card/100 backdrop-blur">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileText className="h-5 w-5 text-emerald-400" />
                        Crear nueva factura
                    </DialogTitle>
                    <DialogDescription>
                        Cargá una nueva deuda a una unidad específica para el período seleccionado.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        {/* Building Selector - Only for Admin without pre-selected building */}
                        {needsBuildingSelector && (
                            <FormField
                                control={form.control}
                                name="building_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            Edificio <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={isLoadingBuildings}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="bg-background/50 border-border/50">
                                                    <SelectValue placeholder={isLoadingBuildings ? "Cargando edificios..." : "Seleccionar edificio"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {buildings.map((building) => (
                                                    <SelectItem key={building.id} value={building.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-primary" />
                                                            {building.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-xs">
                                            Elegí el edificio que contiene la unidad
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Unit Selector */}
                        <FormField
                            control={form.control}
                            name="unit_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <Home className="h-4 w-4 text-muted-foreground" />
                                        Unidad <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <Select
                                        disabled={!selectedBuildingId || !!initialUnitId || isLoadingUnits}
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="bg-background/50 border-border/50">
                                                <SelectValue placeholder={
                                                    !selectedBuildingId
                                                        ? "Primero seleccioná un edificio"
                                                        : isLoadingUnits
                                                            ? "Cargando unidades..."
                                                            : "Seleccioná una unidad"
                                                } />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {units.length === 0 ? (
                                                <SelectItem value="none" disabled>No se encontraron unidades</SelectItem>
                                            ) : (
                                                units.map((unit) => (
                                                    <SelectItem key={unit.id} value={unit.id}>
                                                        <div className="flex items-center gap-2">
                                                            <Home className="h-4 w-4 text-primary" />
                                                            {unit.name} {unit.floor ? `(Piso ${unit.floor})` : ''}
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Amount */}
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                                        Monto <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="100.00"
                                            {...field}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            {/* Period */}
                            <FormField
                                control={form.control}
                                name="period"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            Período <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="2026-02"
                                                {...field}
                                                className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-xs">AAAA-MM</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Due Date */}
                            <FormField
                                control={form.control}
                                name="due_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Vencimiento (opcional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción <span className="text-destructive">*</span></FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Expensas mensuales"
                                            {...field}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="border-border/50"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/30"
                            >
                                {form.formState.isSubmitting ? 'Creando...' : 'Crear factura'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
