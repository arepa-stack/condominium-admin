import { apiClient } from '@/lib/api/client';
import { mapPaginatedResponse } from '@/lib/api/mappers';
import {
    INFORMATION_CENTER_ADMIN_API_PREFIX as ADMIN_P,
    INFORMATION_CENTER_APP_API_PREFIX as APP_P,
} from '@/lib/utils/constants';
import type {
    Announcement,
    AnnouncementListParams,
    AnnouncementMetrics,
    AnnouncementReader,
    BoardMember,
    CreateAnnouncementDto,
    CreateRecommendedServiceDto,
    CreateRuleCategoryDto,
    CreateRuleDto,
    PaginatedResponse,
    RecommendedService,
    RecommendedServiceListParams,
    Rule,
    RuleCategory,
    RuleCategoryListParams,
    RuleListParams,
    UpdateAnnouncementDto,
    UpdateRecommendedServiceDto,
    UpdateRuleCategoryDto,
    UpdateRuleDto,
} from '@/types/models';

function appendIfPresent(form: FormData, key: string, value: unknown) {
    if (value === undefined || value === null) return;
    if (value instanceof File) {
        form.append(key, value);
        return;
    }
    form.append(key, String(value));
}

function announcementToFormData(dto: CreateAnnouncementDto | UpdateAnnouncementDto) {
    const form = new FormData();
    appendIfPresent(form, 'building_id', 'building_id' in dto ? dto.building_id : undefined);
    appendIfPresent(form, 'title', dto.title);
    appendIfPresent(form, 'content', dto.content);
    appendIfPresent(form, 'category', dto.category);
    appendIfPresent(form, 'attachment', dto.attachment);
    appendIfPresent(form, 'is_pinned', dto.is_pinned);
    appendIfPresent(form, 'expires_at', dto.expires_at);
    return form;
}

function ruleToFormData(dto: CreateRuleDto | UpdateRuleDto) {
    const form = new FormData();
    appendIfPresent(form, 'building_id', 'building_id' in dto ? dto.building_id : undefined);
    appendIfPresent(form, 'category_id', dto.category_id);
    appendIfPresent(form, 'title', dto.title);
    appendIfPresent(form, 'content', dto.content);
    appendIfPresent(form, 'attachment', dto.attachment);
    appendIfPresent(form, 'is_published', dto.is_published);
    appendIfPresent(form, 'sort_order', dto.sort_order);
    return form;
}

function hasAttachment(dto: { attachment?: File | null }) {
    return dto.attachment instanceof File;
}

function announcementToJson(dto: CreateAnnouncementDto | UpdateAnnouncementDto) {
    const rest = { ...dto };
    delete rest.attachment;
    return Object.fromEntries(
        Object.entries(rest).filter(([, value]) => value !== undefined && value !== null),
    );
}

function ruleToJson(dto: CreateRuleDto | UpdateRuleDto) {
    const rest = { ...dto };
    delete rest.attachment;
    return Object.fromEntries(
        Object.entries(rest).filter(([, value]) => value !== undefined && value !== null),
    );
}

export const informationCenterService = {
    async listAnnouncements(
        params?: AnnouncementListParams,
    ): Promise<PaginatedResponse<Announcement>> {
        const { data } = await apiClient.get(`${APP_P}/announcements`, { params });
        return mapPaginatedResponse<Announcement>(data);
    },

    async createAnnouncement(dto: CreateAnnouncementDto): Promise<Announcement> {
        const { data } = await apiClient.post<Announcement>(
            `${ADMIN_P}/announcements`,
            hasAttachment(dto) ? announcementToFormData(dto) : announcementToJson(dto),
        );
        return data;
    },

    async updateAnnouncement(id: string, dto: UpdateAnnouncementDto): Promise<Announcement> {
        const { data } = await apiClient.patch<Announcement>(
            `${ADMIN_P}/announcements/${id}`,
            hasAttachment(dto) ? announcementToFormData(dto) : announcementToJson(dto),
        );
        return data;
    },

    async deleteAnnouncement(id: string): Promise<void> {
        await apiClient.delete(`${ADMIN_P}/announcements/${id}`);
    },

    async getAnnouncementMetrics(id: string): Promise<AnnouncementMetrics> {
        const { data } = await apiClient.get<AnnouncementMetrics>(
            `${ADMIN_P}/announcements/${id}/metrics`,
        );
        return data;
    },

    async listAnnouncementReaders(id: string): Promise<AnnouncementReader[]> {
        const { data } = await apiClient.get<AnnouncementReader[]>(
            `${ADMIN_P}/announcements/${id}/readers`,
        );
        return data;
    },

    async listRuleCategories(params?: RuleCategoryListParams): Promise<RuleCategory[]> {
        const { data } = await apiClient.get<RuleCategory[]>(`${ADMIN_P}/rules/categories`, {
            params,
        });
        return data;
    },

    async createRuleCategory(dto: CreateRuleCategoryDto): Promise<RuleCategory> {
        const { data } = await apiClient.post<RuleCategory>(`${ADMIN_P}/rules/categories`, dto);
        return data;
    },

    async updateRuleCategory(id: string, dto: UpdateRuleCategoryDto): Promise<RuleCategory> {
        const { data } = await apiClient.patch<RuleCategory>(
            `${ADMIN_P}/rules/categories/${id}`,
            dto,
        );
        return data;
    },

    async listRules(params?: RuleListParams): Promise<Rule[]> {
        const { data } = await apiClient.get<Rule[]>(`${ADMIN_P}/rules`, { params });
        return data;
    },

    async createRule(dto: CreateRuleDto): Promise<Rule> {
        const { data } = await apiClient.post<Rule>(
            `${ADMIN_P}/rules`,
            hasAttachment(dto) ? ruleToFormData(dto) : ruleToJson(dto),
        );
        return data;
    },

    async updateRule(id: string, dto: UpdateRuleDto): Promise<Rule> {
        const { data } = await apiClient.patch<Rule>(
            `${ADMIN_P}/rules/${id}`,
            hasAttachment(dto) ? ruleToFormData(dto) : ruleToJson(dto),
        );
        return data;
    },

    async deleteRule(id: string): Promise<void> {
        await apiClient.delete(`${ADMIN_P}/rules/${id}`);
    },

    async listRecommendedServices(
        params?: RecommendedServiceListParams,
    ): Promise<RecommendedService[]> {
        const { data } = await apiClient.get<RecommendedService[]>(
            `${ADMIN_P}/recommended-services`,
            { params },
        );
        return data;
    },

    async createRecommendedService(
        dto: CreateRecommendedServiceDto,
    ): Promise<RecommendedService> {
        const { data } = await apiClient.post<RecommendedService>(
            `${ADMIN_P}/recommended-services`,
            dto,
        );
        return data;
    },

    async updateRecommendedService(
        id: string,
        dto: UpdateRecommendedServiceDto,
    ): Promise<RecommendedService> {
        const { data } = await apiClient.patch<RecommendedService>(
            `${ADMIN_P}/recommended-services/${id}`,
            dto,
        );
        return data;
    },

    async deleteRecommendedService(id: string): Promise<void> {
        await apiClient.delete(`${ADMIN_P}/recommended-services/${id}`);
    },

    async getCurrentBoard(buildingId?: string): Promise<BoardMember[]> {
        const { data } = await apiClient.get<BoardMember[]>(`${APP_P}/board`, {
            params: { building_id: buildingId },
        });
        return data;
    },
};
