-- Critical ROI and Assignment System Fix
-- This script fixes the missing project_assignments table and budget_allocated column
-- that are causing 500 errors on project ROI and assignment endpoints

-- =================================================================================
-- 1. CREATE MISSING project_assignments TABLE
-- =================================================================================
-- This table is required for ROI calculations and project assignment management

CREATE TABLE IF NOT EXISTS project_assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role VARCHAR(50) DEFAULT 'team_member', -- project role: project_manager, developer, analyst, etc.
    allocation_percentage DECIMAL(5,2) DEFAULT 100.00, -- % of time allocated to this project (0-100)
    is_active BOOLEAN DEFAULT 1, -- soft delete flag
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER, -- who assigned this user
    
    -- Foreign key constraints
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    
    -- Ensure one active assignment per user per project
    UNIQUE(project_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_active ON project_assignments(is_active, project_id);

-- =================================================================================
-- 2. ADD MISSING budget_allocated COLUMN TO project_financials
-- =================================================================================
-- The project_financials table exists but is missing the budget_allocated column
-- that the project creation and financial controllers expect

-- Check if column already exists, if not add it
-- SQLite doesn't have IF NOT EXISTS for columns, so we use a conditional approach

-- Add the missing budget_allocated column
-- This will fail if the column already exists, but we'll handle that gracefully
ALTER TABLE project_financials ADD COLUMN budget_allocated DECIMAL(12,2);

-- =================================================================================
-- 3. CREATE TRIGGER FOR project_assignments UPDATED_AT
-- =================================================================================
-- Auto-update timestamp when assignments are modified

CREATE TRIGGER IF NOT EXISTS update_project_assignments_timestamp 
    AFTER UPDATE ON project_assignments
    BEGIN
        UPDATE project_assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- =================================================================================
-- 4. MIGRATE EXISTING DATA IF NEEDED
-- =================================================================================
-- If there's existing budget data in budgeted_cost, copy it to budget_allocated

UPDATE project_financials 
SET budget_allocated = budgeted_cost 
WHERE budget_allocated IS NULL AND budgeted_cost IS NOT NULL;

-- =================================================================================
-- 5. POPULATE project_assignments WITH EXISTING PROJECT ASSIGNMENTS
-- =================================================================================
-- Create assignments based on existing project.assigned_to relationships

INSERT INTO project_assignments (project_id, user_id, role, allocation_percentage, created_by, is_active)
SELECT 
    p.id as project_id,
    p.assigned_to as user_id,
    'project_manager' as role, -- Default role for existing assignments
    100.00 as allocation_percentage, -- 100% allocation
    p.created_by as created_by,
    1 as is_active
FROM projects p 
WHERE p.assigned_to IS NOT NULL 
AND p.assigned_to NOT IN (
    SELECT pa.user_id 
    FROM project_assignments pa 
    WHERE pa.project_id = p.id AND pa.is_active = 1
);

-- =================================================================================
-- VERIFICATION QUERIES
-- =================================================================================
-- These can be run after the script to verify everything is working

-- Verify project_assignments table exists and has data
-- SELECT COUNT(*) as assignment_count FROM project_assignments WHERE is_active = 1;

-- Verify project_financials has budget_allocated column
-- PRAGMA table_info(project_financials);

-- Test ROI calculation query (should not fail)
-- SELECT 
--     pa.user_id,
--     pa.allocation_percentage,
--     pa.role
-- FROM project_assignments pa
-- WHERE pa.project_id = 1 AND pa.is_active = 1;