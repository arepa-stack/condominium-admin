'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usersService } from '@/lib/services/users.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service'; // Added
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { MoreHorizontal, Edit, Trash2, CheckCircle, XCircle, Building2, Crown, Home } from 'lucide-react';
import { UserDialog } from '@/components/users/UserDialog';
import { UserRoleManager } from '@/components/users/UserRoleManager';
import { UserUnitsManager } from '@/components/users/UserUnitsManager';
import { BuildingRoleBadge } from '@/components/users/BuildingRoleBadge';
import { formatUserRole } from '@/lib/utils/format';
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
            toast.error('Failed to fetch data');
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
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await usersService.deleteUser(userId);
            toast.success('User deleted');
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error('Failed to delete user');
        }
    };

    const handleStatusChange = async (userId: string, status: 'active' | 'rejected') => {
        try {
            if (status === 'active') {
                await usersService.approveUser(userId);
                toast.success('User approved');
            } else {
                await usersService.rejectUser(userId);
                toast.success('User rejected');
            }
            fetchData();
        } catch (error) {
            console.error(error);
            toast.error(`Failed to update user status`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">Users</h1>
                    <p className="text-muted-foreground mt-1">Manage users and permissions</p>
                </div>
                {isSuperAdmin && (
                    <Button onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }}>
                        <CheckCircle className="mr-2 h-4 w-4" /> Add User
                    </Button>
                )}
            </div>

            {/* Filters Bar */}
            <Card className="p-4 border-border/50 bg-card">
                <div className="flex flex-wrap gap-4">
                    {isSuperAdmin && (
                        <div className="w-full md:w-64">
                            <Select value={filterBuildingId} onValueChange={setFilterBuildingId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filter by Building" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Buildings</SelectItem>
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
                                Building Scoped
                            </div>
                        </div>
                    )}
                    <div className="w-full md:w-48">
                        <Select value={filterRole} onValueChange={setFilterRole}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Roles</SelectItem>
                                <SelectItem value="resident">Resident</SelectItem>
                                <SelectItem value="board">Board Member</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="w-full md:w-48">
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Filter by Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </Card>

            {/* Users List - Responsive View */}
            <Card className="border-border/50 bg-card">
                <CardContent className="p-0">
                    {/* Desktop View (Table) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border/50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Units & Buildings</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50 bg-card">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                            Loading users...
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                            No users found matching filters.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-accent/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-foreground">{user.name}</div>
                                                <div className="text-sm text-muted-foreground">{user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge variant="outline">{formatUserRole(user.role)}</Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.units && user.units.length > 0 ? (
                                                    <div className="space-y-1.5 max-w-md">
                                                        {user.units.map((unit) => (
                                                            <div
                                                                key={`${unit.building_id}-${unit.unit_id}`}
                                                                className="flex items-center gap-2 text-xs p-1.5 rounded-md bg-background/50 border border-border/30"
                                                            >
                                                                <Building2 className="h-3 w-3 text-primary flex-shrink-0" />
                                                                <span className="font-medium text-foreground">
                                                                    {unit.building_name || 'Unknown Building'}
                                                                </span>
                                                                <span className="text-muted-foreground">→</span>
                                                                <Home className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                                                <span className="text-foreground">
                                                                    {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                                </span>
                                                                {unit.is_primary && (
                                                                    <Badge className="text-[9px] h-4 px-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
                                                                        ★ Primary
                                                                    </Badge>
                                                                )}
                                                                <BuildingRoleBadge
                                                                    buildingRole={unit.building_role as any}
                                                                    className="text-[9px] h-4 px-1.5"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No units assigned</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge variant={
                                                    user.status === 'active' ? 'default' :
                                                        user.status === 'pending' ? 'secondary' :
                                                            'destructive'
                                                }>
                                                    {user.status || 'active'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {/* Desktop Actions */}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                        </DropdownMenuItem>
                                                        {user.status === 'pending' && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')} className="text-green-600">
                                                                    <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-red-600">
                                                                    <XCircle className="mr-2 h-4 w-4" /> Reject
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {user.status !== 'pending' && user.status !== 'rejected' && (
                                                            <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-red-600">
                                                                <XCircle className="mr-2 h-4 w-4" /> Deactivate/Reject
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleManageUnits(user)}>
                                                            <Home className="mr-2 h-4 w-4" /> Manage Units
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleManageRoles(user)}>
                                                            <Crown className="mr-2 h-4 w-4" /> Manage Roles
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete User
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile View (Cards) */}
                    <div className="md:hidden divide-y divide-border/50">
                        {isLoading ? (
                            <div className="p-8 text-center text-muted-foreground">
                                Loading users...
                            </div>
                        ) : users.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                No users found matching filters.
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
                                        <Badge variant="outline" className="text-xs">{formatUserRole(user.role)}</Badge>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                            Units & Buildings
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
                                                                {unit.building_name || 'Unknown Building'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 pl-5">
                                                            <Home className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-foreground">
                                                                {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                            </span>
                                                            {unit.is_primary && (
                                                                <Badge className="text-[9px] h-4 px-1 bg-amber-500/20 text-amber-300 border-amber-500/30">
                                                                    ★ Primary
                                                                </Badge>
                                                            )}
                                                            <BuildingRoleBadge
                                                                buildingRole={unit.building_role as any}
                                                                className="text-[9px] h-4 px-1.5"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">No units assigned</span>
                                        )}
                                    </div>

                                    <div className="pt-2 border-t border-border/30 flex justify-end">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="sm" className="w-full">
                                                    Manage User <MoreHorizontal className="ml-2 h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleEdit(user)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                </DropdownMenuItem>
                                                {user.status === 'pending' && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')} className="text-green-600">
                                                            <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-red-600">
                                                            <XCircle className="mr-2 h-4 w-4" /> Reject
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                                {user.status !== 'pending' && user.status !== 'rejected' && (
                                                    <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-red-600">
                                                        <XCircle className="mr-2 h-4 w-4" /> Deactivate
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleManageUnits(user)}>
                                                    <Home className="mr-2 h-4 w-4" /> Manage Units
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleManageRoles(user)}>
                                                    <Crown className="mr-2 h-4 w-4" /> Manage Roles
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-red-600">
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete User
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>

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
