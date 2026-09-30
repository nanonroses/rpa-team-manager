import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 46 - Centros de costos, imputación comercial y cobranza', () => {
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
        dbPath = path.join(os.tmpdir(), `migration46-cecos-test-${Date.now()}.sqlite`);
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

    it('crea la tabla cost_centers con las columnas requeridas', async () => {
        const cols = await columnNames('cost_centers');
        expect(cols).toEqual(
            expect.arrayContaining([
                'id',
                'code',
                'name',
                'country',
                'category',
                'is_rpa',
                'is_active',
                'created_at',
                'updated_at'
            ])
        );
    });

    it('inserta los 28 Centros de Costo oficiales', async () => {
        const rows = await all('SELECT * FROM cost_centers');
        expect(rows.length).toBe(28);

        const chileRows = rows.filter((r) => r.country === 'CHILE');
        const peruRows = rows.filter((r) => r.country === 'PERU');
        const usaRows = rows.filter((r) => r.country === 'USA');

        expect(chileRows.length).toBe(13);
        expect(peruRows.length).toBe(8);
        expect(usaRows.length).toBe(7);
    });

    it('identifica y marca correctamente los CECOs de RPA e IA', async () => {
        const rpaRows = await all('SELECT code, name, country FROM cost_centers WHERE is_rpa = 1 ORDER BY code');
        const codes = rpaRows.map((r) => r.code);

        expect(codes).toEqual(
            expect.arrayContaining([
                'RPA-L', 'RPA-P', 'RPA-S',
                'P-RPA-L', 'P-RPA-P', 'P-RPA-S',
                'U-RPA-L', 'U-RPA-P', 'U-RPA-S'
            ])
        );
        expect(rpaRows.length).toBe(9);
    });

    it('agrega la columna cost_center_id a payment_milestones y a invoice_lines', async () => {
        const milestoneCols = await columnNames('payment_milestones');
        expect(milestoneCols).toContain('cost_center_id');

        const invoiceLineCols = await columnNames('invoice_lines');
        expect(invoiceLineCols).toContain('cost_center_id');
    });

    it('crea la tabla project_cost_center_allocations para la imputación comercial', async () => {
        const cols = await columnNames('project_cost_center_allocations');
        expect(cols).toEqual(
            expect.arrayContaining([
                'id',
                'project_id',
                'quote_id',
                'cost_center_id',
                'amount',
                'percentage',
                'currency',
                'description'
            ])
        );
    });
});
