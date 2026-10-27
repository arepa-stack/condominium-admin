import { apiClient } from '@/lib/api/client';
import { ADMIN_API_PREFIX } from '@/lib/utils/constants';
import type { BuildingPaymentInfo, BuildingPaymentInfoFields } from '@/types/models';

export const paymentInfoService = {
    async get(buildingId: string): Promise<BuildingPaymentInfo> {
        const { data } = await apiClient.get<BuildingPaymentInfo>(`${ADMIN_API_PREFIX}/buildings/${buildingId}/payment-info`);
        return data;
    },

    /** Replaces every field (blank clears it). `qr` uploads a new image; `removeQr` deletes the current one. */
    async update(
        buildingId: string,
        fields: BuildingPaymentInfoFields,
        qr?: File | null,
        removeQr = false,
    ): Promise<BuildingPaymentInfo> {
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.append(key, value ?? '');
        if (qr) form.append('qr', qr);
        if (removeQr) form.append('remove_qr', 'true');
        const { data } = await apiClient.put<BuildingPaymentInfo>(`${ADMIN_API_PREFIX}/buildings/${buildingId}/payment-info`, form);
        return data;
    },
};
