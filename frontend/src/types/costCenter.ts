export type CostCenterCountry = 'CHILE' | 'PERU' | 'USA';

export interface CostCenter {
  id: number;
  code: string;
  name: string;
  country: CostCenterCountry;
  category: string;
  is_rpa: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProjectCostCenterAllocation {
  id?: number;
  project_id?: number;
  quote_id?: number | null;
  cost_center_id: number;
  amount: number;
  percentage?: number | null;
  currency: string;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined fields
  cost_center_code?: string;
  cost_center_name?: string;
  country?: CostCenterCountry;
  category?: string;
  is_rpa?: boolean;
}

export interface SetProjectCostCentersInput {
  quote_id?: number | null;
  allocations: Array<{
    cost_center_id: number;
    amount: number;
    percentage?: number | null;
    currency?: string;
    description?: string | null;
  }>;
}

export interface CostCenterBillingSummaryRow {
  cost_center_id: number;
  code: string;
  name: string;
  country: CostCenterCountry;
  category: string;
  is_rpa: boolean;
  allocated_amount_clp: number;
  invoiced_amount_clp: number;
  paid_amount_clp: number;
  pending_invoice_clp: number;
  pending_payment_clp: number;
}

export interface CostCenterFilterParams {
  country?: CostCenterCountry;
  is_rpa?: boolean;
  active_only?: boolean;
}
