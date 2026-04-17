'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usersService } from '@/lib/services/users.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, Crown, Home, Users } from 'lucide-react';
import { UserDialog } from '@/components/users/UserDialog';
import { UserRoleManager } from '@/components/users/UserRoleManager';
import { UserUnitsManager } from '@/components/users/UserUnitsManager';
import { BuildingRoleBadge } from '@/components/users/BuildingRoleBadge';
import { formatUserRole } from '@/lib/utils/format';
import { getEffectiveRole } from '@/lib/utils/roles';
import type { User, Building, Unit } from '@/types/models';
import { useParams } from 'next/navigation';

export default function BuildingUsersPage() {
    const { isSuperAdmin, isBoardMember, user: currentUser } = usePermissions();
    const params = useParams();
    const buildingId = params.id as string;

    const [users, setUsers] = useState<User[]>([]);
    const [building, setBuilding] = useState<Building | null>(null);
    const [units, setUnits] = useState<Unit[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterRole, setFilterRole] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isRoleManagerOpen, setIsRoleManagerOpen] = useState(false);
    const [roleManagerUser, setRoleManagerUser] = useState<User | null>(null);
    const [isUnitsManagerOpen, setIsUnitsManagerOpen] = useState(false);
    const [unitsManagerUser, setUnitsManagerUser] = useState<User | null>(null);

    const fetchData = useCallback(async () => {
        if (!buildingId) return;

        try {
            setIsLoading(true);

            const query: Record<string, string> = { building_id: buildingId };
            if (filterRole && filterRole !== 'all') query.role = filterRole;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;

            const [usersData, buildingData, unitsData] = await Promise.all([
                usersService.getUsers(query),
                buildingsService.getBuildingById(buildingId),
                unitsService.getUnits(buildingId)
            ]);

            setUsers(usersData);
            setBuilding(buildingData);
            setUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Error al cargar los usuarios');
        } finally {
            setIsLoading(false);
        }
    }, [buildingId, filterRole, filterStatus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsDialogOpen(true);
    };

    const handleManageRoles = (user: User) => {
        setRoleManagerUser(user);
        setIsRoleManagerOpen(true);
    };

    const handleManageUnits = (user: User) => {
        setUnitsManagerUser(user);
        setIsUnitsManagerOpen(true);
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('¿Seguro que querés eliminar este usuario?')) return;
        try {
            await usersService.deleteUser(userId);
            toast.success('Usuario eliminado');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar el usuario');
        }
    };

    const handleStatusChange = async (userId: string, status: 'active' | 'rejected') => {
        try {
            if (status === 'active') {
                await usersService.approveUser(userId);
                toast.success('Usuario aprobado');
            } else {
                await usersService.rejectUser(userId);
                toast.success('Usuario rechazado');
            }
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar el estado del usuario');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight">Usuarios</h1>
                    <p className="text-muted-foreground mt-1">Gestioná usuarios y permisos de {building?.name}</p>
                </div>
                {isSuperAdmin && (
                    <Button onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }}>
                        <CheckCircle className="mr-2 h-4 w-4" /> Agregar Usuario
                    </Button>
                )}
            </div>

            <FilterBar>
                <div className="w-full md:w-48">
                    <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger>
                            <SelectValue placeholder="Rol" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los roles</SelectItem>
                            <SelectItem value="resident">Residente</SelectItem>
                            <SelectItem value="board">Miembro de junta</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full md:w-48">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger>
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="rejected">Rechazado</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </FilterBar>

            {isLoading ? (
                <TableSkeleton rows={5} columns={5} />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Rol</TableHead>
                            <TableHead>Unidades</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="p-0">
                                    <EmptyState icon={Users} message="No se encontraron usuarios" variant="inline" />
                                </TableCell>
                            </TableRow>
                        ) : (
                            users.map((user) => (
                                <TableRow key={user.id} className="group">
                                    <TableCell>
                                        <div className="font-bold group-hover:text-primary transition-colors">{user.name}</div>
                                        <div className="text-xs text-muted-foreground">{user.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="font-medium">{formatUserRole(getEffectiveRole(user, buildingId))}</Badge>
                                    </TableCell>
                                    <TableCell className="whitespace-normal">
                                        {user.units && user.units.length > 0 ? (
                                            <div className="flex flex-wrap gap-2 max-w-md">
                                                {user.units
                                                    .filter(u => u.building_id === buildingId)
                                                    .map((unit) => {
                                                        const userBuildingRole = user.buildingRoles?.find(br => br.building_id === buildingId)?.role || 'resident';
                                                        return (
                                                            <div
                                                                key={`${unit.building_id}-${unit.unit_id}`}
                                                                className="flex items-center gap-2 text-[10px] p-1.5 rounded-lg bg-background/50 border border-border/30"
                                                            >
                                                                <Home className="h-3 w-3 text-primary flex-shrink-0" />
                                                                <span className="font-medium">
                                                                    {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                                </span>
                                                                {unit.is_primary && <Badge className="text-[8px] h-3.5 px-1 bg-chart-2/20 text-chart-2 border-chart-2/30">★</Badge>}
                                                                <BuildingRoleBadge
                                                                    buildingRole={userBuildingRole as any}
                                                                    className="text-[8px] h-3.5 px-1.5"
                                                                />
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Sin unidades</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={
                                            user.status === 'active' ? 'bg-chart-1/20 text-chart-1 border-chart-1/30' :
                                                user.status === 'pending' ? 'bg-chart-2/20 text-chart-2 border-chart-2/30' :
                                                    'bg-destructive/20 text-destructive border-destructive/30'
                                        }>
                                            {user.status || 'active'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel className="text-muted-foreground text-[10px] uppercase font-bold">Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Editar detalles
                                                </DropdownMenuItem>
                                                {user.status === 'pending' && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')} className="text-chart-1">
                                                            <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-destructive">
                                                            <XCircle className="mr-2 h-4 w-4" /> Rechazar
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleManageUnits(user)}>
                                                    <Home className="mr-2 h-4 w-4" /> Gestionar unidades
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleManageRoles(user)}>
                                                    <Crown className="mr-2 h-4 w-4" /> Gestionar roles
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-destructive">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar usuario
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            )}

            <UserDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                user={selectedUser}
                buildings={building ? [building] : []}
                onSuccess={fetchData}
            />

            <UserUnitsManager
                open={isUnitsManagerOpen}
                onOpenChange={setIsUnitsManagerOpen}
                user={unitsManagerUser}
                onSuccess={fetchData}
            />

            <UserRoleManager
                open={isRoleManagerOpen}
                onOpenChange={setIsRoleManagerOpen}
                user={roleManagerUser}
                onSuccess={fetchData}
            />
        </div>
    );
}
