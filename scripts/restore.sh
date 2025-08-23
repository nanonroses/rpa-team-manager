#!/bin/bash

# RPA Team Manager - Restore Script
# Restore from backup

set -e

# Check if backup file is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh /backups/rpa-backup-*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"
TEMP_DIR="/tmp/restore-$(date +%s)"

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "Starting restore from: $BACKUP_FILE"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Extract backup
echo "Extracting backup..."
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Find backup directory (should be only one)
BACKUP_DIR=$(find "$TEMP_DIR" -name "rpa-backup-*" -type d | head -1)

if [ -z "$BACKUP_DIR" ]; then
    echo "Error: Invalid backup file structure"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "Backup directory: $BACKUP_DIR"

# Show backup info if available
if [ -f "$BACKUP_DIR/backup_info.txt" ]; then
    echo "Backup Information:"
    cat "$BACKUP_DIR/backup_info.txt"
    echo ""
fi

# Confirm restore
read -p "Are you sure you want to restore? This will overwrite current data. (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled"
    rm -rf "$TEMP_DIR"
    exit 0
fi

# Stop the application (if running)
echo "Stopping application containers..."
cd /app
docker-compose down 2>/dev/null || echo "Containers not running"

# Backup current data before restore
CURRENT_BACKUP="/backups/pre-restore-backup-$(date +%Y%m%d_%H%M%S).tar.gz"
echo "Creating safety backup of current data: $CURRENT_BACKUP"
tar -czf "$CURRENT_BACKUP" -C /app data uploads 2>/dev/null || echo "No current data to backup"

# Restore database
if [ -f "$BACKUP_DIR/database.sqlite" ]; then
    echo "Restoring database..."
    mkdir -p /app/data
    cp "$BACKUP_DIR/database.sqlite" /app/data/database.sqlite
    chmod 644 /app/data/database.sqlite
    echo "Database restored successfully"
else
    echo "Warning: No database found in backup"
fi

# Restore uploads
if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
    echo "Restoring uploads..."
    mkdir -p /app/uploads
    tar -xzf "$BACKUP_DIR/uploads.tar.gz" -C /app/uploads
    echo "Uploads restored successfully"
else
    echo "Warning: No uploads found in backup"
fi

# Fix permissions
echo "Fixing permissions..."
chown -R 1000:1000 /app/data /app/uploads 2>/dev/null || true
chmod -R 755 /app/data /app/uploads 2>/dev/null || true

# Start the application
echo "Starting application..."
cd /app
docker-compose up -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 10

# Check health
echo "Checking application health..."
for i in {1..30}; do
    if curl -f http://localhost:3001/health >/dev/null 2>&1; then
        echo "Application is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Warning: Application health check failed"
    fi
    sleep 2
done

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "Restore completed successfully!"
echo "Pre-restore backup saved as: $CURRENT_BACKUP"
echo ""
echo "Application URLs:"
echo "- Frontend: http://localhost:3000"
echo "- Backend:  http://localhost:3001"
echo "- Health:   http://localhost:3001/health"