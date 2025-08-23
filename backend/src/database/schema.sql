-- RPA Team Manager Database Schema
-- Optimized for 5-person teams with SQLite

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Users table (5 predefined users)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('team_lead', 'rpa_developer', 'rpa_operations', 'it_support')),
    full_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(255),
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    budget DECIMAL(12,2),
    start_date DATE,
    end_date DATE,
    actual_start_date DATE,
    actual_end_date DATE,
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- Task boards (Kanban style)
CREATE TABLE IF NOT EXISTS task_boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    board_type VARCHAR(20) DEFAULT 'kanban' CHECK (board_type IN ('kanban', 'scrum', 'custom')),
    is_default BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Task columns for boards
CREATE TABLE IF NOT EXISTS task_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL,
    color VARCHAR(7) DEFAULT '#gray',
    is_done_column BOOLEAN DEFAULT 0,
    wip_limit INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES task_boards(id) ON DELETE CASCADE
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL,
    column_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(20) DEFAULT 'task' CHECK (task_type IN ('task', 'bug', 'feature', 'research', 'documentation')),
    status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'testing', 'done', 'blocked')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    
    -- Assignment and responsibility
    assignee_id INTEGER,
    reporter_id INTEGER NOT NULL,
    
    -- Time estimation and tracking
    story_points INTEGER,
    estimated_hours DECIMAL(5,2),
    actual_hours DECIMAL(5,2) DEFAULT 0,
    
    -- Dates
    start_date DATETIME,
    due_date DATETIME,
    completed_date DATETIME,
    
    -- Position in column
    position INTEGER NOT NULL DEFAULT 0,
    
    -- Tags and labels
    tags TEXT, -- JSON array of tags
    labels TEXT, -- JSON array of labels
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (board_id) REFERENCES task_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (column_id) REFERENCES task_columns(id),
    FOREIGN KEY (assignee_id) REFERENCES users(id),
    FOREIGN KEY (reporter_id) REFERENCES users(id)
);

-- Task dependencies for Gantt charts
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

-- Time entries for time tracking
CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER,
    project_id INTEGER,
    description TEXT,
    hours DECIMAL(5,2) NOT NULL CHECK (hours >= 0),
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_billable BOOLEAN DEFAULT 1,
    hourly_rate DECIMAL(8,2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Issues and problems tracking
CREATE TABLE IF NOT EXISTS issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    task_id INTEGER,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    issue_type VARCHAR(20) DEFAULT 'issue' CHECK (issue_type IN ('bug', 'issue', 'impediment', 'risk')),
    severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('critical', 'major', 'minor', 'trivial')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
    
    -- Responsibility tracking (key for your requirements)
    responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external', 'shared')),
    
    -- Financial impact
    financial_impact DECIMAL(10,2) DEFAULT 0,
    delay_days INTEGER DEFAULT 0,
    
    -- Assignment
    reported_by INTEGER NOT NULL,
    assigned_to INTEGER,
    
    -- Resolution
    resolution TEXT,
    resolved_date DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (reported_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- Comments for tasks, projects, issues
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'project', 'issue')),
    entity_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT 0, -- For internal team comments vs client-visible
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- File attachments
CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'project', 'issue', 'comment')),
    entity_id INTEGER NOT NULL,
    uploaded_by INTEGER NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    is_evidence BOOLEAN DEFAULT 0, -- Mark as evidence for delay justification
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    entity_type VARCHAR(20) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL, -- created, updated, deleted, assigned, completed, etc.
    old_values TEXT, -- JSON
    new_values TEXT, -- JSON
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User sessions for JWT token management
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    entity_type VARCHAR(20),
    entity_id INTEGER,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Project financial tracking
