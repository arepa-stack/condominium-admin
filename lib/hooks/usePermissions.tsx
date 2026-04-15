'use client';

import { useMemo, useCallback } from 'react';
import { useBuildingContext } from '../contexts/BuildingContext';
import { useAuth } from './useAuth';

export function usePermissions() {
    const { user } = useAuth();
    const { selectedBuildingId, availableBuildings } = useBuildingContext();

    const userRole = useMemo(() => (user?.role as string | undefined)?.toLowerCase() ?? '', [user?.role]);
    const isSuperAdmin = userRole === 'admin' || userRole === 'superadmin';
    const isBoardMember = userRole === 'board';
    const isResident = userRole === 'resident';

    const getBoardBuildings = useCallback((): string[] => {
        if (isSuperAdmin) return [];
        return availableBuildings.map((b) => b.id);
    }, [isSuperAdmin, availableBuildings]);

    const isBoardInBuilding = useCallback(
        (id?: string): boolean => {
            if (isSuperAdmin) return true;

            const checkId = id || selectedBuildingId;
            if (!checkId) {
                return isBoardMember;
            }

            if (user?.buildingRoles && user.buildingRoles.length > 0) {
                return user.buildingRoles.some(
                    (br) => br.building_id === checkId && br.role?.toLowerCase() === 'board'
                );
            }

            const legacyBuildingId = (user as { building_id?: string } | undefined)?.building_id;
            if (isBoardMember && legacyBuildingId === checkId) return true;

            return false;
        },
        [isSuperAdmin, selectedBuildingId, isBoardMember, user?.buildingRoles, user]
    );

    const buildingId = selectedBuildingId || (isSuperAdmin ? undefined : user?.building_id);

    const selectedBuilding = availableBuildings.find((b) => b.id === buildingId);
    let buildingName = selectedBuilding?.name;

    if (!buildingName && !isSuperAdmin) {
        buildingName = user?.building_name || user?.building?.name;
    }

    const canManageBuilding = useCallback(
        (bid?: string) => {
            return isSuperAdmin || isBoardInBuilding(bid);
        },
        [isSuperAdmin, isBoardInBuilding]
    );

    const canManageUsers = useCallback(
        (bid?: string) => {
            return isSuperAdmin || isBoardInBuilding(bid);
        },
        [isSuperAdmin, isBoardInBuilding]
    );

    const canApprovePayments = useCallback(
        (bid?: string) => {
            return isSuperAdmin || isBoardInBuilding(bid);
        },
        [isSuperAdmin, isBoardInBuilding]
    );

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
