-- Debug Schema - Solo tablas esenciales
PRAGMA foreign_keys = ON;

-- Users table
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

-- Ideas table
CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general' CHECK (category IN ('automation', 'process_improvement', 'tool_enhancement', 'cost_reduction', 'productivity', 'general')),
    impact_score INTEGER DEFAULT 3 CHECK (impact_score BETWEEN 1 AND 5),
    effort_score INTEGER DEFAULT 3 CHECK (effort_score BETWEEN 1 AND 5),
    priority_score DECIMAL(3,2) DEFAULT 1.0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'in_progress', 'done', 'rejected')),
    created_by INTEGER NOT NULL,
    assigned_to INTEGER NULL,
    votes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);

-- Test simple insert
INSERT OR IGNORE INTO users (username, email, password_hash, role, full_name, is_active) 
VALUES ('test', 'test@test.com', 'test', 'team_lead', 'Test User', 1);

INSERT OR IGNORE INTO ideas (title, description, created_by) 
VALUES ('Test Idea', 'Test description', 1);