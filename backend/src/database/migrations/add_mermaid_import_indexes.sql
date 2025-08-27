-- Migration: Add indexes for Mermaid import optimization
-- These indexes improve performance for batch operations during Mermaid import

-- Index for project milestones project lookups (used heavily in batch creation)
CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);

-- Index for milestone date-based queries and sorting
CREATE INDEX IF NOT EXISTS idx_project_milestones_planned_date ON project_milestones(planned_date);

-- Index for milestone status and date combinations (for dashboard queries)
CREATE INDEX IF NOT EXISTS idx_project_milestones_status_date ON project_milestones(status, planned_date);

-- Composite index for task board and column operations (position calculations)
CREATE INDEX IF NOT EXISTS idx_tasks_board_column ON tasks(board_id, column_id);

-- Index for task position calculations within columns
CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column_id, position);

-- Index for task date-based queries during Gantt operations
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, due_date);

-- Index for project board relationships (used in board lookups)
CREATE INDEX IF NOT EXISTS idx_task_boards_project ON task_boards(project_id);