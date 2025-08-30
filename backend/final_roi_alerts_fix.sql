-- FINAL FIX: Create missing roi_alerts table
-- This is the last missing piece for the financial dashboard

BEGIN TRANSACTION;

-- Create roi_alerts table
CREATE TABLE IF NOT EXISTS roi_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'cost_overrun', 'delay_risk', 'low_roi', 'profitability_warning'
    alert_level VARCHAR(20) DEFAULT 'warning' CHECK (alert_level IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    threshold_value DECIMAL(10,2),
    current_value DECIMAL(10,2),
    is_resolved BOOLEAN DEFAULT 0,
    resolved_at DATETIME,
    resolved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- Create indexes for roi_alerts
CREATE INDEX IF NOT EXISTS idx_roi_alerts_project ON roi_alerts(project_id);
CREATE INDEX IF NOT EXISTS idx_roi_alerts_type ON roi_alerts(alert_type, alert_level);
CREATE INDEX IF NOT EXISTS idx_roi_alerts_resolved ON roi_alerts(is_resolved);

-- Create timestamp trigger
CREATE TRIGGER IF NOT EXISTS update_roi_alerts_timestamp 
    AFTER UPDATE ON roi_alerts
    FOR EACH ROW
    BEGIN
        UPDATE roi_alerts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Add a sample alert to test
INSERT OR IGNORE INTO roi_alerts (project_id, alert_type, alert_level, message, threshold_value, current_value)
SELECT 
    p.id,
    'low_roi',
    'warning',
    'Project ROI is below expected threshold',
    20.00,
    5.00
FROM projects p
WHERE p.status = 'active'
LIMIT 1;

COMMIT;