import { db } from '../database/database';
import { logger } from '../utils/logger';
import { notificationService } from './notificationService';

export type CommentEntityType = 'task' | 'project';

export interface CommentRow {
    id: number;
    entity_type: CommentEntityType;
    entity_id: number;
    user_id: number;
    author_name: string;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface MentionableUser {
    id: number;
    username: string;
    full_name: string;
}

const SELECT_COMMENT_FIELDS = `
    c.id, c.entity_type, c.entity_id, c.user_id, u.full_name as author_name, c.content, c.created_at, c.updated_at
`;

/**
 * Única fuente de CRUD de comments (v16) y de resolución de @menciones.
 * La notificación de menciones nunca lanza: un fallo al notificar no debe impedir
 * que el comentario ya guardado se devuelva con éxito.
 */
export class CommentService {
    async getForEntity(entityType: CommentEntityType, entityId: number): Promise<CommentRow[]> {
        return db.query(`
            SELECT ${SELECT_COMMENT_FIELDS}
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = ? AND c.entity_id = ?
            ORDER BY c.created_at ASC, c.id ASC
        `, [entityType, entityId]);
    }

    async create(entityType: CommentEntityType, entityId: number, userId: number, content: string): Promise<CommentRow> {
        const trimmed = content.trim();
        const result = await db.run(
            `INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)`,
            [entityType, entityId, userId, trimmed]
        );

        const comment = await this.findById(result.id as number) as CommentRow;

        await this.notifyMentions(entityType, entityId, userId, trimmed);

        return comment;
    }

    async findById(commentId: number): Promise<CommentRow | undefined> {
        return db.get(`
            SELECT ${SELECT_COMMENT_FIELDS}
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [commentId]);
    }

    async update(commentId: number, content: string): Promise<CommentRow> {
        await db.run(`UPDATE comments SET content = ? WHERE id = ?`, [content.trim(), commentId]);
        return this.findById(commentId) as Promise<CommentRow>;
    }

    async delete(commentId: number): Promise<void> {
        await db.run(`DELETE FROM comments WHERE id = ?`, [commentId]);
    }

    async getMentionableUsers(entityType: CommentEntityType, entityId: number): Promise<MentionableUser[]> {
        const ids = await this.getAccessibleUserIds(entityType, entityId);
        if (ids.size === 0) return [];

        const placeholders = [...ids].map(() => '?').join(', ');
        return db.query(
            `SELECT id, username, full_name FROM users WHERE is_active = 1 AND id IN (${placeholders}) ORDER BY full_name`,
            [...ids]
        );
    }

    private async getAccessibleUserIds(entityType: CommentEntityType, entityId: number): Promise<Set<number>> {
        if (entityType === 'task') {
            const row = await db.get(`
                SELECT t.assignee_id, p.assigned_to, p.created_by
                FROM tasks t
                LEFT JOIN task_boards tb ON t.board_id = tb.id
                LEFT JOIN projects p ON tb.project_id = p.id
                WHERE t.id = ?
            `, [entityId]);
            if (!row) return new Set();
            return this.filterActiveUserIds([row.assignee_id, row.assigned_to, row.created_by]);
        }

        const row = await db.get(`SELECT assigned_to, created_by FROM projects WHERE id = ?`, [entityId]);
        if (!row) return new Set();

        const roleUsers = await db.query(
            `SELECT id FROM users WHERE is_active = 1 AND role IN ('team_lead', 'rpa_operations', 'it_support')`,
            []
        );
        const ids = new Set<number>(roleUsers.map((u: { id: number }) => u.id));
        const specific = await this.filterActiveUserIds([row.assigned_to, row.created_by]);
        specific.forEach((id) => ids.add(id));
        return ids;
    }

    private async filterActiveUserIds(candidateIds: (number | null | undefined)[]): Promise<Set<number>> {
        const ids = [...new Set(candidateIds.filter((id): id is number => id != null))];
        if (ids.length === 0) return new Set();

        const placeholders = ids.map(() => '?').join(', ');
        const rows = await db.query(
            `SELECT id FROM users WHERE is_active = 1 AND id IN (${placeholders})`,
            ids
        );
        return new Set(rows.map((r: { id: number }) => r.id));
    }

    private async notifyMentions(entityType: CommentEntityType, entityId: number, authorId: number, content: string): Promise<void> {
        try {
            const usernames = this.extractMentionedUsernames(content);
            if (usernames.length === 0) return;

            const placeholders = usernames.map(() => '?').join(', ');
            const mentioned = await db.query(
                `SELECT id FROM users WHERE is_active = 1 AND username IN (${placeholders})`,
                usernames
            );

            const candidateIds = [...new Set(mentioned.map((row: { id: number }) => row.id))]
                .filter((id) => id !== authorId);
            if (candidateIds.length === 0) return;

            const accessibleIds = await this.getAccessibleUserIds(entityType, entityId);
            const uniqueUserIds = candidateIds.filter((id) => accessibleIds.has(id));

            for (const userId of uniqueUserIds) {
                await notificationService.notify({
                    userId,
                    eventKey: 'comment_mention',
                    title: 'Te mencionaron en un comentario',
                    message: content.length > 140 ? `${content.slice(0, 140)}...` : content,
                    type: 'info',
                    entityType,
                    entityId,
                    senderId: authorId,
                    link: entityType === 'task' ? `/tasks?taskId=${entityId}` : `/projects/${entityId}`
                });
            }
        } catch (error) {
            logger.error('Failed to resolve/notify comment mentions:', error);
        }
    }

    private extractMentionedUsernames(content: string): string[] {
        const matches = content.match(/@([a-zA-Z0-9_]+)/g) || [];
        return [...new Set(matches.map((token) => token.slice(1)))];
    }
}

export const commentService = new CommentService();
