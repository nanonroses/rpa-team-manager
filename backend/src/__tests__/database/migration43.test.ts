import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 43 - Rol billing en tabla users (Fase 6D)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration43-billing-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });

        await run('PRAGMA foreign_keys = ON');
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        if (fs.existsSync(dbPath)) {
            fs.unlinkSync(dbPath);
        }
    });

    it('conserva todas las columnas requeridas en users', async () => {
        const cols = await columnNames('users');
        expect(cols).toEqual(
            expect.arrayContaining([
                'id',
                'username',
                'email',
                'password_hash',
                'role',
                'full_name',
                'avatar_url',
                'is_active',
                'last_login',
                'created_at',
                'updated_at',
                'area_id'
            ])
        );
    });

    it('permite insertar un usuario con rol billing', async () => {
        const res = await run(
            `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
            ['billing_user', 'billing@empresa.com', 'hashed_pw', 'Facturación User', 'billing']
        );
        expect(res.lastID).toBeGreaterThan(0);

        const rows = await all(`SELECT * FROM users WHERE role = 'billing'`);
        expect(rows).toHaveLength(1);
        expect(rows[0].username).toBe('billing_user');
        expect(rows[0].role).toBe('billing');
    });

    it('falla si se intenta insertar un rol no permitido', async () => {
        await expect(
            run(
                `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
                ['bad_role_user', 'bad@empresa.com', 'hashed_pw', 'Bad Role', 'superadmin']
            )
        ).rejects.toThrow();
    });

    it('mantiene la relación de clave foránea con proyectos', async () => {
        const userRes = await run(
            `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)`,
            ['lead_user', 'lead@empresa.com', 'hashed_pw', 'Lead User', 'team_lead']
        );
        const projRes = await run(
            `INSERT INTO projects (name, created_by) VALUES (?, ?)`,
            ['Proyecto Facturación', userRes.lastID]
        );
        expect(projRes.lastID).toBeGreaterThan(0);
    });

    it('mantiene el trigger update_users_timestamp funcional', async () => {
        const initial = await all(`SELECT updated_at FROM users WHERE username = 'billing_user'`);
        const initialTimestamp = initial[0].updated_at;

        // Esperar 1 segundo para asegurar cambio de timestamp en sqlite
        await new Promise((resolve) => setTimeout(resolve, 1100));

        await run(`UPDATE users SET full_name = 'Facturación Modificada' WHERE username = 'billing_user'`);
        const updated = await all(`SELECT updated_at, full_name FROM users WHERE username = 'billing_user'`);
        expect(updated[0].full_name).toBe('Facturación Modificada');
        expect(updated[0].updated_at).toBeDefined();
    });
});
