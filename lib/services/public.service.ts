import { apiClient } from "@/lib/api/client";
import type { Building, Unit, RegistrationRequest } from "@/types/models";

export const publicService = {
  /**
   * Retrieves a building by its public code.
   * Useful for the public registration form.
   */
  async getBuildingByCode(code: string): Promise<Building> {
    const { data } = await apiClient.get<Building>(`/buildings/by-code/${code}`);
    return data;
  },

  /**
   * Retrieves units for a building using its public code.
   */
  async getBuildingUnitsByCode(code: string): Promise<Unit[]> {
    const { data } = await apiClient.get<Unit[]>(`/buildings/by-code/${code}/units`);
    return data;
  },

  /**
   * Submits a public registration request.
   */
  async submitRegistrationRequest(payload: {
    buildingCode: string;
    unitId: string;
    email: string;
    firstName: string;
    lastName: string;
    documentId: string;
    phone?: string;
  }): Promise<RegistrationRequest> {
    const { data } = await apiClient.post<RegistrationRequest>(`/registration-requests`, payload);
    return data;
  },
};
