import { db } from '../database/database';
import { logger } from '../utils/logger';

export type NotificationEventKey =
    | 'task_assigned'
    | 'task_status_changed'
    | 'task_due_soon'
    | 'timesheet_submitted'
    | 'timesheet_missing_days';

export interface NotifyParams {
    userId: number;
    eventKey: NotificationEventKey;
    title: string;
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    entityType?: string;
    entityId?: number;
    senderId?: number;
    link?: string;
    dedupe?: boolean;
}

export interface NotificationRow {
    id: number;
    user_id: number;
    title: string;
    message: string | null;
    type: string;
    entity_type: string | null;
    entity_id: number | null;
    sender_id: number | null;
    sender_name: string | null;
    link: string | null;
    event_key: string;
    is_read: boolean;
    created_at: string;
}

export interface NotificationQueryOptions {
    limit: number;
    offset: number;
    unreadOnly?: boolean;
}

/**
 * Única fuente de escritura/lectura de notifications (v16 + columnas de v32).
 * notify() nunca lanza: un fallo al notificar no debe romper la operación que lo dispara.
 */
export class NotificationService {
    async notify(params: NotifyParams): Promise<void> {
        try {
            if (params.dedupe) {
                const existing = await db.get(
                    `SELECT id FROM notifications WHERE user_id = ? AND event_key = ? AND entity_id IS ? AND is_read = 0`,
                    [params.userId, params.eventKey, params.entityId ?? null]
                );
                if (existing) return;
            }

            await db.run(`
                INSERT INTO notifications (
                    user_id, title, message, type, entity_type, entity_id, sender_id, link, event_key
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                params.userId,
                params.title,
                params.message ?? null,
                params.type ?? 'info',
                params.entityType ?? null,
                params.entityId ?? null,
                params.senderId ?? null,
                params.link ?? null,
                params.eventKey
            ]);
        } catch (error) {
            logger.error('Failed to create notification:', error);
        }
    }

    async getForUser(userId: number, options: NotificationQueryOptions): Promise<NotificationRow[]> {
        const unreadClause = options.unreadOnly ? 'AND n.is_read = 0' : '';
        return db.query(`
            SELECT n.*, u.full_name as sender_name
            FROM notifications n
            LEFT JOIN users u ON n.sender_id = u.id
            WHERE n.user_id = ? ${unreadClause}
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT ? OFFSET ?
        `, [userId, options.limit, options.offset]);
    }

    async getUnreadCount(userId: number): Promise<number> {
        const row = await db.get(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        return row?.count ?? 0;
    }

    async markRead(notificationId: number, userId: number): Promise<boolean> {
        const result = await db.run(
            `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
            [notificationId, userId]
        );
        return (result?.changes ?? 0) > 0;
    }

    async markAllRead(userId: number): Promise<void> {
        await db.run(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
    }

    private static readonly TASK_DUE_SOON_DAYS = 3;

    async checkLoginReminders(userId: number, missingTimesheetDaysCount: number): Promise<void> {
        try {
            const tasks = await db.query(`
                SELECT id, title FROM tasks
                WHERE assignee_id = ?
                  AND status NOT IN ('done', 'blocked')
                  AND due_date IS NOT NULL
                  AND date(due_date) BETWEEN date('now') AND date('now', '+' || ? || ' days')
            `, [userId, NotificationService.TASK_DUE_SOON_DAYS]);

            for (const task of tasks) {
                await this.notify({
                    userId,
                    eventKey: 'task_due_soon',
                    title: 'Una tarea tuya vence pronto',
                    message: task.title,
                    type: 'warning',
                    entityType: 'task',
                    entityId: task.id,
                    link: `/tasks?taskId=${task.id}`,
                    dedupe: true
                });
            }
        } catch (error) {
            logger.error('Failed to check task_due_soon reminders:', error);
        }

        if (missingTimesheetDaysCount > 0) {
            try {
                await this.notify({
                    userId,
                    eventKey: 'timesheet_missing_days',
                    title: 'Tenés días sin registrar horas',
                    message: `${missingTimesheetDaysCount} día(s) hábil(es) sin horas registradas en las últimas 2 semanas`,
                    type: 'warning',
                    entityType: 'timesheet_reminder',
                    entityId: userId,
                    link: '/time',
                    dedupe: true
                });
            } catch (error) {
                logger.error('Failed to check timesheet_missing_days reminder:', error);
            }
        }
    }
}

export const notificationService = new NotificationService();
