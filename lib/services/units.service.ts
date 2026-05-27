import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type { Unit, CreateUnitDto, BatchUnitDto } from '@/types/models';

const P = ADMIN_API_PREFIX;

export const unitsService = {
    // Public routes
    async getUnits(buildingId: string): Promise<Unit[]> {
        const { data } = await apiClient.get<Unit[]>(`/buildings/${buildingId}/units`);
        return data;
    },

    async getUnitById(unitId: string): Promise<Unit> {
        const { data } = await apiClient.get<Unit>(`/buildings/units/${unitId}`);
        return data;
    },

    // Admin routes
    async createUnit(buildingId: string, payload: CreateUnitDto): Promise<Unit> {
        const { data } = await apiClient.post<Unit>(`${P}/buildings/${buildingId}/units`, payload);
        return data;
    },

    async batchCreateUnits(buildingId: string, payload: BatchUnitDto): Promise<Unit[]> {
        const { data } = await apiClient.post<Unit[]>(`${P}/buildings/${buildingId}/units/batch`, payload);
        return data;
    },

    async deleteUnit(buildingId: string, unitId: string): Promise<void> {
        await apiClient.delete(`${P}/buildings/${buildingId}/units/${unitId}`);
    },

    async deleteAllUnits(buildingId: string): Promise<{ deletedCount: number }> {
        const { data } = await apiClient.delete<{ deletedCount: number }>(`${P}/buildings/${buildingId}/units`);
        return data;
    },
};
