// Project Lifecycle Types
export type PhaseCategory = 'pre_sale' | 'negotiation' | 'pre_development' | 'development' | 'testing' | 'deployment' | 'post_deployment';
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
export type Responsibility = 'internal' | 'client' | 'external' | 'shared';
export type DelayType = 'client_waiting' | 'approval_pending' | 'information_missing' | 'scope_change' | 'technical_blocker' | 'resource_unavailable' | 'external_dependency' | 'other';
export type ChangeType = 'scope_increase' | 'scope_decrease' | 'requirement_change' | 'technical_change' | 'timeline_extension' | 'other';
export type ChangeStatus = 'pending' | 'approved' | 'rejected' | 'implemented';

export interface ProjectPhaseTemplate {
  id: number;
  name: string;
  description?: string;
  phase_order: number;
  is_billable: boolean;
  is_mandatory: boolean;
  estimated_duration_days?: number;
  category: PhaseCategory;
  color: string;
  created_at: string;
}

export interface ProjectPhase {
  id: number;
  project_id: number;
  template_id: number;
  name: string;
  description?: string;
  phase_order: number;
  status: PhaseStatus;
  planned_start_date?: string;
  planned_end_date?: string;
  estimated_hours: number;
  actual_start_date?: string;
  actual_end_date?: string;
  actual_hours: number;
  responsibility: Responsibility;
  blocking_reason?: string;
  waiting_for?: string;
  is_billable: boolean;
  budgeted_cost: number;
  actual_cost: number;
  client_charge: number;
  variance_days: number;
  variance_hours: number;
  efficiency_percentage: number;
  is_critical_path: boolean;
  completion_percentage: number;
  created_at: string;
  updated_at: string;

  // Joined fields
  category?: PhaseCategory;
  color?: string;
  activities?: PhaseActivity[];
}

export interface PhaseActivity {
  id: number;
  phase_id: number;
  project_id: number;
  activity_type: string;
  description: string;
  start_datetime?: string;
  end_datetime?: string;
  duration_minutes: number;
  calculated_hours: number;
  user_id: number;
  is_productive: boolean;
  is_billable: boolean;
  is_internal: boolean;
  responsibility: Responsibility;
  notes?: string;
  tags?: string;
  has_evidence: boolean;
  evidence_description?: string;
  created_at: string;
  updated_at: string;

  // Joined fields
  user_name?: string;
  user_full_name?: string;
}

export interface ProjectDelay {
  id: number;
  project_id: number;
  phase_id?: number;
  delay_type: DelayType;
  description: string;
  responsible_party: Responsibility;
  contact_person?: string;
  delay_start_date: string;
  delay_end_date?: string;
  delay_days: number;
  financial_impact: number;
  resolution?: string;
  resolved_by?: number;
  has_evidence: boolean;
  evidence_notes?: string;
  created_by: number;
  created_at: string;
  updated_at: string;

  // Joined fields
  phase_name?: string;
  created_by_name?: string;
  resolved_by_name?: string;
}

export interface ProjectScopeChange {
  id: number;
  project_id: number;
  phase_id?: number;
  change_type: ChangeType;
  description: string;
  reason: string;
  requested_by?: string;
  hours_impact: number;
  cost_impact: number;
  timeline_impact_days: number;
  status: ChangeStatus;
  approved_by?: number;
  approval_date?: string;
  requires_re_quote: boolean;
  new_quote_amount?: number;
  quote_approved: boolean;
  created_by: number;
  created_at: string;
  updated_at: string;

  // Joined fields
  phase_name?: string;
  approved_by_name?: string;
  created_by_name?: string;
}

export interface ROIAnalysis {
  apparent_roi: number;
  real_roi: number;
  total_hours_real: number;
  billable_hours: number;
  non_billable_hours: number;
  non_billable_percentage: number;
  breakdown: ROIBreakdownItem[];
}

export interface ROIBreakdownItem {
  phase_name: string;
  actual_hours: number;
  cost: number;
  is_billable: boolean;
  category: PhaseCategory;
}

export interface LifecycleMetrics {
  totalPlannedHours: number;
  totalActualHours: number;
  billableHours: number;
  nonBillableHours: number;
  clientWaitingDays: number;
  totalVarianceDays: number;
  efficiency: number;
  totalCost: number;
  billableCost: number;
}

