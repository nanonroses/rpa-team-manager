import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 36 - task_assignees (multi-asignado completo)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration36-assignees-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);

        // Insertar datos ANTES de correr la migración 36 no es posible con este runner
        // (runMigrations corre todas las migraciones en orden desde una BD vacía), así que
        // el backfill se verifica insertando una tarea con assignee_id directamente vía SQL
        // crudo entre la migración que crea `tasks` y la que crea `task_assignees` no es
        // posible tampoco (runMigrations es atómico). En su lugar, se verifica el backfill
        // corriendo TODAS las migraciones, insertando una tarea con assignee_id manualmente,
        // y re-ejecutando manualmente el SQL de backfill de la migración 36 (el mismo texto
        // que usa migrationList.ts) para confirmar que es idempotente y correcto.
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });

        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`);
        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u2', 'u2@x.com', 'h', 'U2', 'rpa_developer')`);
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto X', 1)`);
        await run(`INSERT INTO task_boards (project_id, name) VALUES (1, 'Board 1')`);
        await run(`INSERT INTO task_columns (board_id, name, position) VALUES (1, 'To Do', 0)`);
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('crea la tabla task_assignees con las columnas esperadas', async () => {
        const cols = await columnNames('task_assignees');
        expect(cols).toEqual(expect.arrayContaining(['id', 'task_id', 'user_id', 'created_at']));
    });

    it('permite agregar un responsable a una tarea existente', async () => {
        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea', 1)`);
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea'`);
        const taskId = taskRow[0].id;

        const result = await run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, 2)`, [taskId]);
        expect(result.changes).toBe(1);

        const rows = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(rows).toHaveLength(1);
        expect(rows[0].user_id).toBe(2);
    });

    it('no permite agregar el mismo responsable dos veces a la misma tarea', async () => {
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea'`);
        const taskId = taskRow[0].id;
        await expect(run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, 2)`, [taskId])).rejects.toThrow();
    });

    it('borra en cascada los responsables cuando se borra la tarea padre', async () => {
        await run('PRAGMA foreign_keys = ON');

        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea a borrar', 1)`);
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea a borrar'`);
        const taskId = taskRow[0].id;
        await run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, 2)`, [taskId]);

        await run(`DELETE FROM tasks WHERE id = ?`, [taskId]);

        const remaining = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(remaining).toHaveLength(0);
    });

    it('el backfill (mismo SQL que la migración) copia assignee_id existente a task_assignees sin duplicar', async () => {
        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id, assignee_id) VALUES (1, 1, 'Tarea con assignee previo', 1, 2)`);

        // Mismo SQL que se agrega como paso de backfill en migrationList.ts (v36)
        await run(`INSERT OR IGNORE INTO task_assignees (task_id, user_id) SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL`);

        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea con assignee previo'`);
        const taskId = taskRow[0].id;
        const rows = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(rows).toHaveLength(1);
        expect(rows[0].user_id).toBe(2);

        // Re-correr el mismo backfill no debe duplicar (idempotente)
        await run(`INSERT OR IGNORE INTO task_assignees (task_id, user_id) SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL`);
        const rowsAfterRerun = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(rowsAfterRerun).toHaveLength(1);
    });
});
