export type PaymentMethod = "PAGO_MOVIL" | "TRANSFER" | "CASH";
export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
export type InvoiceTag = "NORMAL" | "PETTY_CASH";
export type InvoiceType = "EXPENSE" | "DEBT" | "EXTRAORDINARY" | "PETTY_CASH_REPLENISHMENT";
export type UserRole = "resident" | "board" | "admin";
export type UserStatus = "pending" | "active" | "inactive" | "rejected";

export interface UserUnit {
  unit_id: string;
  unit_name: string;
  building_id: string;
  building_name: string;
  is_primary: boolean;
  // building_role is moved to User.buildingRoles
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  // Deprecating single unit_id/unit checks
  unit?: string;
  unit_id?: string;
  // New Swagger structure
  units?: UserUnit[];
  buildingRoles?: { building_id: string; role: string }[];
  role: UserRole;
  status?: UserStatus;
  created_at: string;
  updated_at: string;
  // Legacy/Optional fields from older versions or specific endpoints
  building_id?: string;
  building?: Building;
  building_name?: string;
}

export interface Building {
  id: string;
  name: string;
  address: string;
  rif?: string; // Added if needed, but keeping basic for now based on prompt
  total_units?: number;
  monthly_fee?: number;
  created_at?: string;
}

export interface Invoice {
  id: string;
  number?: string;
  amount: number;
  paid_amount: number;
  status: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  description?: string;
  tag: InvoiceTag;
  type?: InvoiceType;
  month?: number;
  year?: number;
  user_id?: string;
  user?: User;
  unit_id?: string | null;
  unit?: Unit;
  building_id?: string | null;
  period?: string; // YYYY-MM
  receipt_number?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Allocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  invoice?: Invoice;
  amount: number;
  created_at: string;
  payment?: Payment; // [NEW] Added for bidirectional navigation
}

export interface Payment {
  id: string;
  user_id: string;
  user?: User; // Backend might include user details
  amount: number;
  payment_date: string;
  method: PaymentMethod;
  reference?: string;
  bank?: string; // Added bank field
  allocations?: Allocation[]; // Real accounting
  proof_url?: string; // Full URL from backend
  status: PaymentStatus;
  notes?: string; // Rejection reason or notes
  unit_id?: string; // UUID link
  processed_at?: string; // [NEW] Audit information
  processed_by?: string; // [NEW] Audit information
  processor?: { id: string; name: string }; // [NEW] Audit information
  created_at: string;
  updated_at: string;
}

export interface InvoicePayment extends Payment {
  allocated_amount: number;
  allocation_id: string;
  allocated_at: string;
}

export type SolvencyStatus = "SOLVENT" | "PENDING" | "OVERDUE";

export interface PaymentSummary {
  solvency_status: SolvencyStatus;
  last_payment_date?: string;
  pending_periods?: string[];
  paid_periods?: string[];
  recent_transactions: Payment[];
}

export interface DashboardStats {
  total_buildings?: number;
  total_users?: number; // Residents
  pending_payments: number;
  approved_payments?: number; // Optional
  total_revenue?: number; // Likely handled per building now
  solvency_rate?: number; // Backend calculated
}

export interface AuthResponse {
  token: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateBuildingDto {
  name: string;
  address: string;
  rif?: string;
}

export interface UpdateBuildingDto {
  name?: string;
  address?: string;
  rif?: string;
}

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  unit?: string;
  unit_id?: string; // [NEW]
  building_id?: string;
  role?: UserRole;
  buildingRoles?: { building_id: string; role: string }[];
  status?: UserStatus;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  building_id: string;
  buildingRoles?: { building_id: string; role: string }[];
  unit?: string;
  unit_id?: string; // [NEW]
  phone?: string;
}

export interface UpdatePaymentDto {
  status: PaymentStatus;
  notes?: string;
}

export interface Unit {
  id: string;
  name: string;
  floor: string;
  aliquot: number;
  building_id: string; // Likely included
}

export interface CreateUnitDto {
  name: string;
  floor: string;
  aliquot?: number;
}

export interface BatchUnitDto {
  floors: string[];
  unitsPerFloor: string[];
  aliquot?: number; // [NEW] Default aliquot for all units
}

export interface BillingDebtPayload {
  unit_id: string;
  amount: number;
  period: string; // "YYYY-MM"
  description: string;
  due_date?: string;
}

export interface UnitInvoice {
  invoiceId: string;
  amount: number;
  paid: number;
  remaining: number;
  period: string;
  status: string;
}

export interface UnitBalance {
  unit: string; // Unit name?
  totalDebt: number;
  pendingInvoices: number;
  creditBalance: number;
  netBalance: number;
  details: UnitInvoice[];
}

// DTOs for Unit Management
// POST /users/:id/units - Handles both create and update
export interface AssignUnitDto {
  unit_id: string; // Backend uses snake_case
  building_id: string; // Backend uses snake_case
  is_primary: boolean; // Backend uses snake_case
}

export interface ProposedInvoice {
  unitName: string;
  amount: number;
  period: string; // Formato YYYY-MM
  issueDate: string;
  receiptNumber: string; // Required now
  receipt_number?: string; // Optional field from backend preview
  warning?: string; // Warning message from backend
  status: "EXISTS" | "TO_BE_CREATED";
}

export interface PreviewInvoicesResponse {
  invoices: ProposedInvoice[];
  unitsToCreate: string[];
}

export interface CreditLedgerEntry {
  id: string;
  unit_id: string;
  amount: number;
  reason: string;
  reference_type?: string;
  reference_id?: string;
  created_at: string;
}

export interface UnitCreditResponse {
  balance: number;
  history: CreditLedgerEntry[];
}

export type PettyCashTransactionType = "INCOME" | "EXPENSE" | "INGRESO" | "EGRESO";

export interface PettyCashBalance {
  current_balance: number;
  building_id: string;
  currency?: string;
  updated_at?: string;
}

export interface PettyCashTransaction {
  id: string;
  fund_id?: string;
  building_id: string;
  amount: number;
  description: string;
  type: PettyCashTransactionType;
  category: string;
  evidence_url?: string;
  created_at: string;
}

export interface CreatePettyCashIncomeDto {
  building_id: string;
  amount: number | string;
  description: string;
}

export interface PettyCashAssessmentPreview {
  building_id: string;
  total_expenses: number;
  total_income: number;
  fund_balance: number;
  total_overage: number;
  already_assessed: number;
  pending_to_assess: number;
  units: { id: string; name: string; amount: number }[];
}

export interface PettyCashAssessmentResponse {
  building_id: string;
  total_assessed: number;
  invoices_created: number;
  invoices: {
    unit_id: string;
    unit_name: string;
    amount: number;
    invoice_id: string;
  }[];
}

export interface PettyCashTransparency {
  building_id: string;
  total_to_collect: number;
  total_collected: number;
  collection_percentage: number;
  units: {
    unit_id: string;
    unit_name: string;
    expected_amount: number;
    covered_amount: number;
    status: "PAID" | "PARTIAL" | "PENDING";
  }[];
}

