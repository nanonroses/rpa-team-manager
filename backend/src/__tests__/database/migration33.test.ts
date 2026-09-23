import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 33 - task_subtasks (checklist liviano de subtareas)', () => {
    let dbPath: string;
    let db: sqlite3.Database;

    function run(sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function (this: any, err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    function all(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    function columnNames(table: string): Promise<string[]> {
        return all(`PRAGMA table_info(${table})`).then((rows) => rows.map((r) => r.name));
    }

    beforeAll(async () => {
        dbPath = path.join(os.tmpdir(), `migration33-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('crea la tabla task_subtasks con las columnas esperadas', async () => {
        const cols = await columnNames('task_subtasks');
        expect(cols).toEqual(expect.arrayContaining(['id', 'task_id', 'title', 'is_done', 'created_at', 'updated_at']));
    });

    it('permite insertar una subtarea asociada a una tarea existente', async () => {
        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`);
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto X', 1)`);
        await run(`INSERT INTO task_boards (project_id, name) VALUES (1, 'Board 1')`);
        await run(`INSERT INTO task_columns (board_id, name, position) VALUES (1, 'To Do', 0)`);
        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea', 1)`);

        const result = await run(`INSERT INTO task_subtasks (task_id, title) VALUES (1, 'Sub 1')`);
        expect(result.changes).toBe(1);

        const rows = await all(`SELECT * FROM task_subtasks WHERE task_id = 1`);
        expect(rows).toHaveLength(1);
        expect(rows[0].is_done).toBe(0);
    });

    it('borra en cascada las subtareas cuando se borra la tarea padre', async () => {
        await run('PRAGMA foreign_keys = ON');

        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea a borrar', 1)`);
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea a borrar'`);
        const taskId = taskRow[0].id;
        await run(`INSERT INTO task_subtasks (task_id, title) VALUES (?, 'Sub huerfana')`, [taskId]);

        await run(`DELETE FROM tasks WHERE id = ?`, [taskId]);

        const remaining = await all(`SELECT * FROM task_subtasks WHERE task_id = ?`, [taskId]);
        expect(remaining).toHaveLength(0);
    });
});
