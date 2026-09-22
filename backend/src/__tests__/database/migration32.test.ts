import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 32 - notificaciones in-app (link, sender_id, event_key)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration32-test-${Date.now()}.sqlite`);
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

    it('agrega link, sender_id y event_key a notifications', async () => {
        const cols = await columnNames('notifications');
        expect(cols).toEqual(expect.arrayContaining(['link', 'sender_id', 'event_key']));
    });

    it('permite insertar una notificación con las columnas nuevas', async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        const insertError: Error | null = await new Promise((resolve) => {
            db.run(
                `INSERT INTO notifications (user_id, title, event_key, entity_type, entity_id, sender_id, link)
                 VALUES (1, 'Título', 'task_assigned', 'task', 5, 1, '/tasks?taskId=5')`,
                (err) => resolve(err)
            );
        });
        expect(insertError).toBeNull();
    });
});
