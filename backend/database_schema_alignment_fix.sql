-- CRITICAL SCHEMA ALIGNMENT FIX
-- Aligns database structure with controller expectations
-- This fixes the remaining 500 errors

BEGIN TRANSACTION;

-- ===========================================
-- FIX project_financials table structure
-- ===========================================

-- Drop and recreate project_financials with correct structure
DROP TABLE IF EXISTS project_financials;

CREATE TABLE project_financials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE,
    budgeted_hours DECIMAL(8,2) DEFAULT 0,
    budgeted_cost DECIMAL(12,2) DEFAULT 0,
    budgeted_cost_currency VARCHAR(3) DEFAULT 'CLP' CHECK (budgeted_cost_currency IN ('USD', 'CLP', 'UF')),
    sale_price DECIMAL(12,2),
    sale_price_currency VARCHAR(3) DEFAULT 'CLP' CHECK (sale_price_currency IN ('USD', 'CLP', 'UF')),
    hourly_rate DECIMAL(10,2),
    hourly_rate_currency VARCHAR(3) DEFAULT 'CLP' CHECK (hourly_rate_currency IN ('USD', 'CLP', 'UF')),
    actual_cost DECIMAL(12,2) DEFAULT 0,
    roi_percentage DECIMAL(5,2) DEFAULT 0,
    profit_margin DECIMAL(12,2) DEFAULT 0,
    delay_cost DECIMAL(10,2) DEFAULT 0,
    penalty_cost DECIMAL(10,2) DEFAULT 0,
    delay_days INTEGER DEFAULT 0,
    efficiency_percentage DECIMAL(5,2) DEFAULT 0,
    cost_per_hour DECIMAL(8,2) DEFAULT 0,
    responsible_user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ===========================================
-- FIX ideas table structure  
-- ===========================================

-- Drop and recreate ideas table with correct structure
DROP TABLE IF EXISTS ideas;

CREATE TABLE ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    priority_matrix VARCHAR(20) DEFAULT 'low-effort-high-value' CHECK (priority_matrix IN ('low-effort-high-value', 'low-effort-low-value', 'high-effort-high-value', 'high-effort-low-value')),
    impact_score INTEGER DEFAULT 1 CHECK (impact_score >= 1 AND impact_score <= 5),
    effort_score INTEGER DEFAULT 1 CHECK (effort_score >= 1 AND effort_score <= 5),
    priority_score DECIMAL(3,2) DEFAULT 1.0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'in_progress', 'done', 'rejected')),
    created_by INTEGER NOT NULL,
    assigned_to INTEGER NULL,
    votes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    estimated_effort_hours DECIMAL(5,2),
    potential_value VARCHAR(10) DEFAULT 'medium' CHECK (potential_value IN ('low', 'medium', 'high')),
    converted_to_task_id INTEGER,
    converted_to_project_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (converted_to_task_id) REFERENCES tasks(id),
    FOREIGN KEY (converted_to_project_id) REFERENCES projects(id)
);

-- ===========================================
-- RECREATE RELATED INDEXES AND TRIGGERS
-- ===========================================

-- Indexes for ideas
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_created_by ON ideas(created_by);
CREATE INDEX IF NOT EXISTS idx_ideas_priority ON ideas(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_assigned ON ideas(assigned_to);

-- Recreate idea vote triggers (they were dropped when ideas table was dropped)
CREATE TRIGGER IF NOT EXISTS update_idea_vote_count_insert
    AFTER INSERT ON idea_votes
    FOR EACH ROW
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes 
            WHERE idea_id = NEW.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes 
            WHERE idea_id = NEW.idea_id AND vote_type = 'down'
        ) WHERE id = NEW.idea_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_idea_vote_count_update
    AFTER UPDATE ON idea_votes
    FOR EACH ROW
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes 
            WHERE idea_id = NEW.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes 
            WHERE idea_id = NEW.idea_id AND vote_type = 'down'
        ) WHERE id = NEW.idea_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_idea_vote_count_delete
    AFTER DELETE ON idea_votes
    FOR EACH ROW
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes 
            WHERE idea_id = OLD.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes 
            WHERE idea_id = OLD.idea_id AND vote_type = 'down'
        ) WHERE id = OLD.idea_id;
    END;

-- Timestamps trigger for ideas
CREATE TRIGGER IF NOT EXISTS update_ideas_timestamp 
    AFTER UPDATE ON ideas
    FOR EACH ROW
    BEGIN
        UPDATE ideas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Priority score calculation trigger
CREATE TRIGGER IF NOT EXISTS calculate_idea_priority_insert
    AFTER INSERT ON ideas
    FOR EACH ROW
    BEGIN
        UPDATE ideas SET priority_score = CAST(NEW.impact_score AS DECIMAL) / CAST(NEW.effort_score AS DECIMAL) WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS calculate_idea_priority_update
    AFTER UPDATE OF impact_score, effort_score ON ideas
    FOR EACH ROW
    BEGIN
        UPDATE ideas SET priority_score = CAST(NEW.impact_score AS DECIMAL) / CAST(NEW.effort_score AS DECIMAL) WHERE id = NEW.id;
    END;

-- ===========================================
-- SEED SAMPLE DATA 
-- ===========================================

-- Add sample financial data for existing projects
INSERT OR IGNORE INTO project_financials (project_id, sale_price, hourly_rate, budgeted_hours, created_by)
SELECT 
    p.id,
    COALESCE(p.budget, 50000.00) * 1.2, -- Sale price 20% above budget
    75.00, -- Default hourly rate
    160.00, -- Default budgeted hours
    1 -- Admin user
FROM projects p
WHERE p.status IN ('active', 'planning', 'completed');

-- Add sample ideas
INSERT OR IGNORE INTO ideas (title, description, category, priority_matrix, impact_score, effort_score, status, created_by)
VALUES 
('Automated Invoice Processing', 'Implement RPA bot to process vendor invoices automatically', 'Automation', 'high-effort-high-value', 5, 4, 'under_review', 1),
('Employee Onboarding Bot', 'Create automated workflow for new employee setup', 'HR Automation', 'low-effort-high-value', 4, 2, 'approved', 1),
('Data Migration Tool', 'Build tool to migrate legacy system data', 'Data Management', 'high-effort-high-value', 4, 5, 'draft', 2),
('Email Classification System', 'Auto-categorize incoming support emails', 'AI/ML', 'low-effort-low-value', 2, 2, 'draft', 3);

COMMIT;

-- ===========================================
-- VERIFICATION
-- ===========================================
-- Check that tables have correct structure
-- SELECT 'project_financials columns:' as info;
-- PRAGMA table_info(project_financials);
-- SELECT 'ideas columns:' as info;  
-- PRAGMA table_info(ideas);