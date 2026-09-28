import { db } from '../database/database';

export type ProjectLogEntryType = 'technical_milestone' | 'client_approval' | 'decision' | 'scope_change' | 'incident';

export interface ProjectLogEntryRow {
    id: number;
    project_id: number;
    entry_type: ProjectLogEntryType;
    description: string;
    file_id: number | null;
    created_by: number;
    author_name: string;
    created_at: string;
}

const SELECT_FIELDS = `
    l.id, l.project_id, l.entry_type, l.description, l.file_id, l.created_by, u.full_name as author_name, l.created_at
`;

/**
 * Bitácora inmutable por proyecto (v42): solo alta y lectura, nunca update/delete.
 */
export class ProjectLogService {
    async getForProject(projectId: number): Promise<ProjectLogEntryRow[]> {
        return db.query(`
            SELECT ${SELECT_FIELDS}
            FROM project_log_entries l
            JOIN users u ON l.created_by = u.id
            WHERE l.project_id = ?
            ORDER BY l.created_at DESC, l.id DESC
        `, [projectId]);
    }

    async create(
        projectId: number,
        userId: number,
        entryType: ProjectLogEntryType,
        description: string,
        fileId: number | null
    ): Promise<ProjectLogEntryRow> {
        const result = await db.run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, file_id, created_by) VALUES (?, ?, ?, ?, ?)`,
            [projectId, entryType, description.trim(), fileId, userId]
        );

        return this.findById(result.id as number) as Promise<ProjectLogEntryRow>;
    }

    async findById(id: number): Promise<ProjectLogEntryRow | undefined> {
        return db.get(`
            SELECT ${SELECT_FIELDS}
            FROM project_log_entries l
            JOIN users u ON l.created_by = u.id
            WHERE l.id = ?
        `, [id]);
    }
}

export const projectLogService = new ProjectLogService();
