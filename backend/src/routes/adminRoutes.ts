import { Router, Request, Response } from 'express';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

const router = Router();

// Database health check endpoint
router.get('/db/health', async (req: Request, res: Response) => {
    try {
        const health = await db.healthCheck();
        
        if (health.status === 'unhealthy') {
            res.status(503).json({ 
                success: false, 
                message: 'Database unhealthy', 
                data: health 
            });
        } else {
            res.json({ 
                success: true, 
                message: `Database is ${health.status}`, 
                data: health 
            });
        }
    } catch (error) {
        logger.error('Database health check failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Health check failed', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
});

// Force WAL checkpoint (maintenance operation)
router.post('/db/checkpoint', async (req: Request, res: Response) => {
    try {
        logger.info('Manual WAL checkpoint requested by user:', (req as any).user?.id || 'unknown');
        await db.forceCheckpoint();
        
        // Get updated health status
        const health = await db.healthCheck();
        
        res.json({ 
            success: true, 
            message: 'WAL checkpoint completed successfully',
            data: {
                walSizeAfter: health.walSize,
                status: health.status
            }
        });
    } catch (error) {
        logger.error('Manual checkpoint failed:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Checkpoint failed', 
            error: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
});

// Get database statistics
router.get('/db/stats', async (req: Request, res: Response) => {
    try {
        const stats = await db.getDatabaseStats();
        const health = await db.healthCheck();
        
        res.json({
            success: true,
            data: {
                health: health,
                tableStats: stats,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Failed to get database stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve database statistics',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Create database backup
router.post('/db/backup', async (req: Request, res: Response) => {
    try {
        const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'database.sqlite');
        const backupDir = path.join(process.cwd(), 'backups');
        
        // Ensure backup directory exists
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        
        // Force checkpoint before backup to ensure consistency
        await db.forceCheckpoint();
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `database-backup-${timestamp}.sqlite`);
        
        // Copy the database file
        fs.copyFileSync(dbPath, backupPath);
        
        // Get backup file size
        const stats = fs.statSync(backupPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        logger.info(`Database backup created: ${backupPath} (${sizeInMB} MB)`);
        
        res.json({
            success: true,
            message: 'Database backup created successfully',
            data: {
                backupPath,
                size: `${sizeInMB} MB`,
                timestamp
            }
        });
        
    } catch (error) {
        logger.error('Database backup failed:', error);
        res.status(500).json({
            success: false,
            message: 'Database backup failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// List available backups
router.get('/db/backups', async (req: Request, res: Response) => {
    try {
        const backupDir = path.join(process.cwd(), 'backups');
        
        if (!fs.existsSync(backupDir)) {
            return res.json({
                success: true,
                data: {
                    backups: [],
                    message: 'No backup directory found'
                }
            });
        }
        
        const files = fs.readdirSync(backupDir)
            .filter(file => file.endsWith('.sqlite'))
            .map(file => {
                const filePath = path.join(backupDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    path: filePath,
                    size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
                    created: stats.ctime,
                    modified: stats.mtime
                };
            })
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
        
        return res.json({
            success: true,
            data: {
                backups: files,
                count: files.length
            }
        });
        
    } catch (error) {
        logger.error('Failed to list backups:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to list backups',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;