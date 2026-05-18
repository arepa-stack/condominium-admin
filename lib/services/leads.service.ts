import { apiClient } from "@/lib/api/client";
import { ADMIN_API_PREFIX } from "@/lib/utils/constants";

const P = ADMIN_API_PREFIX;

export type LeadStatus = "new" | "viewed" | "contacted" | "archived";

export interface Lead {
  id: string;
  full_name: string;
  contact: string;
  email: string;
  building_name: string;
  location: string;
  estimated_users: string;
  status: LeadStatus;
  viewed_at: string | null;
  contacted_at: string | null;
  created_at: string;
}

export const leadsService = {
  async getLeads(params?: { status?: LeadStatus }): Promise<Lead[]> {
    const { data } = await apiClient.get<Lead[]>(`${P}/leads`, { params });
    return data;
  },

  async getUnreadCount(): Promise<number> {
    const { data } = await apiClient.get<{ count: number }>(`${P}/leads/unread-count`);
    return data.count;
  },

  async updateLeadStatus(id: string, status: Exclude<LeadStatus, "new">): Promise<Lead> {
    const { data } = await apiClient.patch<Lead>(`${P}/leads/${id}/status`, { status });
    return data;
  },
};
