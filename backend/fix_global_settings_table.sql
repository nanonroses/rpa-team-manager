-- Fix global_settings table to match controller expectations
-- This SQL script fixes the schema mismatch that was breaking the Settings functionality

-- Drop the existing table (will be recreated with proper schema)
DROP TABLE IF EXISTS global_settings;

-- Recreate the table with the correct schema expected by the controller
CREATE TABLE global_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    setting_type TEXT DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'decimal', 'boolean')),
    description TEXT,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Insert the seed data that the controller and Settings page expect
INSERT INTO global_settings (setting_key, setting_value, setting_type, description, updated_by) VALUES 
    ('usd_rate', '925.50', 'decimal', 'Tipo de cambio USD a CLP (actualizar mensualmente)', 1),
    ('uf_rate', '37250.85', 'decimal', 'Valor de la UF en CLP (actualizar mensualmente)', 1),
    ('monthly_hours', '176', 'number', 'Horas laborales mensuales en Chile (44h semanales)', 1),
    ('weekly_hours', '44', 'number', 'Horas laborales semanales en Chile', 1);

-- Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_global_settings_key ON global_settings(setting_key);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_global_settings_timestamp 
    AFTER UPDATE ON global_settings
    BEGIN
        UPDATE global_settings SET updated_at = CURRENT_TIMESTAMP WHERE setting_key = NEW.setting_key;
    END;