'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usersService } from '@/lib/services/users.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service'; // Added
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
import { MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, Building2, Crown, Home, Users } from 'lucide-react';
import { UserDialog } from '@/components/users/UserDialog';
import { UserRoleManager } from '@/components/users/UserRoleManager';
import { UserUnitsManager } from '@/components/users/UserUnitsManager';
import { BuildingRoleBadge } from '@/components/users/BuildingRoleBadge';
import { formatUserRole } from '@/lib/utils/format';
import { getEffectiveRole } from '@/lib/utils/roles';
import type { User, Building, Unit, UserUnit } from '@/types/models';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';

export default function UsersPage() {
    const { isSuperAdmin, isBoardMember, user: currentUser, buildingId } = usePermissions();
    const { availableBuildings } = useBuildingContext();
    const [users, setUsers] = useState<User[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [units, setUnits] = useState<Unit[]>([]); // Added units state
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filterBuildingId, setFilterBuildingId] = useState<string>('all');
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
        try {
            setIsLoading(true);

            // Determine active building ID for fetching units
            let activeBuildingId = null;
            if (filterBuildingId && filterBuildingId !== 'all') {
                activeBuildingId = filterBuildingId;
            } else if (!isSuperAdmin && buildingId) {
                activeBuildingId = buildingId;
            }

            // Build query params
            const query: Record<string, string> = {};
            if (activeBuildingId) query.building_id = activeBuildingId;

            if (filterRole && filterRole !== 'all') query.role = filterRole;
            if (filterStatus && filterStatus !== 'all') query.status = filterStatus;

            const promises: Promise<any>[] = [
                usersService.getUsers(query),
                isSuperAdmin
                    ? buildingsService.getBuildings()
                    : Promise.resolve(availableBuildings.map(b => ({
                        id: b.id,
                        name: b.name || 'Unknown Building',
                        // Mock fields to satisfy Building type
                        address: '',
                        total_units: 0
                    })))
            ];

            if (activeBuildingId) {
                promises.push(unitsService.getUnits(activeBuildingId));
            } else {
                promises.push(Promise.resolve([]));
            }

            const [usersData, buildingsData, unitsData] = await Promise.all(promises);

            setUsers(usersData);
            setBuildings(buildingsData);
            setUnits(unitsData);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Error al cargar los datos');
        } finally {
            setIsLoading(false);
        }
    }, [filterBuildingId, filterRole, filterStatus, isSuperAdmin, currentUser]);

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
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground font-display tracking-tight">Usuarios</h1>
                    <p className="text-muted-foreground mt-1">Gestioná usuarios y permisos</p>
                </div>
                {isSuperAdmin && (
                    <Button onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }}>
                        <CheckCircle className="mr-2 h-4 w-4" /> Agregar Usuario
                    </Button>
                )}
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
                {(isBoardMember && !isSuperAdmin) && (
                    <div className="w-full md:w-64">
                        <div className="flex items-center px-3 h-10 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground">
                            <Building2 className="mr-2 h-4 w-4" />
                            Edificio asignado
                        </div>
                    </div>
                )}
                <div className="w-full md:w-48">
                    <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger>
                            <SelectValue placeholder="Filtrar por rol" />
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
                            <SelectValue placeholder="Filtrar por estado" />
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

            {/* Desktop View */}
            <div className="hidden md:block">
                {isLoading ? (
                    <TableSkeleton rows={5} columns={5} />
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Unidades y edificios</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="p-0">
                                        <EmptyState icon={Users} message="No hay usuarios que coincidan con los filtros" variant="inline" />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell>
                                            <div className="font-medium">{user.name}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{formatUserRole(getEffectiveRole(user))}</Badge>
                                        </TableCell>
                                        <TableCell className="whitespace-normal">
                                            {user.units && user.units.length > 0 ? (
                                                <div className="space-y-1.5 max-w-md">
                                                    {user.units.map((unit) => (
                                                        <div
                                                            key={`${unit.building_id}-${unit.unit_id}`}
                                                            className="flex items-center gap-2 text-xs p-1.5 rounded-md bg-background/50 border border-border/30"
                                                        >
                                                            <Building2 className="h-3 w-3 text-primary flex-shrink-0" />
                                                            <span className="font-medium text-foreground">
                                                                {unit.building_name || 'Edificio desconocido'}
                                                            </span>
                                                            <span className="text-muted-foreground">→</span>
                                                            <Home className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                            <span className="text-foreground">
                                                                {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                            </span>
                                                            {unit.is_primary && (
                                                                <Badge className="text-[9px] h-4 px-1 bg-chart-2/20 text-chart-2 border-chart-2/30">
                                                                    ★ Principal
                                                                </Badge>
                                                            )}
                                                            <BuildingRoleBadge
                                                                buildingRole={user.buildingRoles?.find(br => br.building_id === unit.building_id)?.role || 'resident'}
                                                                className="text-[9px] h-4 px-1.5"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic">Sin unidades asignadas</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                user.status === 'active' ? 'default' :
                                                    user.status === 'pending' ? 'secondary' :
                                                        'destructive'
                                            }>
                                                {user.status || 'active'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Abrir menú</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
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
                                                    {user.status !== 'pending' && user.status !== 'rejected' && (
                                                        <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-destructive">
                                                            <XCircle className="mr-2 h-4 w-4" /> Desactivar
                                                        </DropdownMenuItem>
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
            </div>

            {/* Mobile View (Cards) */}
            <div className="md:hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-xl divide-y divide-border/50">
                        {isLoading ? (
                            <div className="p-8 text-center text-muted-foreground">
                                Cargando usuarios...
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-8">
                                <EmptyState icon={Users} message="No hay usuarios que coincidan con los filtros" variant="inline" />
                            </div>
                        ) : (
                            users.map((user) => (
                                <div key={user.id} className="p-4 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="text-base font-medium text-foreground">{user.name}</div>
                                            <div className="text-sm text-muted-foreground">{user.email}</div>
                                        </div>
                                        <Badge variant={
                                            user.status === 'active' ? 'default' :
                                                user.status === 'pending' ? 'secondary' :
                                                    'destructive'
                                        }>
                                            {user.status || 'active'}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{formatUserRole(getEffectiveRole(user))}</Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Unidades y edificios
                                        </div>
                                        {user.units && user.units.length > 0 ? (
                                            <div className="space-y-2">
                                                {user.units.map((unit) => (
                                                    <div
                                                        key={`${unit.building_id}-${unit.unit_id}`}
                                                        className="flex flex-col gap-1 text-xs p-2 rounded-md bg-background/50 border border-border/30"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Building2 className="h-3 w-3 text-primary" />
                                                            <span className="font-medium text-foreground">
                                                                {unit.building_name || 'Edificio desconocido'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 pl-5">
                                                            <Home className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-foreground">
                                                                {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                            </span>
                                                            {unit.is_primary && (
                                                                <Badge className="text-[9px] h-4 px-1 bg-chart-2/20 text-chart-2 border-chart-2/30">
                                                                    ★ Principal
                                                                </Badge>
                                                            )}
                                                            <BuildingRoleBadge
                                                                buildingRole={user.buildingRoles?.find(br => br.building_id === unit.building_id)?.role || 'resident'}
                                                                className="text-[9px] h-4 px-1.5"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Sin unidades asignadas</span>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-border/30 flex justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full">
                                                    Gestionar usuario <MoreHorizontal className="ml-2 h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
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
                                                {user.status !== 'pending' && user.status !== 'rejected' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-destructive">
                                                        <XCircle className="mr-2 h-4 w-4" /> Desactivar
                                                    </DropdownMenuItem>
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
                                    </div>
                                </div>
                            ))
                        )}
            </div>

            <UserDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                user={selectedUser}
                buildings={buildings}
                onSuccess={fetchData}
            />

            {/* Units Manager Dialog */}
            <UserUnitsManager
                open={isUnitsManagerOpen}
                onOpenChange={setIsUnitsManagerOpen}
                user={unitsManagerUser}
                onSuccess={fetchData}
            />

            {/* Role Manager Dialog */}
            <UserRoleManager
                open={isRoleManagerOpen}
                onOpenChange={setIsRoleManagerOpen}
                user={roleManagerUser}
                onSuccess={fetchData}
            />
        </div>
    );
}
