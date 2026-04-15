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
import { useBuildingContext } from '@/lib/contexts/BuildingContext';
import { usersService } from '@/lib/services/users.service';
import { toast } from 'sonner';
import { Crown, ArrowUp, ArrowDown, User as UserIcon, Building2, Loader2, Home } from 'lucide-react';
import { buildingsService } from '@/lib/services/buildings.service';
import type { User, UserUnit } from '@/types/models';

interface UserRoleManagerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: User | null;
    onSuccess: () => void;
}

export function UserRoleManager({ open, onOpenChange, user, onSuccess }: UserRoleManagerProps) {
    const { isSuperAdmin, isBoardInBuilding } = usePermissions();
    const { availableBuildings } = useBuildingContext();
    const [loadingBuildingId, setLoadingBuildingId] = useState<string | null>(null);
    const [userBuildingRoles, setUserBuildingRoles] = useState<{ building_id: string; role: string; building_name: string }[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch user's roles and buildings when dialog opens
    useEffect(() => {
        const fetchRoles = async () => {
            if (open && user) {
                setLoading(true);
                try {
                    // Extract buildings from units and roles
                    const buildingsFromUnits = user.units?.map(u => u.building_id) || [];
                    const buildingsFromRoles = user.buildingRoles?.map(br => br.building_id) || [];
                    const allBuildingIds = Array.from(new Set([...buildingsFromUnits, ...buildingsFromRoles]));

                    // Enrich with building names and current roles
                    const enrichedRoles = await Promise.all(
                        allBuildingIds.map(async (buildingId) => {
                            const role = user.buildingRoles?.find(br => br.building_id === buildingId)?.role || 'resident';

                            let buildingName = availableBuildings.find(b => b.id === buildingId)?.name;
                            if (!buildingName) {
                                try {
                                    const building = await buildingsService.getBuildingById(buildingId);
                                    buildingName = building.name;
                                } catch (e) { }
                            }

                            return {
                                building_id: buildingId,
                                role,
                                building_name: buildingName || 'Edificio desconocido'
                            };
                        })
                    );

                    setUserBuildingRoles(enrichedRoles);
                } catch (error) {
                    console.error('Failed to fetch roles:', error);
                } finally {
                    setLoading(false);
                }
            }
        };
        fetchRoles();
    }, [open, user, availableBuildings]);

    if (!user) return null;

    const handleRoleUpdate = async (buildingId: string, role: string) => {
        if (!user) return;

        // Permission check
        if (!isSuperAdmin && !isBoardInBuilding(buildingId)) {
            toast.error('No tenés permisos para gestionar este edificio');
            return;
        }

        try {
            setLoadingBuildingId(buildingId);
            await usersService.updateBuildingRole(user.id, buildingId, role);
            toast.success(`Rol de ${user.name} actualizado a ${role} en ${userBuildingRoles.find(r => r.building_id === buildingId)?.building_name || 'el edificio'}`);

            // Update local state
            setUserBuildingRoles(prev => prev.map(r =>
                r.building_id === buildingId ? { ...r, role } : r
            ));

            onSuccess();
        } catch (error) {
            console.error('Failed to update role:', error);
            toast.error('Error al actualizar el rol del edificio');
        } finally {
            setLoadingBuildingId(null);
        }
    };

    // handleDemoteToResident is merged into handleRoleUpdate

    // Group units by building
    const unitsByBuilding = (user.units || []).reduce((acc: Record<string, UserUnit[]>, unit: UserUnit) => {
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
                    className: 'bg-chart-2/15 text-chart-2 border-chart-2/30',
                    icon: Crown,
                    label: '🏛️ Directiva'
                };
            case 'owner':
                return {
                    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
                    icon: Crown,
                    label: '👑 Propietario'
                };
            default:
                return {
                    className: 'bg-muted/50 text-muted-foreground border-border/50',
                    icon: UserIcon,
                    label: '👤 Residente'
                };
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[80vh] border-border/50 bg-gradient-to-br from-card/95 to-card/100 backdrop-blur">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Crown className="h-5 w-5 text-chart-2" />
                        Gestionar Roles del Edificio
                    </DialogTitle>
                    <DialogDescription>
                        Promover o degradar a {user.name} como miembro de la Directiva en edificios específicos
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : userBuildingRoles.length === 0 ? (
                    <div className="text-center py-8 space-y-3">
                        <div className="flex justify-center">
                            <div className="rounded-full bg-primary/10 p-4">
                                <Building2 className="h-8 w-8 text-primary" />
                            </div>
                        </div>
                        <p className="text-muted-foreground">
                            Este usuario no tiene asociaciones con ningún edificio
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Asigná unidades o roles primero
                        </p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[500px] pr-4">
                        <div className="space-y-4">
                            {userBuildingRoles.map((br) => {
                                const canManage = isSuperAdmin || isBoardInBuilding(br.building_id);
                                const roleBadge = getBuildingRoleBadge(br.role);
                                const RoleIcon = roleBadge.icon;
                                const isLoading = loadingBuildingId === br.building_id;

                                return (
                                    <div key={br.building_id} className="space-y-3 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-background/30 hover:bg-background/50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-primary/10">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-sm text-foreground">{br.building_name}</h3>
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
                                                {br.role !== 'board' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleRoleUpdate(br.building_id, 'board')}
                                                        disabled={!canManage || isLoading}
                                                        className="bg-primary hover:bg-primary/90 text-white border-0 shadow-lg shadow-primary/30"
                                                    >
                                                        {isLoading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                        ) : (
                                                            <ArrowUp className="h-4 w-4 mr-1" />
                                                        )}
                                                        Promover a Directiva
                                                    </Button>
                                                )}
                                                {((user?.role as string) === 'admin' || (user?.role as string) === 'superadmin') && br.role === 'board' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleRoleUpdate(br.building_id, 'resident')}
                                                        disabled={!canManage || isLoading}
                                                        className="border-muted-foreground/30 hover:bg-muted/50"
                                                    >
                                                        {isLoading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                                        ) : (
                                                            <ArrowDown className="h-4 w-4 mr-1" />
                                                        )}
                                                        Degradar a Residente
                                                    </Button>
                                                )}
                                                {!canManage && (
                                                    <p className="text-xs text-amber-400/80 font-medium">Sin permisos</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                )}

                <div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-lg p-3 mt-2">
                    <div className="text-primary mt-0.5">ℹ️</div>
                    <div className="text-xs text-muted-foreground">
                        <p><strong className="text-foreground">Rol del Edificio</strong> determina los permisos dentro de un edificio específico.</p>
                        <p className="mt-1">Los miembros de la directiva pueden gestionar usuarios, aprobar pagos y ver reportes de sus edificios.</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