// Form types
export interface CreatePhaseActivityForm {
  phase_id: number;
  activity_type: string;
  description: string;
  start_datetime?: string;
  end_datetime?: string;
  duration_minutes: number;
  user_id: number;
  is_productive: boolean;
  is_billable: boolean;
  is_internal: boolean;
  responsibility: Responsibility;
  notes?: string;
  tags?: string;
  has_evidence?: boolean;
  evidence_description?: string;
}

export interface CreateDelayForm {
  project_id: number;
  phase_id?: number;
  delay_type: DelayType;
  description: string;
  responsible_party: Responsibility;
  contact_person?: string;
  delay_start_date: string;
  delay_end_date?: string;
  financial_impact?: number;
  has_evidence?: boolean;
  evidence_notes?: string;
}

export interface CreateScopeChangeForm {
  project_id: number;
  phase_id?: number;
  change_type: ChangeType;
  description: string;
  reason: string;
  requested_by?: string;
  hours_impact?: number;
  cost_impact?: number;
  timeline_impact_days?: number;
  requires_re_quote?: boolean;
  new_quote_amount?: number;
}

// Labels for UI
export const PhaseCategoryLabels: Record<PhaseCategory, string> = {
  pre_sale: 'Pre-Venta',
  negotiation: 'Negociación',
  pre_development: 'Pre-Desarrollo',
  development: 'Desarrollo',
  testing: 'Testing',
  deployment: 'Despliegue',
  post_deployment: 'Post-Despliegue'
};

export const PhaseStatusLabels: Record<PhaseStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En Progreso',
  completed: 'Completado',
  skipped: 'Omitido',
  blocked: 'Bloqueado'
};

export const ResponsibilityLabels: Record<Responsibility, string> = {
  internal: 'Interno',
  client: 'Cliente',
  external: 'Externo',
  shared: 'Compartido'
};

export const DelayTypeLabels: Record<DelayType, string> = {
  client_waiting: 'Esperando Cliente',
  approval_pending: 'Aprobación Pendiente',
  information_missing: 'Información Faltante',
  scope_change: 'Cambio de Alcance',
  technical_blocker: 'Bloqueador Técnico',
  resource_unavailable: 'Recurso No Disponible',
  external_dependency: 'Dependencia Externa',
  other: 'Otro'
};

export const ChangeTypeLabels: Record<ChangeType, string> = {
  scope_increase: 'Aumento de Alcance',
  scope_decrease: 'Reducción de Alcance',
  requirement_change: 'Cambio de Requerimiento',
  technical_change: 'Cambio Técnico',
  timeline_extension: 'Extensión de Tiempo',
  other: 'Otro'
};

export const ChangeStatusLabels: Record<ChangeStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  implemented: 'Implementado'
};

// Activity types catalog
export const ActivityTypes = [
  { value: 'meeting', label: 'Reunión' },
  { value: 'document_review', label: 'Revisión de Documentos' },
  { value: 'proposal_writing', label: 'Elaboración de Propuesta' },
  { value: 'waiting', label: 'Tiempo de Espera' },
  { value: 'rework', label: 'Re-trabajo' },
  { value: 'client_follow_up', label: 'Seguimiento a Cliente' },
  { value: 'development', label: 'Desarrollo' },
  { value: 'testing', label: 'Testing' },
  { value: 'debugging', label: 'Debugging' },
  { value: 'documentation', label: 'Documentación' },
  { value: 'deployment', label: 'Despliegue' },
  { value: 'training', label: 'Capacitación' },
  { value: 'support', label: 'Soporte' },
  { value: 'administrative', label: 'Administrativo' },
  { value: 'other', label: 'Otro' }
];

// Color mappings
export const CategoryColors: Record<PhaseCategory, string> = {
  pre_sale: '#8c8c8c',
  negotiation: '#faad14',
  pre_development: '#f5222d',
  development: '#1890ff',
  testing: '#722ed1',
  deployment: '#52c41a',
  post_deployment: '#13c2c2'
};

export const StatusColors: Record<PhaseStatus, string> = {
  pending: '#d9d9d9',
  in_progress: '#1890ff',
  completed: '#52c41a',
  skipped: '#8c8c8c',
  blocked: '#f5222d'
};
