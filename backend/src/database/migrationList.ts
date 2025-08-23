import { Migration } from './migrations';

export const migrations: Migration[] = [
  {
    version: 1,
    description: 'Schema inicial completo',
    up: [
      // Script del schema.sql inicial - solo tablas principales
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('team_lead', 'rpa_developer', 'rpa_operations', 'it_support')),
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
      
      // Otras tablas principales...
      `CREATE TABLE IF NOT EXISTS global_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  }
];