export interface Project {
  id: number;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  budget?: number;
  start_date?: string;
  end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  progress_percentage: number;
  created_by: number;
  assigned_to?: number;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  created_by_name?: string;
  assigned_to_name?: string;
  total_tasks?: number;
  completed_tasks?: number;
  total_hours_logged?: number;
  
  // Financial data
  budget_allocated?: number;
  budget_spent?: number;
  hours_budgeted?: number;
  hours_spent?: number;
  delay_cost?: number;
  penalty_cost?: number;
  sale_price?: number;
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface TaskBoard {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  board_type: 'kanban' | 'scrum' | 'custom';
  is_default: boolean;
  created_at: string;
}

export interface TaskColumn {
  id: number;
  board_id: number;
  name: string;
  position: number;
  color: string;
  is_done_column: boolean;
  wip_limit?: number;
  created_at: string;
}

export interface Task {
  id: number;
  board_id: number;
  column_id: number;
  title: string;
  description?: string;
  task_type: TaskType;
  status: TaskStatus;
  priority: Priority;
  assignee_id?: number;
  reporter_id: number;
  story_points?: number;
  estimated_hours?: number;
  actual_hours?: number;
  start_date?: string;
  due_date?: string;
  completed_date?: string;
  position: number;
  tags?: string;
  labels?: string;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  assignee_name?: string;
  reporter_name?: string;
  column_name?: string;
}

export type TaskType = 'task' | 'bug' | 'feature' | 'research' | 'documentation';

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'testing' | 'done' | 'blocked';

export interface TaskDependency {
  id: number;
  predecessor_id: number;
  successor_id: number;
  dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
  lag_days: number;
  created_at: string;
  
  // Joined fields
  predecessor_title?: string;
  successor_title?: string;
}

export const ProjectStatusLabels: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const PriorityLabels: Record<Priority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export const TaskTypeLabels: Record<TaskType, string> = {
  task: 'Task',
  bug: 'Bug',
  feature: 'Feature',
  research: 'Research',
  documentation: 'Documentation'
};

export const TaskStatusLabels: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  testing: 'Testing',
  done: 'Done',
  blocked: 'Blocked'
};