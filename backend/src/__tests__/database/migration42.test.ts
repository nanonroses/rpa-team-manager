import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 42 - project_log_entries (bitácora del proyecto)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration42-log-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });

        await run('PRAGMA foreign_keys = ON');
        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`);
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto X', 1)`);
        await run(`INSERT INTO files (filename, original_filename, file_path, file_size, mime_type, file_hash, uploaded_by) VALUES ('a.pdf', 'a.pdf', '/tmp/a.pdf', 100, 'application/pdf', 'hash1', 1)`);
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('crea la tabla project_log_entries con las columnas esperadas', async () => {
        const cols = await columnNames('project_log_entries');
        expect(cols).toEqual(expect.arrayContaining(['id', 'project_id', 'entry_type', 'description', 'file_id', 'created_by', 'created_at']));
    });

    it('permite crear una entrada de bitácora con un tipo válido', async () => {
        const result = await run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, created_by) VALUES (1, 'decision', 'Se decidió posponer el go-live', 1)`
        );
        expect(result.changes).toBe(1);

        const rows = await all(`SELECT * FROM project_log_entries WHERE project_id = 1`);
        expect(rows).toHaveLength(1);
        expect(rows[0].entry_type).toBe('decision');
    });

    it('rechaza un entry_type fuera del catálogo permitido', async () => {
        await expect(
            run(`INSERT INTO project_log_entries (project_id, entry_type, description, created_by) VALUES (1, 'invalido', 'x', 1)`)
        ).rejects.toThrow();
    });

    it('permite asociar un archivo existente', async () => {
        const result = await run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, file_id, created_by) VALUES (1, 'incident', 'Falla en producción', 1, 1)`
        );
        const rows = await all(`SELECT * FROM project_log_entries WHERE id = ?`, [result.lastID]);
        expect(rows[0].file_id).toBe(1);
    });

    it('pone file_id en NULL si el archivo asociado se borra (no borra la entrada)', async () => {
        const entry = await run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, file_id, created_by) VALUES (1, 'incident', 'Con adjunto a borrar', 1, 1)`
        );
        await run(`DELETE FROM files WHERE id = 1`);
        const rows = await all(`SELECT * FROM project_log_entries WHERE id = ?`, [entry.lastID]);
        expect(rows).toHaveLength(1);
        expect(rows[0].file_id).toBeNull();
    });

    it('borra en cascada las entradas cuando se borra el proyecto', async () => {
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto a borrar', 1)`);
        const projectRow = await all(`SELECT id FROM projects WHERE name = 'Proyecto a borrar'`);
        const projectId = projectRow[0].id;
        await run(`INSERT INTO project_log_entries (project_id, entry_type, description, created_by) VALUES (?, 'decision', 'x', 1)`, [projectId]);

        await run(`DELETE FROM projects WHERE id = ?`, [projectId]);

        const remaining = await all(`SELECT * FROM project_log_entries WHERE project_id = ?`, [projectId]);
        expect(remaining).toHaveLength(0);
    });
});
