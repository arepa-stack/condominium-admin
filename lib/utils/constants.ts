export const API_BASE_URL =
  process.env.NEXT_PUBLIC_ENVIOREMENT === "DEV"
    ? "http://localhost:5000/"
    : process.env.NEXT_PUBLIC_API_URL ||
      "https://condominium-api.nibs-tech.com/";

// export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://condominio.api.diangogavidia.com';
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Condominio Admin";
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

// API v2 route prefix for admin endpoints
export const ADMIN_API_PREFIX = "/api/v1/admin";

export const PAYMENT_METHODS = ["PAGO_MOVIL", "TRANSFER", "CASH"] as const;
export const PAYMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const USER_ROLES = ["resident", "board", "admin"] as const;
export const USER_STATUSES = ["pending", "active"] as const;
export const INVOICE_TAGS = ["NORMAL", "PETTY_CASH"] as const;

export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  BUILDINGS: "/buildings",
  USERS: "/users",
  PAYMENTS: "/payments",
  PETTY_CASH: "/petty-cash",
} as const;

export const PETTY_CASH_CATEGORIES = [
  "REPAIR",
  "CLEANING",
  "EMERGENCY",
  "OFFICE",
  "UTILITIES",
  "OTHER",
] as const;

export const INVOICE_STATUSES = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "CANCELLED",
] as const;
