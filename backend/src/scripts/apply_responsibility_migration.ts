import { db } from '../database/database';
import { logger } from '../utils/logger';

async function applyMigration() {
    try {
        // Initialize database connection
        await db.connect();
        logger.info('Database connected for migration');
        // Check if columns already exist
        const tableInfo = await db.query(`PRAGMA table_info(project_milestones)`);
        const existingColumns = tableInfo.map((col: any) => col.name);
        
        if (existingColumns.includes('responsibility')) {
            logger.info('Responsibility fields already exist, skipping migration');
            return;
        }

        // Apply migration
        const migrations = [
            `ALTER TABLE project_milestones ADD COLUMN responsibility VARCHAR(20) DEFAULT 'internal'`,
            `ALTER TABLE project_milestones ADD COLUMN blocking_reason TEXT`,
            `ALTER TABLE project_milestones ADD COLUMN delay_justification TEXT`,
            `ALTER TABLE project_milestones ADD COLUMN external_contact VARCHAR(200)`,
            `ALTER TABLE project_milestones ADD COLUMN estimated_delay_days INTEGER DEFAULT 0`,
            `ALTER TABLE project_milestones ADD COLUMN financial_impact DECIMAL(10,2) DEFAULT 0`,
            `UPDATE project_milestones SET responsibility = 'internal' WHERE responsibility IS NULL`
        ];

        for (const migration of migrations) {
            try {
                await db.run(migration);
                logger.info(`Applied: ${migration.substring(0, 50)}...`);
            } catch (error) {
                logger.warn(`Migration already applied or error: ${migration.substring(0, 50)}...`);
            }
        }

        logger.info('✅ Responsibility migration completed successfully');
    } catch (error) {
        logger.error('❌ Migration failed:', error);
    }
}

// Run migration
applyMigration().then(() => {
    console.log('Migration process completed');
    process.exit(0);
}).catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
});