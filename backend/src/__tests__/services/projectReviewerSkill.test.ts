import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

jest.mock('../../database/database', () => ({ db: { get: jest.fn(), query: jest.fn() } }));
jest.mock('../../services/llmService', () => ({
    LLMService: jest.fn().mockImplementation(() => ({
        getAvailableProvider: jest.fn().mockResolvedValue(null)
    }))
}));

import { db } from '../../database/database';
import { ProjectReviewerSkillService } from '../../services/projectReviewerSkill';

describe('Project reviewer schema compatibility', () => {
    let connection: sqlite3.Database;
    const exec = (sql: string) => new Promise<void>((resolve, reject) => {
        connection.exec(sql, error => error ? reject(error) : resolve());
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        connection = new sqlite3.Database(':memory:');
        const schema = fs.readFileSync(path.join(__dirname, '../../database/schema.sql'), 'utf8');
        // Use the application's table definitions so nonexistent columns fail in SQLite.
        for (const table of ['tasks', 'task_boards', 'users', 'project_milestones', 'time_entries', 'files', 'file_associations']) {
            const definition = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`));
            if (!definition) throw new Error(`Missing schema for ${table}`);
            await exec(definition[0]);
        }
        (db.get as jest.Mock).mockImplementation(async (sql: string) =>
            sql.includes('FROM projects') ? { id: 1, name: 'Review test', status: 'active' } : undefined);
        (db.query as jest.Mock).mockImplementation((sql: string, params: unknown[]) =>
            new Promise((resolve, reject) => connection.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))));
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => connection.close(error => error ? reject(error) : resolve()));
    });

    it('reviews milestones and sums decimal hours for only the requested project', async () => {
        await exec(`INSERT INTO project_milestones (project_id, name, planned_date, status, created_by)
            VALUES (1, 'Delivery', '2026-10-01', 'completed', 1);
            INSERT INTO time_entries (project_id, user_id, hours, date)
            VALUES (1, 1, 1.5, '2026-09-28'), (1, 2, 2.25, '2026-09-28'), (2, 1, 10, '2026-09-28');`);
        const review = await new ProjectReviewerSkillService().reviewProject(1, 1);
        expect(review.kpis.hours_spent).toBe(3.8);
        expect(review.kpis.milestones_total).toBe(1);
        expect(review.kpis.milestones_completed).toBe(1);
        expect(review.metadata.source).toBe('rule_based_engine');
    });

    it('reviews a project with no milestones or time entries', async () => {
        const review = await new ProjectReviewerSkillService().reviewProject(1, 1);
        expect(review.kpis.hours_spent).toBe(0);
        expect(review.kpis.milestones_total).toBe(0);
    });
});
