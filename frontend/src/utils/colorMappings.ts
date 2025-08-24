/**
 * Centralized color mappings for consistent theming across the application
 */

// =====================================
// PROJECT STATUS COLORS
// =====================================
export const PROJECT_STATUS_COLORS = {
  planning: 'blue',
  active: 'green', 
  on_hold: 'orange',
  completed: 'purple',
  cancelled: 'red'
} as const;

export type ProjectStatus = keyof typeof PROJECT_STATUS_COLORS;

export const getProjectStatusColor = (status: string): string => {
  return PROJECT_STATUS_COLORS[status as ProjectStatus] || 'default';
};

// =====================================
// TASK STATUS COLORS  
// =====================================
export const TASK_STATUS_COLORS = {
  todo: 'default',
  in_progress: 'processing', 
  review: 'warning',
  testing: 'purple',
  done: 'success',
  blocked: 'error'
} as const;

export type TaskStatus = keyof typeof TASK_STATUS_COLORS;

export const getTaskStatusColor = (status: string): string => {
  return TASK_STATUS_COLORS[status as TaskStatus] || 'default';
};

// =====================================
// IDEA STATUS COLORS
// =====================================
export const IDEA_STATUS_COLORS = {
  draft: 'default',
  under_review: 'processing',
  approved: 'success', 
  in_progress: 'warning',
  done: 'success',
  rejected: 'error'
} as const;

export type IdeaStatus = keyof typeof IDEA_STATUS_COLORS;

export const getIdeaStatusColor = (status: string): string => {
  return IDEA_STATUS_COLORS[status as IdeaStatus] || 'default';
};

// =====================================
// SUPPORT TICKET STATUS COLORS
// =====================================
export const SUPPORT_STATUS_COLORS = {
  open: 'blue',
  in_progress: 'processing',
  resolved: 'success', 
  closed: 'default'
} as const;

export type SupportStatus = keyof typeof SUPPORT_STATUS_COLORS;

export const getSupportStatusColor = (status: string): string => {
  return SUPPORT_STATUS_COLORS[status as SupportStatus] || 'default';
};

// =====================================
// PRIORITY COLORS (Universal)
// =====================================
export const PRIORITY_COLORS = {
  critical: 'red',
  high: 'orange', 
  medium: 'blue',
  low: 'green'
} as const;

export type Priority = keyof typeof PRIORITY_COLORS;

export const getPriorityColor = (priority: string): string => {
  return PRIORITY_COLORS[priority as Priority] || 'default';
};

// =====================================
// FILE STATUS COLORS
// =====================================
export const FILE_STATUS_COLORS = {
  uploading: 'processing',
  uploaded: 'success',
  failed: 'error',
  processing: 'warning'
} as const;

export type FileStatus = keyof typeof FILE_STATUS_COLORS;

export const getFileStatusColor = (status: string): string => {
  return FILE_STATUS_COLORS[status as FileStatus] || 'default';
};

// =====================================
// GENERIC STATUS COLORS (Fallback)
// =====================================
export const GENERIC_STATUS_COLORS = {
  active: 'green',
  inactive: 'red', 
  pending: 'orange',
  processing: 'blue',
  completed: 'purple',
  cancelled: 'red',
  success: 'green',
  error: 'red',
  warning: 'orange',
  info: 'blue'
} as const;

export type GenericStatus = keyof typeof GENERIC_STATUS_COLORS;

export const getGenericStatusColor = (status: string): string => {
  return GENERIC_STATUS_COLORS[status as GenericStatus] || 'default';
};

// =====================================
// PROGRESS/PERFORMANCE COLORS
// =====================================
export const PROGRESS_COLORS = {
  excellent: '#52c41a',    // Green
  good: '#73d13d',         // Light Green  
  fair: '#faad14',         // Orange
  poor: '#ff7875',         // Light Red
  critical: '#f5222d'      // Red
} as const;

