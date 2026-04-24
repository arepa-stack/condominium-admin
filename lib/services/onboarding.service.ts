import { apiClient } from "@/lib/api/client";
import { ADMIN_API_PREFIX } from "@/lib/utils/constants";
import type { RegistrationRequest } from "@/types/models";

const P = ADMIN_API_PREFIX;

export const onboardingService = {
  /**
   * List registration requests. 
   * Board members only see requests for their buildings.
   * Admins see all.
   */
  async getRegistrationRequests(params?: { building_id?: string; status?: string }): Promise<RegistrationRequest[]> {
    const { data } = await apiClient.get<RegistrationRequest[]>(`${P}/registration-requests`, {
      params,
    });
    return data;
  },

  /**
   * Approves a request, creating the resident profile and sending credentials.
   */
  async approveRegistrationRequest(id: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(`${P}/registration-requests/${id}/approve`);
    return data;
  },

  /**
   * Rejects a request with an optional reason.
   */
  async rejectRegistrationRequest(id: string, reason?: string): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(`${P}/registration-requests/${id}/reject`, {
      reason,
    });
    return data;
  },
};
