-- CRITICAL FIX: Restore PMO Gantt Chart Functionality
-- This fixes the "Failed to get project Gantt data" error in PMO Dashboard
-- Missing table: project_dependencies

BEGIN TRANSACTION;

-- ===========================================
-- CREATE MISSING PROJECT_DEPENDENCIES TABLE
-- ===========================================
-- This table is required for Gantt chart project dependencies visualization
CREATE TABLE IF NOT EXISTS project_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_project_id INTEGER NOT NULL,
    dependent_project_id INTEGER NOT NULL,
    dependency_type VARCHAR(30) DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    description TEXT,
    is_critical BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (source_project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (dependent_project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(source_project_id, dependent_project_id)
);

-- ===========================================
-- VERIFY OTHER GANTT-RELATED TABLES EXIST
-- ===========================================

-- Ensure project_milestones table exists (should already exist)
CREATE TABLE IF NOT EXISTS project_milestones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    milestone_type VARCHAR(50) DEFAULT 'delivery' CHECK (milestone_type IN ('delivery', 'demo', 'review', 'go_live', 'checkpoint', 'deadline')),
    planned_date DATE NOT NULL,
    actual_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    responsible_user_id INTEGER,
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    impact_on_timeline INTEGER DEFAULT 0,
    responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external', 'shared')),
    blocking_reason TEXT,
    delay_justification TEXT,
    external_contact VARCHAR(200),
    estimated_delay_days INTEGER DEFAULT 0,
    financial_impact DECIMAL(10,2) DEFAULT 0,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Ensure task_dependencies table exists (should already exist)
CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    predecessor_id INTEGER NOT NULL,
    successor_id INTEGER NOT NULL,
    dependency_type VARCHAR(20) DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
    lag_days INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (predecessor_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (successor_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE(predecessor_id, successor_id)
);

-- ===========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ===========================================

-- Project dependencies indexes
CREATE INDEX IF NOT EXISTS idx_project_dependencies_source ON project_dependencies(source_project_id);
CREATE INDEX IF NOT EXISTS idx_project_dependencies_dependent ON project_dependencies(dependent_project_id);
CREATE INDEX IF NOT EXISTS idx_project_dependencies_critical ON project_dependencies(is_critical);

-- Project milestones indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_project_milestones_status ON project_milestones(status);
CREATE INDEX IF NOT EXISTS idx_project_milestones_planned_date ON project_milestones(planned_date);
CREATE INDEX IF NOT EXISTS idx_project_milestones_responsible ON project_milestones(responsible_user_id);

-- Task dependencies indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_task_dependencies_predecessor ON task_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor ON task_dependencies(successor_id);

-- ===========================================
-- ADD SAMPLE PROJECT DEPENDENCIES FOR TESTING
-- ===========================================

-- Add sample project dependencies between existing projects
-- This will help test the Gantt chart functionality immediately
INSERT OR IGNORE INTO project_dependencies (source_project_id, dependent_project_id, dependency_type, description, is_critical)
SELECT 
    1 as source_project_id, -- First project
    2 as dependent_project_id, -- Second project depends on first
    'finish_to_start' as dependency_type,
    'Project 2 cannot start until Project 1 is completed' as description,
    1 as is_critical
WHERE 
    EXISTS (SELECT 1 FROM projects WHERE id = 1) 
    AND EXISTS (SELECT 1 FROM projects WHERE id = 2);

-- Add some sample milestones for testing if projects exist but have no milestones
INSERT OR IGNORE INTO project_milestones (project_id, name, description, milestone_type, planned_date, status, priority, created_by)
SELECT 
    p.id as project_id,
    'Project Kickoff' as name,
    'Initial project kickoff meeting and planning session' as description,
    'checkpoint' as milestone_type,
    COALESCE(p.start_date, DATE('now', '+7 days')) as planned_date,
    'pending' as status,
    'high' as priority,
    1 as created_by
FROM projects p
WHERE p.id IN (1, 2) 
    AND NOT EXISTS (SELECT 1 FROM project_milestones WHERE project_id = p.id);

INSERT OR IGNORE INTO project_milestones (project_id, name, description, milestone_type, planned_date, status, priority, created_by)
SELECT 
    p.id as project_id,
    'Mid-Project Review' as name,
    'Review project progress and adjust timeline if needed' as description,
    'review' as milestone_type,
    COALESCE(DATE(p.start_date, '+30 days'), DATE('now', '+37 days')) as planned_date,
    'pending' as status,
    'medium' as priority,
    1 as created_by
FROM projects p
WHERE p.id IN (1, 2) 
    AND NOT EXISTS (SELECT 1 FROM project_milestones WHERE project_id = p.id AND name = 'Mid-Project Review');

INSERT OR IGNORE INTO project_milestones (project_id, name, description, milestone_type, planned_date, status, priority, created_by)
SELECT 
    p.id as project_id,
    'Project Delivery' as name,
    'Final project delivery and client handover' as description,
    'delivery' as milestone_type,
    COALESCE(p.end_date, DATE('now', '+60 days')) as planned_date,
    'pending' as status,
    'critical' as priority,
    1 as created_by
FROM projects p
WHERE p.id IN (1, 2) 
    AND NOT EXISTS (SELECT 1 FROM project_milestones WHERE project_id = p.id AND name = 'Project Delivery');

COMMIT;

-- ===========================================
-- VERIFICATION QUERIES
-- ===========================================

-- Verify project_dependencies table was created
SELECT 'project_dependencies table created successfully' as status;
SELECT COUNT(*) as dependency_count FROM project_dependencies;

-- Verify sample data was inserted
SELECT 'Sample project dependencies:' as info;
SELECT 
    pd.*,
    sp.name as source_project_name,
    dp.name as dependent_project_name
FROM project_dependencies pd
JOIN projects sp ON pd.source_project_id = sp.id
JOIN projects dp ON pd.dependent_project_id = dp.id;

-- Verify milestones exist
SELECT 'Project milestones:' as info;
SELECT 
    pm.project_id,
    p.name as project_name,
    COUNT(*) as milestone_count
FROM project_milestones pm
JOIN projects p ON pm.project_id = p.id
GROUP BY pm.project_id, p.name;

SELECT 'Gantt Chart functionality should now be restored!' as final_status;