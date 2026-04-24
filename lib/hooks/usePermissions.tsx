'use client';

import { useBuildingContext } from '../contexts/BuildingContext';
import { useAuth } from './useAuth';
import { isAdmin, isBoardAnywhere, isBoardInBuilding as isBoardInBuildingHelper } from '../utils/roles';
import type { DecisionQuote } from '@/types/models';

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

    /** admin o board del edificio pueden crear/extender/cancelar/finalizar decisions */
    const canManageDecisions = (bId?: string) => isSuperAdmin || isBoardInBuilding(bId);

    /** admin o board pueden subir quotes desde el panel admin */
    const canUploadQuote = (bId?: string) => canManageDecisions(bId);

    /**
     * Un usuario puede eliminar su propio quote sin reason solo si es el uploader
     * y la decision está en RECEPTION. Admin/board pueden eliminar en cualquier fase.
     */
    const canDeleteQuoteAsOwner = (
        quote: DecisionQuote,
        decisionStatus: string,
    ): boolean => {
        if (!user) return false;
        return quote.uploader?.id === user.id && decisionStatus === 'RECEPTION';
    };

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
        canManageDecisions,
        canUploadQuote,
        canDeleteQuoteAsOwner,
    };
}
