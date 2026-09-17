export type PaymentMilestoneStatus = 'pending' | 'billable' | 'invoiced' | 'paid' | 'overdue';
export type TriggerType = 'date' | 'progress_pct' | 'deliverable_approved';
export type Currency = 'CLP' | 'USD' | 'UF';
export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface PaymentMilestone {
  id: number;
  project_id: number;
  project_milestone_id: number | null;
  name: string;
  description: string | null;
  amount: number;
  currency: Currency;
  trigger_type: TriggerType;
  trigger_value: number | null;
  planned_date: string | null;
  status: PaymentMilestoneStatus;
  billable_at: string | null;
  sort_order: number;
  project_name?: string;
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  payment_milestone_id: number | null;
  description: string;
  amount: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  currency: Currency;
  payment_date: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
}

export interface Invoice {
  id: number;
  project_id: number;
  project_name?: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: Currency;
  amount: number;
  status: InvoiceStatus;
  notes: string | null;
  lines: InvoiceLine[];
  payments: Payment[];
}

export interface BillingDashboardRow {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  amount: number;
  currency: Currency;
  amount_clp: number;
  status: PaymentMilestoneStatus;
  planned_date: string | null;
  trigger_type: TriggerType;
}

export interface BillingDashboard {
  ready_to_invoice: BillingDashboardRow[];
  invoiced_unpaid: BillingDashboardRow[];
  paid: BillingDashboardRow[];
  overdue: BillingDashboardRow[];
  cashflow_projection: { month: string; expected_amount_clp: number }[];
  summary: {
    total_pending_clp: number;
    total_billable_clp: number;
    total_invoiced_clp: number;
    total_paid_clp: number;
    total_overdue_clp: number;
  };
}