CREATE TABLE IF NOT EXISTS project_financials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    
    -- Budget and costs
    budget_allocated DECIMAL(12,2),
    budget_spent DECIMAL(12,2) DEFAULT 0,
    hours_budgeted DECIMAL(8,2),
    hours_spent DECIMAL(8,2) DEFAULT 0,
    
    -- ROI calculations
    sale_price DECIMAL(12,2), -- Precio de venta del proyecto
    sale_price_currency VARCHAR(3) DEFAULT 'CLP' CHECK (sale_price_currency IN ('USD', 'CLP', 'UF')), -- Moneda del precio de venta
    hourly_rate DECIMAL(10,2), -- Valor por hora que se cobra al cliente
    hourly_rate_currency VARCHAR(3) DEFAULT 'CLP' CHECK (hourly_rate_currency IN ('USD', 'CLP', 'UF')), -- Moneda del valor por hora
    actual_cost DECIMAL(12,2) DEFAULT 0, -- Costo real basado en horas × tarifa
    roi_percentage DECIMAL(5,2) DEFAULT 0, -- ROI calculado
    profit_margin DECIMAL(12,2) DEFAULT 0, -- Margen de ganancia
    
    -- Delay and penalty costs
    delay_cost DECIMAL(10,2) DEFAULT 0,
    penalty_cost DECIMAL(10,2) DEFAULT 0,
    delay_days INTEGER DEFAULT 0,
    
    -- Efficiency metrics
    efficiency_percentage DECIMAL(5,2) DEFAULT 0, -- Eficiencia: horas presupuestadas vs reales
    cost_per_hour DECIMAL(8,2) DEFAULT 0, -- Costo promedio por hora del proyecto
    
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Team member cost rates (solo visible para team_lead)
CREATE TABLE IF NOT EXISTS user_cost_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    monthly_cost DECIMAL(10,2) NOT NULL, -- Costo mensual del empleado
    monthly_cost_currency VARCHAR(3) DEFAULT 'CLP' CHECK (monthly_cost_currency IN ('USD', 'CLP', 'UF')), -- Moneda del sueldo mensual
    hourly_rate DECIMAL(8,2) NOT NULL, -- Costo por hora (calculado automáticamente: monthly_cost / horas_mensuales)
    hourly_rate_currency VARCHAR(3) DEFAULT 'CLP' CHECK (hourly_rate_currency IN ('USD', 'CLP', 'UF')), -- Moneda del costo por hora
    effective_from DATE NOT NULL, -- Fecha desde cuando aplica esta tarifa
    effective_to DATE, -- Fecha hasta cuando aplica (NULL = vigente)
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER NOT NULL, -- Solo team_lead puede crear/modificar
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ROI alerts and notifications
CREATE TABLE IF NOT EXISTS roi_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'cost_overrun', 'delay_risk', 'low_roi', 'profitability_warning'
    alert_level VARCHAR(20) DEFAULT 'warning' CHECK (alert_level IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    threshold_value DECIMAL(10,2), -- Valor que disparó la alerta
    current_value DECIMAL(10,2), -- Valor actual
    is_resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME,
    resolved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Global settings table (admin-only configuration)
CREATE TABLE IF NOT EXISTS global_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value VARCHAR(255) NOT NULL,
    setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'decimal', 'boolean')),
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Ideas management system
CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('automation', 'process_improvement', 'tool_enhancement', 'cost_reduction', 'productivity', 'general')),
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'in_progress', 'done', 'rejected')),
    
    -- Priority scoring
    impact_score INTEGER DEFAULT 3 CHECK (impact_score BETWEEN 1 AND 5),
    effort_score INTEGER DEFAULT 3 CHECK (effort_score BETWEEN 1 AND 5),
    priority_score DECIMAL(3,2) DEFAULT 1.0,
    
    -- Voting system
    votes_count INTEGER DEFAULT 0,
    
    -- Assignment
    created_by INTEGER NOT NULL,
    assigned_to INTEGER,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- Idea votes
