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

-- (Removed old ideas table - replaced with new one below)

-- Comments for tasks, projects, issues
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'project', 'issue', 'idea')),
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
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'project', 'issue', 'idea', 'comment')),
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
-- Removed old indexes for ideas table - replaced with new ones below
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_user_cost_rates_user ON user_cost_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cost_rates_active ON user_cost_rates(is_active, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_roi_alerts_project ON roi_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_roi_alerts_type ON roi_alerts(alert_type, alert_level);
CREATE INDEX IF NOT EXISTS idx_project_financials_project ON project_financials(project_id);

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

-- (Removed duplicate ideas trigger - using the one below with the new ideas table)

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

CREATE TRIGGER IF NOT EXISTS update_global_settings_timestamp 
    AFTER UPDATE ON global_settings
    BEGIN
        UPDATE global_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Ideas management system
CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('automation', 'process_improvement', 'tool_enhancement', 'cost_reduction', 'productivity', 'general')),
    
    -- Priority matrix values (1-5 scale)
    impact_score INTEGER DEFAULT 3 CHECK (impact_score BETWEEN 1 AND 5),
    effort_score INTEGER DEFAULT 3 CHECK (effort_score BETWEEN 1 AND 5),
    priority_score DECIMAL(3,2) DEFAULT 1.0,
    
    -- Status workflow
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'in_progress', 'done', 'rejected')),
    
    -- Metadata
    created_by INTEGER NOT NULL,
    assigned_to INTEGER NULL,
    votes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- Ideas voting system
CREATE TABLE IF NOT EXISTS idea_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_type VARCHAR(10) DEFAULT 'up' CHECK (vote_type IN ('up', 'down')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(idea_id, user_id)
);

-- Ideas comments system
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

-- Ideas indexes
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_category ON ideas(category);
CREATE INDEX IF NOT EXISTS idx_ideas_created_by ON ideas(created_by);
CREATE INDEX IF NOT EXISTS idx_ideas_priority ON ideas(priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_idea_votes_idea ON idea_votes(idea_id);
CREATE INDEX IF NOT EXISTS idx_idea_comments_idea ON idea_comments(idea_id);

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

-- Trigger to update votes count
CREATE TRIGGER IF NOT EXISTS update_idea_votes_count_insert
    AFTER INSERT ON idea_votes
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'down'
        ) WHERE id = NEW.idea_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_idea_votes_count_delete
    AFTER DELETE ON idea_votes
    BEGIN
        UPDATE ideas SET votes_count = (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = OLD.idea_id AND vote_type = 'up'
        ) - (
            SELECT COUNT(*) FROM idea_votes WHERE idea_id = OLD.idea_id AND vote_type = 'down'
        ) WHERE id = OLD.idea_id;
    END;

-- Trigger to update comments count
CREATE TRIGGER IF NOT EXISTS update_idea_comments_count_insert
    AFTER INSERT ON idea_comments
    BEGIN
        UPDATE ideas SET comments_count = (
            SELECT COUNT(*) FROM idea_comments WHERE idea_id = NEW.idea_id
        ) WHERE id = NEW.idea_id;
    END;

CREATE TRIGGER IF NOT EXISTS update_idea_comments_count_delete
    AFTER DELETE ON idea_comments
    BEGIN
        UPDATE ideas SET comments_count = (
            SELECT COUNT(*) FROM idea_comments WHERE idea_id = OLD.idea_id
        ) WHERE id = OLD.idea_id;
    END;