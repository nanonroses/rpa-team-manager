import { logger } from '../utils/logger';

export interface SchemaRepairDb {
    query(sql: string, params?: any[]): Promise<any[]>;
    run(sql: string, params?: any[]): Promise<unknown>;
}

// Columnas que agrega la migración 30. Una BD cuyo time_entries fue recreado a mano (p. ej. al
// limpiar datos) queda con la v30 registrada como aplicada pero sin estas columnas; el runner de
// migraciones no puede repararlo porque ADD COLUMN no es idempotente en SQLite.
export const TIME_ENTRIES_APPROVAL_COLUMNS: ReadonlyArray<{ name: string; ddl: string }> = [
    { name: 'approval_status', ddl: `approval_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected'))` },
    { name: 'timesheet_period_id', ddl: 'timesheet_period_id INTEGER REFERENCES timesheet_periods(id)' },
    { name: 'approved_by', ddl: 'approved_by INTEGER REFERENCES users(id)' },
    { name: 'approved_at', ddl: 'approved_at DATETIME' },
    { name: 'cost_rate_snapshot', ddl: 'cost_rate_snapshot DECIMAL(10,2)' },
    { name: 'bill_rate_snapshot', ddl: 'bill_rate_snapshot DECIMAL(10,2)' },
    { name: 'is_locked', ddl: 'is_locked BOOLEAN NOT NULL DEFAULT 0' }
];

export async function repairTimeEntriesApprovalColumns(db: SchemaRepairDb): Promise<string[]> {
    const existing = (await db.query('PRAGMA table_info(time_entries)')).map((c: any) => c.name);
    if (existing.length === 0) return [];

    const added: string[] = [];
    for (const col of TIME_ENTRIES_APPROVAL_COLUMNS) {
        if (!existing.includes(col.name)) {
            await db.run(`ALTER TABLE time_entries ADD COLUMN ${col.ddl}`);
            added.push(col.name);
        }
    }

    await db.run('CREATE INDEX IF NOT EXISTS idx_time_entries_approval_status ON time_entries(approval_status)');
    await db.run('CREATE INDEX IF NOT EXISTS idx_time_entries_period ON time_entries(timesheet_period_id)');

    if (added.length > 0) {
        logger.warn(`time_entries reparada: se agregaron columnas faltantes de la migración 30 (${added.join(', ')})`);
    }
    return added;
}
