import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 31 - project_baselines y baseline_planned_date', () => {
    let dbPath: string;
    let db: sqlite3.Database;

    function columnNames(table: string): Promise<string[]> {
        return new Promise((resolve, reject) => {
            db.all(`PRAGMA table_info(${table})`, (err, rows: any[]) => {
                if (err) reject(err);
                else resolve(rows.map(r => r.name));
            });
        });
    }

    beforeAll(async () => {
        dbPath = path.join(os.tmpdir(), `migration31-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => err ? reject(err) : resolve(conn));
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('crea project_baselines con las columnas esperadas', async () => {
        const cols = await columnNames('project_baselines');
        expect(cols).toEqual(expect.arrayContaining([
            'id', 'project_id', 'baseline_date', 'start_date', 'end_date',
            'budgeted_cost_clp', 'budgeted_hours', 'created_by', 'created_at'
        ]));
    });

    it('agrega baseline_planned_date a project_milestones', async () => {
        const cols = await columnNames('project_milestones');
        expect(cols).toContain('baseline_planned_date');
    });

    it('rechaza un segundo baseline para el mismo project_id (UNIQUE)', async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO projects (name, start_date, end_date) VALUES ('P1', '2026-01-01', '2026-06-01')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO project_baselines (project_id, start_date, end_date, budgeted_cost_clp, budgeted_hours, created_by)
                 VALUES (1, '2026-01-01', '2026-06-01', 1000000, 100, 1)`,
                (err) => err ? reject(err) : resolve()
            );
        });

        const secondInsertError: Error | null = await new Promise((resolve) => {
            db.run(
                `INSERT INTO project_baselines (project_id, start_date, end_date, budgeted_cost_clp, budgeted_hours, created_by)
                 VALUES (1, '2026-01-01', '2026-06-01', 1000000, 100, 1)`,
                (err) => resolve(err)
            );
        });

        expect(secondInsertError).not.toBeNull();
        expect(secondInsertError!.message).toContain('UNIQUE');
    });
});
