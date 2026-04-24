export interface PaginationMetadata {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  metadata: PaginationMetadata;
}

export type PaginationParams = {
  page?: number;
  limit?: number | 'all';
};

export type PaymentMethod = "PAGO_MOVIL" | "TRANSFER" | "CASH";
export type PaymentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
export type InvoiceTag = "NORMAL" | "PETTY_CASH";
export type InvoiceType = "EXPENSE" | "DEBT" | "EXTRAORDINARY" | "PETTY_CASH_REPLENISHMENT";
export type UserRole = "resident" | "board" | "admin";
export type AppRole = "admin" | "user";
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
  units?: UserUnit[];
  buildingRoles?: { building_id: string; role: string }[];
  app_role: AppRole;
  status?: UserStatus;
  must_change_password?: boolean;
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
  building_code?: string;
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
  must_change_password?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface CreateBuildingDto {
  name: string;
  address: string;
}

export interface UpdateBuildingDto {
  name?: string;
  address?: string;
}

export interface UpdateUserDto {
  name?: string;
  phone?: string;
  unit?: string;
  unit_id?: string;
  building_id?: string;
  app_role?: AppRole;
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
  board_position?: string;
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

export type PettyCashEntryType = "income" | "expense" | "collection" | "reversal";

export type PettyCashCategory =
  | "REPAIR"
  | "CLEANING"
  | "EMERGENCY"
  | "OFFICE"
  | "UTILITIES"
  | "OTHER";

export type PettyCashEntryReferenceType =
  | "manual"
  | "invoice_payment"
  | "reversal";

export interface PettyCashBalance {
  id: string;
  building_id: string;
  current_balance: number;
  updated_at: string;
}

export interface PettyCashEntry {
  id: string;
  fund_id: string;
  type: PettyCashEntryType;
  amount: number;
  category: PettyCashCategory | null;
  description: string;
  evidence_url: string | null;
  reference_type: PettyCashEntryReferenceType | null;
  reference_id: string | null;
  created_by: string;
  created_at: string;
}

export interface CreatePettyCashIncomeDto {
  building_id: string;
  amount: number | string;
  description: string;
}

export interface CreatePettyCashExpenseDto {
  building_id: string;
  amount: number | string;
  description: string;
  category?: PettyCashCategory;
  evidence_image?: File;
}

export interface PettyCashAssessmentPreview {
  building_id: string;
  current_balance: number;
  total_overage: number;
  already_assessed: number;
  pending_to_assess: number;
  units: { id: string; name: string; amount: number }[];
}

export interface CreatePettyCashAssessmentDto {
  description: string;
  amount: number | string;
  category?: PettyCashCategory;
}

export interface PettyCashAssessmentResponse {
  building_id: string;
  assessment_id: string;
  description: string;
  total_assessed: number;
  invoices_created: number;
  invoices: {
    unit_id: string;
    unit_name: string;
    amount: number;
    invoice_id: string;
  }[];
}

export interface PettyCashTransparencyBatch {
  id: string;
  description: string;
  category: PettyCashCategory | null;
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

export interface PettyCashTransparency {
  building_id: string;
  period: string;
  assessments: PettyCashTransparencyBatch[];
  total_to_collect: number;
  total_collected: number;
  collection_percentage: number;
}

export interface ReversePettyCashEntryDto {
  reason: string;
}

// ─── Decisions (Presupuestos y Votaciones) ─────────────────────────────────

export type DecisionStatus =
  | 'RECEPTION'
  | 'VOTING'
  | 'TIEBREAK_PENDING'
  | 'RESOLVED'
  | 'CANCELLED';

export type DecisionChargeType = 'INVOICE' | 'ASSESSMENT';

export interface DecisionActorRef {
  id: string;
  name: string;
}

export interface Decision {
  id: string;
  building_id: string;
  title: string;
  description: string | null;
  photo_url: string | null;
  status: DecisionStatus;
  current_round: number;
  reception_deadline: string;
  voting_deadline: string;
  tiebreak_duration_hours: number;
  winner_quote_id: string | null;
  resulting_type: DecisionChargeType | null;
  resulting_id: string | null;
  finalized_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  /** Null cuando el usuario creador fue eliminado (FK SET NULL en backend). */
  created_by: DecisionActorRef | null;
  created_at: string;
  updated_at: string;
  /** Computado por el backend: deadline de la fase actual ya pasó pero no se finalizó */
  is_deadline_passed: boolean;
  /** Cantidad de quotes activos (no eliminados) */
  quote_count: number;
}

export interface DecisionQuote {
  id: string;
  decision_id: string;
  /** Null cuando el usuario uploader fue eliminado (FK SET NULL en backend). */
  uploader: DecisionActorRef | null;
  uploader_unit_id: string | null;
  provider_name: string;
  amount: number;
  notes: string | null;
  /** Signed URL con TTL corto (5-10 min). No cachear entre fetches. */
  file_url: string;
  deleted_at: string | null;
  deleted_by: DecisionActorRef | null;
  deletion_reason: string | null;
  created_at: string;
}

export interface DecisionVote {
  id: string;
  decision_id: string;
  round: number;
  apartment_id: string;
  apartment_label: string;
  quote_id: string;
  /** Null cuando el usuario votante fue eliminado (FK SET NULL en backend). */
  voted_by: DecisionActorRef | null;
  created_at: string;
}

export interface DecisionTallyEntry {
  quote_id: string;
  provider_name: string;
  amount: number;
  votes: number;
  pct: number;
}

export interface DecisionTally {
  round: number;
  status: DecisionStatus;
  total_apartments: number;
  total_votes: number;
  participation_pct: number;
  tallies: DecisionTallyEntry[];
  winner_quote_id: string | null;
  is_tied: boolean;
}

export type DecisionAuditEvent =
  | 'CREATED'
  | 'DEADLINE_EXTENDED'
  | 'CANCELLED'
  | 'QUOTE_DELETED'
  | 'FINALIZED'
  | 'TIEBREAK_OPENED'
  | 'WINNER_SET_MANUAL'
  | 'CHARGE_GENERATED'
  | 'PHASE_ADVANCED';

export interface DecisionAuditEntry {
  id: string;
  decision_id: string;
  event: DecisionAuditEvent;
  /** Null cuando el actor fue eliminado (FK SET NULL en backend). */
  actor: DecisionActorRef | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface CreateDecisionDto {
  building_id: string;
  title: string;
  description?: string;
  reception_deadline: string;
  voting_deadline: string;
  tiebreak_duration_hours?: number;
}

export interface ExtendDeadlinesDto {
  reception_deadline?: string;
  voting_deadline?: string;
  reason: string;
}

export interface CancelDecisionDto {
  reason: string;
}

export interface ResolveTiebreakDto {
  quote_id: string;
  reason: string;
}

export interface GenerateChargeDto {
  type: DecisionChargeType;
  amount_override?: number;
  category?: string;
}

// ─── Onboarding & Registration ─────────────────────────────────────────────

export interface RegistrationRequest {
  id: string;
  building_id: string;
  unit_id: string;
  email: string;
  first_name: string;
  last_name: string;
  document_id: string;
  phone: string | null;
  source: "qr" | "invitation";
  status: "pending" | "approved" | "rejected";
  invited_by_profile_id: string | null;
  invitation_id: string | null;
  reviewed_by_profile_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  // For UI display
  building_name?: string;
  unit_name?: string;
}

export interface UnitInvitation {
  id: string;
  unit_id: string;
  building_id: string;
  inviter_profile_id: string;
  invitee_email: string;
  invitee_name: string | null;
  token: string;
  status: "pending" | "claimed" | "expired" | "cancelled";
  expires_at: string;
  claimed_at: string | null;
  created_at: string;
}

