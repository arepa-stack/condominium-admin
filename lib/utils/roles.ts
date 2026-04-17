import type { User } from '@/types/models';

export type AppRole = 'admin' | 'user';
export type EffectiveRole = 'admin' | 'board' | 'resident';

type UserRoleShape = Pick<User, 'app_role' | 'buildingRoles'>;

export function isAdmin(user?: UserRoleShape | null): boolean {
    return user?.app_role === 'admin';
}

export function isBoardAnywhere(user?: UserRoleShape | null): boolean {
    return (user?.buildingRoles?.length ?? 0) > 0;
}

export function isBoardInBuilding(user: UserRoleShape | null | undefined, buildingId: string): boolean {
    if (!user?.buildingRoles) return false;
    return user.buildingRoles.some(
        br => br.building_id === buildingId && br.role?.toLowerCase() === 'board'
    );
}

export function canEnterPanel(user?: UserRoleShape | null): boolean {
    return isAdmin(user) || isBoardAnywhere(user);
}

export function getEffectiveRole(
    user: UserRoleShape | null | undefined,
    buildingId?: string,
): EffectiveRole {
    if (!user) return 'resident';
    if (isAdmin(user)) return 'admin';
    if (buildingId) {
        return isBoardInBuilding(user, buildingId) ? 'board' : 'resident';
    }
    return isBoardAnywhere(user) ? 'board' : 'resident';
}
