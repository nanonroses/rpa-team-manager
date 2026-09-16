-- CRITICAL DATABASE FIX FOR RPA TEAM MANAGER
-- Fixes 500 errors by creating missing tables and columns
-- Execute this script to restore full functionality

BEGIN TRANSACTION;

-- ===========================================
-- MIGRATION v9: Create user_cost_rates table
-- ===========================================
CREATE TABLE IF NOT EXISTS user_cost_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    monthly_cost DECIMAL(10,2) NOT NULL,
    monthly_cost_currency VARCHAR(3) DEFAULT 'CLP' CHECK (monthly_cost_currency IN ('USD', 'CLP', 'UF')),
    hourly_rate DECIMAL(8,2) NOT NULL,
    hourly_rate_currency VARCHAR(3) DEFAULT 'CLP' CHECK (hourly_rate_currency IN ('USD', 'CLP', 'UF')),
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_cost_rates_user ON user_cost_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cost_rates_active ON user_cost_rates(is_active, effective_from, effective_to);

CREATE TRIGGER IF NOT EXISTS update_user_cost_rates_timestamp 
    AFTER UPDATE ON user_cost_rates
    BEGIN
        UPDATE user_cost_rates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ===========================================
-- MIGRATION v10: Create project_pmo_metrics and project_financials
-- ===========================================
CREATE TABLE IF NOT EXISTS project_pmo_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE,
    planned_hours DECIMAL(8,2) DEFAULT 0,
    planned_start_date DATE,
    planned_end_date DATE,
    planned_budget DECIMAL(12,2) DEFAULT 0,
    actual_hours DECIMAL(8,2) DEFAULT 0,
    actual_start_date DATE,
    actual_end_date DATE,
    actual_cost DECIMAL(12,2) DEFAULT 0,
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    completed_tasks INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    schedule_variance_days INTEGER DEFAULT 0,
    cost_variance_percentage DECIMAL(5,2) DEFAULT 0,
    scope_variance_percentage DECIMAL(5,2) DEFAULT 0,
    risk_level VARCHAR(10) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_factors TEXT,
    bugs_found INTEGER DEFAULT 0,
    bugs_resolved INTEGER DEFAULT 0,
    client_satisfaction_score INTEGER CHECK (client_satisfaction_score >= 1 AND client_satisfaction_score <= 10),
    team_velocity DECIMAL(5,2) DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Note: project_financials table already exists, but ensure it has roi_percentage column
-- Check if roi_percentage column exists, if not add it
ALTER TABLE project_financials ADD COLUMN roi_percentage DECIMAL(5,2) DEFAULT 0;

-- ===========================================
-- MISSING TABLES: idea_votes and files
-- ===========================================

-- Create idea_votes table
CREATE TABLE IF NOT EXISTS idea_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(idea_id, user_id),
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add votes_count column to ideas table if it doesn't exist
ALTER TABLE ideas ADD COLUMN votes_count INTEGER DEFAULT 0;

-- Create files table
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    checksum VARCHAR(64),
    category_id INTEGER,
    uploaded_by INTEGER NOT NULL,
    is_deleted BOOLEAN DEFAULT 0,
    version INTEGER DEFAULT 1,
    parent_file_id INTEGER,
    description TEXT,
    tags TEXT,
    metadata_json TEXT,
    download_count INTEGER DEFAULT 0,
    last_accessed DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES file_categories(id),
    FOREIGN KEY (parent_file_id) REFERENCES files(id)
);

-- Create file_categories table
CREATE TABLE IF NOT EXISTS file_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) DEFAULT '#gray',
    icon VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create file_associations table for linking files to projects/tasks/ideas
CREATE TABLE IF NOT EXISTS file_associations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('project', 'task', 'idea', 'user', 'support_ticket')),
    entity_id INTEGER NOT NULL,
    association_type VARCHAR(20) DEFAULT 'attachment' CHECK (association_type IN ('attachment', 'reference', 'output', 'documentation')),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(file_id, entity_type, entity_id, association_type)
);

-- ===========================================
-- INDEXES AND TRIGGERS FOR PERFORMANCE
-- ===========================================

-- Indexes for idea_votes
CREATE INDEX IF NOT EXISTS idx_idea_votes_idea ON idea_votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_votes_user ON idea_votes(user_id);

-- Indexes for files
CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category_id);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(is_deleted);
CREATE INDEX IF NOT EXISTS idx_files_parent ON files(parent_file_id);

-- Indexes for file_associations
CREATE INDEX IF NOT EXISTS idx_file_associations_file ON file_associations(file_id);
CREATE INDEX IF NOT EXISTS idx_file_associations_entity ON file_associations(entity_type, entity_id);

-- Triggers to update votes_count in ideas table
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

-- Update file timestamps
CREATE TRIGGER IF NOT EXISTS update_files_timestamp 
    AFTER UPDATE ON files
    FOR EACH ROW
    BEGIN
        UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- ===========================================
-- SEED ESSENTIAL DATA
-- ===========================================

-- Insert default file categories
INSERT OR IGNORE INTO file_categories (name, description, color, icon) VALUES
('Documents', 'General documentation and text files', '#blue', 'file-text'),
('Images', 'Screenshots, diagrams, and images', '#green', 'image'),
('Code', 'Source code and scripts', '#purple', 'code'),
('Data', 'Databases, CSV, and data files', '#orange', 'database'),
('Archives', 'ZIP, RAR, and compressed files', '#gray', 'archive'),
('Presentations', 'PowerPoint, PDF presentations', '#red', 'presentation');

-- Insert user cost rates for existing users (if they don't exist)
INSERT OR IGNORE INTO user_cost_rates (user_id, monthly_cost, hourly_rate, effective_from, created_by)
SELECT 
    u.id,
    CASE 
        WHEN u.role = 'team_lead' THEN 8000.00
        WHEN u.role = 'rpa_developer' THEN 6000.00
        WHEN u.role = 'rpa_operations' THEN 5000.00
        WHEN u.role = 'it_support' THEN 4000.00
        ELSE 5000.00
    END,
    CASE 
        WHEN u.role = 'team_lead' THEN 50.00
        WHEN u.role = 'rpa_developer' THEN 37.50
        WHEN u.role = 'rpa_operations' THEN 31.25
        WHEN u.role = 'it_support' THEN 25.00
        ELSE 31.25
    END,
    DATE('now'),
    1
FROM users u
WHERE u.is_active = 1;

-- Update applied migrations table to reflect these fixes
INSERT OR IGNORE INTO schema_migrations (version, description) VALUES
(8, 'Agregar índices para optimización de importación Mermaid'),
(9, 'Agregar tabla user_cost_rates para costos de empleados'),
(10, 'Agregar project_pmo_metrics y project_financials con roi_percentage'),
(11, 'CRITICAL FIX: Add missing idea_votes, files tables and votes_count column');

COMMIT;

-- ===========================================
-- VERIFICATION QUERIES (OPTIONAL - for manual verification)
-- ===========================================

-- Verify all critical tables exist
-- SELECT name FROM sqlite_master WHERE type='table' AND name IN ('user_cost_rates', 'idea_votes', 'files', 'file_categories', 'file_associations', 'project_pmo_metrics');

-- Verify ideas table has votes_count column
-- PRAGMA table_info(ideas);

-- Verify user cost rates have been seeded
-- SELECT u.full_name, u.role, ucr.monthly_cost, ucr.hourly_rate FROM users u LEFT JOIN user_cost_rates ucr ON u.id = ucr.user_id WHERE u.is_active = 1;