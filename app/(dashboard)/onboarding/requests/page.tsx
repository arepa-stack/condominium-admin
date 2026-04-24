'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { onboardingService } from '@/lib/services/onboarding.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { FilterBar } from '@/components/ui/filter-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { TableSkeleton } from '@/components/ui/skeletons';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { 
    CheckCircle, 
    XCircle, 
    Building2, 
    UserPlus, 
    Clock, 
    Check, 
    X, 
    Eye,
    QrCode,
    Mail
} from 'lucide-react';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import type { RegistrationRequest, Building } from '@/types/models';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RegistrationRequestDialog } from '@/components/onboarding/RegistrationRequestDialog';

export default function RegistrationRequestsPage() {
    const { isSuperAdmin, buildingId } = usePermissions();
    const { availableBuildings } = useBuildingContext();
    const [requests, setRequests] = useState<RegistrationRequest[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterBuildingId, setFilterBuildingId] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('pending');

    const activeBuildingId =
        filterBuildingId && filterBuildingId !== 'all'
            ? filterBuildingId
            : buildingId;

    useEffect(() => {
        if (buildingId && (filterBuildingId === 'all' || !filterBuildingId)) {
            setFilterBuildingId(buildingId);
        }
    }, [buildingId, filterBuildingId]);

    const fetchData = useCallback(async () => {
        try {
            setIsLoading(true);
            const query: { building_id?: string; status?: string } = {};
            if (activeBuildingId) query.building_id = activeBuildingId;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;

            const [requestsData, buildingsData] = await Promise.all([
                onboardingService.getRegistrationRequests(query),
                isSuperAdmin
                    ? buildingsService.getBuildings()
                    : Promise.resolve(availableBuildings as Building[]),
            ]);

            setRequests(requestsData);
            setBuildings(buildingsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Error al cargar las solicitudes');
        } finally {
            setIsLoading(false);
        }
    }, [activeBuildingId, filterStatus, isSuperAdmin, availableBuildings]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const [selectedRequest, setSelectedRequest] = useState<RegistrationRequest | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const handleView = (request: RegistrationRequest) => {
        setSelectedRequest(request);
        setIsDialogOpen(true);
    };

    const handleApprove = async (id: string) => {
        try {
            await onboardingService.approveRegistrationRequest(id);
            toast.success('Solicitud aprobada con éxito');
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al aprobar la solicitud');
        }
    };

    const handleReject = async (id: string, reason?: string) => {
        try {
            await onboardingService.rejectRegistrationRequest(id, reason);
            toast.success('Solicitud rechazada');
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Error al rechazar la solicitud');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display tracking-tight">Solicitudes de Registro</h1>
                    <p className="text-muted-foreground mt-1">Gestioná las solicitudes de nuevos residentes</p>
                </div>
            </div>

            <FilterBar>
                {isSuperAdmin && (
                    <div className="w-full md:w-64">
                        <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filtrar por edificio" />
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
                <div className="w-full md:w-48">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="pending">Pendientes</SelectItem>
                            <SelectItem value="approved">Aprobados</SelectItem>
                            <SelectItem value="rejected">Rechazados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </FilterBar>

            <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden">
                {isLoading ? (
                    <TableSkeleton rows={5} columns={6} />
                ) : requests.length === 0 ? (
                    <EmptyState 
                        icon={UserPlus} 
                        message="No hay solicitudes que coincidan con los filtros" 
                        variant="inline"
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Residente</TableHead>
                                    <TableHead>Unidad / Edificio</TableHead>
                                    <TableHead>Origen</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests.map((request) => (
                                    <TableRow key={request.id}>
                                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                            {format(new Date(request.created_at), 'dd MMM yyyy, HH:mm', { locale: es })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{request.first_name} {request.last_name}</div>
                                            <div className="text-xs text-muted-foreground">{request.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <Building2 className="h-3 w-3 text-primary" />
                                                <span className="font-medium">{request.building_name || 'Edificio'}</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground ml-4.5">
                                                Unidad: {request.unit_name || 'Desconocida'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="gap-1 font-normal text-[10px]">
                                                {request.source === 'qr' ? (
                                                    <><QrCode className="h-2.5 w-2.5" /> QR</>
                                                ) : (
                                                    <><Mail className="h-2.5 w-2.5" /> Invitación</>
                                                )}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                request.status === 'approved' ? 'default' :
                                                request.status === 'pending' ? 'secondary' :
                                                'destructive'
                                            } className="gap-1">
                                                {request.status === 'pending' && <Clock className="h-3 w-3" />}
                                                {request.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                                                {request.status === 'rejected' && <XCircle className="h-3 w-3" />}
                                                {request.status === 'pending' ? 'Pendiente' : 
                                                 request.status === 'approved' ? 'Aprobado' : 'Rechazado'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="sm" variant="ghost" onClick={() => handleView(request)}>
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                {request.status === 'pending' && (
                                                    <>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="text-chart-1 hover:text-chart-1 hover:bg-chart-1/10"
                                                            onClick={() => handleApprove(request.id)}
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => handleReject(request.id)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            <RegistrationRequestDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                request={selectedRequest}
                onApprove={handleApprove}
                onReject={handleReject}
            />
        </div>
    );
}
