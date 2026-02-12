'use client';

import { useBuildingContext } from '../contexts/BuildingContext';
import { useAuth } from './useAuth';

export function usePermissions() {
    const { user } = useAuth();
    const { selectedBuildingId, availableBuildings } = useBuildingContext();

    const userRole = (user?.role as string || '').toLowerCase();
    const isSuperAdmin = userRole === 'admin' || userRole === 'superadmin';

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
        if (!checkId) {
            // If we are board member and have no selected building, 
            // maybe we can still perform some board actions if we only have one building?
            return isBoardMember;
        }

        // First check in the new buildingRoles array
        if (user?.buildingRoles && user.buildingRoles.length > 0) {
            return user.buildingRoles.some(
                br => br.building_id === checkId && br.role?.toLowerCase() === 'board'
            );
        }

        // Fallback for legacy support: check if global building_id matches 
        // OR if the user is board member and we are in their primary building context
        const legacyBuildingId = (user as any).building_id;
        if (isBoardMember && legacyBuildingId === checkId) return true;

        return false;
    };

    // Legacy support
    const isBoardMember = userRole === 'board';
    const isResident = userRole === 'resident';

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
