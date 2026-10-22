/**
 * Pure helpers to derive display info for a unit from data already returned by the API
 * (unit name/aliquot from the DB, owner contact from the linked user).
 */

export interface UnitDisplaySource {
    name?: string | null;
    // The DB default 0 means "not set"; tolerate null/undefined/numeric strings from the API.
    aliquot?: number | string | null;
}

export interface UnitOwnerSource {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
}

export interface UnitInfo {
    unitName: string;
    ownerName: string | null;
    email: string | null;
    phone: string | null;
    aliquot: number | null;
}

/** Returns the aliquot when it is a finite number > 0, otherwise null. */
export function unitAliquot(aliquot?: number | string | null): number | null {
    if (aliquot === null || aliquot === undefined || aliquot === '') return null;
    const value = typeof aliquot === 'number' ? aliquot : Number(aliquot);
    return Number.isFinite(value) && value > 0 ? value : null;
}

function clean(value?: string | null): string | null {
    const trimmed = (value ?? '').trim();
    return trimmed ? trimmed : null;
}

export function getUnitInfo(
    unit?: UnitDisplaySource | null,
    user?: UnitOwnerSource | null
): UnitInfo {
    return {
        unitName: (unit?.name ?? '').trim(),
        ownerName: clean(user?.name),
        email: clean(user?.email),
        phone: clean(user?.phone),
        aliquot: unitAliquot(unit?.aliquot),
    };
}
