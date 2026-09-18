import { db } from '../database/database';
import { logger } from '../utils/logger';

/**
 * Única fuente de escritura/lectura de activity_log (migración v16).
 * logActivity nunca lanza: un fallo de auditoría no debe romper la operación que lo dispara.
 */
export class ActivityLogService {
    async logActivity(
        userId: number | undefined,
        entityType: string,
        entityId: number,
        action: string,
        oldValues: any,
        newValues: any
    ): Promise<void> {
        try {
            await db.run(`
                INSERT INTO activity_log (
                    user_id, entity_type, entity_id, action, old_values, new_values
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId || null,
                entityType,
                entityId,
                action,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null
            ]);
        } catch (error) {
            logger.error('Failed to log activity:', error);
        }
    }
}

export const activityLogService = new ActivityLogService();
