import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 29 - tablas de cobros', () => {
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
        dbPath = path.join(os.tmpdir(), `migration29-test-${Date.now()}.sqlite`);
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

    it('crea payment_milestones con las columnas esperadas', async () => {
        const cols = await columnNames('payment_milestones');
        expect(cols).toEqual(expect.arrayContaining([
            'id', 'project_id', 'project_milestone_id', 'name', 'description',
            'amount', 'currency', 'trigger_type', 'trigger_value', 'planned_date',
            'status', 'billable_at', 'sort_order', 'created_by', 'created_at', 'updated_at'
        ]));
    });

    it('crea invoices con las columnas esperadas', async () => {
        const cols = await columnNames('invoices');
        expect(cols).toEqual(expect.arrayContaining([
            'id', 'project_id', 'invoice_number', 'issue_date', 'due_date',
            'currency', 'amount', 'status', 'notes', 'created_by', 'created_at', 'updated_at'
        ]));
    });

    it('crea invoice_lines con las columnas esperadas', async () => {
        const cols = await columnNames('invoice_lines');
        expect(cols).toEqual(expect.arrayContaining([
            'id', 'invoice_id', 'payment_milestone_id', 'description', 'amount', 'created_at'
        ]));
    });

    it('crea payments con las columnas esperadas', async () => {
        const cols = await columnNames('payments');
        expect(cols).toEqual(expect.arrayContaining([
            'id', 'invoice_id', 'amount', 'currency', 'payment_date', 'method', 'reference', 'notes', 'created_by', 'created_at'
        ]));
    });

    it('rechaza un trigger_type inválido en payment_milestones', async () => {
        await expect(new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO payment_milestones (project_id, name, amount, currency, trigger_type, status)
                 VALUES (1, 'x', 100, 'CLP', 'invalido', 'pending')`,
                (err) => err ? reject(err) : resolve()
            );
        })).rejects.toThrow();
    });

    it('rechaza un status inválido en invoices', async () => {
        await expect(new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO invoices (project_id, invoice_number, issue_date, due_date, currency, status)
                 VALUES (1, 'F-1', '2026-01-01', '2026-02-01', 'CLP', 'invalido')`,
                (err) => err ? reject(err) : resolve()
            );
        })).rejects.toThrow();
    });

    it('inserta un payment_milestone válido y lo puede leer de vuelta', async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO payment_milestones (project_id, name, amount, currency, trigger_type, planned_date, status)
                 VALUES (1, 'Hito 1', 500000, 'CLP', 'date', '2026-10-01', 'pending')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        const row: any = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM payment_milestones WHERE name = 'Hito 1'`, (err, r) => err ? reject(err) : resolve(r));
        });
        expect(row.amount).toBe(500000);
        expect(row.status).toBe('pending');
    });
});
