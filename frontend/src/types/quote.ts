/**
 * Quote-related TypeScript interfaces for the frontend
 */

export interface QuoteTask {
  title: string;
  description?: string;
  estimated_hours?: number;
  priority?: 'low' | 'medium' | 'high';
}

export interface QuoteMilestone {
  name: string;
  description?: string;
  target_date?: string;
}

export interface QuoteData {
  project_name: string;
  description: string;
  client_name: string;
  estimated_start_date?: string;
  estimated_end_date?: string;
  budgeted_cost?: number;
  expected_revenue?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tasks: QuoteTask[];
  milestones: QuoteMilestone[];
}

export interface UploadQuoteResponse {
  message: string;
  quote_data: QuoteData;
}

export interface CreateProjectFromQuoteResponse {
  message: string;
  project: any;
  tasks_created: number;
  milestones_created: number;
}
