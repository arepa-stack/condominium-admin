import { apiClient } from '@/lib/api/client';
import { mapPaginatedResponse } from '@/lib/api/mappers';
import { DECISIONS_API_PREFIX as P } from '@/lib/utils/constants';
import type {
    Decision,
    DecisionQuote,
    DecisionVote,
    DecisionTally,
    DecisionAuditEntry,
    CreateDecisionDto,
    ExtendDeadlinesDto,
    CancelDecisionDto,
    ResolveTiebreakDto,
    GenerateChargeDto,
    PaginatedResponse,
    PaginationParams,
} from '@/types/models';

interface ListDecisionsParams extends PaginationParams {
    building_id?: string;
    status?: string;
    search?: string;
}

interface DecisionDetailResponse {
    decision: Decision;
    quotes: DecisionQuote[];
    tally: DecisionTally | null;
    my_vote: DecisionVote | null;
}

interface GenerateChargeResponse {
    decision: Decision;
    charge_type: string;
    charge_id: string;
}

export const decisionsService = {
    async list(params?: ListDecisionsParams): Promise<PaginatedResponse<Decision>> {
        const { data } = await apiClient.get(P, { params });
        return mapPaginatedResponse<Decision>(data);
    },

    async getById(id: string): Promise<DecisionDetailResponse> {
        const { data } = await apiClient.get<DecisionDetailResponse>(`${P}/${id}`);
        return data;
    },

    async create(dto: CreateDecisionDto): Promise<Decision> {
        const { data } = await apiClient.post<Decision>(P, dto);
        return data;
    },

    async uploadPhoto(id: string, file: File): Promise<Decision> {
        const fd = new FormData();
        fd.append('photo', file);
        const { data } = await apiClient.post<Decision>(`${P}/${id}/photo`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async extendDeadlines(id: string, dto: ExtendDeadlinesDto): Promise<Decision> {
        const { data } = await apiClient.patch<Decision>(`${P}/${id}/deadlines`, dto);
        return data;
    },

    async cancel(id: string, dto: CancelDecisionDto): Promise<Decision> {
        const { data } = await apiClient.post<Decision>(`${P}/${id}/cancel`, dto);
        return data;
    },

    async finalize(
        id: string,
        body?: { force?: boolean; reason?: string },
    ): Promise<Decision> {
        const { data } = await apiClient.post<Decision>(
            `${P}/${id}/finalize`,
            body ?? {},
        );
        return data;
    },

    async resolveTiebreak(id: string, dto: ResolveTiebreakDto): Promise<Decision> {
        const { data } = await apiClient.post<Decision>(`${P}/${id}/resolve-tiebreak`, dto);
        return data;
    },

    async generateCharge(id: string, dto: GenerateChargeDto): Promise<GenerateChargeResponse> {
        const { data } = await apiClient.post<GenerateChargeResponse>(
            `${P}/${id}/generate-charge`,
            dto,
        );
        return data;
    },

    async listQuotes(
        id: string,
        params?: PaginationParams,
    ): Promise<PaginatedResponse<DecisionQuote>> {
        const { data } = await apiClient.get(`${P}/${id}/quotes`, { params });
        return mapPaginatedResponse<DecisionQuote>(data);
    },

    async uploadQuote(id: string, fd: FormData): Promise<DecisionQuote> {
        const { data } = await apiClient.post<DecisionQuote>(`${P}/${id}/quotes`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data;
    },

    async deleteQuote(id: string, quoteId: string, reason?: string): Promise<void> {
        await apiClient.delete(`${P}/${id}/quotes/${quoteId}`, {
            data: reason ? { reason } : undefined,
        });
    },

    async listVotes(
        id: string,
        params?: PaginationParams,
    ): Promise<PaginatedResponse<DecisionVote>> {
        const { data } = await apiClient.get(`${P}/${id}/votes`, { params });
        return mapPaginatedResponse<DecisionVote>(data);
    },

    async getResults(id: string): Promise<DecisionTally> {
        const { data } = await apiClient.get<DecisionTally>(`${P}/${id}/results`);
        return data;
    },

    async getAuditLog(
        id: string,
        params?: PaginationParams,
    ): Promise<PaginatedResponse<DecisionAuditEntry>> {
        const { data } = await apiClient.get(`${P}/${id}/audit-log`, { params });
        return mapPaginatedResponse<DecisionAuditEntry>(data);
    },
};
