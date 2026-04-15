import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type {
    BoardMember,
    CreateBoardMemberDto,
    UpdateBoardMemberDto,
    Worker,
    CreateWorkerDto,
    UpdateWorkerDto,
} from '@/types/models';

const ADMIN = `${ADMIN_API_PREFIX}/directory`;
const APP = '/api/v1/app/directory';

export const directoryService = {
    // ── Admin: Board Members ───────────────────────────────────────────

    async getBoardMembers(buildingId: string): Promise<BoardMember[]> {
        const { data } = await apiClient.get<BoardMember[]>(
            `${ADMIN}/buildings/${buildingId}/board-members`
        );
        return data;
    },

    async createBoardMember(
        buildingId: string,
        payload: CreateBoardMemberDto
    ): Promise<BoardMember> {
        const { data } = await apiClient.post<BoardMember>(
            `${ADMIN}/buildings/${buildingId}/board-members`,
            payload
        );
        return data;
    },

    async updateBoardMember(
        buildingId: string,
        memberId: string,
        payload: UpdateBoardMemberDto
    ): Promise<BoardMember> {
        const { data } = await apiClient.patch<BoardMember>(
            `${ADMIN}/buildings/${buildingId}/board-members/${memberId}`,
            payload
        );
        return data;
    },

    async deleteBoardMember(buildingId: string, memberId: string): Promise<void> {
        await apiClient.delete(
            `${ADMIN}/buildings/${buildingId}/board-members/${memberId}`
        );
    },

    // ── Admin: Workers ─────────────────────────────────────────────────

    async getWorkers(buildingId: string): Promise<Worker[]> {
        const { data } = await apiClient.get<Worker[]>(
            `${ADMIN}/buildings/${buildingId}/workers`
        );
        return data;
    },

    async createWorker(
        buildingId: string,
        payload: CreateWorkerDto
    ): Promise<Worker> {
        const { data } = await apiClient.post<Worker>(
            `${ADMIN}/buildings/${buildingId}/workers`,
            payload
        );
        return data;
    },

    async updateWorker(
        buildingId: string,
        workerId: string,
        payload: UpdateWorkerDto
    ): Promise<Worker> {
        const { data } = await apiClient.patch<Worker>(
            `${ADMIN}/buildings/${buildingId}/workers/${workerId}`,
            payload
        );
        return data;
    },

    async deleteWorker(buildingId: string, workerId: string): Promise<void> {
        await apiClient.delete(
            `${ADMIN}/buildings/${buildingId}/workers/${workerId}`
        );
    },

    // ── App (read-only) ────────────────────────────────────────────────

    async getCurrentBoard(buildingId: string): Promise<BoardMember[]> {
        const { data } = await apiClient.get<BoardMember[]>(
            `${APP}/board-members`,
            { params: { building_id: buildingId } }
        );
        return data;
    },

    async getActiveWorkers(buildingId: string): Promise<Worker[]> {
        const { data } = await apiClient.get<Worker[]>(
            `${APP}/workers`,
            { params: { building_id: buildingId } }
        );
        return data;
    },
};
