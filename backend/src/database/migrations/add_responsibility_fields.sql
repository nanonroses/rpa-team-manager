-- Migration: Add responsibility and external dependency fields to project_milestones
-- Date: 2025-08-23

-- Add responsibility tracking fields
ALTER TABLE project_milestones ADD COLUMN responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external', 'shared'));

-- Add external dependency tracking fields
ALTER TABLE project_milestones ADD COLUMN blocking_reason TEXT;
ALTER TABLE project_milestones ADD COLUMN delay_justification TEXT;
ALTER TABLE project_milestones ADD COLUMN external_contact VARCHAR(200);
ALTER TABLE project_milestones ADD COLUMN estimated_delay_days INTEGER DEFAULT 0;
ALTER TABLE project_milestones ADD COLUMN financial_impact DECIMAL(10,2) DEFAULT 0;

-- Update existing milestones to have 'internal' responsibility by default
UPDATE project_milestones SET responsibility = 'internal' WHERE responsibility IS NULL;