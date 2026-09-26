import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';
import { reorderColumnPositions } from '../../utils/batch-deletion.utils';

describe('reorderColumnPositions - respeta el orden manual (position), no el de creacion (id)', () => {
    let dbPath: string;
    let sqliteDb: sqlite3.Database;

    function run(sql: string, params: any[] = []): Promise<{ id?: number; changes: number }> {
        return new Promise((resolve, reject) => {
            sqliteDb.run(sql, params, function (this: any, err) {
                if (err) reject(err);
                else resolve({ id: this.lastID, changes: this.changes });
            });
        });
    }

    function all(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            sqliteDb.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    // Adaptador minimo compatible con la firma db.run() que espera reorderColumnPositions
    const dbAdapter = { run };

    beforeAll(async () => {
        dbPath = path.join(os.tmpdir(), `batch-deletion-reorder-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        sqliteDb = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });

        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`);
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto X', 1)`);
        await run(`INSERT INTO task_boards (project_id, name) VALUES (1, 'Board 1')`);
        await run(`INSERT INTO task_columns (board_id, name, position) VALUES (1, 'To Do', 0)`);
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => sqliteDb.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('mantiene el orden manual (drag-and-drop) al renumerar tras un borrado, aunque no coincida con el orden de creacion', async () => {
        // Se crean 4 tareas en orden de id 1,2,3,4, pero el usuario ya las reordeno
        // manualmente a mano: C(1), A(3), D(2), B(4) - el orden de "position" no sigue al de "id".
        const taskA = await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id, position) VALUES (1, 1, 'A', 1, 3)`);
        const taskB = await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id, position) VALUES (1, 1, 'B', 1, 4)`);
        const taskC = await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id, position) VALUES (1, 1, 'C', 1, 1)`);
        const taskD = await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id, position) VALUES (1, 1, 'D', 1, 2)`);

        // Se borra B (la ultima en el orden manual) - deberia quedar C, D, A en ese orden.
        await run(`DELETE FROM tasks WHERE id = ?`, [taskB.id]);

        await reorderColumnPositions(dbAdapter, new Set([1]), 'tasks');

        const remaining = await all(`SELECT id, title, position FROM tasks WHERE column_id = 1 ORDER BY position ASC`);
        expect(remaining.map((t) => t.title)).toEqual(['C', 'D', 'A']);
        expect(remaining.map((t) => t.position)).toEqual([1, 2, 3]);
        expect(remaining.find((t) => t.id === taskC.id)?.position).toBe(1);
        expect(remaining.find((t) => t.id === taskD.id)?.position).toBe(2);
        expect(remaining.find((t) => t.id === taskA.id)?.position).toBe(3);
    });
});
