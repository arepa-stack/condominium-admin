import { apiClient } from '@/lib/api/client';
import type { Unit, CreateUnitDto, BatchUnitDto } from '@/types/models';

export const unitsService = {
    async getUnits(buildingId: string): Promise<Unit[]> {
        const { data } = await apiClient.get<Unit[]>(`/buildings/${buildingId}/units`);
        return data;
    },

    async createUnit(buildingId: string, data: CreateUnitDto): Promise<Unit> {
        const { data: unit } = await apiClient.post<Unit>(`/buildings/${buildingId}/units`, data);
        return unit;
    },

    async batchCreateUnits(buildingId: string, data: BatchUnitDto): Promise<Unit[]> { // Assumes returns array of created units
        // Prompt says endpoint: POST /buildings/:id/units/batch
        const { data: units } = await apiClient.post<Unit[]>(`/buildings/${buildingId}/units/batch`, data);
        return units;
    },
    async getUnitById(unitId: string): Promise<Unit> {
        const { data } = await apiClient.get<Unit>(`/buildings/units/${unitId}`);
        return data;
    },
};
