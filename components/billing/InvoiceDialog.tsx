'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
import { pettyCashService } from '@/lib/services/petty-cash.service';
import { usePermissions } from '@/lib/hooks/usePermissions';
import {
    extractActiveBudgets,
    calculateUnitAmountForBudget,
    type ActiveBudgetOption,
} from '@/lib/utils/budget-helpers';
import { InvoiceReceiptDialog } from '@/components/billing/InvoiceReceiptDialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { getGranadaCoproprietor } from '@/lib/data/granada-coproprietors';
import {
    Building2,
    Home,
    DollarSign,
    FileText,
    Calendar,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Receipt,
    Sparkles,
    Calculator,
    FolderKanban,
    Coins,
    RefreshCw,
} from 'lucide-react';
import type { Unit, Building, BillingDebtPayload, Invoice, Decision, RateSet } from '@/types/models';
import type { InvoicePdfPaymentDetails } from '@/lib/utils/invoice-pdf';

const createInvoiceSchema = (needsBuildingSelector: boolean) => z.object({
    building_id: z.string().optional(),
    unit_id: z.string().min(1, 'La unidad es obligatoria'),
    amount: z.string().min(1, 'El monto es obligatorio'),
    paid_amount: z.string().optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/, 'El período debe estar en formato AAAA-MM'),
    description: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    due_date: z.string().optional(),
    receipt_number: z.string().optional(),
    is_paid: z.boolean(),
    payment_method: z.string().optional(),
    payment_date: z.string().optional(),
    payment_currency: z.enum(['USD', 'VES']).optional(),
    rate_type: z.enum(['EUR_BCV', 'USD_BCV', 'CUSTOM']).optional(),
    exchange_rate: z.string().optional(),
    amount_ves: z.string().optional(),
    include_rate_in_notes: z.boolean().optional(),
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

    // Exchange rates state
    const [ratesData, setRatesData] = useState<RateSet | null>(null);
    const [isLoadingRates, setIsLoadingRates] = useState(false);

    // Receipt Dialog for newly created paid invoice
    const [createdInvoiceForReceipt, setCreatedInvoiceForReceipt] = useState<Invoice | null>(null);
    const [createdPaymentDetails, setCreatedPaymentDetails] = useState<InvoicePdfPaymentDetails | null>(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);

    // Admin needs to select building, board has it pre-selected
    const needsBuildingSelector = isSuperAdmin && !propBuildingId;

    const form = useForm<InvoiceFormData>({
        resolver: zodResolver(createInvoiceSchema(needsBuildingSelector)),
        defaultValues: {
            building_id: propBuildingId || '',
            unit_id: initialUnitId || '',
            amount: '',
            paid_amount: '',
            period: new Date().toISOString().slice(0, 7),
            description: '',
            due_date: '',
            receipt_number: '',
            is_paid: false,
            payment_method: 'PAGO_MOVIL',
            payment_date: new Date().toISOString().slice(0, 10),
            payment_currency: 'VES',
            rate_type: 'EUR_BCV',
            exchange_rate: '',
            amount_ves: '',
            include_rate_in_notes: true,
        },
    });

    const isPaid = form.watch('is_paid');
    const paymentCurrency = form.watch('payment_currency');
    const rateType = form.watch('rate_type');
    const paymentDate = form.watch('payment_date');
    const currentAmount = form.watch('amount');
    const currentPaidAmount = form.watch('paid_amount');
    const exchangeRate = form.watch('exchange_rate');
    const selectedBuildingId = form.watch('building_id') || propBuildingId;
    const selectedUnitId = form.watch('unit_id');

    // Calculation of paid amount in USD vs total amount
    const numTotal = parseFloat(currentAmount || '0') || 0;
    const numPaidInput = parseFloat(currentPaidAmount || '');
    const effectivePaidUsd = !isNaN(numPaidInput) && numPaidInput > 0 ? numPaidInput : numTotal;
    const isPartialPayment = isPaid && numTotal > 0 && effectivePaidUsd < numTotal;
    const remainingBalance = Math.max(0, numTotal - effectivePaidUsd);

    // Extract active budgets from existing invoices & decisions
    const activeBudgets = useMemo(() => {
        return extractActiveBudgets(existingInvoices, decisions);
    }, [existingInvoices, decisions]);

    // Unit options formatted with Apto number, code, and coproprietor for easy autocomplete
    const unitOptions = useMemo(() => {
        return units.map((unit) => {
            const coprop = getGranadaCoproprietor(unit.name);
            const unitLabel = coprop
                ? `Apartamento ${coprop.apto} (${unit.name}) - ${coprop.propietario}`
                : `Apartamento ${unit.name}${unit.floor ? ` (Piso ${unit.floor})` : ''}`;
            const aliquotVal = coprop?.aliquot ?? unit.aliquot;
            const aliquotPart = aliquotVal ? ` [${aliquotVal.toFixed(4)}%]` : '';

            return {
                value: unit.id,
                label: `${unitLabel}${aliquotPart}`,
                icon: Home,
            };
        });
    }, [units]);

    // Fetch rates whenever payment date changes or dialog opens
    const fetchRates = useCallback(async (dateStr?: string) => {
        try {
            setIsLoadingRates(true);
            const data = await pettyCashService.getRates(dateStr);
            setRatesData(data);
            return data;
        } catch (error) {
            console.warn('Could not fetch exchange rates from backend API', error);
            return null;
        } finally {
            setIsLoadingRates(false);
        }
    }, []);

    // Initial rates load
    useEffect(() => {
        if (open && isPaid && paymentCurrency === 'VES') {
            fetchRates(paymentDate);
        }
    }, [open, isPaid, paymentCurrency, paymentDate, fetchRates]);

    // Update exchange rate value when rateType or ratesData changes
    useEffect(() => {
        if (!isPaid || paymentCurrency !== 'VES' || rateType === 'CUSTOM') return;

        let selectedRateValue: number | undefined;
        if (rateType === 'EUR_BCV' && ratesData?.rates?.euro_oficial?.bs_per_unit) {
            selectedRateValue = ratesData.rates.euro_oficial.bs_per_unit;
        } else if (rateType === 'USD_BCV' && ratesData?.rates?.dolar_oficial?.bs_per_unit) {
            selectedRateValue = ratesData.rates.dolar_oficial.bs_per_unit;
        }

        if (selectedRateValue) {
            form.setValue('exchange_rate', selectedRateValue.toFixed(4), { shouldValidate: true });
        }
    }, [isPaid, paymentCurrency, rateType, ratesData, form]);

    // Automatically recalculate Amount in VES when amount/paid_amount (USD) or exchange_rate changes
    useEffect(() => {
        if (!isPaid || paymentCurrency !== 'VES') return;

        const effectiveUsd = parseFloat(currentPaidAmount || '') || parseFloat(currentAmount || '') || 0;
        const numRate = parseFloat(exchangeRate || '0');

        if (!isNaN(effectiveUsd) && effectiveUsd > 0 && !isNaN(numRate) && numRate > 0) {
            const calculatedVes = (effectiveUsd * numRate).toFixed(2);
            form.setValue('amount_ves', calculatedVes, { shouldValidate: false });
        }
    }, [isPaid, paymentCurrency, currentAmount, currentPaidAmount, exchangeRate, form]);

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
            const parsedPaid = values.paid_amount ? parseFloat(values.paid_amount) : NaN;
            const numPaidAmount = values.is_paid
                ? (!isNaN(parsedPaid) && parsedPaid > 0 ? parsedPaid : numAmount)
                : 0;

            const isPartial = values.is_paid && numAmount > 0 && numPaidAmount < numAmount;
            const remainingBalanceUsd = Math.max(0, numAmount - numPaidAmount);
            const invoiceStatus = values.is_paid
                ? (isPartial ? 'PARTIAL' : 'PAID')
                : 'PENDING';

            let finalDescription = values.description.trim();

            const isVesPayment = values.is_paid && values.payment_currency === 'VES';
            const numRate = parseFloat(values.exchange_rate || '0');
            const numVes = parseFloat(values.amount_ves || '0');

            // Format exchange rate string if paid in VES
            if (isVesPayment && numRate > 0 && values.include_rate_in_notes) {
                const rateLabel = values.rate_type === 'EUR_BCV'
                    ? 'Tasa Euro BCV'
                    : values.rate_type === 'USD_BCV'
                    ? 'Tasa USD BCV'
                    : 'Tasa';
                const formattedBs = numVes > 0
                    ? numVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : (numPaidAmount * numRate).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                
                const paymentDateFormatted = values.payment_date || new Date().toISOString().slice(0, 10);
                const paymentNote = isPartial
                    ? ` | Abono en Bs: ${formattedBs} Bs. ($${numPaidAmount.toFixed(2)} USD a ${rateLabel}: ${numRate.toFixed(4)} Bs. - Fecha: ${paymentDateFormatted}) - Resta: $${remainingBalanceUsd.toFixed(2)} USD`
                    : ` | Pagado en Bs: ${formattedBs} Bs. (${rateLabel}: ${numRate.toFixed(4)} Bs. - Fecha: ${paymentDateFormatted})`;

                // Avoid duplicating if already present
                if (!finalDescription.includes('Pagado en Bs:') && !finalDescription.includes('Abono en Bs:')) {
                    finalDescription += paymentNote;
                }
            }

            const payload: BillingDebtPayload = {
                unit_id: values.unit_id,
                amount: numAmount,
                period: values.period,
                description: finalDescription,
                due_date: values.due_date || undefined,
                receipt_number: values.receipt_number?.trim() || undefined,
                status: invoiceStatus,
                paid_amount: numPaidAmount,
                payment_method: values.is_paid ? (values.payment_method || 'CASH') : undefined,
                payment_date: values.is_paid ? (values.payment_date || new Date().toISOString().slice(0, 10)) : undefined,
            };

            const createdInvoice = await billingService.loadDebt(payload);

            toast.success(
                values.is_paid
                    ? (isPartial ? 'Abono parcial registrado correctamente' : 'Factura creada y registrada como PAGADA')
                    : 'Factura creada correctamente'
            );

            // Notify parent to refresh table
            onSuccess();

            // If it was marked as paid, provide immediate receipt download/view option
            if (values.is_paid) {
                const selectedUnitObj = units.find(u => u.id === values.unit_id);

                const invoiceWithUnit: Invoice = {
                    ...createdInvoice,
                    unit: selectedUnitObj,
                    building_id: values.building_id || propBuildingId,
                };

                const paymentDetailsData: InvoicePdfPaymentDetails = {
                    paymentMethod: values.payment_method || 'PAGO_MOVIL',
                    paymentDate: values.payment_date || new Date().toISOString().slice(0, 10),
                    currency: values.payment_currency,
                    rateType: values.rate_type,
                    exchangeRate: numRate > 0 ? numRate : undefined,
                    amountVes: numVes > 0 ? numVes : (numRate > 0 ? numPaidAmount * numRate : undefined),
                    amountUsd: numPaidAmount,
                    paidAmountUsd: numPaidAmount,
                    totalAmountUsd: numAmount,
                    remainingBalanceUsd: remainingBalanceUsd,
                };

                setCreatedInvoiceForReceipt(invoiceWithUnit);
                setCreatedPaymentDetails(paymentDetailsData);
                setIsReceiptOpen(true);
            }

            onOpenChange(false);

            form.reset({
                building_id: propBuildingId || '',
                unit_id: initialUnitId || '',
                amount: '',
                paid_amount: '',
                period: new Date().toISOString().slice(0, 7),
                description: '',
                due_date: '',
                receipt_number: '',
                is_paid: false,
                payment_method: 'PAGO_MOVIL',
                payment_date: new Date().toISOString().slice(0, 10),
                payment_currency: 'VES',
                rate_type: 'EUR_BCV',
                exchange_rate: '',
                amount_ves: '',
                include_rate_in_notes: true,
            });
            setSelectedBudgetId('none');
            setBudgetHint(null);
        } catch (error: unknown) {
            console.error('Failed to create invoice', error);
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al crear la factura');
        }
    };

    const selectedUnitObj = units.find(u => u.id === selectedUnitId);
    const selectedBuildingObj = buildings.find(b => b.id === selectedBuildingId);
    const resolvedBuildingName = selectedBuildingObj?.name || 'Edificio Granada';

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[620px] max-h-[92vh] overflow-y-auto border-border/50 bg-gradient-to-br from-card/95 to-card/100 backdrop-blur">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-display">
                            <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            Crear Factura / Cobro
                        </DialogTitle>
                        <DialogDescription>
                            Carga una nueva factura a una unidad. Puedes vincularla a un <strong>presupuesto activo</strong> o marcarla como <strong>ya pagada</strong> con cálculo a tasa oficial.
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

                            {/* Unit Selector (Autocomplete) */}
                            <FormField
                                control={form.control}
                                name="unit_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 text-xs font-semibold">
                                            <Home className="h-4 w-4 text-muted-foreground" />
                                            Unidad / Apartamento <span className="text-destructive">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <SearchableSelect
                                                options={unitOptions}
                                                value={field.value}
                                                onValueChange={(val) => {
                                                    field.onChange(val);
                                                }}
                                                placeholder={
                                                    !selectedBuildingId
                                                        ? "Primero seleccioná un edificio"
                                                        : isLoadingUnits
                                                            ? "Cargando unidades..."
                                                            : "Escribí o seleccioná unidad (ej. 2-3, 23, propietario)..."
                                                }
                                                searchPlaceholder="Buscar por número (ej. 2-3, 23) o nombre..."
                                                emptyText="No se encontraron unidades"
                                                disabled={!selectedBuildingId || !!initialUnitId || isLoadingUnits}
                                                triggerIcon={Home}
                                                clearValue=""
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Amount in USD */}
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
                                                    placeholder="Ej. Cuota Especial: Reparaciones Mayores y Pintura"
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
                                                N° de Recibo / Factura (Opcional)
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
                                            Si lo dejas vacío, el sistema generará una referencia automática.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Mark As Already Paid Toggle */}
                            <div className={`p-4 rounded-xl border transition-all ${
                                isPaid
                                    ? (isPartialPayment
                                        ? 'bg-amber-500/10 border-amber-500/30'
                                        : 'bg-emerald-500/10 border-emerald-500/30')
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
                                                    <span>Marcar como ya pagada / abonada</span>
                                                    {isPaid && (
                                                        <Badge className={`${isPartialPayment ? 'bg-amber-600' : 'bg-emerald-600'} text-white text-[10px] h-4 px-1.5`}>
                                                            {isPartialPayment ? 'Abono Parcial' : 'Pagada'}
                                                        </Badge>
                                                    )}
                                                </FormLabel>
                                                <FormDescription className="text-xs">
                                                    Marca esto si la unidad realizó un pago total o un abono parcial por este concepto. Podrás registrar la tasa oficial BCV, el monto abonado y descargar el recibo.
                                                </FormDescription>
                                            </div>
                                        </FormItem>
                                    )}
                                />

                                {/* Additional Paid Details */}
                                {isPaid && (
                                    <div className="mt-4 pt-3.5 border-t border-emerald-500/20 space-y-3.5 animate-in fade-in-50 duration-200">
                                        {/* Paid Amount vs Total Quota */}
                                        <div className="p-3 bg-background/80 rounded-lg border border-emerald-500/30 space-y-2">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <FormField
                                                    control={form.control}
                                                    name="paid_amount"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                                                                <span>Monto Pagado / Abonado Hoy (USD)</span>
                                                                <Badge variant="outline" className={`text-[10px] font-normal ${isPartialPayment ? 'border-amber-500 text-amber-700 dark:text-amber-300' : 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'}`}>
                                                                    {isPartialPayment ? 'Abono parcial' : 'Total o abono'}
                                                                </Badge>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder={currentAmount ? `Ej. ${currentAmount}` : 'Ej. 50.00'}
                                                                    {...field}
                                                                    className="h-8 text-xs font-mono font-bold bg-card border-emerald-500/40"
                                                                />
                                                            </FormControl>
                                                            <FormDescription className="text-[11px]">
                                                                {numTotal > 0 ? (
                                                                    <>Total cuota: <strong>${numTotal.toFixed(2)} USD</strong>. Si abona una parte (ej. $50.00), colócalo aquí.</>
                                                                ) : (
                                                                    <>Indica cuánto está pagando hoy en USD.</>
                                                                )}
                                                            </FormDescription>
                                                        </FormItem>
                                                    )}
                                                />

                                                <div className={`flex flex-col justify-center p-2.5 rounded border text-xs space-y-1 ${
                                                    isPartialPayment
                                                        ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                                                        : 'bg-card/60 border-border/50'
                                                }`}>
                                                    <span className="text-[11px] font-medium text-muted-foreground">Estado del Saldo de la Cuota:</span>
                                                    {isPartialPayment ? (
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold">
                                                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                                                                <span>Abono Parcial (Debe Resto)</span>
                                                            </div>
                                                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                                                Cuota Total: <strong>${numTotal.toFixed(2)} USD</strong> • Pagando Hoy: <strong>${effectivePaidUsd.toFixed(2)} USD</strong>
                                                            </p>
                                                            <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                                                Saldo Restante Pendiente: ${remainingBalance.toFixed(2)} USD
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
                                                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                                                                <span>Pago Total (Solvente)</span>
                                                            </div>
                                                            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                                                                Cuota Total: <strong>${numTotal.toFixed(2)} USD</strong>
                                                            </p>
                                                            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                                                Saldo restante quedará en $0.00 USD
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            {/* Payment Method */}
                                            <FormField
                                                control={form.control}
                                                name="payment_method"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                                            Método de Pago
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value || 'PAGO_MOVIL'}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-8 text-xs bg-background">
                                                                    <SelectValue placeholder="Método" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="PAGO_MOVIL" className="text-xs">Pago Móvil</SelectItem>
                                                                <SelectItem value="TRANSFER" className="text-xs">Transferencia Bancaria</SelectItem>
                                                                <SelectItem value="CASH" className="text-xs">Efectivo / Zelle</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Payment Date */}
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

                                            {/* Currency Selector (USD vs VES) */}
                                            <FormField
                                                control={form.control}
                                                name="payment_currency"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                                                            Moneda del Pago
                                                        </FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value || 'VES'}>
                                                            <FormControl>
                                                                <SelectTrigger className="h-8 text-xs bg-background font-semibold">
                                                                    <SelectValue placeholder="Moneda" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="VES" className="text-xs font-medium">
                                                                    Bolívares (VES a Tasa)
                                                                </SelectItem>
                                                                <SelectItem value="USD" className="text-xs font-medium">
                                                                    Dólares (USD Directo)
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        {/* Venezuelan Bolívares Exchange Rate Section */}
                                        {paymentCurrency === 'VES' && (
                                            <div className="p-3 bg-background/80 rounded-lg border border-emerald-500/30 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                                        <Coins className="h-3.5 w-3.5 text-emerald-600" />
                                                        Cálculo a Tasa de Cambio (Bolívares)
                                                    </span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => fetchRates(paymentDate)}
                                                        disabled={isLoadingRates}
                                                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                                                    >
                                                        <RefreshCw className={`h-3 w-3 ${isLoadingRates ? 'animate-spin' : ''}`} />
                                                        Actualizar tasa
                                                    </Button>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {/* Rate Type Selector */}
                                                    <FormField
                                                        control={form.control}
                                                        name="rate_type"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                                                                    Tipo de Tasa
                                                                </FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value}>
                                                                    <FormControl>
                                                                        <SelectTrigger className="h-8 text-xs bg-card">
                                                                            <SelectValue placeholder="Tasa" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="EUR_BCV" className="text-xs">
                                                                            Euro Oficial (BCV)
                                                                        </SelectItem>
                                                                        <SelectItem value="USD_BCV" className="text-xs">
                                                                            Dólar Oficial (BCV)
                                                                        </SelectItem>
                                                                        <SelectItem value="CUSTOM" className="text-xs">
                                                                            Tasa Personalizada
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {/* Rate Value */}
                                                    <FormField
                                                        control={form.control}
                                                        name="exchange_rate"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[11px] font-medium text-muted-foreground flex justify-between">
                                                                    <span>Tasa (Bs./unidad)</span>
                                                                    {rateType === 'EUR_BCV' && <span className="text-emerald-600 font-bold">€ EUR</span>}
                                                                    {rateType === 'USD_BCV' && <span className="text-emerald-600 font-bold">$ USD</span>}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.0001"
                                                                        placeholder="Ej. 45.20"
                                                                        {...field}
                                                                        className="h-8 text-xs font-mono font-semibold bg-card"
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />

                                                    {/* Amount in Bolivares (VES) */}
                                                    <FormField
                                                        control={form.control}
                                                        name="amount_ves"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-[11px] font-medium text-muted-foreground">
                                                                    Monto a Pagar en Bolívares (Bs.)
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        type="number"
                                                                        step="0.01"
                                                                        placeholder="Ej. 2260.00"
                                                                        {...field}
                                                                        className="h-8 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-card"
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>

                                                {/* Live Rate Summary Banner */}
                                                {effectivePaidUsd > 0 && exchangeRate && parseFloat(exchangeRate) > 0 && (
                                                    <div className={`p-2.5 rounded-md border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                                        isPartialPayment
                                                            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200'
                                                            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                                    }`}>
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles className={`h-4 w-4 shrink-0 ${isPartialPayment ? 'text-amber-600' : 'text-emerald-600'}`} />
                                                            <span>
                                                                Fecha: <strong>{paymentDate || 'Hoy'}</strong> • ${effectivePaidUsd.toFixed(2)} USD {isPartialPayment ? `(Abono a cuota de $${numTotal.toFixed(2)})` : ''} a {rateType === 'EUR_BCV' ? 'Tasa Euro BCV' : rateType === 'USD_BCV' ? 'Tasa Dólar BCV' : 'Tasa'} ({parseFloat(exchangeRate).toFixed(4)} Bs.)
                                                            </span>
                                                        </div>
                                                        <Badge className={`${isPartialPayment ? 'bg-amber-600' : 'bg-emerald-600'} text-white font-mono text-xs px-2 self-start sm:self-auto shrink-0`}>
                                                            Bs. {(effectivePaidUsd * parseFloat(exchangeRate)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </Badge>
                                                    </div>
                                                )}

                                                {/* Checkbox to include note in description */}
                                                <FormField
                                                    control={form.control}
                                                    name="include_rate_in_notes"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-0.5">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="text-[11px] text-muted-foreground cursor-pointer">
                                                                Incluir detalle del pago en Bolívares y tasa en el concepto de la factura
                                                            </FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        )}
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
                                            ? (isPartialPayment
                                                ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-md shadow-amber-600/30 font-semibold text-xs"
                                                : "bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md shadow-emerald-600/30 font-semibold text-xs")
                                            : "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs"
                                    }
                                >
                                    {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isPaid ? (
                                        <>
                                            <CheckCircle2 className="mr-1.5 h-4 w-4" />
                                            {isPartialPayment ? 'Registrar Abono Parcial' : 'Crear Factura Pagada'}
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

            {/* Receipt Modal for Immediate PDF Download / Print */}
            {createdInvoiceForReceipt && (
                <InvoiceReceiptDialog
                    open={isReceiptOpen}
                    onOpenChange={setIsReceiptOpen}
                    invoice={createdInvoiceForReceipt}
                    buildingName={resolvedBuildingName}
                    unit={selectedUnitObj}
                    paymentDetails={createdPaymentDetails || undefined}
                />
            )}
        </>
    );
}
