'use client';

import { useBuildingContext } from '../contexts/BuildingContext';
import { useAuth } from './useAuth';
import { isAdmin, isBoardAnywhere, isBoardInBuilding as isBoardInBuildingHelper } from '../utils/roles';

export function usePermissions() {
    const { user } = useAuth();
    const { selectedBuildingId, availableBuildings } = useBuildingContext();

    const isSuperAdmin = isAdmin(user);
    const isBoardMember = isBoardAnywhere(user);
    const isResident = !isSuperAdmin && !isBoardMember;

    const getBoardBuildings = (): string[] => {
        if (isSuperAdmin) return [];
        return (user?.buildingRoles ?? [])
            .filter(br => br.role?.toLowerCase() === 'board')
            .map(br => br.building_id);
    };

    const isBoardInBuilding = (id?: string): boolean => {
        if (isSuperAdmin) return true;

        const checkId = id || selectedBuildingId;
        if (!checkId) {
            return isBoardMember;
        }

        return isBoardInBuildingHelper(user, checkId);
    };

    const buildingId = selectedBuildingId || undefined;
    const selectedBuilding = availableBuildings.find(b => b.id === buildingId);
    const buildingName = selectedBuilding?.name;

    const canManageBuilding = (buildingId?: string) => {
        return isSuperAdmin || isBoardInBuilding(buildingId);
    };

    const canManageUsers = (buildingId?: string) => {
        return isSuperAdmin || isBoardInBuilding(buildingId);
    };

    const canApprovePayments = (buildingId?: string) => {
        return isSuperAdmin || isBoardInBuilding(buildingId);
    };

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
        getBoardBuildings,
        isBoardInBuilding,
        canManageBuilding,
        canManageUsers,
        canApprovePayments,
        canManageBuildings,
        canManageAllUsers,
        canManageBuildingUsers,
        canViewAllPayments,
    };
}
