import { db } from '../database/database';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class DatabaseBackupManager {
    private backupDir: string;

    constructor() {
        this.backupDir = path.join(process.cwd(), 'backups');
        this.ensureBackupDirectory();
    }

    private ensureBackupDirectory(): void {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
            logger.info(`Created backup directory: ${this.backupDir}`);
        }
    }

    public async createBackup(tag?: string): Promise<{
        success: boolean;
        backupPath?: string;
        size?: string;
        error?: string;
    }> {
        try {
            const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.sqlite');
            
            // Ensure database connection
            await db.connect();
            
            // Force checkpoint to ensure all data is in main database file
            await db.forceCheckpoint();
            
            // Create timestamp-based filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const tagSuffix = tag ? `-${tag}` : '';
            const backupFilename = `database-backup-${timestamp}${tagSuffix}.sqlite`;
            const backupPath = path.join(this.backupDir, backupFilename);
            
            // Copy database file
            fs.copyFileSync(dbPath, backupPath);
            
            // Get backup file size
            const stats = fs.statSync(backupPath);
            const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
            
            logger.info(`Database backup created successfully: ${backupFilename} (${sizeInMB} MB)`);
            
            return {
                success: true,
                backupPath,
                size: `${sizeInMB} MB`
            };
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('Database backup failed:', errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    public listBackups(): Array<{
        filename: string;
        path: string;
        size: string;
        created: Date;
    }> {
        try {
            if (!fs.existsSync(this.backupDir)) {
                return [];
            }

            return fs.readdirSync(this.backupDir)
                .filter(file => file.endsWith('.sqlite'))
                .map(file => {
                    const filePath = path.join(this.backupDir, file);
                    const stats = fs.statSync(filePath);
                    return {
                        filename: file,
                        path: filePath,
                        size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                        created: stats.ctime
                    };
                })
                .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        } catch (error) {
            logger.error('Failed to list backups:', error);
            return [];
        }
    }

    public async cleanOldBackups(retainCount: number = 5): Promise<void> {
        try {
            const backups = this.listBackups();
            
            if (backups.length <= retainCount) {
                return; // Nothing to clean
            }

            const backupsToDelete = backups.slice(retainCount);
            
            for (const backup of backupsToDelete) {
                fs.unlinkSync(backup.path);
                logger.info(`Deleted old backup: ${backup.filename}`);
            }

            logger.info(`Cleaned ${backupsToDelete.length} old backups, retained ${retainCount} most recent`);
            
        } catch (error) {
            logger.error('Failed to clean old backups:', error);
        }
    }

    public async scheduleAutoBackup(): Promise<void> {
        // Create backup every 6 hours
        const backupInterval = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
        
        setInterval(async () => {
            logger.info('Creating scheduled backup...');
            const result = await this.createBackup('auto');
            
            if (result.success) {
                // Clean old backups, keep last 10 automatic backups
                await this.cleanOldBackups(10);
            }
        }, backupInterval);

        logger.info('Automatic backup scheduled every 6 hours');
    }
}

// Export singleton instance
export const backupManager = new DatabaseBackupManager();

// Script execution for manual backup
if (require.main === module) {
    (async () => {
        logger.info('Starting manual database backup...');
        
        try {
            // Initialize database connection first
            await db.connect();
            await db.initializeSchema();
            
            const result = await backupManager.createBackup('manual');
            
            if (result.success) {
                console.log(`✅ Backup created: ${result.backupPath} (${result.size})`);
                process.exit(0);
            } else {
                console.error(`❌ Backup failed: ${result.error}`);
                process.exit(1);
            }
        } catch (error) {
            console.error(`❌ Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    })();
}