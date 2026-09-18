import { db } from '../database/database';
import { logger } from '../utils/logger';

export interface ActivityLogEntry {
    id: number;
    user_id: number | null;
    user_name: string | null;
    entity_type: string;
    entity_id: number;
    action: string;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    created_at: string;
}

export interface ActivityQueryOptions {
    limit: number;
    offset: number;
}

function parseJsonColumn(value: string | null): Record<string, any> | null {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function mapActivityRow(row: any): ActivityLogEntry {
    return {
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        action: row.action,
        old_values: parseJsonColumn(row.old_values),
        new_values: parseJsonColumn(row.new_values),
        created_at: row.created_at
    };
}

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

    async getProjectActivity(projectId: number, options: ActivityQueryOptions): Promise<ActivityLogEntry[]> {
        const rows = await db.query(`
            SELECT al.*, u.full_name as user_name
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE (al.entity_type = 'project' AND al.entity_id = ?)
               OR (al.entity_type = 'task' AND al.entity_id IN (
                     SELECT t.id FROM tasks t
                     JOIN task_boards tb ON t.board_id = tb.id
                     WHERE tb.project_id = ?
                   ))
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [projectId, projectId, options.limit, options.offset]);

        return rows.map(mapActivityRow);
    }

    async getTaskActivity(taskId: number, options: ActivityQueryOptions): Promise<ActivityLogEntry[]> {
        const rows = await db.query(`
            SELECT al.*, u.full_name as user_name
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.entity_type = 'task' AND al.entity_id = ?
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [taskId, options.limit, options.offset]);

        return rows.map(mapActivityRow);
    }
}

export const activityLogService = new ActivityLogService();
