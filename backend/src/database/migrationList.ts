import { Migration } from './migrations';

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Schema inicial completo',
    up: [
      // Script del schema.sql inicial - tablas principales
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username VARCHAR(50) UNIQUE,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('team_lead', 'rpa_developer', 'rpa_operations', 'it_support')),
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        start_date DATE,
        end_date DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'cancelled')),
        budget DECIMAL(10,2),
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS task_boards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        board_type VARCHAR(20) DEFAULT 'kanban' CHECK (board_type IN ('kanban', 'scrum', 'custom')),
        is_default BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS task_columns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        position INTEGER NOT NULL,
        color VARCHAR(7) DEFAULT '#gray',
        is_done_column BOOLEAN DEFAULT 0,
        wip_limit INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES task_boards(id) ON DELETE CASCADE
      )`,
      
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        board_id INTEGER NOT NULL,
        column_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        task_type VARCHAR(20) DEFAULT 'task' CHECK (task_type IN ('task', 'bug', 'feature', 'research', 'documentation')),
        status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'testing', 'done', 'blocked')),
        priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
        assignee_id INTEGER,
        reporter_id INTEGER NOT NULL,
        story_points INTEGER,
        estimated_hours DECIMAL(5,2),
        actual_hours DECIMAL(5,2) DEFAULT 0,
        start_date DATETIME,
        due_date DATETIME,
        position INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (board_id) REFERENCES task_boards(id) ON DELETE CASCADE,
        FOREIGN KEY (column_id) REFERENCES task_columns(id),
        FOREIGN KEY (assignee_id) REFERENCES users(id),
        FOREIGN KEY (reporter_id) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS project_milestones (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (responsible_user_id) REFERENCES users(id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS global_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'decimal', 'boolean')),
        description TEXT,
        updated_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )`
    ]
  },
  
  {
    version: 2,
    description: 'Agregar soporte para empresas de soporte',
    up: [
      `CREATE TABLE IF NOT EXISTS support_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        contact_email TEXT,
        contact_phone TEXT,
        monthly_hours_contracted INTEGER DEFAULT 0,
        hourly_rate DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ]
  },
  
  {
    version: 3,
    description: 'Agregar tabla de tickets de soporte',
    up: [
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        company_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
        ticket_type TEXT DEFAULT 'support' CHECK (ticket_type IN ('support', 'maintenance', 'development', 'consultation')),
        created_by INTEGER NOT NULL,
        resolver_id INTEGER,
        hours_spent DECIMAL(5,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES support_companies(id),
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (resolver_id) REFERENCES users(id)
      )`
    ]
  },
  
  {
    version: 4,
    description: 'Agregar procesos RPA específicos por empresa',
    up: [
      `CREATE TABLE IF NOT EXISTS support_rpa_processes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        process_name TEXT NOT NULL,
        process_description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES support_companies(id),
        UNIQUE(company_id, process_name)
      )`
    ]
  },
  
  {
    version: 5,
    description: 'Agregar contactos por empresa',
    up: [
      `CREATE TABLE IF NOT EXISTS support_company_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_id INTEGER NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT,
        contact_phone TEXT,
        position TEXT,
        is_primary BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES support_companies(id)
      )`
    ]
  },
  
  {
    version: 6,
    description: 'Agregar campos de ticket específicos',
    up: [
      `ALTER TABLE support_tickets ADD COLUMN attention_method TEXT DEFAULT 'FreshDesk'`,
      `ALTER TABLE support_tickets ADD COLUMN rpa_process_id INTEGER REFERENCES support_rpa_processes(id)`,
      `ALTER TABLE support_tickets ADD COLUMN contact_id INTEGER REFERENCES support_company_contacts(id)`,
      `ALTER TABLE support_tickets ADD COLUMN work_date DATE`,
      `ALTER TABLE support_tickets ADD COLUMN completion_date DATE`
    ]
  },
  
  {
    version: 7,
    description: 'Agregar tarifa de horas extra a empresas de soporte',
    up: [
      `ALTER TABLE support_companies ADD COLUMN hourly_rate_extra DECIMAL(10,2) DEFAULT 0`
    ]
  },
  
  {
    version: 8,
    description: 'Agregar índices para optimización de importación Mermaid',
    up: [
      // Index for project milestones project lookups (used heavily in batch creation)
      `CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id)`,
      
      // Index for milestone date-based queries and sorting
      `CREATE INDEX IF NOT EXISTS idx_project_milestones_planned_date ON project_milestones(planned_date)`,
      
      // Index for milestone status and date combinations (for dashboard queries)
      `CREATE INDEX IF NOT EXISTS idx_project_milestones_status_date ON project_milestones(status, planned_date)`,
      
      // Composite index for task board and column operations (position calculations)
      `CREATE INDEX IF NOT EXISTS idx_tasks_board_column ON tasks(board_id, column_id)`,
      
      // Index for task position calculations within columns
      `CREATE INDEX IF NOT EXISTS idx_tasks_column_position ON tasks(column_id, position)`,
      
      // Index for task date-based queries during Gantt operations
      `CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, due_date)`,
      
      // Index for project board relationships (used in board lookups)
      `CREATE INDEX IF NOT EXISTS idx_task_boards_project ON task_boards(project_id)`
    ]
  },
  
  {
    version: 9,
    description: 'Agregar tabla user_cost_rates para costos de empleados',
    up: [
      `CREATE TABLE IF NOT EXISTS user_cost_rates (
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
      )`,
      
      `CREATE INDEX IF NOT EXISTS idx_user_cost_rates_user ON user_cost_rates(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_cost_rates_active ON user_cost_rates(is_active, effective_from, effective_to)`,
      
      `CREATE TRIGGER IF NOT EXISTS update_user_cost_rates_timestamp 
        AFTER UPDATE ON user_cost_rates
        BEGIN
          UPDATE user_cost_rates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`
    ]
  },
  
  {
    version: 10,
    description: 'Agregar project_pmo_metrics y project_financials con roi_percentage',
    up: [
      `CREATE TABLE IF NOT EXISTS project_pmo_metrics (
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
      )`,
      
      `CREATE TABLE IF NOT EXISTS project_financials (
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
      )`
    ]
  },
  
  {
    version: 11,
    description: 'Agregar sistema completo de archivos y gestión de documentos',
    up: [
      // Main files table
      `CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename VARCHAR(255) NOT NULL,
        original_filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_extension VARCHAR(10),
        file_hash VARCHAR(64) NOT NULL,
        uploaded_by INTEGER NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT 0,
        is_deleted BOOLEAN DEFAULT 0,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )`,
      
      // File categories for organization and validation
      `CREATE TABLE IF NOT EXISTS file_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        allowed_extensions TEXT NOT NULL,
        max_file_size INTEGER,
        icon VARCHAR(50) DEFAULT 'file',
        color VARCHAR(7) DEFAULT '#6b7280',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // File associations to link files with entities
      `CREATE TABLE IF NOT EXISTS file_associations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INTEGER NOT NULL,
        association_type VARCHAR(50) DEFAULT 'attachment',
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE(file_id, entity_type, entity_id, association_type)
      )`,
      
      // File versions for version control
      `CREATE TABLE IF NOT EXISTS file_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        version_number INTEGER NOT NULL,
        filename VARCHAR(255) NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        uploaded_by INTEGER NOT NULL,
        version_notes TEXT,
        upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id),
        UNIQUE(file_id, version_number)
      )`,
      
      // File access log for audit and security
      `CREATE TABLE IF NOT EXISTS file_access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        access_type VARCHAR(20) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        access_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      
      // Create indexes for better performance
      `CREATE INDEX IF NOT EXISTS idx_files_hash ON files(file_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_files_uploaded_by ON files(uploaded_by)`,
      `CREATE INDEX IF NOT EXISTS idx_files_extension ON files(file_extension)`,
      `CREATE INDEX IF NOT EXISTS idx_files_upload_date ON files(upload_date)`,
      `CREATE INDEX IF NOT EXISTS idx_file_associations_file ON file_associations(file_id)`,
      `CREATE INDEX IF NOT EXISTS idx_file_associations_entity ON file_associations(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_file_associations_type ON file_associations(association_type)`,
      `CREATE INDEX IF NOT EXISTS idx_file_versions_file ON file_versions(file_id)`,
      `CREATE INDEX IF NOT EXISTS idx_file_versions_upload_date ON file_versions(upload_date)`,
      `CREATE INDEX IF NOT EXISTS idx_file_access_file ON file_access_log(file_id)`,
      `CREATE INDEX IF NOT EXISTS idx_file_access_user ON file_access_log(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_file_access_date ON file_access_log(access_date)`,
      
      // Insert default file categories
      `INSERT OR IGNORE INTO file_categories (name, description, allowed_extensions, max_file_size, icon, color) VALUES 
        ('Imágenes', 'Archivos de imagen como JPEG, PNG, GIF', '["jpg", "jpeg", "png", "gif", "webp", "svg"]', 10485760, 'image', '#10b981'),
        ('Documentos', 'Documentos de texto y presentaciones', '["pdf", "doc", "docx", "ppt", "pptx", "txt", "rtf", "odt"]', 52428800, 'file-text', '#3b82f6'),
        ('Hojas de Cálculo', 'Archivos de hojas de cálculo', '["xls", "xlsx", "csv", "ods"]', 52428800, 'table', '#059669'),
        ('Archivos Comprimidos', 'Archivos ZIP, RAR y otros comprimidos', '["zip", "rar", "7z", "tar", "gz"]', 104857600, 'archive', '#8b5cf6'),
        ('Videos', 'Archivos de video', '["mp4", "avi", "mov", "wmv", "flv", "webm"]', 524288000, 'video', '#ef4444'),
        ('Audio', 'Archivos de audio', '["mp3", "wav", "ogg", "flac", "aac"]', 104857600, 'music', '#f59e0b'),
        ('Código', 'Archivos de código fuente', '["js", "ts", "py", "java", "cpp", "c", "html", "css", "sql", "json", "xml"]', 10485760, 'code', '#6366f1'),
        ('Otros', 'Otros tipos de archivo', '["*"]', 104857600, 'file', '#6b7280')`
    ]
  },
  
  {
    version: 12,
    description: 'Fix global_settings table schema to match controller expectations',
    up: [
      // Drop existing table if it has wrong schema
      `DROP TABLE IF EXISTS global_settings`,
      
      // Recreate with correct schema
      `CREATE TABLE global_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'decimal', 'boolean')),
        description TEXT,
        updated_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
      )`,
      
      // Insert the required seed data
      `INSERT INTO global_settings (setting_key, setting_value, setting_type, description, updated_by) VALUES 
        ('usd_rate', '925.50', 'decimal', 'Tipo de cambio USD a CLP (actualizar mensualmente)', 1),
        ('uf_rate', '37250.85', 'decimal', 'Valor de la UF en CLP (actualizar mensualmente)', 1),
        ('monthly_hours', '176', 'number', 'Horas laborales mensuales en Chile (44h semanales)', 1),
        ('weekly_hours', '44', 'number', 'Horas laborales semanales en Chile', 1)`,
      
      // Create index and trigger
      `CREATE INDEX IF NOT EXISTS idx_global_settings_key ON global_settings(setting_key)`,
      
      `CREATE TRIGGER IF NOT EXISTS update_global_settings_timestamp 
        AFTER UPDATE ON global_settings
        BEGIN
          UPDATE global_settings SET updated_at = CURRENT_TIMESTAMP WHERE setting_key = NEW.setting_key;
        END`
    ]
  },

  {
    version: 13,
    description: 'Sistema de Ciclo de Vida del Proyecto - Project Lifecycle Phases',
    up: [
      // ========================================
      // PROJECT PHASE TEMPLATES
      // ========================================
      `CREATE TABLE IF NOT EXISTS project_phase_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        phase_order INTEGER NOT NULL,
        is_billable BOOLEAN DEFAULT 0,
        is_mandatory BOOLEAN DEFAULT 1,
        estimated_duration_days INTEGER,
        category VARCHAR(30) CHECK (category IN ('pre_sale', 'negotiation', 'pre_development', 'development', 'testing', 'deployment', 'post_deployment')),
        color VARCHAR(7) DEFAULT '#1890ff',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // ========================================
      // PROJECT PHASES (instancias reales)
      // ========================================
      `CREATE TABLE IF NOT EXISTS project_phases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        phase_order INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
        planned_start_date DATE,
        planned_end_date DATE,
        estimated_hours DECIMAL(5,2) DEFAULT 0,
        actual_start_date DATE,
        actual_end_date DATE,
        actual_hours DECIMAL(5,2) DEFAULT 0,
        responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external', 'shared')),
        blocking_reason TEXT,
        waiting_for VARCHAR(200),
        is_billable BOOLEAN DEFAULT 0,
        budgeted_cost DECIMAL(10,2) DEFAULT 0,
        actual_cost DECIMAL(10,2) DEFAULT 0,
        client_charge DECIMAL(10,2) DEFAULT 0,
        variance_days INTEGER DEFAULT 0,
        variance_hours DECIMAL(5,2) DEFAULT 0,
        efficiency_percentage DECIMAL(5,2) DEFAULT 100,
        is_critical_path BOOLEAN DEFAULT 0,
        completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES project_phase_templates(id)
      )`,

      // ========================================
      // PHASE ACTIVITIES (granularidad extrema)
      // ========================================
      `CREATE TABLE IF NOT EXISTS phase_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phase_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        activity_type VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        start_datetime DATETIME,
        end_datetime DATETIME,
        duration_minutes INTEGER DEFAULT 0,
        calculated_hours DECIMAL(5,2) DEFAULT 0,
        user_id INTEGER NOT NULL,
        is_productive BOOLEAN DEFAULT 1,
        is_billable BOOLEAN DEFAULT 0,
        is_internal BOOLEAN DEFAULT 1,
        responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external')),
        notes TEXT,
        tags TEXT,
        has_evidence BOOLEAN DEFAULT 0,
        evidence_description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE CASCADE,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      // ========================================
      // PROJECT DELAYS
      // ========================================
      `CREATE TABLE IF NOT EXISTS project_delays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        phase_id INTEGER,
        delay_type VARCHAR(30) CHECK (delay_type IN ('client_waiting', 'approval_pending', 'information_missing', 'scope_change', 'technical_blocker', 'resource_unavailable', 'external_dependency', 'other')),
        description TEXT NOT NULL,
        responsible_party VARCHAR(20) CHECK (responsible_party IN ('internal', 'client', 'external', 'shared')),
        contact_person VARCHAR(200),
        delay_start_date DATE NOT NULL,
        delay_end_date DATE,
        delay_days INTEGER DEFAULT 0,
        financial_impact DECIMAL(10,2) DEFAULT 0,
        resolution TEXT,
        resolved_by INTEGER,
        has_evidence BOOLEAN DEFAULT 0,
        evidence_notes TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (phase_id) REFERENCES project_phases(id),
        FOREIGN KEY (resolved_by) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      // ========================================
      // PROJECT SCOPE CHANGES
      // ========================================
      `CREATE TABLE IF NOT EXISTS project_scope_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        phase_id INTEGER,
        change_type VARCHAR(30) CHECK (change_type IN ('scope_increase', 'scope_decrease', 'requirement_change', 'technical_change', 'timeline_extension', 'other')),
        description TEXT NOT NULL,
        reason TEXT NOT NULL,
        requested_by VARCHAR(200),
        hours_impact DECIMAL(5,2) DEFAULT 0,
        cost_impact DECIMAL(10,2) DEFAULT 0,
        timeline_impact_days INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented')),
        approved_by INTEGER,
        approval_date DATE,
        requires_re_quote BOOLEAN DEFAULT 0,
        new_quote_amount DECIMAL(12,2),
        quote_approved BOOLEAN DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (phase_id) REFERENCES project_phases(id),
        FOREIGN KEY (approved_by) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      // ========================================
      // INDEXES
      // ========================================
      `CREATE INDEX IF NOT EXISTS idx_project_phases_project ON project_phases(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_phases_status ON project_phases(status)`,
      `CREATE INDEX IF NOT EXISTS idx_project_phases_template ON project_phases(template_id)`,
      `CREATE INDEX IF NOT EXISTS idx_phase_activities_phase ON phase_activities(phase_id)`,
      `CREATE INDEX IF NOT EXISTS idx_phase_activities_project ON phase_activities(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_phase_activities_user ON phase_activities(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_phase_activities_type ON phase_activities(activity_type)`,
      `CREATE INDEX IF NOT EXISTS idx_project_delays_project ON project_delays(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_delays_phase ON project_delays(phase_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_delays_type ON project_delays(delay_type)`,
      `CREATE INDEX IF NOT EXISTS idx_project_delays_responsible ON project_delays(responsible_party)`,
      `CREATE INDEX IF NOT EXISTS idx_scope_changes_project ON project_scope_changes(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_scope_changes_phase ON project_scope_changes(phase_id)`,
      `CREATE INDEX IF NOT EXISTS idx_scope_changes_status ON project_scope_changes(status)`,

      // ========================================
      // TRIGGERS
      // ========================================
      `CREATE TRIGGER IF NOT EXISTS calculate_activity_hours
        AFTER INSERT ON phase_activities
        BEGIN
          UPDATE phase_activities
          SET calculated_hours = CAST(NEW.duration_minutes AS DECIMAL) / 60.0
          WHERE id = NEW.id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS update_phase_hours_on_activity_insert
        AFTER INSERT ON phase_activities
        BEGIN
          UPDATE project_phases
          SET actual_hours = (
            SELECT COALESCE(SUM(calculated_hours), 0)
            FROM phase_activities
            WHERE phase_id = NEW.phase_id
          )
          WHERE id = NEW.phase_id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS update_phase_hours_on_activity_update
        AFTER UPDATE ON phase_activities
        BEGIN
          UPDATE project_phases
          SET actual_hours = (
            SELECT COALESCE(SUM(calculated_hours), 0)
            FROM phase_activities
            WHERE phase_id = NEW.phase_id
          )
          WHERE id = NEW.phase_id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS calculate_delay_days
        AFTER UPDATE OF delay_end_date ON project_delays
        WHEN NEW.delay_end_date IS NOT NULL
        BEGIN
          UPDATE project_delays
          SET delay_days = CAST(julianday(NEW.delay_end_date) - julianday(NEW.delay_start_date) AS INTEGER)
          WHERE id = NEW.id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS update_project_phases_timestamp
        AFTER UPDATE ON project_phases
        BEGIN
          UPDATE project_phases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS update_phase_activities_timestamp
        AFTER UPDATE ON phase_activities
        BEGIN
          UPDATE phase_activities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS update_project_delays_timestamp
        AFTER UPDATE ON project_delays
        BEGIN
          UPDATE project_delays SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      `CREATE TRIGGER IF NOT EXISTS update_scope_changes_timestamp
        AFTER UPDATE ON project_scope_changes
        BEGIN
          UPDATE project_scope_changes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      // ========================================
      // SEED DATA - Phase Templates
      // ========================================
      `INSERT INTO project_phase_templates (name, description, phase_order, is_billable, category, estimated_duration_days, color) VALUES
        ('Discovery Call', 'Primera reunión exploratoria con cliente para entender necesidad', 1, 0, 'pre_sale', 1, '#8c8c8c'),
        ('Process Analysis', 'Análisis profundo del proceso actual (revisión grabaciones, documentos, flujos)', 2, 0, 'pre_sale', 2, '#8c8c8c'),
        ('Technical Feasibility', 'Evaluación técnica de viabilidad de automatización', 3, 0, 'pre_sale', 1, '#8c8c8c'),
        ('Proposal Creation', 'Armado de propuesta técnica y comercial', 4, 0, 'pre_sale', 2, '#8c8c8c'),
        ('Client Review', 'Cliente revisa propuesta (tiempo de espera)', 5, 0, 'negotiation', 5, '#faad14'),
        ('Proposal Adjustments', 'Ajustes de propuesta según feedback cliente', 6, 0, 'negotiation', 1, '#faad14'),
        ('Commercial Negotiation', 'Negociación de precios y condiciones', 7, 0, 'negotiation', 3, '#faad14'),
        ('Contract Signing', 'Firma de contrato (OC/Contrato marco)', 8, 0, 'negotiation', 2, '#faad14'),
        ('PDD Creation', 'Creación del Process Definition Document', 9, 1, 'pre_development', 3, '#f5222d'),
        ('PDD Client Review', 'Cliente revisa y aprueba PDD (espera)', 10, 0, 'pre_development', 5, '#f5222d'),
        ('PDD Signature', 'Firma del PDD por cliente (NO INICIAR SIN ESTO)', 11, 0, 'pre_development', 2, '#f5222d'),
        ('Environment Setup', 'Configuración de ambientes de desarrollo y testing', 12, 1, 'pre_development', 1, '#f5222d'),
        ('Kickoff Meeting', 'Reunión de inicio oficial del proyecto', 13, 1, 'pre_development', 1, '#f5222d'),
        ('Development - Core Logic', 'Desarrollo lógica principal del robot', 14, 1, 'development', 10, '#1890ff'),
        ('Development - Exception Handling', 'Manejo de excepciones y casos borde', 15, 1, 'development', 3, '#1890ff'),
        ('Development - Logging & Monitoring', 'Implementación de logs y monitoreo', 16, 1, 'development', 2, '#1890ff'),
        ('Code Review', 'Revisión de código por peer/líder técnico', 17, 1, 'development', 1, '#1890ff'),
        ('Unit Testing', 'Pruebas unitarias de componentes', 18, 1, 'testing', 2, '#722ed1'),
        ('Integration Testing', 'Pruebas de integración con sistemas', 19, 1, 'testing', 3, '#722ed1'),
        ('UAT Preparation', 'Preparación de casos de prueba para cliente', 20, 1, 'testing', 1, '#722ed1'),
        ('UAT Execution', 'Cliente ejecuta User Acceptance Testing', 21, 1, 'testing', 5, '#722ed1'),
        ('UAT Fixes', 'Correcciones post UAT', 22, 1, 'testing', 3, '#722ed1'),
        ('Production Deployment', 'Despliegue a ambiente productivo', 23, 1, 'deployment', 1, '#52c41a'),
        ('Hypercare Week 1', 'Soporte intensivo primera semana', 24, 1, 'deployment', 7, '#52c41a'),
        ('Knowledge Transfer', 'Transferencia de conocimiento a equipo cliente', 25, 1, 'deployment', 2, '#52c41a'),
        ('Documentation Delivery', 'Entrega de documentación técnica y usuario final', 26, 1, 'deployment', 2, '#52c41a'),
        ('Hypercare Month 1', 'Soporte post go-live mes 1', 27, 1, 'post_deployment', 30, '#13c2c2'),
        ('Final Review', 'Reunión de cierre y lecciones aprendidas', 28, 0, 'post_deployment', 1, '#13c2c2'),
        ('Project Closure', 'Cierre administrativo del proyecto', 29, 0, 'post_deployment', 1, '#13c2c2')`
    ]
  },

  {
    version: 14,
    description: 'Agregar tabla LLM API Keys para configuración de modelos de lenguaje',
    up: [
      `CREATE TABLE IF NOT EXISTS llm_api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('openai', 'claude', 'gemini', 'deepseek')),
        api_key_encrypted TEXT NOT NULL,
        selected_model VARCHAR(50),
        is_valid BOOLEAN DEFAULT 0,
        last_validated DATETIME,
        validation_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, provider)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_llm_api_keys_user_provider ON llm_api_keys(user_id, provider)`,
      `CREATE INDEX IF NOT EXISTS idx_llm_api_keys_provider ON llm_api_keys(provider)`,

      `CREATE TRIGGER IF NOT EXISTS update_llm_api_keys_timestamp
        AFTER UPDATE ON llm_api_keys
        BEGIN
          UPDATE llm_api_keys SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`
    ]
  },

  {
    version: 15,
    description: 'Agregar columnas faltantes a la tabla projects',
    up: [
      // Agregar columna priority
      `ALTER TABLE projects ADD COLUMN priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low'))`,

      // Agregar columna assigned_to
      `ALTER TABLE projects ADD COLUMN assigned_to INTEGER REFERENCES users(id)`,

      // Agregar columna actual_start_date
      `ALTER TABLE projects ADD COLUMN actual_start_date DATE`,

      // Agregar columna actual_end_date
      `ALTER TABLE projects ADD COLUMN actual_end_date DATE`,

      // Agregar columna progress_percentage
      `ALTER TABLE projects ADD COLUMN progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100)`
    ]
  },

  {
    version: 16,
    description: 'Agregar tablas faltantes del schema (user_sessions, notifications, activity_log, etc.)',
    up: [
      // ========================================
      // USER SESSIONS - CRÍTICO PARA LOGIN
      // ========================================
      `CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash)`,
      `CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at)`,

      // ========================================
      // NOTIFICATIONS
      // ========================================
      `CREATE TABLE IF NOT EXISTS notifications (
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
      )`,

      `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)`,

      // ========================================
      // ACTIVITY LOG
      // ========================================
      `CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        entity_type VARCHAR(20) NOT NULL,
        entity_id INTEGER NOT NULL,
        action VARCHAR(50) NOT NULL,
        old_values TEXT,
        new_values TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON activity_log(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at)`,

      // ========================================
      // COMMENTS
      // ========================================
      `CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'project', 'issue')),
        entity_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        is_internal BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id)`,

      `CREATE TRIGGER IF NOT EXISTS update_comments_timestamp
        AFTER UPDATE ON comments
        BEGIN
          UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      // ========================================
      // ATTACHMENTS
      // ========================================
      `CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('task', 'project', 'issue', 'comment')),
        entity_id INTEGER NOT NULL,
        uploaded_by INTEGER NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INTEGER,
        mime_type VARCHAR(100),
        is_evidence BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id)`,
      `CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by)`,

      // ========================================
      // TIME ENTRIES
      // ========================================
      `CREATE TABLE IF NOT EXISTS time_entries (
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
      )`,

      `CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id)`,
      `CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id)`,

      `CREATE TRIGGER IF NOT EXISTS update_time_entries_timestamp
        AFTER UPDATE ON time_entries
        BEGIN
          UPDATE time_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      // ========================================
      // ISSUES
      // ========================================
      `CREATE TABLE IF NOT EXISTS issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER,
        task_id INTEGER,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        issue_type VARCHAR(20) DEFAULT 'issue' CHECK (issue_type IN ('bug', 'issue', 'impediment', 'risk')),
        severity VARCHAR(10) DEFAULT 'medium' CHECK (severity IN ('critical', 'major', 'minor', 'trivial')),
        status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'wont_fix')),
        responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external', 'shared')),
        financial_impact DECIMAL(10,2) DEFAULT 0,
        delay_days INTEGER DEFAULT 0,
        reported_by INTEGER NOT NULL,
        assigned_to INTEGER,
        resolution TEXT,
        resolved_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (reported_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_issues_responsibility ON issues(responsibility)`,
      `CREATE INDEX IF NOT EXISTS idx_issues_project ON issues(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status)`,

      `CREATE TRIGGER IF NOT EXISTS update_issues_timestamp
        AFTER UPDATE ON issues
        BEGIN
          UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      // ========================================
      // TASK DEPENDENCIES
      // ========================================
      `CREATE TABLE IF NOT EXISTS task_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        predecessor_id INTEGER NOT NULL,
        successor_id INTEGER NOT NULL,
        dependency_type VARCHAR(20) DEFAULT 'finish_to_start' CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
        lag_days INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (predecessor_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (successor_id) REFERENCES tasks(id) ON DELETE CASCADE,
        UNIQUE(predecessor_id, successor_id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_task_dependencies_predecessor ON task_dependencies(predecessor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_task_dependencies_successor ON task_dependencies(successor_id)`,

      // ========================================
      // ROI ALERTS
      // ========================================
      `CREATE TABLE IF NOT EXISTS roi_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        alert_level VARCHAR(20) DEFAULT 'warning' CHECK (alert_level IN ('info', 'warning', 'critical')),
        message TEXT NOT NULL,
        threshold_value DECIMAL(10,2),
        current_value DECIMAL(10,2),
        is_resolved BOOLEAN DEFAULT 0,
        resolved_at DATETIME,
        resolved_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (resolved_by) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_roi_alerts_project ON roi_alerts(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_roi_alerts_type ON roi_alerts(alert_type, alert_level)`,
      `CREATE INDEX IF NOT EXISTS idx_roi_alerts_resolved ON roi_alerts(is_resolved)`,

      // ========================================
      // PROJECT DEPENDENCIES
      // ========================================
      `CREATE TABLE IF NOT EXISTS project_dependencies (
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
      )`,

      `CREATE INDEX IF NOT EXISTS idx_project_dependencies_source ON project_dependencies(source_project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_dependencies_dependent ON project_dependencies(dependent_project_id)`
    ]
  },

  {
    version: 17,
    description: 'Agregar columnas faltantes a la tabla users (avatar_url, last_login)',
    up: [
      // Agregar columna avatar_url
      `ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255)`,

      // Agregar columna last_login
      `ALTER TABLE users ADD COLUMN last_login DATETIME`
    ]
  },

  {
    version: 18,
    description: 'Crear tabla project_assignments para gestión de múltiples usuarios por proyecto',
    up: [
      // ========================================
      // PROJECT ASSIGNMENTS - Multi-user assignments
      // ========================================
      `CREATE TABLE IF NOT EXISTS project_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(50) DEFAULT 'contributor' CHECK (role IN ('lead', 'contributor', 'reviewer', 'observer')),
        allocation_percentage INTEGER DEFAULT 100 CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
        start_date DATE,
        end_date DATE,
        is_active BOOLEAN DEFAULT 1,
        notes TEXT,
        assigned_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (assigned_by) REFERENCES users(id),
        UNIQUE(project_id, user_id, is_active)
      )`,

      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_project_assignments_active ON project_assignments(is_active)`,

      // Trigger to update timestamp
      `CREATE TRIGGER IF NOT EXISTS update_project_assignments_timestamp
        AFTER UPDATE ON project_assignments
        BEGIN
          UPDATE project_assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`
    ]
  },

  {
    version: 19,
    description: 'Agregar columnas faltantes a project_milestones para tracking de delays',
    up: [
      // Add missing columns to project_milestones table
      `ALTER TABLE project_milestones ADD COLUMN impact_on_timeline INTEGER DEFAULT 0`,
      `ALTER TABLE project_milestones ADD COLUMN responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external', 'shared'))`,
      `ALTER TABLE project_milestones ADD COLUMN blocking_reason TEXT`,
      `ALTER TABLE project_milestones ADD COLUMN delay_justification TEXT`,
      `ALTER TABLE project_milestones ADD COLUMN external_contact VARCHAR(200)`,
      `ALTER TABLE project_milestones ADD COLUMN estimated_delay_days INTEGER DEFAULT 0`,
      `ALTER TABLE project_milestones ADD COLUMN financial_impact DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE project_milestones ADD COLUMN created_by INTEGER REFERENCES users(id)`
    ]
  }
];