import { apiClient } from '@/lib/api/client';
import type { User, UpdateUserDto } from '@/types/models';

export const usersService = {
    async getUsers(params?: {
        building_id?: string;
        unit_id?: string;
        role?: string;
        status?: string;
    }): Promise<User[]> {
        const { data } = await apiClient.get<User[]>('/users/', { params });
        return data;
    },

    async getUserById(id: string): Promise<User> {
        const { data } = await apiClient.get<User>(`/users/${id}`);
        return data;
    },

    async updateUser(id: string, updates: UpdateUserDto): Promise<User> {
        const { data } = await apiClient.patch<User>(`/users/${id}`, updates);
        return data;
    },

    async approveUser(id: string): Promise<User> {
        const { data } = await apiClient.post<User>(`/users/${id}/approve`);
        return data;
    },

    async rejectUser(id: string): Promise<User> {
        const { data } = await apiClient.patch<User>(`/users/${id}`, { status: 'rejected' });
        return data;
    },

    async createUser(data: import('@/types/models').CreateUserDto): Promise<User> {
        const { data: user } = await apiClient.post<User>('/users', data);
        return user;
    },

    async deleteUser(id: string): Promise<void> {
        await apiClient.delete(`/users/${id}`);
    },

    // Unit Management
    // POST /users/:id/units - Handles both assign new unit AND update existing unit
    // If unit already exists for user, it updates the building_role
    // If unit doesn't exist, it creates the assignment
    async assignOrUpdateUnit(userId: string, payload: import('@/types/models').AssignUnitDto): Promise<{ success: boolean }> {
        const { data } = await apiClient.post<{ success: boolean }>(`/users/${userId}/units`, payload);
        return data;
    },

    // GET /users/:id/units - View all units for a user
    async getUserUnits(userId: string): Promise<import('@/types/models').UserUnit[]> {
        const { data } = await apiClient.get<import('@/types/models').UserUnit[]>(`/users/${userId}/units`);
        return data;
    },

    // DELETE /users/:id/units/:unitId - Remove unit assignment
    async removeUnit(userId: string, unitId: string): Promise<void> {
        await apiClient.delete(`/users/${userId}/units/${unitId}`);
    },
};
