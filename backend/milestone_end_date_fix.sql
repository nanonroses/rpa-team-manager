-- Add end_date field to project_milestones table to support milestone date ranges
-- This fixes the Mermaid import milestone end date calculation issue

BEGIN TRANSACTION;

-- Add end_date column to project_milestones table
ALTER TABLE project_milestones ADD COLUMN end_date DATE;

-- Initialize end_date with planned_date for existing milestones (since milestones typically have the same start and end date)
UPDATE project_milestones SET end_date = planned_date WHERE end_date IS NULL;

-- Add index for better query performance on end_date
CREATE INDEX IF NOT EXISTS idx_project_milestones_end_date ON project_milestones(end_date);

COMMIT;

-- Verify the column was added successfully
SELECT sql FROM sqlite_master WHERE type='table' AND name='project_milestones';