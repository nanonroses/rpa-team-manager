export interface ProjectBaseline {
  id: number;
  project_id: number;
  baseline_date: string;
  start_date: string;
  end_date: string;
  budgeted_cost_clp: number;
  budgeted_hours: number;
  created_by: number;
  created_at: string;
}

export interface ProjectHealth {
  project_id: number;
  has_baseline: boolean;
  status: 'insufficient_data' | 'ok';
  ev_percentage: number;
  pv_percentage: number | null;
  spi: number | null;
  cpi: number | null;
  semaphore: 'green' | 'yellow' | 'red' | 'gray';
  projected_end_date: string | null;
  schedule_variance_days: number | null;
}
