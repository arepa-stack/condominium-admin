/**
 * Onboarding service — unit invitations only.
 *
 * Registration requests (QR/invitation flows) now create pending users directly
 * in the `profiles` table. Manage them from the Usuarios section (/users).
 *
 * The old approveRegistrationRequest / rejectRegistrationRequest / getRegistrationRequests
 * methods have been removed. Use usersService.approveUser / rejectUser instead.
 */
import { apiClient } from "@/lib/api/client";
import { ADMIN_API_PREFIX } from "@/lib/utils/constants";

const P = ADMIN_API_PREFIX;

export const onboardingService = {
  // Future: unit invitation management endpoints can be added here.
};
