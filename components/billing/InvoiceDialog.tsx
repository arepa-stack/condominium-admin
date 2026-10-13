'use client';

import { useEffect, useState, useMemo } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { billingService } from '@/lib/services/billing.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
import { decisionsService } from '@/lib/services/decisions.service';
import { usePermissions } from '@/lib/hooks/usePermissions';
import {
    extractActiveBudgets,
    calculateUnitAmountForBudget,
    type ActiveBudgetOption,
} from '@/lib/utils/budget-helpers';
import {
    Building2,
    Home,
    DollarSign,
    FileText,
    Calendar,
    Loader2,
    CheckCircle2,
    Receipt,
    Sparkles,
    Calculator,
    FolderKanban,
} from 'lucide-react';
import type { Unit, Building, BillingDebtPayload, Invoice, Decision } from '@/types/models';

const createInvoiceSchema = (needsBuildingSelector: boolean) => z.object({
    building_id: z.string().optional(),
    unit_id: z.string().min(1, 'La unidad es obligatoria'),
    amount: z.string().min(1, 'El monto es obligatorio'),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'El período debe estar en formato AAAA-MM'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    due_date: z.string().optional(),
    receipt_number: z.string().optional(),
    is_paid: z.boolean(),
    payment_method: z.string().optional(),
    payment_date: z.string().optional(),
}).refine(data => !needsBuildingSelector || (data.building_id && data.building_id.length > 0), {
    message: "El edificio es obligatorio",
    path: ["building_id"],
});

type InvoiceFormData = z.infer<ReturnType<typeof createInvoiceSchema>>;

interface InvoiceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    initialUnitId?: string;
    buildingId?: string;
    initialBudgetOption?: ActiveBudgetOption | null;
    existingInvoices?: Invoice[];
}

const COMMON_CONCEPTS = [
    'Cisterna de agua',
    'Cuota de condominio',
    'Gasto extraordinario',
    'Mantenimiento / Reparación',
];