CREATE TABLE IF NOT EXISTS idea_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(idea_id, user_id),
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Idea comments
CREATE TABLE IF NOT EXISTS idea_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_issues_responsibility ON issues(responsibility);
CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_cost_rates_user ON user_cost_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cost_rates_active ON user_cost_rates(is_active, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_roi_alerts_project ON roi_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_roi_alerts_type ON roi_alerts(alert_type, alert_level);
CREATE INDEX IF NOT EXISTS idx_project_financials_project ON project_financials(project_id);
-- Ideas indexes
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_created_by ON ideas(created_by);
CREATE INDEX IF NOT EXISTS idx_ideas_priority ON ideas(priority_score);
CREATE INDEX IF NOT EXISTS idx_idea_votes_idea ON idea_votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_comments_idea ON idea_comments(idea_id);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects
    BEGIN
        UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_tasks_timestamp 
    AFTER UPDATE ON tasks
    BEGIN
        UPDATE tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_time_entries_timestamp 
    AFTER UPDATE ON time_entries
    BEGIN
        UPDATE time_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_issues_timestamp 
    AFTER UPDATE ON issues
    BEGIN
        UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_user_cost_rates_timestamp 
    AFTER UPDATE ON user_cost_rates
    BEGIN
        UPDATE user_cost_rates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_project_financials_timestamp 
    AFTER UPDATE ON project_financials
    BEGIN
        UPDATE project_financials SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Ideas triggers
CREATE TRIGGER IF NOT EXISTS update_ideas_timestamp 
    AFTER UPDATE ON ideas
    BEGIN
        UPDATE ideas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_idea_comments_timestamp 
    AFTER UPDATE ON idea_comments
    BEGIN
        UPDATE idea_comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Trigger para calcular priority_score automáticamente
CREATE TRIGGER IF NOT EXISTS calculate_priority_score_insert
    AFTER INSERT ON ideas
    BEGIN
        UPDATE ideas SET priority_score = CAST(NEW.impact_score AS DECIMAL) / CAST(NEW.effort_score AS DECIMAL) WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS calculate_priority_score_update
    AFTER UPDATE OF impact_score, effort_score ON ideas
    BEGIN
        UPDATE ideas SET priority_score = CAST(NEW.impact_score AS DECIMAL) / CAST(NEW.effort_score AS DECIMAL) WHERE id = NEW.id;
    END;

-- Trigger para actualizar vote count en ideas
CREATE TRIGGER IF NOT EXISTS update_idea_vote_count_insert
    AFTER INSERT ON idea_votes
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'down'
        ) WHERE id = NEW.idea_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_idea_vote_count_update
    AFTER UPDATE ON idea_votes
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'down'
        ) WHERE id = NEW.idea_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_idea_vote_count_delete
    AFTER DELETE ON idea_votes
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = OLD.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = OLD.idea_id AND vote_type = 'down'
        ) WHERE id = OLD.idea_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_global_settings_timestamp 
    AFTER UPDATE ON global_settings
    BEGIN
        UPDATE global_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Ideas triggers - TEMPORARILY DISABLED
-- CREATE TRIGGER IF NOT EXISTS update_ideas_timestamp (...);
-- All ideas-related triggers commented out for now

-- ========================================
-- FILE MANAGEMENT SYSTEM
-- ========================================

-- Files table - stores all uploaded files and documents
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    file_hash VARCHAR(64) UNIQUE, -- SHA-256 hash to prevent duplicates
    uploaded_by INTEGER NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    is_public BOOLEAN DEFAULT 0,
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- File associations - links files to projects, tasks, or ideas
CREATE TABLE IF NOT EXISTS file_associations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('project', 'task', 'idea', 'user')),
    entity_id INTEGER NOT NULL,
    association_type VARCHAR(30) DEFAULT 'attachment' CHECK (association_type IN (
        'attachment', 'evidence', 'documentation', 'screenshot', 'diagram', 
        'report', 'presentation', 'code', 'config', 'log', 'other'
    )),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(file_id, entity_type, entity_id) -- Prevent duplicate associations
);

-- File versions - track file updates and history
CREATE TABLE IF NOT EXISTS file_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    version_number INTEGER NOT NULL DEFAULT 1,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    uploaded_by INTEGER NOT NULL,
    version_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id),
    UNIQUE(file_id, version_number)
);

-- File access log - track downloads and views
CREATE TABLE IF NOT EXISTS file_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    access_type VARCHAR(20) DEFAULT 'view' CHECK (access_type IN ('view', 'download', 'preview')),
    ip_address VARCHAR(45),
    user_agent TEXT,
    accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- File categories - organize files by type and purpose
CREATE TABLE IF NOT EXISTS file_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(20), -- For UI icons
    color VARCHAR(7), -- Hex color for UI
    allowed_extensions TEXT, -- JSON array of allowed extensions
    max_file_size INTEGER, -- Max size in bytes
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default file categories
INSERT OR IGNORE INTO file_categories (name, description, icon, color, allowed_extensions, max_file_size) VALUES
('documents', 'Documents and Reports', 'FileTextOutlined', '#1890ff', '["pdf","doc","docx","txt","md","rtf"]', 52428800), -- 50MB
('images', 'Screenshots and Images', 'FileImageOutlined', '#52c41a', '["jpg","jpeg","png","gif","bmp","webp","svg"]', 10485760), -- 10MB
('presentations', 'Presentations and Slides', 'FileOutlined', '#faad14', '["ppt","pptx","odp"]', 104857600), -- 100MB
('spreadsheets', 'Spreadsheets and Data', 'FileExcelOutlined', '#13c2c2', '["xls","xlsx","csv","ods"]', 52428800), -- 50MB
('code', 'Code and Scripts', 'FileOutlined', '#722ed1', '["js","ts","py","java","cs","cpp","sql","json","xml","yaml","yml"]', 5242880), -- 5MB
('archives', 'Compressed Archives', 'FileZipOutlined', '#f5222d', '["zip","rar","7z","tar","gz"]', 209715200), -- 200MB
('videos', 'Video Files', 'VideoCameraOutlined', '#eb2f96', '["mp4","avi","mov","wmv","webm"]', 524288000), -- 500MB
('audio', 'Audio Files', 'AudioOutlined', '#fa541c', '["mp3","wav","ogg","m4a"]', 52428800), -- 50MB
('other', 'Other Files', 'FileOutlined', '#8c8c8c', '[]', 104857600); -- 100MB

