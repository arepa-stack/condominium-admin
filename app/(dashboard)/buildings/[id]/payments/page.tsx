'use client';

import { useCallback, useEffect, useState } from 'react';
import { paymentsService } from '@/lib/services/payments.service';
import { unitsService } from '@/lib/services/units.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeletons';
import type { Payment, Unit } from '@/types/models';
import { formatCurrency, formatDate, formatPaymentMethod } from '@/lib/utils/format';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { CheckCircle, XCircle, Info, Home, DollarSign, Receipt } from 'lucide-react';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { PaymentApprovalDialog } from '@/components/payments/PaymentApprovalDialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import Image from 'next/image';
import { useParams, useSearchParams } from 'next/navigation';

export default function BuildingPaymentsPage() {
    const { isSuperAdmin, isBoardMember, user } = usePermissions();
    const params = useParams();
    const searchParams = useSearchParams();
    const buildingId = params.id as string;
    const userIdParam = searchParams.get('user_id');

    const [payments, setPayments] = useState<Payment[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterUnitId, setFilterUnitId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterPeriod, setFilterPeriod] = useState<string>('');

    // Proof Dialog
    const [proofUrl, setProofUrl] = useState<string | null>(null);

    // Approval Dialog State
    const [approvalPayment, setApprovalPayment] = useState<Payment | null>(null);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);


    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            const query: Record<string, string> = {
                building_id: buildingId,
                year: filterYear
            };

            if (userIdParam) query.user_id = userIdParam;
            if (filterUnitId && filterUnitId !== 'all') query.unit_id = filterUnitId;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;
            if (filterPeriod) query.period = filterPeriod;

            const [paymentsData, unitsData] = await Promise.all([
                paymentsService.getPayments(query),
                unitsService.getUnits(buildingId)
            ]);

            let filteredResults = paymentsData;
            if (userIdParam) {
                filteredResults = paymentsData.filter((p: Payment) => p.user_id === userIdParam);
            }

            setPayments(filteredResults);
            setUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Error al cargar los pagos');
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterUnitId, filterStatus, filterPeriod, filterYear, userIdParam]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleReject = async (paymentId: string) => {
        const reason = prompt('Motivo del rechazo:');
        if (reason === null) return;

        try {
            await paymentsService.rejectPayment(paymentId, reason);
            toast.success('Pago rechazado');
            setApprovalPayment(null);
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Error al rechazar el pago');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Pagos</h1>
                    <p className="text-muted-foreground mt-1">Revisá y gestioná los pagos de este edificio</p>
                </div>
                <Button onClick={() => setIsPaymentDialogOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 transition-all">
                    <DollarSign className="h-4 w-4" />
                    Registrar Pago
                </Button>
            </div>

            <FilterBar>
                <div className="w-full md:w-64">
                    <SearchableSelect
                        options={[
                            { value: 'all', label: 'Todas las unidades' },
                            ...units.map(u => ({
                                value: u.id,
                                label: u.name,
                                icon: Home
                            }))
                        ]}
                        value={filterUnitId}
                        onValueChange={setFilterUnitId}
                        placeholder="Todas las unidades"
                        searchPlaceholder="Buscar unidad..."
                        triggerIcon={Home}
                    />
                </div>
                <div className="w-full md:w-48">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Todos los estados" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="PENDING">Pendiente</SelectItem>
                            <SelectItem value="APPROVED">Aprobado</SelectItem>
                            <SelectItem value="REJECTED">Rechazado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full md:w-32">
                    <Select value={filterYear} onValueChange={setFilterYear}>
                        <SelectTrigger>
                            <SelectValue placeholder="Año" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full md:w-48">
                    <Input
                        placeholder="Período (ej. 2024-01)"
                        value={filterPeriod}
                        onChange={(e) => setFilterPeriod(e.target.value)}
                    />
                </div>
            </FilterBar>

            {isLoading ? (
                <TableSkeleton rows={5} columns={7} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Usuario / Unidad</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Referencia / Método</TableHead>
                            <TableHead>Procesador</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="p-0">
                                    <EmptyState icon={Receipt} message="No se encontraron pagos" variant="inline" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            payments.map((payment) => (
                                <TableRow
                                    key={payment.id}
                                    className="cursor-pointer group"
                                    onClick={() => setApprovalPayment(payment)}
                                >
                                    <TableCell className="text-muted-foreground tabular-nums">
                                        {formatDate(payment.payment_date)}
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-semibold">{payment.user?.name || 'Desconocido'}</div>
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                const unitId = payment.unit_id || payment.user?.unit_id;
                                                const unitName = unitId ? units.find(u => u.id === unitId)?.name : null;
                                                const userUnitName = payment.user?.units?.find(u => u.unit_id === unitId)?.unit_name;
                                                const finalUnitName = unitName || userUnitName;
                                                return finalUnitName ? `Unidad ${finalUnitName}` : '';
                                            })()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-bold tabular-nums">
                                        {formatCurrency(payment.amount)}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        <div className="text-foreground font-medium">{formatPaymentMethod(payment.method)}</div>
                                        <span className="text-xs">{payment.reference}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {payment.processor ? (
                                            <div className="flex flex-col">
                                                <span className="text-foreground font-medium">{payment.processor.name}</span>
                                                <span className="text-[10px] tabular-nums">{payment.processed_at ? formatDate(payment.processed_at) : ''}</span>
                                            </div>
                                        ) : <span className="text-xs italic">-</span>}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={payment.status} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {payment.status === 'PENDING' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        onClick={(e) => { e.stopPropagation(); setApprovalPayment(payment); }}
                                                        className="bg-chart-1/20 text-chart-1 hover:bg-chart-1/30 h-8 w-8 p-0 rounded-lg"
                                                        title="Aprobar"
                                                    >
                                                        <CheckCircle className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={(e) => { e.stopPropagation(); handleReject(payment.id); }}
                                                        className="h-8 w-8 p-0 rounded-lg"
                                                        title="Rechazar"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                    </Button>
                                                </>
                                            )}
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setApprovalPayment(payment); }} className="h-8 w-8 p-0">
                                                <Info className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            )}

            {/* Proof Dialog */}
            <Dialog open={!!proofUrl} onOpenChange={(open) => !open && setProofUrl(null)}>
                <DialogContent className="max-w-5xl bg-card border-white/10 backdrop-blur-2xl">
                    <DialogDescription className="sr-only">Vista previa del comprobante de pago.</DialogDescription>
                    <div className="flex items-center justify-between gap-4 mb-2">
                        <DialogTitle>Comprobante de Pago</DialogTitle>
                        {proofUrl && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-white/10 hover:bg-white/5 text-white"
                                onClick={() => window.open(proofUrl, '_blank')}
                            >
                                <CheckCircle className="h-4 w-4" />
                                Descargar / Abrir
                            </Button>
                        )}
                    </div>
                    {proofUrl && (
                        <div className="relative w-full h-[75vh] min-h-[400px] rounded-xl overflow-hidden border border-white/5 shadow-2xl">
                            <Image
                                src={proofUrl}
                                alt="Comprobante de pago"
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <PaymentApprovalDialog
                payment={approvalPayment}
                onClose={() => setApprovalPayment(null)}
                onSuccess={fetchData}
            />
            <PaymentDialog
                open={isPaymentDialogOpen}
                onOpenChange={setIsPaymentDialogOpen}
                buildingId={buildingId}
                onSuccess={fetchData}
            />
        </div>
    );
}
