#!/bin/bash

# RPA Team Manager - Backup Script
# Automated backup for SQLite database and uploads

set -e

# Configuration
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/rpa-backup-$DATE"
DB_PATH="/backup/data/database.sqlite"
UPLOADS_PATH="/backup/uploads"
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

# Create backup directory
echo "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Warning: Database file not found at $DB_PATH"
    exit 1
fi

# Backup database
echo "Backing up database..."
cp "$DB_PATH" "$BACKUP_DIR/database.sqlite"

# Backup uploads if directory exists
if [ -d "$UPLOADS_PATH" ]; then
    echo "Backing up uploads..."
    tar -czf "$BACKUP_DIR/uploads.tar.gz" -C "$UPLOADS_PATH" . 2>/dev/null || echo "No uploads to backup"
else
    echo "Uploads directory not found, skipping..."
fi

# Create backup info file
cat > "$BACKUP_DIR/backup_info.txt" << EOF
Backup Created: $(date)
Database Size: $(du -h "$DB_PATH" | cut -f1)
Uploads Size: $(du -sh "$UPLOADS_PATH" 2>/dev/null | cut -f1 || echo "N/A")
Backup Type: Automated
Retention: $RETENTION_DAYS days
EOF

# Compress backup
echo "Compressing backup..."
cd /backups
tar -czf "rpa-backup-$DATE.tar.gz" "rpa-backup-$DATE"
rm -rf "rpa-backup-$DATE"

# Calculate backup size
BACKUP_SIZE=$(du -h "rpa-backup-$DATE.tar.gz" | cut -f1)
echo "Backup completed: rpa-backup-$DATE.tar.gz ($BACKUP_SIZE)"

# Cleanup old backups
echo "Cleaning up old backups (older than $RETENTION_DAYS days)..."
find /backups -name "rpa-backup-*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

# List current backups
echo "Current backups:"
ls -lh /backups/rpa-backup-*.tar.gz 2>/dev/null || echo "No backups found"

# Log backup completion
echo "$(date): Backup completed successfully - rpa-backup-$DATE.tar.gz ($BACKUP_SIZE)" >> /backups/backup.log

echo "Backup process completed successfully!"