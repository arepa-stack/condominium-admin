import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type {
    BillConceptPayload, BillConceptResult, BillingSummary, ChargeConcept, ChargeConceptPayload,
    ChargeConceptStatus, ChargeConceptUpdatePayload,
} from '@/types/models';

const P = ADMIN_API_PREFIX;

const base = (buildingId: string) => `${P}/billing/buildings/${buildingId}/concepts`;

export const chargeConceptsService = {
    async list(buildingId: string, status?: ChargeConceptStatus): Promise<ChargeConcept[]> {
        const { data } = await apiClient.get<ChargeConcept[]>(base(buildingId), {
            params: status ? { status } : undefined,
        });
        return data;
    },

    async create(buildingId: string, payload: ChargeConceptPayload): Promise<ChargeConcept> {
        const { data } = await apiClient.post<ChargeConcept>(base(buildingId), payload);
        return data;
    },

    async update(buildingId: string, conceptId: string, payload: ChargeConceptUpdatePayload): Promise<ChargeConcept> {
        const { data } = await apiClient.patch<ChargeConcept>(`${base(buildingId)}/${conceptId}`, payload);
        return data;
    },

    // One invoice per unit of the building, split by the concept's distribution.
    async bill(buildingId: string, conceptId: string, payload: BillConceptPayload): Promise<BillConceptResult> {
        const { data } = await apiClient.post<BillConceptResult>(`${base(buildingId)}/${conceptId}/invoices`, payload);
        return data;
    },

    // Invoices grouped by concept (and period for ORDINARY concepts) with collection progress.
    async summary(buildingId: string): Promise<BillingSummary> {
        const { data } = await apiClient.get<BillingSummary>(`${P}/billing/buildings/${buildingId}/billing-summary`);
        return data;
    },
};