export const getProgressColor = (percentage: number): string => {
  if (percentage >= 90) return PROGRESS_COLORS.excellent;
  if (percentage >= 75) return PROGRESS_COLORS.good;
  if (percentage >= 50) return PROGRESS_COLORS.fair;
  if (percentage >= 25) return PROGRESS_COLORS.poor;
  return PROGRESS_COLORS.critical;
};

// =====================================
// ROI/FINANCIAL COLORS  
// =====================================
export const FINANCIAL_COLORS = {
  positive: '#52c41a',     // Green
  neutral: '#faad14',      // Orange
  negative: '#f5222d'      // Red
} as const;

export const getROIColor = (roiPercentage: number): string => {
  if (roiPercentage > 0) return FINANCIAL_COLORS.positive;
  if (roiPercentage === 0) return FINANCIAL_COLORS.neutral;
  return FINANCIAL_COLORS.negative;
};

export const getBudgetVarianceColor = (variance: number): string => {
  if (Math.abs(variance) <= 5) return FINANCIAL_COLORS.positive;  // Within 5%
  if (Math.abs(variance) <= 15) return FINANCIAL_COLORS.neutral; // Within 15%
  return FINANCIAL_COLORS.negative; // Over 15%
};

// =====================================
// TEAM/USER ROLE COLORS
// =====================================
export const ROLE_COLORS = {
  team_lead: 'purple',
  rpa_developer: 'blue',
  rpa_operations: 'green', 
  it_support: 'orange'
} as const;

export type UserRole = keyof typeof ROLE_COLORS;

export const getRoleColor = (role: string): string => {
  return ROLE_COLORS[role as UserRole] || 'default';
};

// =====================================
// UTILITY FUNCTIONS
// =====================================

/**
 * Gets appropriate color for any status across the application
 * Uses entity-specific mapping when available, falls back to generic
 */
export const getStatusColor = (status: string, entityType?: 'project' | 'task' | 'idea' | 'support' | 'file'): string => {
  switch (entityType) {
    case 'project': return getProjectStatusColor(status);
    case 'task': return getTaskStatusColor(status);
    case 'idea': return getIdeaStatusColor(status);
    case 'support': return getSupportStatusColor(status);
    case 'file': return getFileStatusColor(status);
    default: return getGenericStatusColor(status);
  }
};

/**
 * Converts Ant Design color names to hex codes for use in custom styles
 */
export const COLOR_HEX_MAP = {
  red: '#f5222d',
  volcano: '#fa541c', 
  orange: '#fa8c16',
  gold: '#faad14',
  yellow: '#fadb14',
  lime: '#a0d911',
  green: '#52c41a',
  cyan: '#13c2c2',
  blue: '#1890ff',
  geekblue: '#2f54eb',
  purple: '#722ed1',
  magenta: '#eb2f96',
  grey: '#8c8c8c',
  gray: '#8c8c8c',
  default: '#d9d9d9'
} as const;

export const getColorHex = (antdColor: string): string => {
  return COLOR_HEX_MAP[antdColor as keyof typeof COLOR_HEX_MAP] || antdColor;
};

// =====================================
// EXPORT ALL FOR CONVENIENCE
// =====================================
export const ColorMappings = {
  // Status functions
  getProjectStatusColor,
  getTaskStatusColor, 
  getIdeaStatusColor,
  getSupportStatusColor,
  getFileStatusColor,
  getGenericStatusColor,
  getStatusColor,
  
  // Priority & Role functions
  getPriorityColor,
  getRoleColor,
  
  // Performance functions
  getProgressColor,
  getROIColor,
  getBudgetVarianceColor,
  
  // Utility functions
  getColorHex,
  
  // Color constants
  PROJECT_STATUS_COLORS,
  TASK_STATUS_COLORS,
  IDEA_STATUS_COLORS,
  SUPPORT_STATUS_COLORS,
  PRIORITY_COLORS,
  FILE_STATUS_COLORS,
  GENERIC_STATUS_COLORS,
  PROGRESS_COLORS,
  FINANCIAL_COLORS,
  ROLE_COLORS,
  COLOR_HEX_MAP
} as const;

export default ColorMappings;