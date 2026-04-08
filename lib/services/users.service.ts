import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type { User, UpdateUserDto, CreateUserDto, AssignUnitDto, UserUnit } from '@/types/models';

const P = ADMIN_API_PREFIX;

export const usersService = {
    async getUsers(params?: {
        building_id?: string;
        unit_id?: string;
        role?: string;
        status?: string;
    }): Promise<User[]> {
        const { data } = await apiClient.get<User[]>(`${P}/users`, { params });
        return data;
    },

    async getUserById(id: string): Promise<User> {
        const { data } = await apiClient.get<User>(`${P}/users/${id}`);
        return data;
    },

    async updateUser(id: string, updates: UpdateUserDto): Promise<User> {
        const { data } = await apiClient.patch<User>(`${P}/users/${id}`, updates);
        return data;
    },

    async approveUser(id: string): Promise<User> {
        const { data } = await apiClient.post<User>(`${P}/users/${id}/approve`);
        return data;
    },

    async rejectUser(id: string): Promise<User> {
        const { data } = await apiClient.patch<User>(`${P}/users/${id}`, { status: 'rejected' });
        return data;
    },

    async createUser(payload: CreateUserDto): Promise<User> {
        const { data } = await apiClient.post<User>(`${P}/users`, payload);
        return data;
    },

    async deleteUser(id: string): Promise<void> {
        await apiClient.delete(`${P}/users/${id}`);
    },

    async assignOrUpdateUnit(userId: string, payload: AssignUnitDto): Promise<{ success: boolean }> {
        const { data } = await apiClient.post<{ success: boolean }>(`${P}/users/${userId}/units`, payload);
        return data;
    },

    async getUserUnits(userId: string): Promise<UserUnit[]> {
        const { data } = await apiClient.get<UserUnit[]>(`${P}/users/${userId}/units`);
        return data;
    },

    async removeUnit(userId: string, unitId: string): Promise<void> {
        await apiClient.delete(`${P}/users/${userId}/units/${unitId}`);
    },

    async updateBuildingRole(userId: string, buildingId: string, role: string): Promise<User> {
        const { data } = await apiClient.post<User>(`${P}/users/${userId}/roles`, {
            building_id: buildingId,
            role: role
        });
        return data;
    },
};
