'use client';

import { useBuildingContext } from '../contexts/BuildingContext';
import { useAuth } from './useAuth';

export function usePermissions() {
    const { user } = useAuth();
    const { selectedBuildingId, availableBuildings } = useBuildingContext();

    const isSuperAdmin = user?.role === 'admin';

    // Get all buildings where user has board role
    const getBoardBuildings = (): string[] => {
        if (isSuperAdmin) return []; // Admin doesn't need filtering
        return availableBuildings.map(b => b.id);
    };

    // Check if user is board in specific building
    const isBoardInBuilding = (id?: string): boolean => {
        if (isSuperAdmin) return true;

        // If no ID provided, check current selected building
        const checkId = id || selectedBuildingId;
        if (!checkId) return false;

        return user?.units?.some(
            (unit: any) => unit.building_id === checkId && unit.building_role === 'board'
        ) ?? false;
    };

    // Legacy support
    const isBoardMember = user?.role === 'board';
    const isResident = user?.role === 'resident';

    // Current Building ID from Context or Fallback
    const buildingId = selectedBuildingId || (isSuperAdmin ? undefined : user?.building_id);

    // Get Building Name from available buildings or user
    const selectedBuilding = availableBuildings.find(b => b.id === buildingId);
    let buildingName = selectedBuilding?.name;

    if (!buildingName && !isSuperAdmin) {
        buildingName = user?.building_name || user?.building?.name;
    }

    // Building-aware permissions
    const canManageBuilding = (buildingId?: string) => {
        return isSuperAdmin || isBoardInBuilding(buildingId);
    };

    const canManageUsers = (buildingId?: string) => {
        return isSuperAdmin || isBoardInBuilding(buildingId);
    };

    const canApprovePayments = (buildingId?: string) => {
        return isSuperAdmin || isBoardInBuilding(buildingId);
    };

    // Legacy permissions (deprecated but kept for compatibility)
    const canManageBuildings = isSuperAdmin;
    const canManageAllUsers = isSuperAdmin;
    const canManageBuildingUsers = isSuperAdmin || isBoardMember;
    const canViewAllPayments = isSuperAdmin;

    return {
        user,
        buildingId,
        buildingName,
        displayName: user?.name || user?.email?.split('@')[0] || 'User',
        isSuperAdmin,
        isBoardMember,
        isResident,
        // New building-aware functions
        getBoardBuildings,
        isBoardInBuilding,
        canManageBuilding,
        canManageUsers,
        canApprovePayments,
        // Legacy permissions
        canManageBuildings,
        canManageAllUsers,
        canManageBuildingUsers,
        canViewAllPayments,
    };
}
