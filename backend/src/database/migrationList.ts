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
  }
];