-- ========================================
-- FILE SYSTEM TRIGGERS
-- ========================================

-- Update file timestamp on update
CREATE TRIGGER IF NOT EXISTS update_files_timestamp
    AFTER UPDATE ON files
    BEGIN
        UPDATE files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update file category timestamp on update  
CREATE TRIGGER IF NOT EXISTS update_file_categories_timestamp
    AFTER UPDATE ON file_categories
    BEGIN
        UPDATE file_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Auto-increment version number for new file versions
-- Note: This is now handled in the application code to avoid trigger complexity

-- ========================================
-- PMO MODULE - PROJECT MANAGEMENT OFFICE
-- ========================================

-- Project milestones - key delivery points and deadlines
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
    impact_on_timeline INTEGER DEFAULT 0, -- Days of impact if delayed
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (responsible_user_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- PMO metrics and tracking data per project
CREATE TABLE IF NOT EXISTS project_pmo_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE,
    
    -- Planning metrics
    planned_hours DECIMAL(8,2) DEFAULT 0,
    planned_start_date DATE,
    planned_end_date DATE,
    planned_budget DECIMAL(12,2) DEFAULT 0,
    
    -- Actual metrics
    actual_hours DECIMAL(8,2) DEFAULT 0,
    actual_start_date DATE,
    actual_end_date DATE,
    actual_cost DECIMAL(12,2) DEFAULT 0,
    
    -- Progress tracking
    completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    completed_tasks INTEGER DEFAULT 0,
    total_tasks INTEGER DEFAULT 0,
    
    -- Variance tracking
    schedule_variance_days INTEGER DEFAULT 0, -- Positive = ahead, Negative = behind
    cost_variance_percentage DECIMAL(5,2) DEFAULT 0, -- Percentage over/under budget
    scope_variance_percentage DECIMAL(5,2) DEFAULT 0, -- Scope creep tracking
    
    -- Risk assessment
    risk_level VARCHAR(10) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_factors TEXT, -- JSON array of risk descriptions
    
    -- Quality metrics
    bugs_found INTEGER DEFAULT 0,
    bugs_resolved INTEGER DEFAULT 0,
    client_satisfaction_score INTEGER CHECK (client_satisfaction_score >= 1 AND client_satisfaction_score <= 10),
    
    -- Team velocity (tasks per week)
    team_velocity DECIMAL(5,2) DEFAULT 0,
    
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- PMO project dependencies
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

-- ========================================
-- SUPPORT MODULE - CUSTOMER SUPPORT MANAGEMENT
-- ========================================

-- Support companies table - stores client companies that receive support
CREATE TABLE IF NOT EXISTS support_companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(50),
    address TEXT,
    
    -- Contract details
    contracted_hours_monthly INTEGER NOT NULL DEFAULT 0, -- Monthly support hours contracted (10, 20, 30, 50)
    hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0, -- Rate per hour in local currency
    hourly_rate_currency VARCHAR(3) DEFAULT 'CLP' CHECK (hourly_rate_currency IN ('USD', 'CLP', 'UF')),
    hourly_rate_extra DECIMAL(10,2) DEFAULT 0, -- Rate per extra hour (over contracted hours)
    
    -- Contract dates
    contract_start_date DATE,
    contract_end_date DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'terminated')),
    
    -- Additional info
    notes TEXT,
    timezone VARCHAR(50) DEFAULT 'America/Santiago',
    preferred_language VARCHAR(10) DEFAULT 'es',
    
    -- Audit fields
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Support tickets table - stores individual support requests
CREATE TABLE IF NOT EXISTS support_tickets (
    id_ticket VARCHAR(20) PRIMARY KEY, -- Custom ticket ID (e.g., "SUP-2025-001")
    id INTEGER UNIQUE NOT NULL, -- Auto-increment numeric ID for internal use
    
    -- Company and basic info
    company_id INTEGER NOT NULL,
    client_name VARCHAR(100) NOT NULL, -- Specific person from the company requesting support
    
    -- Ticket classification
    ticket_type VARCHAR(50) NOT NULL, -- Type of support (bug, enhancement, consultation, maintenance, etc.)
    attention_method VARCHAR(30) NOT NULL, -- Method of attention (email, phone, remote, on-site, chat)
    rpa_process VARCHAR(200), -- RPA process affected/related
    
    -- Assignment and responsibility
    requester VARCHAR(100) NOT NULL, -- Person who requested the support
    resolver_id INTEGER, -- User assigned to resolve the ticket
    
    -- Content
    description TEXT NOT NULL, -- Problem description
    solution TEXT, -- Solution provided
    
    -- Status and lifecycle
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'pending_client', 'resolved', 'closed', 'cancelled')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    
    -- Time tracking
    open_date DATETIME DEFAULT CURRENT_TIMESTAMP, -- When ticket was opened
    close_date DATETIME, -- When ticket was closed
    time_invested_minutes INTEGER DEFAULT 0, -- Time invested in minutes
    hours_calculated DECIMAL(5,2) DEFAULT 0, -- Calculated hours (time_invested_minutes / 60)
    
    -- Financial
    billable_hours DECIMAL(5,2) DEFAULT 0, -- Hours that will be billed to client
    internal_cost DECIMAL(10,2) DEFAULT 0, -- Internal cost based on resolver hourly rate
    client_charge DECIMAL(10,2) DEFAULT 0, -- Amount to charge client
    
    -- Additional info
    urgency_level VARCHAR(20) DEFAULT 'normal' CHECK (urgency_level IN ('low', 'normal', 'high', 'urgent')),
    customer_satisfaction INTEGER CHECK (customer_satisfaction BETWEEN 1 AND 5), -- 1-5 rating
    tags TEXT, -- JSON array of tags
    
    -- Audit fields
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES support_companies(id) ON DELETE CASCADE,
    FOREIGN KEY (resolver_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Support monthly summaries - aggregated data per company per month
CREATE TABLE IF NOT EXISTS support_monthly_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    
    -- Hours tracking
    contracted_hours INTEGER NOT NULL, -- Hours contracted for this month
    consumed_hours DECIMAL(5,2) DEFAULT 0, -- Hours actually consumed
    remaining_hours DECIMAL(5,2) DEFAULT 0, -- Hours remaining
    exceeded_hours DECIMAL(5,2) DEFAULT 0, -- Hours over the contract (if any)
    
    -- Ticket counts
    total_tickets INTEGER DEFAULT 0,
    resolved_tickets INTEGER DEFAULT 0,
    open_tickets INTEGER DEFAULT 0,
    
    -- Financial calculations
    base_monthly_cost DECIMAL(12,2) DEFAULT 0, -- Base cost for contracted hours
    additional_hours_cost DECIMAL(12,2) DEFAULT 0, -- Cost for exceeded hours
    total_monthly_charge DECIMAL(12,2) DEFAULT 0, -- Total amount to charge
    
    -- Status
    is_finalized BOOLEAN DEFAULT 0, -- Whether this month is closed for billing
    invoice_generated BOOLEAN DEFAULT 0,
    invoice_number VARCHAR(50),
    
    -- Audit
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES support_companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, year, month)
);

