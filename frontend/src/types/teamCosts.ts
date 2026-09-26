export interface TeamCostMember {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  cost_rate_id: number | null;
  monthly_cost: number | null;
  hourly_rate: number | null;
  effective_from: string | null;
}

export interface TeamCostsResponse {
  monthly_hours: number;
  members: TeamCostMember[];
}
