import { createRealTestDb, RealTestDb } from '../helpers/realTestDb';
import { repairTimeEntriesApprovalColumns, TIME_ENTRIES_APPROVAL_COLUMNS } from '../../database/schemaRepair';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

async function columnNames(db: RealTestDb, table: string): Promise<string[]> {
    return (await db.query(`PRAGMA table_info(${table})`)).map((c: any) => c.name);
}

// Reproduce la BD local real: time_entries recreado con el esquema de la v16, sin las columnas de la v30.
async function breakTimeEntries(db: RealTestDb): Promise<void> {
    await db.run('DROP TABLE time_entries');
    await db.run(`CREATE TABLE time_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_id INTEGER,
        project_id INTEGER,
        description TEXT,
        hours DECIMAL(5,2) NOT NULL CHECK (hours >= 0),
        date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        is_billable BOOLEAN DEFAULT 1,
        hourly_rate DECIMAL(8,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
}

describe('schemaRepair - columnas de aprobación de time_entries (migración 30)', () => {
    let db: RealTestDb;

    beforeEach(async () => {
        db = await createRealTestDb();
    });

    afterEach(async () => {
        await db.close();
    });

    it('en una BD sana no agrega nada', async () => {
        const added = await repairTimeEntriesApprovalColumns(db);
        expect(added).toEqual([]);
    });

    it('agrega las 7 columnas faltantes y conserva las filas existentes con approval_status = draft', async () => {
        await breakTimeEntries(db);
        await db.run(`INSERT INTO time_entries (user_id, hours, date) VALUES (1, 4, '2026-09-20')`);

        const added = await repairTimeEntriesApprovalColumns(db);

        expect(added.sort()).toEqual(TIME_ENTRIES_APPROVAL_COLUMNS.map((c) => c.name).sort());
        const cols = await columnNames(db, 'time_entries');
        for (const col of TIME_ENTRIES_APPROVAL_COLUMNS) {
            expect(cols).toContain(col.name);
        }
        const rows = await db.query('SELECT hours, approval_status, is_locked FROM time_entries');
        expect(rows).toEqual([{ hours: 4, approval_status: 'draft', is_locked: 0 }]);
    });

    it('es idempotente: una segunda pasada no agrega nada ni falla', async () => {
        await breakTimeEntries(db);
        await repairTimeEntriesApprovalColumns(db);

        const secondPass = await repairTimeEntriesApprovalColumns(db);

        expect(secondPass).toEqual([]);
    });

    it('crea los índices de approval_status y timesheet_period_id', async () => {
        await breakTimeEntries(db);
        await repairTimeEntriesApprovalColumns(db);

        const indexes = (await db.query(`PRAGMA index_list(time_entries)`)).map((i: any) => i.name);
        expect(indexes).toEqual(expect.arrayContaining(['idx_time_entries_approval_status', 'idx_time_entries_period']));
    });
});

describe('Migración v37 - corrección de horas en global_settings', () => {
    let db: RealTestDb;

    beforeEach(async () => {
        db = await createRealTestDb();
    });

    afterEach(async () => {
        await db.close();
    });

    it('establece monthly_hours = 168 y weekly_hours = 42 en global_settings', async () => {
        const monthly = await db.get('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['monthly_hours']);
        const weekly = await db.get('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['weekly_hours']);

        expect(monthly?.setting_value).toBe('168');
        expect(weekly?.setting_value).toBe('42');
    });

    it('es idempotente: ejecutarla dos veces produce el mismo resultado', async () => {
        const monthly1 = await db.get('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['monthly_hours']);
        const weekly1 = await db.get('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['weekly_hours']);
        expect(monthly1?.setting_value).toBe('168');
        expect(weekly1?.setting_value).toBe('42');

        // Re-ejecutamos todas las migraciones (incluida v37, ya aplicada) contra el MISMO archivo
        // de BD, usando una segunda conexión/manager independiente, tal como ocurriría al reiniciar
        // el backend con una BD ya migrada. runMigrations() debe detectar que v37 ya está en
        // schema_migrations y no reaplicarla ni fallar.
        const manager = new MigrationManager();
        await manager.init(db.dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        const monthly2 = await db.get('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['monthly_hours']);
        const weekly2 = await db.get('SELECT setting_value FROM global_settings WHERE setting_key = ?', ['weekly_hours']);

        expect(monthly2?.setting_value).toBe('168');
        expect(weekly2?.setting_value).toBe('42');
    });
});