export function InvoiceDialog({
    open,
    onOpenChange,
    onSuccess,
    initialUnitId,
    buildingId: propBuildingId,
    initialBudgetOption,
    existingInvoices = [],
}: InvoiceDialogProps) {
    const { isSuperAdmin } = usePermissions();
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [isLoadingBuildings, setIsLoadingBuildings] = useState(false);
    const [isLoadingUnits, setIsLoadingUnits] = useState(false);

    // Active budget selection
    const [selectedBudgetId, setSelectedBudgetId] = useState<string>('none');
    const [budgetHint, setBudgetHint] = useState<string | null>(null);

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
            receipt_number: '',
            is_paid: false,
            payment_method: 'CASH',
            payment_date: new Date().toISOString().slice(0, 10),
        },
    });

    const isPaid = form.watch('is_paid');
    const selectedBuildingId = form.watch('building_id') || propBuildingId;
    const selectedUnitId = form.watch('unit_id');

    // Extract active budgets from existing invoices & decisions
    const activeBudgets = useMemo(() => {
        return extractActiveBudgets(existingInvoices, decisions);
    }, [existingInvoices, decisions]);

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

    // Fetch units & decisions when building is selected
    useEffect(() => {
        const fetchUnitsAndDecisions = async () => {
            if (open && selectedBuildingId) {
                try {
                    setIsLoadingUnits(true);
                    const [unitsData, decisionsData] = await Promise.all([
                        unitsService.getUnits(selectedBuildingId),
                        decisionsService.list({ building_id: selectedBuildingId }).catch(() => ({ data: [] })),
                    ]);
                    setUnits(unitsData);
                    setDecisions(decisionsData.data || []);
                } catch (error) {
                    console.error('Failed to fetch units or decisions', error);
                    toast.error('Error al cargar las unidades');
                    setUnits([]);
                } finally {
                    setIsLoadingUnits(false);
                }
            }
        };
        fetchUnitsAndDecisions();
    }, [open, selectedBuildingId]);

    // Set initial unit if provided
    useEffect(() => {
        if (initialUnitId && open) {
            form.setValue('unit_id', initialUnitId);
        }
    }, [initialUnitId, open, form]);

    // Set initial budget option if provided
    useEffect(() => {
        if (initialBudgetOption && open) {
            setSelectedBudgetId(initialBudgetOption.id);
        } else if (!open) {
            setSelectedBudgetId('none');
            setBudgetHint(null);
        }
    }, [initialBudgetOption, open]);

    // Automatically recalculate amount and description when budget or unit changes
    useEffect(() => {
        if (selectedBudgetId === 'none') {
            setBudgetHint(null);
            return;
        }

        const budget = activeBudgets.find(b => b.id === selectedBudgetId);
        if (!budget) return;

        const currentUnit = units.find(u => u.id === selectedUnitId);

        if (budget.baseBudget && currentUnit) {
            const { amount: calcAmount, aliquot } = calculateUnitAmountForBudget(currentUnit, budget.baseBudget);
            form.setValue('amount', calcAmount.toString(), { shouldValidate: true });

            const fullDescription = `${budget.title} - Base: $${budget.baseBudget.toFixed(2)} (Alícuota: ${aliquot.toFixed(4)}%)${budget.details ? ` | ${budget.details}` : ''}`;
            form.setValue('description', fullDescription, { shouldValidate: true });

            if (budget.period) {
                form.setValue('period', budget.period);
            }

            setBudgetHint(
                `Alícuota de la unidad: ${aliquot.toFixed(4)}% sobre presupuesto base de $${budget.baseBudget.toFixed(2)} → Monto: $${calcAmount.toFixed(2)} USD`
            );
        } else if (budget.title) {
            form.setValue('description', budget.title, { shouldValidate: true });
            if (budget.period) {
                form.setValue('period', budget.period);
            }
            setBudgetHint(`Factura vinculada a: ${budget.title}`);
        }
    }, [selectedBudgetId, selectedUnitId, units, activeBudgets, form]);

    const onSubmit = async (values: InvoiceFormData) => {
        try {
            if (needsBuildingSelector && !values.building_id) {
                toast.error('Seleccioná un edificio');
                return;
            }

            const numAmount = Number(values.amount);

            const payload: BillingDebtPayload = {
                unit_id: values.unit_id,
                amount: numAmount,
                period: values.period,
                description: values.description,
                due_date: values.due_date || undefined,
                receipt_number: values.receipt_number?.trim() || undefined,
                status: values.is_paid ? 'PAID' : 'PENDING',
                paid_amount: values.is_paid ? numAmount : 0,
                payment_method: values.is_paid ? (values.payment_method || 'CASH') : undefined,
                payment_date: values.is_paid ? (values.payment_date || new Date().toISOString().slice(0, 10)) : undefined,
            };

            await billingService.loadDebt(payload);
            toast.success(values.is_paid ? 'Factura creada y registrada como PAGADA' : 'Factura creada correctamente');
            onSuccess();
            onOpenChange(false);
            form.reset({
                building_id: propBuildingId || '',
                unit_id: initialUnitId || '',
                amount: '',
                period: new Date().toISOString().slice(0, 7),
                description: '',
                due_date: '',
                receipt_number: '',
                is_paid: false,
                payment_method: 'CASH',
                payment_date: new Date().toISOString().slice(0, 10),
            });
            setSelectedBudgetId('none');
            setBudgetHint(null);
        } catch (error: any) {
            console.error('Failed to create invoice', error);
            toast.error(error.response?.data?.message || 'Error al crear la factura');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto border-border/50 bg-gradient-to-br from-card/95 to-card/100 backdrop-blur">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-display">
                        <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        Crear Factura / Cobro
                    </DialogTitle>
                    <DialogDescription>
                        Carga una nueva factura a una unidad. Puedes vincularla a un <strong>presupuesto activo</strong> o marcarla como <strong>ya pagada</strong>.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
                        {/* Building Selector - Only for Admin without pre-selected building */}
                        {needsBuildingSelector && (
                            <FormField
                                control={form.control}
                                name="building_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 text-xs font-semibold">
                                            <Building2 className="h-4 w-4 text-muted-foreground" />
                                            Edificio <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={isLoadingBuildings}
                                        >
                                            <FormControl>
                                                <SelectTrigger className="bg-background/50 border-border/50 text-xs">
                                                    <SelectValue placeholder={isLoadingBuildings ? "Cargando edificios..." : "Seleccionar edificio"} />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {buildings.map((building) => (
                                                    <SelectItem key={building.id} value={building.id} className="text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-4 w-4 text-primary" />
                                                            {building.name}
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Active Budget Selector Field */}
                        <div className="space-y-1.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                                    <FolderKanban className="h-3.5 w-3.5 text-primary" />
                                    Vincular a Presupuesto Activo
                                </label>
                                {selectedBudgetId !== 'none' && (
                                    <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                                        Vinculado
                                    </Badge>
                                )}
                            </div>
                            <Select
                                value={selectedBudgetId}
                                onValueChange={setSelectedBudgetId}
                            >
                                <SelectTrigger className="h-9 text-xs bg-background/80 border-border">
                                    <SelectValue placeholder="Selecciona un presupuesto..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-56">
                                    <SelectItem value="none" className="text-xs">
                                        Ninguno (Factura individual regular / ordinaria)
                                    </SelectItem>
                                    {activeBudgets.map((b) => (
                                        <SelectItem key={b.id} value={b.id} className="text-xs font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calculator className="h-3.5 w-3.5 text-primary shrink-0" />
                                                <span className="truncate">{b.title}</span>
                                                {b.baseBudget && (
                                                    <Badge variant="secondary" className="text-[10px] ml-auto shrink-0 font-mono">
                                                        Base: ${b.baseBudget.toFixed(2)}
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {budgetHint && (
                                <p className="text-[11px] text-primary flex items-center gap-1.5 pt-0.5 font-medium animate-in fade-in-50">
                                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                                    <span>{budgetHint}</span>
                                </p>
                            )}
                        </div>

                        {/* Unit Selector */}
                        <FormField
                            control={form.control}
                            name="unit_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center gap-2 text-xs font-semibold">
                                        <Home className="h-4 w-4 text-muted-foreground" />
                                        Unidad / Apartamento <span className="text-destructive">*</span>
                                    </FormLabel>
                                    <Select
                                        disabled={!selectedBuildingId || !!initialUnitId || isLoadingUnits}
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger className="bg-background/50 border-border/50 text-xs">
                                                <SelectValue placeholder={
                                                    !selectedBuildingId
                                                        ? "Primero seleccioná un edificio"
                                                        : isLoadingUnits
                                                            ? "Cargando unidades..."
                                                            : "Seleccioná una unidad"
                                                } />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="max-h-56">
                                            {units.length === 0 ? (
                                                <SelectItem value="none" disabled className="text-xs">No se encontraron unidades</SelectItem>
                                            ) : (
                                                units.map((unit) => (
                                                    <SelectItem key={unit.id} value={unit.id} className="text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <Home className="h-4 w-4 text-primary" />
                                                            Apartamento {unit.name} {unit.floor ? `(Piso ${unit.floor})` : ''}
                                                            {unit.aliquot ? ` - ${unit.aliquot}%` : ''}
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
                                    <FormLabel className="flex items-center justify-between text-xs font-semibold">
                                        <span className="flex items-center gap-2">
                                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                                            Monto (USD) <span className="text-destructive">*</span>
                                        </span>
                                        {selectedBudgetId !== 'none' && (
                                            <span className="text-[10px] text-muted-foreground font-normal">
                                                Calculado automáticamente según alícuota
                                            </span>
                                        )}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="Ej. 50.00"
                                            {...field}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors text-base font-semibold font-mono"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Description & Quick Suggestions */}
                        <div className="space-y-1.5">
                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold">
                                            Concepto / Descripción <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Ej. Cisterna de agua (Unidad 14)"
                                                {...field}
                                                className="bg-background/50 border-border/50 focus:border-primary transition-colors text-xs"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Quick Chips if no active budget is selected */}
                            {selectedBudgetId === 'none' && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    <span className="text-[11px] text-muted-foreground self-center mr-1">Rápidos:</span>
                                    {COMMON_CONCEPTS.map((concept) => (
                                        <button
                                            key={concept}
                                            type="button"
                                            onClick={() => form.setValue('description', concept, { shouldValidate: true })}
                                            className="text-[11px] px-2 py-0.5 rounded-md border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {concept}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Period & Due Date */}
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="period"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 text-xs font-semibold">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            Período <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="2026-10"
                                                {...field}
                                                className="bg-background/50 border-border/50 focus:border-primary transition-colors font-mono text-xs"
                                            />
                                        </FormControl>
                                        <FormDescription className="text-[11px]">AAAA-MM</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="due_date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-semibold">Vencimiento (opcional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                className="bg-background/50 border-border/50 focus:border-primary transition-colors text-xs"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Receipt Number (Explicitly Optional) */}
                        <FormField
                            control={form.control}
                            name="receipt_number"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center justify-between text-xs font-semibold">
                                        <span className="flex items-center gap-2">
                                            <Receipt className="h-4 w-4 text-muted-foreground" />
                                            N° de Recibo (Opcional)
                                        </span>
                                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-border">
                                            Opcional
                                        </Badge>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Ej. REC-014 o dejar vacío"
                                            {...field}
                                            className="bg-background/50 border-border/50 focus:border-primary transition-colors font-mono text-xs"
                                        />
                                    </FormControl>
                                    <FormDescription className="text-[11px]">
                                        Si no te pasaron el comprobante o número de recibo, puedes dejarlo vacío.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Mark As Already Paid Toggle */}
                        <div className={`p-3.5 rounded-xl border transition-all ${
                            isPaid
                                ? 'bg-emerald-500/10 border-emerald-500/30'
                                : 'bg-muted/30 border-border/60 hover:border-border'
                        }`}>
                            <FormField
                                control={form.control}
                                name="is_paid"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                className="mt-0.5"
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="text-sm font-semibold cursor-pointer flex items-center gap-1.5">
                                                <span>Marcar como ya pagada</span>
                                                {isPaid && (
                                                    <Badge className="bg-emerald-600 text-white text-[10px] h-4 px-1.5">
                                                        Pagada
                                                    </Badge>
                                                )}
                                            </FormLabel>
                                            <FormDescription className="text-xs">
                                                Marca esto si la unidad ya pagó este concepto (ej. Cisterna pagada en efectivo o transferencia previa). Saldo restante quedará en <strong>$0.00</strong>.
                                            </FormDescription>
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {/* Additional Paid Details (Optional) */}
                            {isPaid && (
                                <div className="mt-3 pt-3 border-t border-emerald-500/20 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in-50 duration-200">
                                    <FormField
                                        control={form.control}
                                        name="payment_method"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                                    Método de Pago
                                                </FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value || 'CASH'}>
                                                    <FormControl>
                                                        <SelectTrigger className="h-8 text-xs bg-background">
                                                            <SelectValue placeholder="Método" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="CASH" className="text-xs">Efectivo / Zelle (Directo)</SelectItem>
                                                        <SelectItem value="TRANSFER" className="text-xs">Transferencia Bancaria</SelectItem>
                                                        <SelectItem value="PAGO_MOVIL" className="text-xs">Pago Móvil</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="payment_date"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                                    Fecha en que se pagó
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="date"
                                                        {...field}
                                                        className="h-8 text-xs bg-background"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}
                        </div>

                        <DialogFooter className="pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                className="border-border/50 text-xs"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                className={
                                    isPaid
                                        ? "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shadow-emerald-600/30 font-semibold text-xs"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
                                }
                            >
                                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isPaid ? (
                                    <>
                                        <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                        Crear Factura Pagada
                                    </>
                                ) : (
                                    'Crear Factura'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
