import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type { Building, CreateBuildingDto, UpdateBuildingDto } from '@/types/models';

export const buildingsService = {
    // Public routes (no prefix)
    async getBuildings(): Promise<Building[]> {
        const { data } = await apiClient.get<Building[]>('/buildings');
        return data;
    },

    async getBuildingById(id: string): Promise<Building> {
        const { data } = await apiClient.get<Building>(`/buildings/${id}`);
        return data;
    },

    // Admin routes (prefixed)
    async createBuilding(building: CreateBuildingDto): Promise<Building> {
        const { data } = await apiClient.post<Building>(`${ADMIN_API_PREFIX}/buildings`, building);
        return data;
    },

    async updateBuilding(id: string, updates: UpdateBuildingDto): Promise<Building> {
        const { data } = await apiClient.patch<Building>(`${ADMIN_API_PREFIX}/buildings/${id}`, updates);
        return data;
    },

    async deleteBuilding(id: string): Promise<void> {
        await apiClient.delete(`${ADMIN_API_PREFIX}/buildings/${id}`);
    },
};
