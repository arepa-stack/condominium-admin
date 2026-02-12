'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usersService } from '@/lib/services/users.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
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
            toast.error('Failed to fetch users');
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
                    <h1 className="text-3xl font-bold text-foreground font-display tracking-tight text-white">Users</h1>
                    <p className="text-muted-foreground mt-1">Manage users and permissions for {building?.name}</p>
                </div>
                {isSuperAdmin && (
                    <Button onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }} className="shadow-lg shadow-primary/20">
                        <CheckCircle className="mr-2 h-4 w-4" /> Add User
                    </Button>
                )}
            </div>

            {/* Filters Bar */}
            <Card className="p-4 border-white/5 bg-card/50 backdrop-blur-xl">
                <div className="flex flex-wrap gap-4">
                    <div className="w-full md:w-48">
                        <Select value={filterRole} onValueChange={setFilterRole}>
                            <SelectTrigger className="bg-background/50 border-white/5">
                                <SelectValue placeholder="Role" />
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
                            <SelectTrigger className="bg-background/50 border-white/5">
                                <SelectValue placeholder="Status" />
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

            {/* Users List */}
            <Card className="border-white/5 bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-white/5 border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Units</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                                <span>Loading users...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No users found.</td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-white group-hover:text-primary transition-colors">{user.name}</div>
                                                <div className="text-xs text-muted-foreground">{user.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge variant="outline" className="border-white/10 text-white bg-white/5 font-medium">{formatUserRole(user.role)}</Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.units && user.units.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2 max-w-md">
                                                        {user.units
                                                            .filter(u => u.building_id === buildingId)
                                                            .map((unit) => {
                                                                const userBuildingRole = user.buildingRoles?.find(br => br.building_id === buildingId)?.role || 'resident';
                                                                return (
                                                                    <div
                                                                        key={`${unit.building_id}-${unit.unit_id}`}
                                                                        className="flex items-center gap-2 text-[10px] p-1.5 rounded-lg bg-black/20 border border-white/5"
                                                                    >
                                                                        <Home className="h-3 w-3 text-primary flex-shrink-0" />
                                                                        <span className="text-white font-medium">
                                                                            {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                                        </span>
                                                                        {unit.is_primary && <Badge className="text-[8px] h-3.5 px-1 bg-amber-500/20 text-amber-400 border-amber-500/20">★</Badge>}
                                                                        <BuildingRoleBadge
                                                                            buildingRole={userBuildingRole as any}
                                                                            className="text-[8px] h-3.5 px-1.5"
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">No units</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <Badge className={
                                                    user.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                        user.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                                                            'bg-red-500/20 text-red-400 border-red-500/30'
                                                }>
                                                    {user.status || 'active'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-white/10">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-card border-white/10 shadow-2xl">
                                                        <DropdownMenuLabel className="text-muted-foreground text-[10px] uppercase font-bold px-3 py-2">Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => handleEdit(user)} className="focus:bg-primary/20 focus:text-primary">
                                                            <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                        </DropdownMenuItem>
                                                        {user.status === 'pending' && (
                                                            <>
                                                                <DropdownMenuSeparator className="bg-white/5" />
                                                                <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'active')} className="text-green-400 focus:bg-green-400/20">
                                                                    <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'rejected')} className="text-red-400 focus:bg-red-400/20">
                                                                    <XCircle className="mr-2 h-4 w-4" /> Reject
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        <DropdownMenuSeparator className="bg-white/5" />
                                                        <DropdownMenuItem onClick={() => handleManageUnits(user)} className="focus:bg-primary/20 focus:text-primary">
                                                            <Home className="mr-2 h-4 w-4" /> Manage Units
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleManageRoles(user)} className="focus:bg-primary/20 focus:text-primary">
                                                            <Crown className="mr-2 h-4 w-4" /> Manage Roles
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-white/5" />
                                                        <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-red-400 focus:bg-red-400/20">
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
                </CardContent>
            </Card>

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
