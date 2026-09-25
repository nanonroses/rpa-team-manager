import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

export interface RealTestDb {
    query(sql: string, params?: any[]): Promise<any[]>;
    get(sql: string, params?: any[]): Promise<any>;
    run(sql: string, params?: any[]): Promise<{ id?: number; changes: number }>;
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    close(): Promise<void>;
}

export interface TestUsers {
    lead: number;
    dev: number;
    ops: number;
}

// Uso: jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));
// y en beforeAll: realDbHolder.current = await createRealTestDb();
export const realDbHolder: { current: RealTestDb | null } = { current: null };

function current(): RealTestDb {
    if (!realDbHolder.current) throw new Error('realDbHolder.current no inicializado (falta createRealTestDb en beforeAll)');
    return realDbHolder.current;
}

export const realDbProxy = {
    query: (sql: string, params?: any[]) => current().query(sql, params),
    get: (sql: string, params?: any[]) => current().get(sql, params),
    run: (sql: string, params?: any[]) => current().run(sql, params),
    beginTransaction: () => current().beginTransaction(),
    commit: () => current().commit(),
    rollback: () => current().rollback()
};

export async function createRealTestDb(): Promise<RealTestDb> {
    const dbPath = path.join(
        os.tmpdir(),
        `real-test-db-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`
    );
    const manager = new MigrationManager();
    await manager.init(dbPath);
    await manager.runMigrations(migrations);
    await manager.close();

    const conn: sqlite3.Database = await new Promise((resolve, reject) => {
        const c = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(c)));
    });
    const exec = (sql: string) =>
        new Promise<void>((resolve, reject) => conn.exec(sql, (err) => (err ? reject(err) : resolve())));

    await exec('PRAGMA foreign_keys = ON');

    return {
        query: (sql, params = []) =>
            new Promise((resolve, reject) => conn.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))),
        get: (sql, params = []) =>
            new Promise((resolve, reject) => conn.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))),
        run: (sql, params = []) =>
            new Promise((resolve, reject) =>
                conn.run(sql, params, function (this: sqlite3.RunResult, err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, changes: this.changes });
                })
            ),
        beginTransaction: () => exec('BEGIN TRANSACTION'),
        commit: () => exec('COMMIT'),
        rollback: () => exec('ROLLBACK'),
        close: async () => {
            await new Promise<void>((resolve) => conn.close(() => resolve()));
            fs.unlinkSync(dbPath);
        }
    };
}

export async function seedBasicUsers(db: RealTestDb): Promise<TestUsers> {
    const insert = (username: string, role: string) =>
        db.run(
            `INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, 'h', ?, ?)`,
            [username, `${username}@test.cl`, username.toUpperCase(), role]
        );
    const lead = await insert('lead', 'team_lead');
    const dev = await insert('dev', 'rpa_developer');
    const ops = await insert('ops', 'rpa_operations');
    return { lead: lead.id!, dev: dev.id!, ops: ops.id! };
}
