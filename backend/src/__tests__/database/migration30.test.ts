import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 30 - timesheet_periods y columnas de aprobación en time_entries', () => {
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
        dbPath = path.join(os.tmpdir(), `migration30-test-${Date.now()}.sqlite`);
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

    it('crea timesheet_periods con las columnas esperadas', async () => {
        const cols = await columnNames('timesheet_periods');
        expect(cols).toEqual(expect.arrayContaining([
            'id', 'user_id', 'period_start', 'period_end', 'status',
            'submitted_at', 'approved_by', 'approved_at', 'rejection_reason',
            'created_at', 'updated_at'
        ]));
    });

    it('agrega las columnas de aprobación a time_entries', async () => {
        const cols = await columnNames('time_entries');
        expect(cols).toEqual(expect.arrayContaining([
            'approval_status', 'timesheet_period_id', 'approved_by', 'approved_at',
            'cost_rate_snapshot', 'bill_rate_snapshot', 'is_locked'
        ]));
    });

    it('las filas existentes de time_entries quedan en approval_status=draft y is_locked=0', async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'rpa_developer')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO time_entries (user_id, project_id, hours, date) VALUES (1, NULL, 1, '2026-09-01')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        const row: any = await new Promise((resolve, reject) => {
            db.get(`SELECT approval_status, is_locked FROM time_entries WHERE user_id = 1`, (err, r) => err ? reject(err) : resolve(r));
        });
        expect(row.approval_status).toBe('draft');
        expect(row.is_locked).toBe(0);
    });

    it('rechaza un status inválido en timesheet_periods', async () => {
        await expect(new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO timesheet_periods (user_id, period_start, period_end, status) VALUES (1, '2026-09-01', '2026-09-07', 'invalido')`,
                (err) => err ? reject(err) : resolve()
            );
        })).rejects.toThrow();
    });

    it('rechaza dos periodos para el mismo usuario con el mismo period_start', async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO timesheet_periods (user_id, period_start, period_end, status) VALUES (1, '2026-09-01', '2026-09-07', 'open')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        await expect(new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO timesheet_periods (user_id, period_start, period_end, status) VALUES (1, '2026-09-01', '2026-09-07', 'open')`,
                (err) => err ? reject(err) : resolve()
            );
        })).rejects.toThrow();
    });
});
