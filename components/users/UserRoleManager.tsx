'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/hooks/useAuth';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usersService } from '@/lib/services/users.service';
import { toast } from 'sonner';
import { Crown, ArrowUp, ArrowDown, User as UserIcon, Building2, Loader2, Home } from 'lucide-react';
import type { User, UserUnit } from '@/types/models';
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { buildingsService } from '@/lib/services/buildings.service';

interface UserRoleManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    onSuccess: () => void;
}

export function UserRoleManager({ open, onOpenChange, user, onSuccess }: UserRoleManagerProps) {
    const { isSuperAdmin, isBoardInBuilding } = usePermissions();
    const { availableBuildings } = useBuildingContext();
    const [loadingUnitId, setLoadingUnitId] = useState<string | null>(null);
    const [userUnits, setUserUnits] = useState<UserUnit[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch user's units when dialog opens
    useEffect(() => {
        const fetchUserUnits = async () => {
            if (open && user) {
                setLoading(true);
                try {
                    // GET /users/:id/units
                    const units = await usersService.getUserUnits(user.id);

                    // Enrich with building names
                    const enrichedUnits = await Promise.all(
                        units.map(async (unit) => {
                            // Try to find in available context first (much faster)
                            let buildingName = availableBuildings.find(b => b.id === unit.building_id)?.name;

                            // If not found and user has permission (or just to display correctly), try fetch
                            if (!buildingName) {
                                try {
                                    const building = await buildingsService.getBuildingById(unit.building_id);
                                    buildingName = building.name;
                                } catch (e) {
                                    // Silent fail
                                }
                            }

                            return {
                                ...unit,
                                building_name: buildingName || unit.building_name || 'Unknown Building'
                            };
                        })
                    );

                    setUserUnits(enrichedUnits);
                } catch (error) {
                    console.error('Failed to fetch user units:', error);
                    // Fallback to user.units if API fails
                    setUserUnits(user.units || []);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchUserUnits();
    }, [open, user, availableBuildings]);

    if (!user) return null;

    const handlePromoteToBoard = async (unit: UserUnit) => {
        if (!unit.unit_id) return;

        // Permission check
        if (!isSuperAdmin && !isBoardInBuilding(unit.building_id)) {
            toast.error('You do not have permission to manage this building');
            return;
        }

        try {
            setLoadingUnitId(unit.unit_id);
            // POST /users/:id/units - Updates existing unit's building_role
            await usersService.assignOrUpdateUnit(user.id, {
                unit_id: unit.unit_id,
                building_role: 'board',
                is_primary: unit.is_primary
            });
            toast.success(`${user.name} promoted to Board for ${unit.unit_name || 'unit'}`);

            // Refresh units list
            const updatedUnits = await usersService.getUserUnits(user.id);
            setUserUnits(updatedUnits);
            onSuccess();
        } catch (error) {
            console.error('Failed to promote user:', error);
            toast.error('Failed to promote user to Board');
        } finally {
            setLoadingUnitId(null);
        }
    };

    const handleDemoteToResident = async (unit: UserUnit) => {
        if (!unit.unit_id) return;

        // Permission check
        if (!isSuperAdmin && !isBoardInBuilding(unit.building_id)) {
            toast.error('You do not have permission to manage this building');
            return;
        }

        try {
            setLoadingUnitId(unit.unit_id);
            // POST /users/:id/units - Updates existing unit's building_role
            await usersService.assignOrUpdateUnit(user.id, {
                unit_id: unit.unit_id,
                building_role: 'resident',
                is_primary: unit.is_primary
            });
            toast.success(`${user.name} demoted to Resident for ${unit.unit_name || 'unit'}`);

            // Refresh units list
            const updatedUnits = await usersService.getUserUnits(user.id);
            setUserUnits(updatedUnits);
            onSuccess();
        } catch (error) {
            console.error('Failed to demote user:', error);
            toast.error('Failed to demote user to Resident');
        } finally {
            setLoadingUnitId(null);
        }
    };

    // Group units by building
    const unitsByBuilding = userUnits.reduce((acc, unit) => {
        const buildingId = unit.building_id || 'unknown';
        if (!acc[buildingId]) {
            acc[buildingId] = [];
        }
        acc[buildingId].push(unit);
        return acc;
    }, {} as Record<string, UserUnit[]>);

    const getBuildingRoleBadge = (role: string) => {
        switch (role) {
            case 'board':
                return {
                    className: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30',
                    icon: Crown,
                    label: '🏛️ Board'
                };
            case 'owner':
                return {
                    className: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30',
                    icon: Crown,
                    label: '👑 Owner'
                };
            default:
                return {
                    className: 'bg-muted/50 text-muted-foreground border-border/50',
                    icon: UserIcon,
                    label: '👤 Resident'
                };
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] border-border/50 bg-gradient-to-br from-card/95 to-card/100 backdrop-blur">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Crown className="h-5 w-5 text-purple-400" />
                        Manage Building Roles
                    </DialogTitle>
                    <DialogDescription>
                        Promote or demote {user.name} to Board member for specific buildings
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : userUnits.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                        <div className="flex justify-center">
                            <div className="rounded-full bg-primary/10 p-4">
                                <Home className="h-8 w-8 text-primary" />
                            </div>
                        </div>
                        <p className="text-muted-foreground">
                            This user has no units assigned yet
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Assign units first before managing building roles
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[500px] pr-4">
                        <div className="space-y-4">
                            {Object.entries(unitsByBuilding).map(([buildingId, units]) => {
                                const buildingName = units[0]?.building_name || 'Unknown Building';
                                const canManage = isSuperAdmin || isBoardInBuilding(buildingId);

                                return (
                                    <div key={buildingId} className="space-y-3">
                                        <div className="flex items-center gap-2 pb-2">
                                            <Building2 className="h-4 w-4 text-primary" />
                                            <h3 className="font-semibold text-sm text-foreground">{buildingName}</h3>
                                            <Badge variant="outline" className="text-xs">
                                                {units.length} {units.length === 1 ? 'unit' : 'units'}
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            {units.map((unit) => {
                                                const roleBadge = getBuildingRoleBadge(unit.building_role);
                                                const RoleIcon = roleBadge.icon;
                                                const isLoading = loadingUnitId === unit.unit_id;

                                                return (
                                                    <div
                                                        key={unit.unit_id}
                                                        className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 rounded-full bg-primary/10">
                                                                <Home className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-medium text-sm">
                                                                        {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                                    </p>
                                                                    {unit.is_primary && (
                                                                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                                                            Primary
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={`text-xs mt-1 ${roleBadge.className}`}
                                                                >
                                                                    <RoleIcon className="h-3 w-3 mr-1" />
                                                                    {roleBadge.label}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {unit.building_role !== 'board' && (
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => handlePromoteToBoard(unit)}
                                                                    disabled={!canManage || isLoading}
                                                                    className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border-0 shadow-lg shadow-purple-500/30"
                                                                >
                                                                    {isLoading ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                                    ) : (
                                                                        <ArrowUp className="h-4 w-4 mr-1" />
                                                                    )}
                                                                    Promote to Board
                                                                </Button>
                                                            )}
                                                            {unit.building_role === 'board' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleDemoteToResident(unit)}
                                                                    disabled={!canManage || isLoading}
                                                                    className="border-muted-foreground/30 hover:bg-muted/50"
                                                                >
                                                                    {isLoading ? (
                                                                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                                    ) : (
                                                                        <ArrowDown className="h-4 w-4 mr-1" />
                                                                    )}
                                                                    Demote to Resident
                                                                </Button>
                                                            )}
                                                            {!canManage && (
                                                                <p className="text-xs text-amber-400/80">No permission</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <Separator className="bg-border/30" />
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <div className="text-primary mt-0.5">ℹ️</div>
                    <div className="text-xs text-muted-foreground">
                        <p><strong className="text-foreground">Building Role</strong> determines permissions within a specific building.</p>
                        <p className="mt-1">Board members can manage users, approve payments, and view reports for their buildings.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