-- Support ticket comments/updates
CREATE TABLE IF NOT EXISTS support_ticket_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id VARCHAR(20) NOT NULL, -- References support_tickets.id_ticket
    user_id INTEGER NOT NULL,
    comment_type VARCHAR(20) DEFAULT 'comment' CHECK (comment_type IN ('comment', 'status_change', 'assignment', 'time_log', 'resolution')),
    content TEXT NOT NULL,
    time_spent_minutes INTEGER DEFAULT 0, -- Time spent for this specific update
    is_internal BOOLEAN DEFAULT 0, -- Internal comment vs client-visible
    is_solution BOOLEAN DEFAULT 0, -- Mark as solution comment
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id_ticket) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Support RPA processes - catalog for dropdown (company-specific)
CREATE TABLE IF NOT EXISTS support_rpa_processes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    process_name VARCHAR(200) NOT NULL,
    process_description TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES support_companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, process_name)
);

-- Support company contacts/requesters
CREATE TABLE IF NOT EXISTS support_company_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    contact_email VARCHAR(100),
    contact_phone VARCHAR(50),
    position VARCHAR(100),
    is_primary BOOLEAN DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (company_id) REFERENCES support_companies(id) ON DELETE CASCADE,
    UNIQUE(company_id, contact_name)
);

