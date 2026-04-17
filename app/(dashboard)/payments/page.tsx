'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { paymentsService } from '@/lib/services/payments.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
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
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
    DialogHeader,
    DialogFooter,
} from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeletons';
import type { Payment, Building, Unit, PaginationMetadata } from '@/types/models';
import { Paginator } from '@/components/ui/paginator';
import { formatCurrency, formatDate, formatPaymentMethod } from '@/lib/utils/format';

const PAGE_SIZE = 20;
import { toast } from 'sonner';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { Eye, CheckCircle, XCircle, Building2, Home, DollarSign, RotateCcw, Receipt, Loader2 } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PaymentDialog } from '@/components/payments/PaymentDialog';
import { PaymentApprovalDialog } from '@/components/payments/PaymentApprovalDialog';
import Image from 'next/image';

import { useSearchParams } from 'next/navigation';

export default function PaymentsPage() {
    const { isSuperAdmin, isBoardMember, user, buildingId } = usePermissions();
    const searchParams = useSearchParams();
    const userIdParam = searchParams.get('user_id');

    const [payments, setPayments] = useState<Payment[]>([]);
    const [paymentsMetadata, setPaymentsMetadata] = useState<PaginationMetadata | null>(null);
    const [page, setPage] = useState(1);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterBuildingId, setFilterBuildingId] = useState<string>('all');
    const [filterUnitId, setFilterUnitId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
    const [filterPeriod, setFilterPeriod] = useState<string>('');

    // Proof Dialog
    const [proofUrl, setProofUrl] = useState<string | null>(null);

    // Approval Dialog State
    const [approvalPayment, setApprovalPayment] = useState<Payment | null>(null);
    const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

    // Reason Dialog State
    const [reasonDialog, setReasonDialog] = useState<{
        open: boolean;
        paymentId?: string;
        action?: 'reject' | 'reverse';
        title?: string;
        description?: string;
    }>({ open: false });
    const [actionReason, setActionReason] = useState('');
    const [isActionSubmitting, setIsActionSubmitting] = useState(false);

    // Explicit filter wins, else fall back to globally selected building
    const activeBuildingId =
        filterBuildingId && filterBuildingId !== 'all'
            ? filterBuildingId
            : buildingId;

    // Sync filterBuildingId with globally selected buildingId on init/change
    useEffect(() => {
        if (buildingId && (filterBuildingId === 'all' || !filterBuildingId)) {
            setFilterBuildingId(buildingId);
        }
    }, [buildingId, filterBuildingId]);

    // Reset to first page when filters change
    useEffect(() => {
        setPage(1);
    }, [activeBuildingId, filterUnitId, filterStatus, filterPeriod, filterYear, userIdParam]);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);

            const query: {
                page: number;
                limit: number;
                building_id?: string;
                unit_id?: string;
                status?: string;
                period?: string;
                year?: string;
                user_id?: string;
            } = { page, limit: PAGE_SIZE };
            if (activeBuildingId) query.building_id = activeBuildingId;
            if (userIdParam) query.user_id = userIdParam;
            if (filterUnitId && filterUnitId !== 'all') query.unit_id = filterUnitId;
            if (filterYear) query.year = filterYear;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;
            if (filterPeriod) query.period = filterPeriod;

            const [paymentsResp, buildingsData, unitsData] = await Promise.all([
                paymentsService.getAdminPaymentsPaginated(query),
                isSuperAdmin ? buildingsService.getBuildings() : Promise.resolve([] as Building[]),
                activeBuildingId
                    ? unitsService.getUnits(activeBuildingId)
                    : Promise.resolve([] as Unit[]),
            ]);

            setPayments(paymentsResp.data);
            setPaymentsMetadata(paymentsResp.metadata);
            setBuildings(buildingsData);
            setUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Error al cargar los pagos');
        } finally {
            setIsLoading(false);
        }
    }, [activeBuildingId, filterUnitId, filterStatus, filterPeriod, filterYear, userIdParam, isSuperAdmin, page]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Pagos</h1>
                    <p className="text-muted-foreground mt-1">Gestioná y revisá los pagos</p>
                </div>
                <Button onClick={() => setIsPaymentDialogOpen(true)} className="gap-2">
                    <DollarSign className="h-4 w-4" />
                    Registrar Pago
                </Button>
            </div>

            <FilterBar>
                {isSuperAdmin && (
                    <div className="w-full md:w-64">
                        <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Todos los edificios" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los edificios</SelectItem>
                                {buildings.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                        {b.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {(isBoardMember && !isSuperAdmin) && (
                    <div className="w-full md:w-64">
                        <div className="flex items-center px-3 h-10 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
                            <Building2 className="mr-2 h-4 w-4" />
                            Edificio asignado
                        </div>
                    </div>
                )}
                <div className="w-full md:w-56">
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
                        disabled={!isSuperAdmin && !buildingId && filterBuildingId === 'all'}
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
                            <SelectItem value="2026">2026</SelectItem>
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
                <TableSkeleton rows={5} columns={8} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Comprobante</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="p-0">
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
                                    <TableCell>{formatDate(payment.payment_date)}</TableCell>
                                    <TableCell>
                                        {payment.user?.name || 'Desconocido'} <br />
                                        <span className="text-xs text-muted-foreground">
                                            {(() => {
                                                const unitId = payment.unit_id || payment.user?.unit_id;
                                                const unitName = unitId ? units.find(u => u.id === unitId)?.name : payment.user?.unit;
                                                return unitName ? `Unidad ${unitName}` : '';
                                            })()}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                                    <TableCell className="text-muted-foreground">{formatPaymentMethod(payment.method)}</TableCell>
                                    <TableCell className="text-muted-foreground">
                                        <span className="text-xs">{payment.reference || '-'}</span>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {payment.proof_url ? (
                                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setProofUrl(payment.proof_url!); }}>
                                                <Eye className="h-4 w-4 mr-1" /> Ver
                                            </Button>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={payment.status} />
                                    </TableCell>
                                    <TableCell>
                                        {payment.status === 'PENDING' && (
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={(e) => { e.stopPropagation(); setApprovalPayment(payment); }}
                                                    className="bg-chart-1/20 text-chart-1 hover:bg-chart-1/30 h-8 w-8 p-0"
                                                    title="Aprobar"
                                                >
                                                    <CheckCircle className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setReasonDialog({
                                                            open: true,
                                                            paymentId: payment.id,
                                                            action: 'reject',
                                                            title: 'Rechazar Pago',
                                                            description: 'Por favor, indica el motivo del rechazo. Este mensaje será visible para el residente y le enviará una notificación.'
                                                        });
                                                        setActionReason('');
                                                    }}
                                                    className="h-8 w-8 p-0"
                                                    title="Rechazar"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                        {payment.status === 'APPROVED' && (isSuperAdmin || isBoardMember) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setReasonDialog({
                                                        open: true,
                                                        paymentId: payment.id,
                                                        action: 'reverse',
                                                        title: 'Revertir Pago',
                                                        description: 'Por favor, indica un motivo válido para la reversión del pago. Esta acción anulará el balance acreditado a la unidad.'
                                                    });
                                                    setActionReason('');
                                                }}
                                                className="h-8 w-8 p-0 border-chart-2/50 text-chart-2 hover:bg-chart-2/10"
                                                title="Revertir pago"
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            )}

            <Paginator
                metadata={paymentsMetadata}
                isLoading={isLoading}
                onPageChange={setPage}
            />

            {/* Proof Dialog */}
            <Dialog open={!!proofUrl} onOpenChange={(open) => !open && setProofUrl(null)}>
                <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto bg-card border-border/50 shadow-2xl">
                    <DialogDescription className="sr-only">Vista previa del comprobante de pago.</DialogDescription>
                    <div className="flex items-center justify-between">
                        <DialogTitle>Comprobante de Pago</DialogTitle>
                        {proofUrl && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-border/50 hover:bg-muted/50"
                                onClick={() => window.open(proofUrl, '_blank')}
                            >
                                <CheckCircle className="h-4 w-4" />
                                Descargar / Abrir original
                            </Button>
                        )}
                    </div>
                    {proofUrl && (
                        <div className="relative w-full h-[75vh] min-h-[400px]">
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

            {/* Action Reason Dialog */}
            <Dialog open={reasonDialog.open} onOpenChange={(open) => {
                if (isActionSubmitting) return;
                if (!open) setReasonDialog({ open: false });
            }}>
                <DialogContent className="sm:max-w-[425px] border-border/50 bg-card backdrop-blur">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">{reasonDialog.title}</DialogTitle>
                        <DialogDescription className="text-muted-foreground mt-2">
                            {reasonDialog.description}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-6">
                        <div className="flex flex-col gap-3">
                            <Label htmlFor="reason" className="text-sm font-semibold text-foreground/90 flex items-center gap-1">
                                Motivo <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="reason"
                                placeholder="..."
                                value={actionReason}
                                onChange={(e) => setActionReason(e.target.value)}
                                disabled={isActionSubmitting}
                                autoFocus
                                className="bg-background/50 border-border/50 focus:border-primary transition-colors"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button 
                            variant="ghost" 
                            disabled={isActionSubmitting} 
                            onClick={() => setReasonDialog({ open: false })}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            Cancelar
                        </Button>
                        <Button 
                            variant={reasonDialog.action === 'reject' ? "destructive" : "default"}
                            disabled={!actionReason.trim() || isActionSubmitting}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]"
                            onClick={async () => {
                                if (!reasonDialog.paymentId || !actionReason.trim()) return;
                                setIsActionSubmitting(true);
                                try {
                                    if (reasonDialog.action === 'reject') {
                                        await paymentsService.rejectPayment(reasonDialog.paymentId, actionReason.trim());
                                        toast.success('Pago rechazado y residente notificado');
                                    } else {
                                        await paymentsService.reversePayment(reasonDialog.paymentId, actionReason.trim());
                                        toast.success('Pago revertido con éxito');
                                    }
                                    setReasonDialog({ open: false });
                                    fetchData();
                                } catch (error) {
                                    console.error(error);
                                    toast.error(reasonDialog.action === 'reject' ? 'Error al rechazar el pago' : 'Error al revertir el pago');
                                } finally {
                                    setIsActionSubmitting(false);
                                }
                            }}
                        >
                            {isActionSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin opacity-70" />
                                    Procesando...
                                </>
                            ) : (
                                "Confirmar Acción"
                            )}
                        </Button>
                    </DialogFooter>
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
                buildings={buildings}
                onSuccess={fetchData}
            />
        </div>
    );
}
