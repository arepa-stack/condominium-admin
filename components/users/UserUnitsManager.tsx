'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { usersService } from '@/lib/services/users.service';
import { buildingsService } from '@/lib/services/buildings.service';
import { unitsService } from '@/lib/services/units.service';
import { toast } from 'sonner';
import {
    Home,
    Building2,
    Loader2,
    Plus,
    Trash2,
    Crown,
    Star,
    User as UserIcon
} from 'lucide-react';
import type { User, UserUnit, Building, Unit } from '@/types/models';

import { useBuildingContext } from '@/lib/contexts/BuildingContext';

interface UserUnitsManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    onSuccess: () => void;
}

export function UserUnitsManager({ open, onOpenChange, user, onSuccess }: UserUnitsManagerProps) {
    const { isSuperAdmin } = usePermissions();
    const { availableBuildings, selectedBuildingId: currentContextBuildingId } = useBuildingContext();
    const [userUnits, setUserUnits] = useState<UserUnit[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Add new unit form
    const [selectedBuilding, setSelectedBuilding] = useState<string>('');
    const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<'resident' | 'board' | 'owner'>('resident');
    const [isPrimary, setIsPrimary] = useState(false);

    // Initialize selected building when dialog opens
    useEffect(() => {
        if (open && !isSuperAdmin && currentContextBuildingId) {
            setSelectedBuilding(currentContextBuildingId);
        } else if (open) {
            setSelectedBuilding('');
        }
    }, [open, isSuperAdmin, currentContextBuildingId]);

    // Fetch user's current units and all buildings
    useEffect(() => {
        const fetchData = async () => {
            if (open && user) {
                setLoading(true);
                try {
                    // Fetch user units
                    const userUnitsPromise = usersService.getUserUnits(user.id);

                    // Fetch buildings based on role
                    let buildingsPromise: Promise<Building[]>;
                    if (isSuperAdmin) {
                        buildingsPromise = buildingsService.getBuildings();
                    } else {
                        // For board members, use available buildings from context
                        // We map them to Building type structure
                        buildingsPromise = Promise.resolve(availableBuildings.map(b => ({
                            id: b.id,
                            name: b.name || 'Unknown Building',
                            address: '', // Mock missing fields
                            total_units: 0
                        } as Building)));
                    }

                    const [units, buildingsData] = await Promise.all([
                        userUnitsPromise,
                        buildingsPromise
                    ]);

                    setUserUnits(units);
                    setBuildings(buildingsData);
                } catch (error) {
                    console.error('Failed to fetch data:', error);
                    toast.error('Failed to load user units');
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchData();
    }, [open, user, isSuperAdmin, availableBuildings]);

    // Fetch units when building is selected
    useEffect(() => {
        const fetchUnits = async () => {
            if (selectedBuilding) {
                try {
                    const units = await unitsService.getUnits(selectedBuilding);
                    setAvailableUnits(units);
                } catch (error) {
                    console.error('Failed to fetch units:', error);
                    toast.error('Failed to load units');
                }
            } else {
                setAvailableUnits([]);
            }
        };
        fetchUnits();
    }, [selectedBuilding]);

    // Helper to refresh and enrich units
    const refreshUserUnits = async () => {
        if (!user) return;

        try {
            const units = await usersService.getUserUnits(user.id);
            setUserUnits(units);
        } catch (error) {
            console.error('Failed to refresh user units:', error);
        }
    };

    const handleAddUnit = async () => {
        if (!user || !selectedBuilding || !selectedUnit) {
            toast.error('Please select a building and unit');
            return;
        }

        // Check if unit is already assigned
        const alreadyAssigned = userUnits.some(u => u.unit_id === selectedUnit);
        if (alreadyAssigned) {
            toast.error('This unit is already assigned to this user');
            return;
        }

        setActionLoading(true);
        try {
            // POST /users/:id/units
            await usersService.assignOrUpdateUnit(user.id, {
                unit_id: selectedUnit,
                building_role: selectedRole,
                is_primary: isPrimary || userUnits.length === 0 // First unit is primary
            });

            toast.success('Unit assigned successfully');

            // Refresh units list with enriched data
            await refreshUserUnits();

            // Reset form
            setSelectedBuilding('');
            setSelectedUnit('');
            setSelectedRole('resident');
            setIsPrimary(false);

            onSuccess();
        } catch (error: any) {
            console.error('Failed to assign unit:', error);
            toast.error(error.response?.data?.message || 'Failed to assign unit');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveUnit = async (unitId: string, unitName?: string) => {
        if (!user) return;

        const confirmed = confirm(
            `Are you sure you want to remove "${unitName || 'this unit'}" from ${user.name}?`
        );
        if (!confirmed) return;

        setActionLoading(true);
        try {
            // DELETE /users/:id/units/:unitId
            await usersService.removeUnit(user.id, unitId);
            toast.success('Unit removed successfully');

            // Refresh units list with enriched data
            await refreshUserUnits();

            onSuccess();
        } catch (error: any) {
            console.error('Failed to remove unit:', error);
            toast.error(error.response?.data?.message || 'Failed to remove unit');
        } finally {
            setActionLoading(false);
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'board':
                return {
                    className: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/30',
                    icon: Crown,
                    label: 'Board'
                };
            case 'owner':
                return {
                    className: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30',
                    icon: Crown,
                    label: 'Owner'
                };
            default:
                return {
                    className: 'bg-muted/50 text-muted-foreground border-border/50',
                    icon: UserIcon,
                    label: 'Resident'
                };
        }
    };

    // Group units by building for better organization
    const unitsByBuilding = userUnits.reduce((acc, unit) => {
        const buildingId = unit.building_id || 'unknown';
        if (!acc[buildingId]) {
            acc[buildingId] = [];
        }
        acc[buildingId].push(unit);
        return acc;
    }, {} as Record<string, UserUnit[]>);

    if (!user) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] border-border/50 bg-gradient-to-br from-card/95 to-card/100 backdrop-blur">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Home className="h-5 w-5 text-primary" />
                        Manage Units for {user.name}
                    </DialogTitle>
                    <DialogDescription>
                        Assign or remove apartment units for this user. Each user can have multiple units across different buildings.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Add New Unit Section */}
                    <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                        <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold">Assign New Unit</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {/* Building Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Building</label>
                                <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                                    <SelectTrigger className="bg-background/50">
                                        <SelectValue placeholder="Select building" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {buildings.map(building => (
                                            <SelectItem key={building.id} value={building.id}>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-3 w-3" />
                                                    {building.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Unit Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Unit</label>
                                <Select
                                    value={selectedUnit}
                                    onValueChange={setSelectedUnit}
                                    disabled={!selectedBuilding}
                                >
                                    <SelectTrigger className="bg-background/50">
                                        <SelectValue placeholder={selectedBuilding ? "Select unit" : "Select building first"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableUnits.map(unit => (
                                            <SelectItem key={unit.id} value={unit.id}>
                                                <div className="flex items-center gap-2">
                                                    <Home className="h-3 w-3" />
                                                    {unit.name} {unit.floor ? `(Floor ${unit.floor})` : ''}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Role Selector */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Role in Building</label>
                                <Select value={selectedRole} onValueChange={(v: any) => setSelectedRole(v)}>
                                    <SelectTrigger className="bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="resident">
                                            <div className="flex items-center gap-2">
                                                <UserIcon className="h-3 w-3" />
                                                Resident
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="board">
                                            <div className="flex items-center gap-2">
                                                <Crown className="h-3 w-3 text-purple-400" />
                                                Board Member
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="owner">
                                            <div className="flex items-center gap-2">
                                                <Crown className="h-3 w-3 text-amber-400" />
                                                Owner
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Primary Checkbox */}
                            <div className="space-y-2 flex items-end">
                                <div className="flex items-center space-x-2 h-10 px-3 rounded-md border bg-background/50">
                                    <Checkbox
                                        id="primary"
                                        checked={isPrimary}
                                        onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
                                        disabled={userUnits.length === 0}
                                    />
                                    <label
                                        htmlFor="primary"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
                                    >
                                        <Star className="h-3 w-3 text-amber-400" />
                                        Primary Unit
                                    </label>
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleAddUnit}
                            disabled={!selectedBuilding || !selectedUnit || actionLoading}
                            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-700"
                        >
                            {actionLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Assigning...
                                </>
                            ) : (
                                <>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Assign Unit
                                </>
                            )}
                        </Button>
                    </div>

                    <Separator />

                    {/* Current Units List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Home className="h-4 w-4 text-primary" />
                                Assigned Units ({userUnits.length})
                            </h3>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : userUnits.length === 0 ? (
                            <div className="text-center py-8 space-y-2 bg-muted/30 rounded-lg border border-dashed">
                                <div className="flex justify-center">
                                    <Home className="h-12 w-12 text-muted-foreground/50" />
                                </div>
                                <p className="text-muted-foreground text-sm">
                                    No units assigned yet
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Use the form above to assign units to this user
                                </p>
                            </div>
                        ) : (
                            <ScrollArea className="max-h-[300px] pr-2">
                                <div className="space-y-4">
                                    {Object.entries(unitsByBuilding).map(([buildingId, units]) => {
                                        const buildingName = units[0]?.building_name || 'Unknown Building';

                                        return (
                                            <div key={buildingId} className="space-y-2">
                                                {/* Building Header */}
                                                <div className="flex items-center gap-2 pb-1">
                                                    <Building2 className="h-4 w-4 text-primary" />
                                                    <span className="font-medium text-sm">{buildingName}</span>
                                                    <Badge variant="outline" className="text-xs">
                                                        {units.length} {units.length === 1 ? 'unit' : 'units'}
                                                    </Badge>
                                                </div>

                                                {/* Units */}
                                                <div className="space-y-2">
                                                    {units.map(unit => {
                                                        const roleBadge = getRoleBadge(unit.building_role);
                                                        const RoleIcon = roleBadge.icon;

                                                        return (
                                                            <div
                                                                key={unit.unit_id}
                                                                className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/30 hover:bg-background/50 transition-all group"
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 rounded-full bg-primary/10">
                                                                        <Home className="h-4 w-4 text-primary" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium text-sm">
                                                                                {unit.unit_name || unit.unit_id.slice(0, 8)}
                                                                            </span>
                                                                            {unit.is_primary && (
                                                                                <Badge className="text-xs bg-amber-500/20 text-amber-300 border-amber-500/30">
                                                                                    <Star className="h-3 w-3 mr-1" />
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

                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    onClick={() => handleRemoveUnit(unit.unit_id, unit.unit_name)}
                                                                    disabled={actionLoading}
                                                                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <Separator className="bg-border/30 my-2" />
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        )}
                    </div>
                </div>

                {/* Info Footer */}
                <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground">
                    <div className="text-primary mt-0.5">ℹ️</div>
                    <div className="space-y-1">
                        <p><strong className="text-foreground">Primary Unit:</strong> The main unit associated with the user's account.</p>
                        <p><strong className="text-foreground">Building Role:</strong> Determines the user's permissions within each building.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