-- Note: RPA processes are now company-specific and created on demand

-- ========================================
-- SUPPORT MODULE INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_support_companies_status ON support_companies(status);
CREATE INDEX IF NOT EXISTS idx_support_companies_created_by ON support_companies(created_by);

CREATE INDEX IF NOT EXISTS idx_support_tickets_company ON support_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_resolver ON support_tickets(resolver_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_open_date ON support_tickets(open_date);
CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(ticket_type);

CREATE INDEX IF NOT EXISTS idx_support_monthly_company_date ON support_monthly_summaries(company_id, year, month);
CREATE INDEX IF NOT EXISTS idx_support_monthly_finalized ON support_monthly_summaries(is_finalized);

CREATE INDEX IF NOT EXISTS idx_support_comments_ticket ON support_ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_comments_user ON support_ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_support_comments_type ON support_ticket_comments(comment_type);

CREATE INDEX IF NOT EXISTS idx_support_rpa_processes_company ON support_rpa_processes(company_id);
CREATE INDEX IF NOT EXISTS idx_support_rpa_processes_active ON support_rpa_processes(is_active);
CREATE INDEX IF NOT EXISTS idx_support_company_contacts_company ON support_company_contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_support_company_contacts_active ON support_company_contacts(is_active);

-- ========================================
-- SUPPORT MODULE TRIGGERS
-- ========================================

-- Auto-generate ticket ID sequence
CREATE TRIGGER IF NOT EXISTS auto_generate_ticket_id
    AFTER INSERT ON support_tickets
    BEGIN
        UPDATE support_tickets 
        SET id_ticket = 'SUP-' || strftime('%Y', 'now') || '-' || printf('%03d', NEW.id)
        WHERE id = NEW.id AND id_ticket IS NULL;
    END;

-- Calculate hours from minutes automatically
CREATE TRIGGER IF NOT EXISTS calculate_ticket_hours
    AFTER UPDATE OF time_invested_minutes ON support_tickets
    BEGIN
        UPDATE support_tickets 
        SET hours_calculated = CAST(NEW.time_invested_minutes AS DECIMAL) / 60.0,
            billable_hours = CAST(NEW.time_invested_minutes AS DECIMAL) / 60.0
        WHERE id = NEW.id;
    END;

-- Update support company timestamps
CREATE TRIGGER IF NOT EXISTS update_support_companies_timestamp
    AFTER UPDATE ON support_companies
    BEGIN
        UPDATE support_companies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update support tickets timestamps  
CREATE TRIGGER IF NOT EXISTS update_support_tickets_timestamp
    AFTER UPDATE ON support_tickets
    BEGIN
        UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Update monthly summaries timestamps
CREATE TRIGGER IF NOT EXISTS update_support_monthly_summaries_timestamp
    AFTER UPDATE ON support_monthly_summaries
    BEGIN
        UPDATE support_monthly_summaries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Auto-update monthly summary when ticket is resolved
CREATE TRIGGER IF NOT EXISTS update_monthly_summary_on_ticket_close
    AFTER UPDATE OF status, hours_calculated ON support_tickets
    WHEN NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed')
    BEGIN
        INSERT OR REPLACE INTO support_monthly_summaries (
            company_id, year, month, contracted_hours, consumed_hours, 
            remaining_hours, exceeded_hours, total_tickets, resolved_tickets
        )
        SELECT 
            NEW.company_id,
            strftime('%Y', NEW.close_date),
            strftime('%m', NEW.close_date),
            sc.contracted_hours_monthly,
            COALESCE(SUM(st.hours_calculated), 0),
            MAX(0, sc.contracted_hours_monthly - COALESCE(SUM(st.hours_calculated), 0)),
            MAX(0, COALESCE(SUM(st.hours_calculated), 0) - sc.contracted_hours_monthly),
            COUNT(*),
            COUNT(CASE WHEN st.status IN ('resolved', 'closed') THEN 1 END)
        FROM support_companies sc
        LEFT JOIN support_tickets st ON st.company_id = sc.id 
            AND strftime('%Y-%m', st.close_date) = strftime('%Y-%m', NEW.close_date)
        WHERE sc.id = NEW.company_id
        GROUP BY sc.id;
    END;