# Fase 6 · Sub-proyecto A — Saneamiento del flujo de proyectos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Arreglar los errores que hoy impiden medir un proyecto: precio de venta y horas que se pierden, financieros que se borran al editar, asignaciones de equipo que nunca se guardan, horas infladas, columnas faltantes de `time_entries` en la BD local, finanzas expuestas a cualquier rol y el valor HH calculado por rol con 160 h fijas.

**Architecture:** Cambios quirúrgicos sobre el código existente, sin tablas nuevas. (1) Un reparador de esquema al arranque (`backend/src/database/schemaRepair.ts`, mismo precedente que `fixFilesTableIfNeeded` en `database.ts`) agrega de forma idempotente las 7 columnas de la migración 30 que faltan en la BD local. (2) `projectController` persiste los campos financieros con un helper de UPSERT parcial, enmascara datos financieros para quien no es `team_lead` y arregla asignaciones, conteo de horas y creación desde cotización. (3) `financialRoutes` exige `team_lead` en todo; el valor HH pasa a ser costo empresa ÷ `global_settings.monthly_hours`, por persona, con un endpoint `GET /api/financial/team-costs` y una tarjeta nueva en Configuración. (4) `financeService` usa `project_financials.sale_price` cuando existe. Los tests de controller más delicados corren contra **SQLite real** (helper nuevo `realTestDb.ts`) para no repetir el bug de multi-asignado que los mocks no detectaron.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend, Jest + ts-jest + supertest). React 18/TypeScript/Ant Design 5 (frontend, Vitest + Testing Library). Sin dependencias nuevas.

**Spec:** `C:\Users\nanon\.claude\plans\pasted-content-id-c56b-vamos-al-declarative-crane.md` — sección "Sub-proyecto A — Saneamiento del flujo actual (bloqueante)" y "Decisiones de producto" 6 y 7 (valor HH = costo empresa mensual ÷ horas del mes, por persona; sueldos/HH/costos/márgenes solo `team_lead`).

## Global Constraints

- Rama nueva `fase6a-saneamiento` creada desde `main`. No mergear ni abrir PR sin preguntar al usuario.
- Acceso a BD siempre vía `db.query` / `db.get` / `db.run` (nunca `db.all`). Firmas reales (`backend/src/database/database.ts`): `query(sql, params[]) => Promise<any[]>`, `get(sql, params[]) => Promise<any>`, `run(sql, params[]) => Promise<{ id?: number; changes: number }>`, `beginTransaction()`, `commit()`, `rollback()`.
- Roles reales (CHECK de `users.role`, migración 1): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. No existe otro rol.
- Estados reales de `projects.status` (CHECK, migración 1): `'active' | 'on_hold' | 'completed' | 'cancelled'`. **`'planning'` no existe en la BD**: se elimina de validación, controller y frontend; el valor por defecto pasa a `'active'`. (La etapa "En cotización" llega en el Sub-proyecto B como columna aparte.)
- Valor HH = `monthly_cost / monthly_hours`, con `monthly_hours` leído de `global_settings` vía `financeService.getMonthlyHours()` (el usuario fijó 168 = 42 h × 4 semanas, ver "Decisiones del usuario"). Nunca el 160 fijo.
- Toda ruta que lea o escriba costos, tarifas, precio de venta, utilidad o ROI: solo `team_lead` (`authorize(['team_lead'])`). Respuestas de proyecto y asignaciones a otros roles no incluyen `sale_price`, `budgeted_cost`, `budget_spent`, `delay_cost`, `penalty_cost`, `monthly_cost`, `hourly_rate`.
- Tests backend con mocks: `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))`. Tests con SQLite real: helper `backend/src/__tests__/helpers/realTestDb.ts` (Task 1).
- Tests frontend: Vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest'`), molde `frontend/src/__tests__/components/ProjectHealthCard.test.tsx`.
- Textos visibles al usuario en español.
- Cada tarea termina con `npx tsc --noEmit` limpio en el paquete tocado y commit propio.

## Decisiones del usuario 2026-09-25 (PREVALECEN sobre cualquier otra parte de este plan)

1. **Horas del mes = 168** (42 h semanales × 4 semanas). Valor HH = costo empresa mensual ÷ 168.
   - En **Task 1**, agregar la migración **v37** en `migrationList.ts` (SQL plano, se aplica una sola vez): `UPDATE global_settings SET setting_value = '168' WHERE setting_key = 'monthly_hours'; UPDATE global_settings SET setting_value = '42' WHERE setting_key = 'weekly_hours';`. Incluir un test con SQLite real que confirme los valores 168 y 42 después de migrar.
   - En todo el plan, el respaldo de `getMonthlyHours()` pasa de **176 a 168**: en el código, en los tests ("usa 168, nunca NaN ni Infinity") y en el Review Focus. Los valores 176 que aparecen como *mock* en los tests pueden quedar, pero conviene cambiarlos a 168 por consistencia.
   - Recorrido manual de Task 7: el costo empresa de "RPA Developer 1" se fija en **1.680.000** y debe mostrar un Valor HH de **$10.000** con `monthly_hours` = 168.
2. **Quién crea proyectos y quién asigna gente:**
   - `rpa_operations` crea **su propio** proyecto. `team_lead` también puede crear.
   - Cuando lo crea un `rpa_operations`, queda **asignado automáticamente a sí mismo**: `projects.assigned_to = req.user.id` y una fila en `project_assignments` con rol `lead`, 100 % de dedicación y `assigned_by = req.user.id`. Se ignora cualquier `assigned_to` o `assigned_users` que venga en el body.
   - **Solo `team_lead` asigna o agrega a otros devs** (endpoints de asignación y `assigned_to`/`assigned_users` al crear o editar). Pasa en cerca del 1 % de los casos; no hace falta optimizar la UI para eso.
   - En el frontend (`CreateProjectModal.tsx`), `rpa_operations` no ve el selector de equipo. Muestra el texto "Quedarás asignado a este proyecto".
   - Tests en **Task 2 y Task 3**:
     - `rpa_operations` crea un proyecto y queda como `assigned_to` y con su fila de asignación, aunque el body traiga otro usuario.
     - `rpa_operations` recibe 403 al intentar asignar a otro dev.

## Review Focus

- **Reparar la BD local no debe perder horas ya cargadas:** una BD cuyo `time_entries` fue recreado sin las columnas de la v30 y ya tiene filas debe conservarlas tras la reparación, con `approval_status = 'draft'`. Test en Task 1.
- **Editar solo el nombre o la descripción de un proyecto no debe tocar `project_financials`** (hoy cualquier edición con `budget` borra la fila y pierde `hourly_rate`). Test en Task 2.
- **Un `rpa_operations` o `rpa_developer` que envía `sale_price` por la API no debe poder escribirlo ni verlo en la respuesta.** Test en Task 2.
- **Re-guardar el equipo con un payload inválido no debe borrar el equipo actual:** la validación va antes del `DELETE`. Test en Task 3.
- **`monthly_hours` vacío, cero o no numérico en `global_settings` no debe producir un valor HH `NaN` o `Infinity`:** cae a 168. Test en Task 5.

---

## Task 1: Reparador de esquema de `time_entries` + helper de SQLite real para tests

**Contexto verificado:** la BD local (`backend/data/database.sqlite`) tiene la migración 30 registrada en `schema_migrations`, pero `time_entries` no tiene `approval_status`, `timesheet_period_id`, `approved_by`, `approved_at`, `cost_rate_snapshot`, `bill_rate_snapshot` ni `is_locked`. Son las únicas columnas faltantes: se comparó tabla por tabla contra una BD recién migrada. El runner de migraciones (`backend/src/database/migrations.ts`) solo ejecuta SQL plano en una transacción, y `ALTER TABLE ... ADD COLUMN` falla si la columna ya existe. Por eso una "migración v37 idempotente" no se puede expresar en ese formato: rompería en toda BD sana. La reparación se hace al arranque, igual que `fixFilesTableIfNeeded`.

**Files:**
- Create: `backend/src/database/schemaRepair.ts`
- Modify: `backend/src/database/database.ts` (en `initializeSchema`, justo después de `await this.fixFilesTableIfNeeded();`, ~línea 123)
- Create: `backend/src/__tests__/helpers/realTestDb.ts`
- Test: `backend/src/__tests__/database/schemaRepair.test.ts`

**Interfaces:**
- Produces: `repairTimeEntriesApprovalColumns(db: SchemaRepairDb): Promise<string[]>` (devuelve los nombres agregados; `[]` si no había nada que reparar).
- Produces (usado por las Tasks 2, 3 y 4): `createRealTestDb(): Promise<RealTestDb>`, `realDbHolder: { current: RealTestDb | null }`, `realDbProxy` (objeto con `query/get/run/beginTransaction/commit/rollback` que delega en `realDbHolder.current`), `seedBasicUsers(db): Promise<TestUsers>` con `TestUsers = { lead: number; dev: number; ops: number }`.

- [ ] **Step 1: Crear el helper de SQLite real**

Crear `backend/src/__tests__/helpers/realTestDb.ts` (el nombre no termina en `.test.ts`, así que Jest no lo toma como suite):

```typescript
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
```

- [ ] **Step 2: Escribir el test que falla del reparador**

Crear `backend/src/__tests__/database/schemaRepair.test.ts`:

```typescript
import { createRealTestDb, RealTestDb } from '../helpers/realTestDb';
import { repairTimeEntriesApprovalColumns, TIME_ENTRIES_APPROVAL_COLUMNS } from '../../database/schemaRepair';

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
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `cd backend && npx jest src/__tests__/database/schemaRepair.test.ts`
Expected: FAIL con "Cannot find module '../../database/schemaRepair'".

- [ ] **Step 4: Implementar el reparador**

Crear `backend/src/database/schemaRepair.ts`:

```typescript
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
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `cd backend && npx jest src/__tests__/database/schemaRepair.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Enganchar el reparador al arranque**

En `backend/src/database/database.ts`, agregar el import junto a los demás del inicio del archivo:

```typescript
import { repairTimeEntriesApprovalColumns } from './schemaRepair';
```

Y en `initializeSchema()`, inmediatamente después de `await this.fixFilesTableIfNeeded();`:

```typescript
            await repairTimeEntriesApprovalColumns(this);
```

(`this.query` y `this.run` del singleton ya cumplen la interfaz `SchemaRepairDb`.)

- [ ] **Step 7: Verificar tipos y commit**

Run: `cd backend && npx tsc --noEmit && npx jest src/__tests__/database`
Expected: sin errores de tipos; todos los tests de `database/` en PASS.

```bash
git add backend/src/database/schemaRepair.ts backend/src/database/database.ts backend/src/__tests__/helpers/realTestDb.ts backend/src/__tests__/database/schemaRepair.test.ts
git commit -m "fix(fase6a): repara al arrancar las columnas de aprobacion de time_entries que faltan en BDs recreadas"
```

---

## Task 2: Alta y edición de proyecto guardan precio, horas y campos v27 sin borrar financieros; datos financieros solo para team_lead

**Contexto verificado:**
- `createProjectSchema` / `updateProjectSchema` (`backend/src/validation/schemas.ts:20-35`) no declaran `sale_price` ni `hours_budgeted`, y zod descarta lo que no conoce (`middleware/validation.ts:19` reemplaza `req.body`). Por eso esos campos nunca llegan al controller.
- `updateProject` (`projectController.ts:296-321`) hace `DELETE FROM project_financials` + INSERT solo con 3 columnas, lo que borra `hourly_rate` y lo demás.
- `createProject` usa por defecto `'planning'`, que el CHECK rechaza (500), e ignora `client_id/area_id/pm_user_id/project_type/currency` (columnas de la v27).
- `getProject` y `updateProject` devuelven `sale_price`/`budgeted_cost` a cualquier rol con acceso.
- `budget` también es `.positive()` y no admite `null`, así que borrar el campo en el formulario da 400.

**Files:**
- Modify: `backend/src/validation/schemas.ts:19-35`
- Modify: `backend/src/controllers/projectController.ts` (`getProject` 69-138, `createProject` 141-245, `updateProject` 248-358, más helpers privados nuevos)
- Test: `backend/src/__tests__/validation/schemas.test.ts` (agregar `describe`)
- Test: `backend/src/__tests__/controllers/projectController.financials.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Consumes: `createRealTestDb`, `realDbHolder`, `realDbProxy`, `seedBasicUsers` (Task 1).
- Produces: body de `POST/PUT /api/projects` acepta `sale_price?: number|null`, `sale_price_currency?: 'CLP'|'USD'|'UF'`, `hours_budgeted?: number|null`, `client_id? / area_id? / pm_user_id?: number|null`, `project_type?: 'internal'|'commercial'`, `currency?: 'CLP'|'USD'|'UF'`. Métodos privados `upsertProjectFinancials(projectId: number, input: Record<string, any>): Promise<void>` y `stripFinancialFields<T>(user, row: T): T`.

- [ ] **Step 1: Test de esquema que falla**

Agregar al final de `backend/src/__tests__/validation/schemas.test.ts` (sumar `createProjectSchema, updateProjectSchema` al import existente de `'../../validation/schemas'`):

```typescript
describe('createProjectSchema / updateProjectSchema - campos financieros y v27', () => {
    it('conserva sale_price, hours_budgeted y los campos de v27 en vez de descartarlos', async () => {
        const parsed = await createProjectSchema.parseAsync({
            name: 'P', sale_price: 12000000, sale_price_currency: 'CLP', hours_budgeted: 300,
            client_id: 4, area_id: 1, pm_user_id: 2, project_type: 'commercial', currency: 'UF'
        });
        expect(parsed).toMatchObject({
            sale_price: 12000000, sale_price_currency: 'CLP', hours_budgeted: 300,
            client_id: 4, area_id: 1, pm_user_id: 2, project_type: 'commercial', currency: 'UF'
        });
    });

    it('rechaza el estado planning, que no existe en la BD', async () => {
        await expect(createProjectSchema.parseAsync({ name: 'P', status: 'planning' })).rejects.toThrow();
    });

    it('acepta budget y sale_price en null (campo borrado en el formulario)', async () => {
        const parsed = await updateProjectSchema.parseAsync({ budget: null, sale_price: null });
        expect(parsed).toMatchObject({ budget: null, sale_price: null });
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/validation/schemas.test.ts`
Expected: FAIL (el primer caso recibe un objeto sin `sale_price`; el de `planning` no lanza).

- [ ] **Step 3: Actualizar los esquemas**

En `backend/src/validation/schemas.ts`, reemplazar el bloque `// Project validation schemas` (líneas 19-35) por:

```typescript
// Project validation schemas
// projects.status solo acepta estos 4 valores (CHECK de la migración 1); 'planning' nunca existió en la BD.
const PROJECT_STATUSES = ['active', 'on_hold', 'completed', 'cancelled'] as const;
const CURRENCIES = ['CLP', 'USD', 'UF'] as const;

export const createProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required').max(200),
    description: z.string().max(1000).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    budget: z.number().min(0, 'Budget must be positive').max(999999999.99).optional().nullable(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    assigned_to: z.number().int().positive().optional().nullable(),
    client_id: z.number().int().positive().optional().nullable(),
    area_id: z.number().int().positive().optional().nullable(),
    pm_user_id: z.number().int().positive().optional().nullable(),
    project_type: z.enum(['internal', 'commercial']).optional(),
    currency: z.enum(CURRENCIES).optional(),
    sale_price: z.number().min(0).max(999999999999.99).optional().nullable(),
    sale_price_currency: z.enum(CURRENCIES).optional(),
    hours_budgeted: z.number().min(0).max(99999).optional().nullable()
});

export const updateProjectSchema = createProjectSchema.extend({
    actual_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    actual_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    progress_percentage: z.number().int().min(0).max(100).optional()
}).partial();
```

Run: `cd backend && npx jest src/__tests__/validation/schemas.test.ts` → Expected: PASS.

- [ ] **Step 4: Test de controller (SQLite real) que falla**

Crear `backend/src/__tests__/controllers/projectController.financials.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user, body, params } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

describe('ProjectController - persistencia financiera (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let lead: { id: number; role: string };
    let ops: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        ops = { id: users.ops, role: 'rpa_operations' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new ProjectController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    async function createAs(user: { id: number; role: string }, body: any): Promise<any> {
        const res = mockRes();
        await controller.createProject(makeReq(user, body), res);
        expect(res.status).toHaveBeenCalledWith(201);
        return jsonOf(res);
    }

    it('team_lead crea un proyecto con precio y horas: se guardan en project_financials y el estado por defecto es active', async () => {
        const created = await createAs(lead, { name: 'P1', budget: 5000000, sale_price: 12000000, hours_budgeted: 300 });

        expect(created.status).toBe('active');
        const fin = await testDb.get('SELECT * FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin).toMatchObject({ budgeted_cost: 5000000, sale_price: 12000000, budgeted_hours: 300 });
    });

    it('guarda client_id, area_id, pm_user_id, project_type y currency en projects', async () => {
        const client = await testDb.run(`INSERT INTO clients (name, created_by) VALUES ('Cliente X', ?)`, [users.lead]);
        const area = await testDb.get(`SELECT id FROM business_areas WHERE code = 'RPA_IA'`);

        const created = await createAs(lead, {
            name: 'P-v27', client_id: client.id, area_id: area.id, pm_user_id: users.lead, project_type: 'internal', currency: 'UF'
        });

        const row = await testDb.get('SELECT client_id, area_id, pm_user_id, project_type, currency FROM projects WHERE id = ?', [created.id]);
        expect(row).toEqual({ client_id: client.id, area_id: area.id, pm_user_id: users.lead, project_type: 'internal', currency: 'UF' });
    });

    it('rpa_operations puede crear el proyecto, pero el sale_price que envía se ignora y no aparece en la respuesta', async () => {
        const created = await createAs(ops, { name: 'P-ops', budget: 1000, sale_price: 999999 });

        const fin = await testDb.get('SELECT sale_price, budgeted_cost FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin).toEqual({ sale_price: null, budgeted_cost: 1000 });
        expect(created).not.toHaveProperty('sale_price');
    });

    it('editar solo sale_price actualiza esa columna y conserva hourly_rate y budgeted_hours (no borra la fila)', async () => {
        const created = await createAs(lead, { name: 'P2', sale_price: 1000, hours_budgeted: 10 });
        await testDb.run(`UPDATE project_financials SET hourly_rate = 1.5, hourly_rate_currency = 'UF' WHERE project_id = ?`, [created.id]);

        const res = mockRes();
        await controller.updateProject(makeReq(lead, { sale_price: 2000 }, { id: String(created.id) }), res);

        expect(res.status).not.toHaveBeenCalled();
        const rows = await testDb.query('SELECT sale_price, budgeted_hours, hourly_rate FROM project_financials WHERE project_id = ?', [created.id]);
        expect(rows).toEqual([{ sale_price: 2000, budgeted_hours: 10, hourly_rate: 1.5 }]);
    });

    it('editar solo el nombre no toca project_financials', async () => {
        const created = await createAs(lead, { name: 'P3', budget: 700, sale_price: 5000, hours_budgeted: 20 });
        await testDb.run(`UPDATE project_financials SET hourly_rate = 2 WHERE project_id = ?`, [created.id]);

        const res = mockRes();
        await controller.updateProject(makeReq(lead, { name: 'P3 renombrado' }, { id: String(created.id) }), res);

        const fin = await testDb.get('SELECT budgeted_cost, sale_price, budgeted_hours, hourly_rate FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin).toEqual({ budgeted_cost: 700, sale_price: 5000, budgeted_hours: 20, hourly_rate: 2 });
        expect(jsonOf(res).name).toBe('P3 renombrado');
    });

    it('rpa_developer asignado puede editar la descripción, pero su sale_price se ignora y no lo ve en la respuesta', async () => {
        const created = await createAs(lead, { name: 'P4', sale_price: 8000, assigned_to: users.dev });

        const res = mockRes();
        await controller.updateProject(makeReq(dev, { description: 'nueva', sale_price: 1 }, { id: String(created.id) }), res);

        const fin = await testDb.get('SELECT sale_price FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin.sale_price).toBe(8000);
        expect(jsonOf(res).description).toBe('nueva');
        expect(jsonOf(res)).not.toHaveProperty('sale_price');
    });

    it('getProject oculta los campos financieros a un rpa_developer y los muestra a team_lead', async () => {
        const created = await createAs(lead, { name: 'P5', budget: 300, sale_price: 900, assigned_to: users.dev });

        const resDev = mockRes();
        await controller.getProject(makeReq(dev, {}, { id: String(created.id) }), resDev);
        const devView = jsonOf(resDev);
        for (const field of ['sale_price', 'budgeted_cost', 'budget_spent', 'delay_cost', 'penalty_cost']) {
            expect(devView).not.toHaveProperty(field);
        }

        const resLead = mockRes();
        await controller.getProject(makeReq(lead, {}, { id: String(created.id) }), resLead);
        expect(jsonOf(resLead)).toMatchObject({ sale_price: 900, budgeted_cost: 300 });
    });

    it('updateProject sin campos válidos responde 400', async () => {
        const created = await createAs(lead, { name: 'P6' });
        const res = mockRes();
        await controller.updateProject(makeReq(lead, {}, { id: String(created.id) }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });
});
```

- [ ] **Step 5: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/controllers/projectController.financials.test.ts`
Expected: FAIL. El primer caso da 500 (el CHECK rechaza `'planning'`). Los demás fallan por `sale_price` ausente, fila borrada o campos filtrados.

- [ ] **Step 6: Implementar helpers privados en `ProjectController`**

En `backend/src/controllers/projectController.ts`, dentro de la clase y justo después del constructor, agregar:

```typescript
    // Campo del body -> columna de project_financials.
    private static readonly FINANCIAL_FIELD_MAP: Record<string, string> = {
        budget: 'budgeted_cost',
        sale_price: 'sale_price',
        sale_price_currency: 'sale_price_currency',
        hours_budgeted: 'budgeted_hours'
    };

    // Solo team_lead fija precio/horas vendidas; el presupuesto (budget) lo puede fijar cualquier rol que edite el proyecto.
    private static readonly TEAM_LEAD_ONLY_FINANCIAL_FIELDS = ['sale_price', 'sale_price_currency', 'hours_budgeted'];

    private static readonly FINANCIAL_RESPONSE_FIELDS = ['budgeted_cost', 'budget_spent', 'delay_cost', 'penalty_cost', 'sale_price'];

    private financialInputFor(user: AuthenticatedRequest['user'], body: Record<string, any>): Record<string, any> {
        if (user?.role === 'team_lead') return body;
        const filtered = { ...body };
        for (const field of ProjectController.TEAM_LEAD_ONLY_FINANCIAL_FIELDS) delete filtered[field];
        return filtered;
    }

    // UPSERT parcial: escribe solo las columnas recibidas y nunca borra la fila (hourly_rate y demás se conservan).
    private async upsertProjectFinancials(projectId: number, input: Record<string, any>): Promise<void> {
        const entries = Object.entries(ProjectController.FINANCIAL_FIELD_MAP)
            .filter(([field]) => input[field] !== undefined)
            .map(([field, column]) => [column, input[field]] as [string, any]);
        if (entries.length === 0) return;

        const existing = await db.get('SELECT id FROM project_financials WHERE project_id = ?', [projectId]);
        if (existing) {
            await db.run(
                `UPDATE project_financials SET ${entries.map(([column]) => `${column} = ?`).join(', ')}, updated_at = datetime('now') WHERE project_id = ?`,
                [...entries.map(([, value]) => value), projectId]
            );
        } else {
            await db.run(
                `INSERT INTO project_financials (project_id, ${entries.map(([column]) => column).join(', ')}) VALUES (?, ${entries.map(() => '?').join(', ')})`,
                [projectId, ...entries.map(([, value]) => value)]
            );
        }
    }

    private stripFinancialFields<T extends Record<string, any> | null | undefined>(user: AuthenticatedRequest['user'], row: T): T {
        if (!row || user?.role === 'team_lead') return row;
        const copy: Record<string, any> = { ...row };
        for (const field of ProjectController.FINANCIAL_RESPONSE_FIELDS) delete copy[field];
        return copy as T;
    }
```

- [ ] **Step 7: Reescribir `createProject`**

Reemplazar el cuerpo de `createProject` (líneas 141-245) por:

```typescript
    createProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const {
                name,
                description,
                status = 'active',
                priority = 'medium',
                budget,
                start_date,
                end_date,
                assigned_to,
                client_id,
                area_id,
                pm_user_id,
                project_type = 'commercial',
                currency = 'CLP'
            } = req.body;

            if (!name) {
                res.status(400).json({ error: 'Project name is required' });
                return;
            }

            if (assigned_to) {
                const assignedUser = await db.get('SELECT id FROM users WHERE id = ?', [assigned_to]);
                if (!assignedUser) {
                    res.status(400).json({ error: `Assigned user with ID ${assigned_to} does not exist` });
                    return;
                }
            }

            const result = await db.run(`
                INSERT INTO projects (
                    name, description, status, priority, budget,
                    start_date, end_date, assigned_to, created_by,
                    client_id, area_id, pm_user_id, project_type, currency
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                name, description, status, priority, budget ?? null,
                start_date ?? null, end_date ?? null, assigned_to || null, req.user?.id,
                client_id ?? null, area_id ?? null, pm_user_id ?? null, project_type, currency
            ]);

            const projectId = result.id!;

            await this.upsertProjectFinancials(projectId, this.financialInputFor(req.user, req.body));

            const boardResult = await db.run(`
                INSERT INTO task_boards (
                    project_id, name, description, board_type, is_default
                ) VALUES (?, ?, ?, 'kanban', 1)
            `, [projectId, `${name} Board`, `Main kanban board for ${name}`]);

            const boardId = boardResult.id!;

            const defaultColumns = [
                { name: 'Backlog', position: 1, color: '#gray', is_done: 0 },
                { name: 'To Do', position: 2, color: '#blue', is_done: 0 },
                { name: 'In Progress', position: 3, color: '#yellow', is_done: 0, wip_limit: 3 },
                { name: 'Review', position: 4, color: '#orange', is_done: 0 },
                { name: 'Testing', position: 5, color: '#purple', is_done: 0 },
                { name: 'Done', position: 6, color: '#green', is_done: 1 }
            ];

            for (const column of defaultColumns) {
                await db.run(`
                    INSERT INTO task_columns (
                        board_id, name, position, color, is_done_column, wip_limit
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [boardId, column.name, column.position, column.color, column.is_done, column.wip_limit || null]);
            }

            await activityLogService.logActivity(
                req.user?.id,
                'project',
                projectId,
                'created',
                null,
                { name, status, priority }
            );

            const createdProject = await db.get(`
                SELECT p.*, u.full_name as created_by_name,
                       pf.budgeted_cost, pf.budgeted_hours as hours_budgeted, pf.sale_price
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                LEFT JOIN project_financials pf ON p.id = pf.project_id
                WHERE p.id = ?
            `, [projectId]);

            res.status(201).json(this.stripFinancialFields(req.user, createdProject));
        } catch (error) {
            logger.error('Create project error:', error);
            res.status(500).json({ error: 'Failed to create project' });
        }
    };
```

- [ ] **Step 8: Reescribir `updateProject` y enmascarar `getProject`**

Reemplazar el cuerpo de `updateProject` (líneas 248-358) por:

```typescript
    updateProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updates = req.body;

            const currentProject = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
            if (!currentProject) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            if (req.user?.role === 'rpa_developer' &&
                currentProject.created_by !== req.user.id &&
                currentProject.assigned_to !== req.user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const allowedFields = [
                'name', 'description', 'status', 'priority', 'budget',
                'start_date', 'end_date', 'actual_start_date', 'actual_end_date',
                'assigned_to', 'progress_percentage',
                'client_id', 'area_id', 'pm_user_id', 'project_type', 'currency'
            ];

            const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key) && updates[key] !== undefined);
            const financialInput = this.financialInputFor(req.user, updates);
            const hasFinancialChanges = Object.keys(ProjectController.FINANCIAL_FIELD_MAP)
                .some(field => financialInput[field] !== undefined);

            if (updateFields.length === 0 && !hasFinancialChanges) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }

            if (updateFields.length > 0) {
                const setClause = updateFields.map(field => `${field} = ?`).join(', ');
                const values = updateFields.map(field => updates[field]);
                values.push(id);

                await db.run(`
                    UPDATE projects
                    SET ${setClause}, updated_at = datetime('now')
                    WHERE id = ?
                `, values);
            }

            await this.upsertProjectFinancials(parseInt(id), financialInput);

            await activityLogService.logActivity(
                req.user?.id,
                'project',
                parseInt(id),
                'updated',
                this.stripFinancialFields(req.user, currentProject),
                this.stripFinancialFields(req.user, updates)
            );

            const updatedProject = await db.get(`
                SELECT p.*,
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       pf.budgeted_cost,
                       pf.actual_cost as budget_spent,
                       pf.budgeted_hours as hours_budgeted,
                       0 as hours_spent,
                       pf.delay_cost,
                       pf.penalty_cost,
                       pf.sale_price
                FROM projects p
                LEFT JOIN users u1 ON p.created_by = u1.id
                LEFT JOIN users u2 ON p.assigned_to = u2.id
                LEFT JOIN project_financials pf ON p.id = pf.project_id
                WHERE p.id = ?
            `, [id]);

            res.json(this.stripFinancialFields(req.user, updatedProject));
        } catch (error) {
            logger.error('Update project error:', error);
            res.status(500).json({ error: 'Failed to update project' });
        }
    };
```

En `getProject`, cambiar la respuesta final (`res.json({ ...project, tasks_summary, recent_activities })`) por:

```typescript
            res.json({
                ...this.stripFinancialFields(req.user, project),
                tasks_summary: tasksSummary,
                recent_activities: recentActivities
            });
```

- [ ] **Step 9: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/projectController src/__tests__/validation && npx tsc --noEmit`
Expected: PASS en `projectController.financials.test.ts` (8 tests) y en los `projectController.*.test.ts` ya existentes (ownership, health, activity, comments); tsc limpio.

- [ ] **Step 10: Commit**

```bash
git add backend/src/validation/schemas.ts backend/src/controllers/projectController.ts backend/src/__tests__/validation/schemas.test.ts backend/src/__tests__/controllers/projectController.financials.test.ts
git commit -m "fix(fase6a): alta/edicion de proyecto guardan precio, horas y campos v27 sin borrar financieros; financieros solo para team_lead"
```

---

## Task 3: Las asignaciones de equipo se guardan de verdad; los costos solo los ve team_lead; frontend sin 'planning'

**Contexto verificado:**
- `addProjectAssignments` (`projectController.ts:789-860`) inserta en `created_by`, columna que no existe (la tabla tiene `assigned_by INTEGER NOT NULL`).
- El frontend manda el rol `'member'` (`CreateProjectModal.tsx:167`) y el backend lo usa por defecto (línea 818), pero el CHECK solo acepta `lead|contributor|reviewer|observer`. Por eso guardar un equipo falla siempre.
- Hoy el endpoint borra todo antes de validar: un payload con un error deja el proyecto sin equipo (hoy no ocurre solo porque el INSERT falla dentro de la transacción).
- `getProjectAssignments` devuelve `monthly_cost` y `hourly_rate` a cualquier rol con acceso.

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (`getProjectAssignments` 750-786, `addProjectAssignments` 789-860)
- Test: `backend/src/__tests__/controllers/projectController.assignments.test.ts` (nuevo, SQLite real)
- Create: `frontend/src/components/projects/projectAssignments.ts`
- Modify: `frontend/src/components/projects/CreateProjectModal.tsx` (líneas 84-91, 162-179, 191-197, 236-239)
- Modify: `frontend/src/types/project.ts:35,106-112`
- Modify: `frontend/src/pages/projects/ProjectsPage.tsx:133`
- Test: `frontend/src/__tests__/components/projectAssignments.test.ts` (nuevo)

**Interfaces:**
- Consumes: helper de SQLite real (Task 1).
- Produces: `POST /api/projects/:id/assignments` con body `{ user_assignments: Array<{ user_id: number; allocation_percentage?: number /* entero 0-100, por defecto 100 */; role?: 'lead'|'contributor'|'reviewer'|'observer' /* por defecto 'contributor' */; start_date?: string|null; end_date?: string|null }> }`. Responde 201, o 400 con `{ error }` sin tocar las asignaciones existentes. Frontend: `buildUserAssignments(userIds: number[], allocation?: number): Array<{ user_id: number; allocation_percentage: number; role: 'lead' | 'contributor' }>`.

- [ ] **Step 1: Test backend que falla**

Crear `backend/src/__tests__/controllers/projectController.assignments.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user, body, params } as unknown as AuthenticatedRequest;
}

describe('ProjectController - asignaciones de equipo (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let projectId: number;
    let lead: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        controller = new ProjectController();
        const project = await testDb.run(`INSERT INTO projects (name, created_by, assigned_to) VALUES ('P', ?, ?)`, [users.lead, users.dev]);
        projectId = project.id!;
        await testDb.run(
            `INSERT INTO user_cost_rates (user_id, monthly_cost, hourly_rate, effective_from, is_active, created_by) VALUES (?, 1760000, 10000, '2026-09-01', 1, ?)`,
            [users.dev, users.lead]
        );
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    async function post(body: any): Promise<Response> {
        const res = mockRes();
        await controller.addProjectAssignments(makeReq(lead, body, { id: String(projectId) }), res);
        return res;
    }

    async function activeRows(): Promise<any[]> {
        return testDb.query(
            'SELECT user_id, role, allocation_percentage, assigned_by, start_date FROM project_assignments WHERE project_id = ? AND is_active = 1 ORDER BY user_id',
            [projectId]
        );
    }

    it('guarda dos asignaciones con rol, dedicación, fecha y assigned_by = quien asigna', async () => {
        const res = await post({ user_assignments: [
            { user_id: users.dev, role: 'lead', allocation_percentage: 50, start_date: '2026-10-01' },
            { user_id: users.ops, allocation_percentage: 100 }
        ] });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(await activeRows()).toEqual([
            { user_id: users.dev, role: 'lead', allocation_percentage: 50, assigned_by: users.lead, start_date: '2026-10-01' },
            { user_id: users.ops, role: 'contributor', allocation_percentage: 100, assigned_by: users.lead, start_date: null }
        ]);
    });

    it('rechaza con 400 el rol "member" y deja intacto el equipo existente', async () => {
        const res = await post({ user_assignments: [{ user_id: users.dev, role: 'member' }] });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(await activeRows()).toHaveLength(2);
    });

    it('rechaza con 400 una dedicación fuera de 0-100', async () => {
        const res = await post({ user_assignments: [{ user_id: users.dev, allocation_percentage: 150 }] });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(await activeRows()).toHaveLength(2);
    });

    it('rechaza con 400 un usuario inexistente o repetido', async () => {
        const missing = await post({ user_assignments: [{ user_id: 9999 }] });
        expect(missing.status).toHaveBeenCalledWith(400);

        const duplicated = await post({ user_assignments: [{ user_id: users.dev }, { user_id: users.dev }] });
        expect(duplicated.status).toHaveBeenCalledWith(400);
        expect(await activeRows()).toHaveLength(2);
    });

    it('responde 404 si el proyecto no existe', async () => {
        const res = mockRes();
        await controller.addProjectAssignments(makeReq(lead, { user_assignments: [{ user_id: users.dev }] }, { id: '99999' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('volver a guardar reemplaza el equipo anterior', async () => {
        const res = await post({ user_assignments: [{ user_id: users.dev, role: 'lead' }] });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(await activeRows()).toEqual([
            { user_id: users.dev, role: 'lead', allocation_percentage: 100, assigned_by: users.lead, start_date: null }
        ]);
    });

    it('getProjectAssignments oculta monthly_cost/hourly_rate a un rpa_developer y los muestra a team_lead', async () => {
        const resDev = mockRes();
        await controller.getProjectAssignments(makeReq({ id: users.dev, role: 'rpa_developer' }, {}, { id: String(projectId) }), resDev);
        const devRows = (resDev.json as jest.Mock).mock.calls[0][0];
        expect(devRows[0]).not.toHaveProperty('monthly_cost');
        expect(devRows[0]).not.toHaveProperty('hourly_rate');

        const resLead = mockRes();
        await controller.getProjectAssignments(makeReq(lead, {}, { id: String(projectId) }), resLead);
        expect((resLead.json as jest.Mock).mock.calls[0][0][0]).toMatchObject({ monthly_cost: 1760000, hourly_rate: 10000 });
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/controllers/projectController.assignments.test.ts`
Expected: FAIL. El primer caso da 500 porque la columna `created_by` no existe.

- [ ] **Step 3: Reescribir `addProjectAssignments`**

Reemplazar el método (líneas 789-860) por:

```typescript
    private static readonly ASSIGNMENT_ROLES = ['lead', 'contributor', 'reviewer', 'observer'];

    // POST /api/projects/:id/assignments
    addProjectAssignments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { user_assignments } = req.body;
            const userId = req.user?.id;

            if (!userId) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            if (!Array.isArray(user_assignments) || user_assignments.length === 0) {
                res.status(400).json({ error: 'user_assignments array is required' });
                return;
            }

            const project = await db.get('SELECT id FROM projects WHERE id = ?', [id]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            // Validar todo ANTES de borrar: un payload inválido nunca debe dejar el proyecto sin equipo.
            const datePattern = /^\d{4}-\d{2}-\d{2}$/;
            const seen = new Set<number>();
            const normalized: Array<{ user_id: number; role: string; allocation_percentage: number; start_date: string | null; end_date: string | null }> = [];

            for (const assignment of user_assignments) {
                const { user_id, allocation_percentage = 100, role = 'contributor', start_date = null, end_date = null } = assignment || {};

                if (!Number.isInteger(user_id) || user_id <= 0) {
                    res.status(400).json({ error: 'Cada asignación requiere un user_id válido' });
                    return;
                }
                if (seen.has(user_id)) {
                    res.status(400).json({ error: `El usuario ${user_id} está repetido en la asignación` });
                    return;
                }
                if (!ProjectController.ASSIGNMENT_ROLES.includes(role)) {
                    res.status(400).json({ error: `Rol de asignación inválido: ${role}` });
                    return;
                }
                if (!Number.isInteger(allocation_percentage) || allocation_percentage < 0 || allocation_percentage > 100) {
                    res.status(400).json({ error: 'La dedicación debe ser un entero entre 0 y 100' });
                    return;
                }
                if ((start_date !== null && !datePattern.test(start_date)) || (end_date !== null && !datePattern.test(end_date))) {
                    res.status(400).json({ error: 'Las fechas deben tener formato YYYY-MM-DD' });
                    return;
                }
                const userExists = await db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', [user_id]);
                if (!userExists) {
                    res.status(400).json({ error: `El usuario ${user_id} no existe o está inactivo` });
                    return;
                }

                seen.add(user_id);
                normalized.push({ user_id, role, allocation_percentage, start_date, end_date });
            }

            await db.beginTransaction();
            try {
                await db.run('DELETE FROM project_assignments WHERE project_id = ?', [id]);

                const newAssignments = [];
                for (const a of normalized) {
                    const result = await db.run(`
                        INSERT INTO project_assignments (
                            project_id, user_id, role, allocation_percentage, start_date, end_date, assigned_by, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
                    `, [id, a.user_id, a.role, a.allocation_percentage, a.start_date, a.end_date, userId]);

                    newAssignments.push({ id: result.id, project_id: Number(id), ...a, assigned_by: userId, is_active: 1 });
                }

                await db.commit();

                logger.info(`Added ${newAssignments.length} assignments to project ${id}`);
                res.status(201).json({
                    message: 'Project assignments updated successfully',
                    assignments: newAssignments
                });
            } catch (error) {
                await db.rollback();
                throw error;
            }
        } catch (error) {
            logger.error('Add project assignments error:', error);
            res.status(500).json({ error: 'Failed to update project assignments' });
        }
    };
```

(Si la línea `private static readonly ASSIGNMENT_ROLES` choca con el orden de los miembros, se puede mover junto a los otros `static readonly` agregados en la Task 2. Cualquier ubicación dentro de la clase sirve.)

- [ ] **Step 4: Enmascarar costos en `getProjectAssignments`**

En `getProjectAssignments`, reemplazar `res.json(assignments);` por:

```typescript
            if (req.user?.role === 'team_lead') {
                res.json(assignments);
                return;
            }
            res.json(assignments.map(({ monthly_cost, hourly_rate, ...rest }: any) => rest));
```

- [ ] **Step 5: Correr tests backend**

Run: `cd backend && npx jest src/__tests__/controllers/projectController && npx tsc --noEmit`
Expected: PASS, incluido `projectController.ownership.test.ts`, que sigue pasando porque sus filas no tienen campos de costo. tsc limpio.

- [ ] **Step 6: Test frontend que falla**

Crear `frontend/src/__tests__/components/projectAssignments.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildUserAssignments } from '@/components/projects/projectAssignments';

describe('buildUserAssignments', () => {
  it('el primer seleccionado es lead y el resto contributor (nunca "member", que la BD rechaza)', () => {
    expect(buildUserAssignments([7, 3, 9], 60)).toEqual([
      { user_id: 7, allocation_percentage: 60, role: 'lead' },
      { user_id: 3, allocation_percentage: 60, role: 'contributor' },
      { user_id: 9, allocation_percentage: 60, role: 'contributor' }
    ]);
  });

  it('usa 100% de dedicación si no se indica', () => {
    expect(buildUserAssignments([5])).toEqual([{ user_id: 5, allocation_percentage: 100, role: 'lead' }]);
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/components/projectAssignments.test.ts`
Expected: FAIL ("Failed to resolve import").

- [ ] **Step 7: Implementar el helper y usarlo en el modal**

Crear `frontend/src/components/projects/projectAssignments.ts`:

```typescript
export interface UserAssignmentPayload {
  user_id: number;
  allocation_percentage: number;
  role: 'lead' | 'contributor';
}

export const buildUserAssignments = (userIds: number[], allocation?: number): UserAssignmentPayload[] =>
  userIds.map((userId, index) => ({
    user_id: userId,
    allocation_percentage: allocation ?? 100,
    role: index === 0 ? 'lead' : 'contributor'
  }));
```

En `frontend/src/components/projects/CreateProjectModal.tsx`:
- Agregar `import { buildUserAssignments } from './projectAssignments';`.
- Reemplazar el bloque `const userAssignments = values.assigned_users.map(...)` (líneas 164-168) por `const userAssignments = buildUserAssignments(values.assigned_users, values.default_allocation);`.
- En las dos inicializaciones del formulario (líneas 86-90 y 236-239), cambiar `status: 'planning'` por `status: 'active'`.
- En `statusOptions` (líneas 191-197), borrar la línea `{ label: 'Planning', value: 'planning' },`.

- [ ] **Step 8: Quitar 'planning' de los tipos y del filtro de proyectos**

- `frontend/src/types/project.ts:35` → `export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled';`
- `frontend/src/types/project.ts:106-112` → borrar la línea `planning: 'Planning',` de `ProjectStatusLabels`.
- `frontend/src/pages/projects/ProjectsPage.tsx:133` → borrar `{ label: 'Planning', value: 'planning' },`.
- Los mapas de color con clave `planning` en `utils/colorMappings.ts` y `pages/dashboard/DashboardPage.tsx` no son de tipo `Record<ProjectStatus, …>` y no molestan, así que no se tocan.

- [ ] **Step 9: Correr tests y tipos del frontend**

Run: `cd frontend && npx vitest run src/__tests__/components/projectAssignments.test.ts && npx tsc --noEmit`
Expected: PASS y tsc limpio. Si tsc marca otro uso de `'planning'` tipado como `ProjectStatus`, quitar ese uso de la misma forma.

- [ ] **Step 10: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/__tests__/controllers/projectController.assignments.test.ts frontend/src/components/projects/projectAssignments.ts frontend/src/components/projects/CreateProjectModal.tsx frontend/src/types/project.ts frontend/src/pages/projects/ProjectsPage.tsx frontend/src/__tests__/components/projectAssignments.test.ts
git commit -m "fix(fase6a): las asignaciones de equipo se guardan (assigned_by, roles validos, validacion previa); costos de asignacion solo para team_lead; sin estado planning"
```

---

## Task 4: Conteo de tareas y horas sin inflar; crear proyecto desde cotización funciona

**Contexto verificado:**
- `getProjects` (`projectController.ts:25-38`) hace `LEFT JOIN tasks` y `LEFT JOIN time_entries` a la vez. Eso multiplica filas: con 3 tareas y 3 registros de horas cuenta 9 tareas y triplica las horas. Además suma horas no aprobadas.
- `createProjectFromQuote` falla siempre por tres motivos:
  - Inserta el estado `'planning'` (línea 1023).
  - Inserta tareas sin `reporter_id`, que es `NOT NULL` (líneas 1094-1107).
  - Inserta hitos en `target_date`, columna que no existe; la real es `planned_date DATE NOT NULL` (líneas 1114-1123).

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (`getProjects` 23-66, `createProjectFromQuote` 1019-1031, 1094-1107, 1112-1125)
- Test: `backend/src/__tests__/controllers/projectController.listAndQuote.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Consumes: helper de SQLite real (Task 1).
- Produces: `GET /api/projects`. Cada proyecto trae `total_tasks`, `completed_tasks` y `progress_percentage` correctos, y `total_hours_logged` = suma de horas **aprobadas** del proyecto. `POST /api/projects/from-quote` responde 201 y crea el proyecto en estado `active`, con sus tareas y sus hitos (fecha del hito = `target_date`, o si falta `estimated_end_date` de la cotización, o si falta hoy).

- [ ] **Step 1: Test que falla**

Crear `backend/src/__tests__/controllers/projectController.listAndQuote.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user, body, params } as unknown as AuthenticatedRequest;
}

describe('ProjectController - listado y creación desde cotización (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        controller = new ProjectController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('getProjects no multiplica tareas por horas y solo suma horas aprobadas', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('Conteo', ?)`, [users.lead]);
        const board = await testDb.run(`INSERT INTO task_boards (project_id, name) VALUES (?, 'B')`, [project.id]);
        const column = await testDb.run(`INSERT INTO task_columns (board_id, name, position) VALUES (?, 'To Do', 1)`, [board.id]);
        for (const status of ['todo', 'in_progress', 'done']) {
            await testDb.run(
                `INSERT INTO tasks (board_id, column_id, title, reporter_id, status) VALUES (?, ?, ?, ?, ?)`,
                [board.id, column.id, `T-${status}`, users.lead, status]
            );
        }
        await testDb.run(`INSERT INTO time_entries (user_id, project_id, hours, date, approval_status) VALUES (?, ?, 4, '2026-09-21', 'approved')`, [users.dev, project.id]);
        await testDb.run(`INSERT INTO time_entries (user_id, project_id, hours, date, approval_status) VALUES (?, ?, 6, '2026-09-22', 'approved')`, [users.dev, project.id]);
        await testDb.run(`INSERT INTO time_entries (user_id, project_id, hours, date, approval_status) VALUES (?, ?, 5, '2026-09-23', 'draft')`, [users.dev, project.id]);

        const res = mockRes();
        await controller.getProjects(makeReq({ id: users.lead, role: 'team_lead' }), res);

        const rows = (res.json as jest.Mock).mock.calls[0][0];
        const row = rows.find((p: any) => p.id === project.id);
        expect(row).toMatchObject({ total_tasks: 3, completed_tasks: 1, progress_percentage: 33, total_hours_logged: 10 });
    });

    it('getProjects devuelve 0 horas y 0% para un proyecto sin tareas ni horas', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('Vacío', ?)`, [users.lead]);

        const res = mockRes();
        await controller.getProjects(makeReq({ id: users.lead, role: 'team_lead' }), res);

        const row = (res.json as jest.Mock).mock.calls[0][0].find((p: any) => p.id === project.id);
        expect(row).toMatchObject({ total_tasks: 0, completed_tasks: 0, progress_percentage: 0, total_hours_logged: 0 });
    });

    it('createProjectFromQuote crea proyecto activo, tareas con reporter y hitos con planned_date (con fallback)', async () => {
        const res = mockRes();
        await controller.createProjectFromQuote(makeReq({ id: users.lead, role: 'team_lead' }, {
            quote_data: {
                project_name: 'Desde cotización',
                description: 'Automatización',
                client_name: 'Cliente Y',
                estimated_start_date: '2026-10-01',
                estimated_end_date: '2026-12-15',
                expected_revenue: 9000000,
                tasks: [{ title: 'Levantamiento', estimated_hours: 8 }, { title: 'Desarrollo' }],
                milestones: [{ name: 'PDD aprobado', target_date: '2026-10-20' }, { name: 'Go-live' }]
            }
        }), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const projectId = (res.json as jest.Mock).mock.calls[0][0].project.id;

        const project = await testDb.get('SELECT status FROM projects WHERE id = ?', [projectId]);
        expect(project.status).toBe('active');

        const tasks = await testDb.query(
            `SELECT t.title, t.reporter_id FROM tasks t JOIN task_boards tb ON t.board_id = tb.id WHERE tb.project_id = ? ORDER BY t.position`,
            [projectId]
        );
        expect(tasks).toEqual([
            { title: 'Levantamiento', reporter_id: users.lead },
            { title: 'Desarrollo', reporter_id: users.lead }
        ]);

        const milestones = await testDb.query('SELECT name, planned_date FROM project_milestones WHERE project_id = ? ORDER BY id', [projectId]);
        expect(milestones).toEqual([
            { name: 'PDD aprobado', planned_date: '2026-10-20' },
            { name: 'Go-live', planned_date: '2026-12-15' }
        ]);
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/controllers/projectController.listAndQuote.test.ts`
Expected: FAIL. El primer caso recibe `total_tasks: 9` y `total_hours_logged: 45`; el de cotización da 500.

- [ ] **Step 3: Reescribir la consulta de `getProjects`**

Reemplazar el bloque `let query = \`...\`` (líneas 25-38) y la línea `query += ' GROUP BY p.id ORDER BY p.created_at DESC';` (línea 48) por:

```typescript
            let query = `
                SELECT p.*,
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       (SELECT COUNT(*) FROM tasks t JOIN task_boards tb ON t.board_id = tb.id
                         WHERE tb.project_id = p.id) as total_tasks,
                       (SELECT COUNT(*) FROM tasks t JOIN task_boards tb ON t.board_id = tb.id
                         WHERE tb.project_id = p.id AND t.status = 'done') as completed_tasks,
                       (SELECT COALESCE(SUM(te.hours), 0) FROM time_entries te
                         WHERE te.project_id = p.id AND te.approval_status = 'approved') as total_hours_logged
                FROM projects p
                LEFT JOIN users u1 ON p.created_by = u1.id
                LEFT JOIN users u2 ON p.assigned_to = u2.id
            `;
```

y:

```typescript
            query += ' ORDER BY p.created_at DESC';
```

(El `WHERE` del `rpa_developer` y el `map` de `progress_percentage` quedan igual.)

- [ ] **Step 4: Arreglar `createProjectFromQuote`**

- Línea 1023: `) VALUES (?, ?, 'planning', ?, ?, ?, ?)` → `) VALUES (?, ?, 'active', ?, ?, ?, ?)`.
- Inserción de tareas (líneas 1094-1107):

```typescript
                        await db.run(`
                            INSERT INTO tasks (
                                board_id, column_id, title, description,
                                status, priority, position, estimated_hours, reporter_id
                            ) VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?)
                        `, [
                            boardId,
                            columnIds['To Do'],
                            task.title,
                            task.description || null,
                            task.priority || 'medium',
                            i,
                            task.estimated_hours || null,
                            userId
                        ]);
```

- Inserción de hitos (líneas 1112-1125):

```typescript
                if (quote_data.milestones && quote_data.milestones.length > 0) {
                    const fallbackDate = quote_data.estimated_end_date || new Date().toISOString().slice(0, 10);
                    for (const milestone of quote_data.milestones) {
                        await db.run(`
                            INSERT INTO project_milestones (
                                project_id, name, description, planned_date, status
                            ) VALUES (?, ?, ?, ?, 'pending')
                        `, [
                            projectId,
                            milestone.name,
                            milestone.description || null,
                            milestone.target_date || fallbackDate
                        ]);
                    }
                }
```

- Al logueo de actividad (líneas 1137-1138) y a la respuesta (líneas 1161-1162) les faltan los `?? []`: si la IA no devuelve `tasks` o `milestones`, `.length` revienta. Usar `(quote_data.tasks ?? []).length` y `(quote_data.milestones ?? []).length` en los 4 lugares.

- [ ] **Step 5: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/projectController && npx tsc --noEmit`
Expected: PASS y tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/__tests__/controllers/projectController.listAndQuote.test.ts
git commit -m "fix(fase6a): listado de proyectos sin conteos inflados (solo horas aprobadas) y creacion desde cotizacion funcional"
```

---

## Task 5: Finanzas solo para team_lead, valor HH por persona con horas del mes y precio de venta real

**Contexto verificado:**
- En `backend/src/routes/financialRoutes.ts:17-21`, `project-roi`, `project-financial` y `dashboard` solo exigen estar autenticado.
- `createUserCost` / `updateUserCost` (`financialController.ts:52, 105`) dividen por 160 fijo.
- No existe un endpoint que liste a **todas** las personas activas con su costo vigente. `GET /user-costs` solo devuelve quienes ya tienen costo, y por eso `SettingsPage` asigna el sueldo por rol.
- `financeService.calculateProjectFinancials` (`financeService.ts:186-189`) calcula la venta solo como `budgeted_hours × hourly_rate` e ignora `project_financials.sale_price`. Como nadie carga `hourly_rate`, la venta queda en 0. Ese es el arreglo mínimo que pide este sub-proyecto; el modelo de precio completo (cerrado o por horas) es el Sub-proyecto C.
- `getMonthlyHours()` devuelve `NaN` si el valor guardado no es numérico.

**Files:**
- Modify: `backend/src/routes/financialRoutes.ts`
- Modify: `backend/src/controllers/financialController.ts` (`createUserCost` 37-86, `updateUserCost` 89-130, método nuevo `getTeamCosts`)
- Modify: `backend/src/services/financeService.ts` (`getMonthlyHours` 73-78, venta en 182-189)
- Test: `backend/src/__tests__/routes/financialRoutes.auth.test.ts` (nuevo)
- Test: `backend/src/__tests__/controllers/financialController.userCosts.test.ts` (nuevo)
- Test: `backend/src/__tests__/services/financeService.test.ts` (agregar casos)

**Interfaces:**
- Produces: `GET /api/financial/team-costs` (solo team_lead) → `{ monthly_hours: number; members: Array<{ user_id: number; full_name: string; email: string; role: string; cost_rate_id: number | null; monthly_cost: number | null; hourly_rate: number | null; effective_from: string | null }> }`.
- Produces: `POST /api/financial/user-costs` con body `{ user_id: number; monthly_cost: number /* > 0, costo empresa en CLP */; effective_from?: string /* YYYY-MM-DD, por defecto hoy */ }`. Guarda `hourly_rate = round(monthly_cost / monthly_hours, 2)`.
- Produces: `financeService.getMonthlyHours()` siempre devuelve un número > 0 (176 como respaldo). `calculateProjectFinancials().sale_price` = `project_financials.sale_price` convertido a CLP (según `sale_price_currency`) cuando es > 0; si no, el cálculo anterior por horas × tarifa.

- [ ] **Step 1: Test de rutas que falla**

Crear `backend/src/__tests__/routes/financialRoutes.auth.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

jest.mock('../../middleware/auth', () => {
    const actual = jest.requireActual('../../middleware/auth');
    return {
        ...actual,
        authenticate: (req: any, _res: any, next: any) => {
            req.user = { id: 1, role: req.headers['x-test-role'] };
            next();
        }
    };
});

import express from 'express';
import request from 'supertest';
import { db } from '../../database/database';
import financialRoutes from '../../routes/financialRoutes';

const app = express();
app.use(express.json());
app.use('/api/financial', financialRoutes);

const protectedRoutes: Array<['get' | 'post', string]> = [
    ['get', '/api/financial/project-roi/1'],
    ['post', '/api/financial/project-financial'],
    ['get', '/api/financial/dashboard'],
    ['get', '/api/financial/team-costs'],
    ['get', '/api/financial/user-costs']
];

describe('financialRoutes - solo team_lead', () => {
    it.each(['rpa_developer', 'rpa_operations', 'it_support'])('%s recibe 403 en todas las rutas financieras', async (role) => {
        for (const [method, url] of protectedRoutes) {
            const res = await request(app)[method](url).set('x-test-role', role).send({});
            expect({ url, status: res.status }).toEqual({ url, status: 403 });
        }
    });

    it('team_lead obtiene el equipo con su costo vigente en /team-costs', async () => {
        (db.get as jest.Mock).mockResolvedValue({ setting_value: '176' });
        (db.query as jest.Mock).mockResolvedValue([
            { user_id: 2, full_name: 'Dev Uno', email: 'd@x.cl', role: 'rpa_developer', cost_rate_id: 5, monthly_cost: 1760000, hourly_rate: 10000, effective_from: '2026-09-01' }
        ]);

        const res = await request(app).get('/api/financial/team-costs').set('x-test-role', 'team_lead');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            monthly_hours: 176,
            members: [{ user_id: 2, full_name: 'Dev Uno', email: 'd@x.cl', role: 'rpa_developer', cost_rate_id: 5, monthly_cost: 1760000, hourly_rate: 10000, effective_from: '2026-09-01' }]
        });
    });
});
```

Run: `cd backend && npx jest src/__tests__/routes/financialRoutes.auth.test.ts`
Expected: FAIL. Algunas rutas devuelven un status distinto de 403 y `/team-costs` da 404.

- [ ] **Step 2: Test de controller que falla**

Crear `backend/src/__tests__/controllers/financialController.userCosts.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { FinancialController } from '../../controllers/financialController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

const lead = { id: 1, role: 'team_lead' };

function mockDb(monthlyHours: string | null) {
    (db.get as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id')) return Promise.resolve({ id: 2 });
        if (sql.includes('global_settings')) return Promise.resolve(monthlyHours === null ? undefined : { setting_value: monthlyHours });
        if (sql.includes('FROM user_cost_rates ucr')) return Promise.resolve({ id: 10, user_id: 2 });
        return Promise.resolve(undefined);
    });
    (db.run as jest.Mock).mockResolvedValue({ id: 10, changes: 1 });
}

function insertParams(): any[] {
    const call = (db.run as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO user_cost_rates'));
    return call[1];
}

describe('FinancialController - costo empresa por persona', () => {
    let controller: FinancialController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new FinancialController();
    });

    it('calcula el valor HH con las horas mensuales configuradas (no con 160)', async () => {
        mockDb('176');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: 1760000, effective_from: '2026-09-25' } } as unknown as AuthenticatedRequest, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const [userId, monthlyCost, hourlyRate, effectiveFrom] = insertParams();
        expect({ userId, monthlyCost, hourlyRate, effectiveFrom }).toEqual({ userId: 2, monthlyCost: 1760000, hourlyRate: 10000, effectiveFrom: '2026-09-25' });
    });

    it('si monthly_hours no es un número válido usa 176 (nunca NaN ni Infinity)', async () => {
        mockDb('abc');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: 1760000 } } as unknown as AuthenticatedRequest, res);

        expect(insertParams()[2]).toBe(10000);
    });

    it('usa la fecha de hoy si no viene effective_from', async () => {
        mockDb('176');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: 1760000 } } as unknown as AuthenticatedRequest, res);

        expect(insertParams()[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it.each([0, -5, '1000', null])('rechaza con 400 un costo empresa inválido (%p)', async (monthlyCost) => {
        mockDb('176');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: monthlyCost } } as unknown as AuthenticatedRequest, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.run).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un usuario inexistente', async () => {
        mockDb('176');
        (db.get as jest.Mock).mockImplementation((sql: string) =>
            Promise.resolve(sql.includes('FROM users WHERE id') ? undefined : { setting_value: '176' }));
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 99, monthly_cost: 1000000 } } as unknown as AuthenticatedRequest, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/financialController.userCosts.test.ts`
Expected: FAIL (el valor HH sale 11000 = 1.760.000/160, no hay default de fecha y no hay validación de tipos).

- [ ] **Step 3: Test de `financeService` que falla**

Agregar dentro del `describe('FinanceService', ...)` de `backend/src/__tests__/services/financeService.test.ts`, al final:

```typescript
    describe('getMonthlyHours', () => {
        it('devuelve 176 si el valor configurado no es un número positivo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ setting_value: '0' });
            expect(await financeService.getMonthlyHours()).toBe(176);
            (db.get as jest.Mock).mockResolvedValue({ setting_value: 'abc' });
            expect(await financeService.getMonthlyHours()).toBe(176);
            (db.get as jest.Mock).mockResolvedValue({ setting_value: '170' });
            expect(await financeService.getMonthlyHours()).toBe(170);
        });
    });

    describe('calculateProjectFinancials - precio de venta guardado', () => {
        function mockWithFinancials(financials: any) {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM projects WHERE id')) return Promise.resolve({ id: 1, name: 'P', assigned_to: null });
                if (sql.includes('FROM project_financials')) return Promise.resolve(financials);
                if (sql.includes('FROM exchange_rates')) return Promise.resolve({ rate_to_clp: 38000 });
                if (sql.includes('FROM user_cost_rates')) return Promise.resolve({ hourly_rate: 10000, hourly_rate_currency: 'CLP' });
                if (sql.includes('FROM project_milestones')) return Promise.resolve({ total_delay_hours: 0 });
                if (sql.includes('FROM time_entries')) return Promise.resolve({ hours: 0, cost: 0 });
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockImplementation((sql: string) =>
                Promise.resolve(sql.includes('FROM project_assignments')
                    ? [{ user_id: 1, allocation_percentage: 100, full_name: 'Dev', role: 'rpa_developer' }]
                    : []));
        }

        it('usa project_financials.sale_price en CLP aunque no haya tarifa por hora cargada', async () => {
            mockWithFinancials({ budgeted_hours: 100, sale_price: 5000000, sale_price_currency: 'CLP', hourly_rate: null });

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.sale_price).toBe(5000000);
            expect(result.planned_cost).toBe(1000000);
            expect(result.planned_profit).toBe(4000000);
        });

        it('convierte a CLP un sale_price guardado en UF', async () => {
            mockWithFinancials({ budgeted_hours: 100, sale_price: 100, sale_price_currency: 'UF', hourly_rate: null });

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.sale_price).toBe(3800000);
        });
    });
```

Run: `cd backend && npx jest src/__tests__/services/financeService.test.ts`
Expected: FAIL (`getMonthlyHours` devuelve 0 o NaN; `sale_price` sale 0).

- [ ] **Step 4: Implementar en `financeService`**

En `backend/src/services/financeService.ts`, reemplazar `getMonthlyHours` (líneas 73-78):

```typescript
    async getMonthlyHours(): Promise<number> {
        const row = await db.get(
            `SELECT setting_value FROM global_settings WHERE setting_key = 'monthly_hours'`
        );
        const hours = row ? parseFloat(row.setting_value) : NaN;
        return Number.isFinite(hours) && hours > 0 ? hours : 176;
    }
```

Y reemplazar el cálculo de `salePrice` (líneas 186-189):

```typescript
        // Precio guardado en el proyecto (alta/edición); si no hay, se mantiene el cálculo histórico horas × tarifa.
        const salePrice = financials?.sale_price > 0
            ? await this.toCLP(financials.sale_price, (financials.sale_price_currency as Currency) || 'CLP')
            : await this.toCLP(
                plannedHours * hourlyRateUF,
                (financials?.hourly_rate_currency as Currency) || 'UF'
            );
```

- [ ] **Step 5: Implementar en `financialController`**

En `backend/src/controllers/financialController.ts`, reemplazar `createUserCost` (líneas 37-86):

```typescript
    // POST /api/financial/user-costs - Solo para team_lead
    // monthly_cost = costo empresa mensual (sueldo + leyes sociales + otros), en CLP.
    createUserCost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can manage cost information' });
                return;
            }

            const { user_id, monthly_cost } = req.body;
            const effective_from: string = req.body.effective_from || new Date().toISOString().slice(0, 10);

            if (!Number.isInteger(user_id) || typeof monthly_cost !== 'number' || !(monthly_cost > 0)) {
                res.status(400).json({ error: 'user_id y un costo empresa mensual mayor a 0 son obligatorios' });
                return;
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(effective_from)) {
                res.status(400).json({ error: 'effective_from debe tener formato YYYY-MM-DD' });
                return;
            }

            const user = await db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', [user_id]);
            if (!user) {
                res.status(400).json({ error: `El usuario ${user_id} no existe o está inactivo` });
                return;
            }

            const monthlyHours = await financeService.getMonthlyHours();
            const hourly_rate = Math.round((monthly_cost / monthlyHours) * 100) / 100;

            await db.run(`
                UPDATE user_cost_rates
                SET is_active = 0, effective_to = ?
                WHERE user_id = ? AND is_active = 1
            `, [effective_from, user_id]);

            const result = await db.run(`
                INSERT INTO user_cost_rates (
                    user_id, monthly_cost, hourly_rate, effective_from,
                    is_active, created_by
                ) VALUES (?, ?, ?, ?, 1, ?)
            `, [user_id, monthly_cost, hourly_rate, effective_from, req.user?.id]);

            const newCost = await db.get(`
                SELECT ucr.*, u.full_name, u.email, u.role
                FROM user_cost_rates ucr
                JOIN users u ON ucr.user_id = u.id
                WHERE ucr.id = ?
            `, [result.id]);

            res.status(201).json(newCost);
        } catch (error) {
            logger.error('Create user cost error:', error);
            res.status(500).json({ error: 'Failed to create user cost' });
        }
    };
```

En `updateUserCost`, reemplazar las líneas 99-105 (validación y cálculo):

```typescript
            if (typeof monthly_cost !== 'number' || !(monthly_cost > 0)) {
                res.status(400).json({ error: 'Monthly cost must be a number greater than 0' });
                return;
            }

            const monthlyHours = await financeService.getMonthlyHours();
            const hourly_rate = Math.round((monthly_cost / monthlyHours) * 100) / 100;
```

Agregar el método nuevo después de `updateUserCost`:

```typescript
    // GET /api/financial/team-costs - Solo para team_lead
    // Todas las personas activas, tengan o no costo registrado, con su costo vigente más reciente.
    getTeamCosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const monthly_hours = await financeService.getMonthlyHours();
            const members = await db.query(`
                SELECT u.id as user_id, u.full_name, u.email, u.role,
                       ucr.id as cost_rate_id, ucr.monthly_cost, ucr.hourly_rate, ucr.effective_from
                FROM users u
                LEFT JOIN user_cost_rates ucr ON ucr.id = (
                    SELECT id FROM user_cost_rates
                    WHERE user_id = u.id AND is_active = 1
                    ORDER BY effective_from DESC, id DESC LIMIT 1
                )
                WHERE u.is_active = 1
                ORDER BY u.full_name
            `);
            res.json({ monthly_hours, members });
        } catch (error) {
            logger.error('Get team costs error:', error);
            res.status(500).json({ error: 'Failed to get team costs' });
        }
    };
```

- [ ] **Step 6: Proteger las rutas**

Reemplazar el contenido de `backend/src/routes/financialRoutes.ts` desde `// User cost management` hasta el final:

```typescript
// Todo lo financiero (costos de personas, precio, utilidad, ROI) es solo para team_lead.
router.use(authorize(['team_lead']));

// User cost management
router.get('/user-costs', financialController.getUserCosts);
router.post('/user-costs', financialController.createUserCost);
router.put('/user-costs/:id', financialController.updateUserCost);
router.get('/team-costs', financialController.getTeamCosts);

// Project financial data
router.get('/project-roi/:projectId', financialController.getProjectROI);
router.post('/project-financial', financialController.updateProjectFinancial);

// ROI Dashboard and analytics
router.get('/dashboard', financialController.getROIDashboard);

export default router;
```

- [ ] **Step 7: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/routes src/__tests__/controllers/financialController.userCosts.test.ts src/__tests__/services/financeService && npx tsc --noEmit`
Expected: PASS en los 3 archivos nuevos o modificados y en `financeService.roiAlerts.test.ts`; tsc limpio.

Si `jest.requireActual('../../middleware/auth')` falla al instanciar `AuthService` fuera del mock de `db`, mockear además `'../../services/authService'` con `{ AuthService: jest.fn().mockImplementation(() => ({})) }` antes de los imports.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/financialRoutes.ts backend/src/controllers/financialController.ts backend/src/services/financeService.ts backend/src/__tests__/routes/financialRoutes.auth.test.ts backend/src/__tests__/controllers/financialController.userCosts.test.ts backend/src/__tests__/services/financeService.test.ts
git commit -m "fix(fase6a): rutas financieras solo team_lead, valor HH por persona con horas del mes y precio de venta guardado en el calculo"
```

---

## Task 6: Configuración con costo empresa por persona y tarjeta de rentabilidad con datos reales

**Contexto verificado:**
- `SettingsPage.tsx:27-170, 312-453` guarda **un sueldo por rol** y lo asigna al primer usuario que encuentra con ese rol. Si hay 2 devs, el segundo nunca tiene costo.
- `ProjectROICard.tsx:94-95` muestra valores reales solo si hay atraso del cliente, e ignora las horas aprobadas.

**Files:**
- Create: `frontend/src/types/teamCosts.ts`
- Modify: `frontend/src/services/api.ts` (junto a `getUserCosts`, ~línea 358)
- Create: `frontend/src/components/settings/TeamCostsCard.tsx`
- Modify: `frontend/src/pages/settings/SettingsPage.tsx`
- Modify: `frontend/src/components/projects/ProjectROICard.tsx:14-48, 93-95`
- Test: `frontend/src/__tests__/components/TeamCostsCard.test.tsx` (nuevo)
- Test: `frontend/src/__tests__/components/ProjectROICard.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `GET /api/financial/team-costs` y `POST /api/financial/user-costs` (Task 5).
- Produces: `apiService.getTeamCosts(): Promise<TeamCostsResponse>` y el componente `<TeamCostsCard />` sin props.

- [ ] **Step 1: Tipos y método de API**

Crear `frontend/src/types/teamCosts.ts`:

```typescript
export interface TeamCostMember {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  cost_rate_id: number | null;
  monthly_cost: number | null;
  hourly_rate: number | null;
  effective_from: string | null;
}

export interface TeamCostsResponse {
  monthly_hours: number;
  members: TeamCostMember[];
}
```

En `frontend/src/services/api.ts`, agregar el import `import { TeamCostsResponse } from '@/types/teamCosts';` junto a los demás imports de tipos, y el método justo después de `getUserCosts`:

```typescript
  async getTeamCosts(): Promise<TeamCostsResponse> {
    const response = await this.api.get('/financial/team-costs');
    return response.data;
  }
```

- [ ] **Step 2: Test de `TeamCostsCard` que falla**

Crear `frontend/src/__tests__/components/TeamCostsCard.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getTeamCosts: vi.fn(),
    createUserCost: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TeamCostsCard } from '@/components/settings/TeamCostsCard';

const response = {
  monthly_hours: 176,
  members: [
    { user_id: 2, full_name: 'Dev Uno', email: 'd@x.cl', role: 'rpa_developer', cost_rate_id: 5, monthly_cost: 1760000, hourly_rate: 10000, effective_from: '2026-09-01' },
    { user_id: 3, full_name: 'Ops Uno', email: 'o@x.cl', role: 'rpa_operations', cost_rate_id: null, monthly_cost: null, hourly_rate: null, effective_from: null }
  ]
};

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

describe('TeamCostsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getTeamCosts as any).mockResolvedValue(response);
    (apiService.createUserCost as any).mockResolvedValue({ id: 9 });
  });

  it('lista a cada persona activa con su valor HH calculado con las horas del mes', async () => {
    render(<TeamCostsCard />);

    await waitFor(() => expect(screen.getByText('Dev Uno')).toBeInTheDocument());
    expect(within(rowOf('Dev Uno')).getByText(/10\.000/)).toBeInTheDocument();
    expect(within(rowOf('Ops Uno')).getByText(/sin costo registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/176/)).toBeInTheDocument();
  });

  it('guarda el costo empresa de una persona sin costo previo', async () => {
    render(<TeamCostsCard />);
    await waitFor(() => expect(screen.getByText('Ops Uno')).toBeInTheDocument());

    const input = within(rowOf('Ops Uno')).getByLabelText(/costo empresa de ops uno/i);
    fireEvent.change(input, { target: { value: '3520000' } });
    fireEvent.click(within(rowOf('Ops Uno')).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(apiService.createUserCost).toHaveBeenCalledWith({
        user_id: 3,
        monthly_cost: 3520000,
        effective_from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      });
    });
    expect(apiService.getTeamCosts).toHaveBeenCalledTimes(2);
  });

  it('el botón Guardar está deshabilitado si no se cambió el costo', async () => {
    render(<TeamCostsCard />);
    await waitFor(() => expect(screen.getByText('Dev Uno')).toBeInTheDocument());

    expect(within(rowOf('Dev Uno')).getByRole('button', { name: /guardar/i })).toBeDisabled();
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/components/TeamCostsCard.test.tsx`
Expected: FAIL ("Failed to resolve import").

- [ ] **Step 3: Implementar `TeamCostsCard`**

Crear `frontend/src/components/settings/TeamCostsCard.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Table, InputNumber, Button, Alert, Tag, Typography, message } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import { TeamCostMember } from '@/types/teamCosts';

const { Text } = Typography;

const ROLE_LABELS: Record<string, string> = {
  team_lead: 'Team Lead',
  rpa_developer: 'RPA Developer',
  rpa_operations: 'RPA Operations',
  it_support: 'Soporte TI'
};

const formatCLP = (value: number) => `$${Math.round(value).toLocaleString('es-CL')}`;

export const TeamCostsCard: React.FC = () => {
  const [members, setMembers] = useState<TeamCostMember[]>([]);
  const [monthlyHours, setMonthlyHours] = useState(176);
  const [drafts, setDrafts] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getTeamCosts();
      setMembers(data.members);
      setMonthlyHours(data.monthly_hours);
      setDrafts({});
    } catch (error) {
      console.error('Error loading team costs:', error);
      message.error('Error al cargar el costo empresa del equipo');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const currentValue = (member: TeamCostMember): number | null =>
    drafts[member.user_id] !== undefined ? drafts[member.user_id] : member.monthly_cost;

  const handleSave = async (member: TeamCostMember) => {
    const monthlyCost = drafts[member.user_id];
    if (!monthlyCost || monthlyCost <= 0) return;
    try {
      setSavingUserId(member.user_id);
      await apiService.createUserCost({
        user_id: member.user_id,
        monthly_cost: monthlyCost,
        effective_from: dayjs().format('YYYY-MM-DD')
      });
      message.success(`Costo empresa de ${member.full_name} actualizado`);
      await load();
    } catch (error) {
      console.error('Error saving team cost:', error);
      message.error('Error al guardar el costo empresa');
    } finally {
      setSavingUserId(null);
    }
  };

  const columns = [
    { title: 'Persona', dataIndex: 'full_name', key: 'full_name' },
    {
      title: 'Rol',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => <Tag>{ROLE_LABELS[role] || role}</Tag>
    },
    {
      title: 'Costo empresa mensual (CLP)',
      key: 'monthly_cost',
      render: (_: unknown, member: TeamCostMember) => (
        <InputNumber
          aria-label={`Costo empresa de ${member.full_name}`}
          value={currentValue(member)}
          min={0}
          step={50000}
          style={{ width: 180 }}
          onChange={(value) =>
            setDrafts((prev) => ({ ...prev, [member.user_id]: typeof value === 'number' ? value : null }))
          }
        />
      )
    },
    {
      title: 'Valor HH',
      key: 'hourly_rate',
      render: (_: unknown, member: TeamCostMember) => {
        const value = currentValue(member);
        return value && value > 0 ? formatCLP(value / monthlyHours) : '—';
      }
    },
    {
      title: 'Vigente desde',
      key: 'effective_from',
      render: (_: unknown, member: TeamCostMember) =>
        member.effective_from || <Text type="secondary">Sin costo registrado</Text>
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, member: TeamCostMember) => {
        const draft = drafts[member.user_id];
        const canSave = typeof draft === 'number' && draft > 0 && draft !== member.monthly_cost;
        return (
          <Button
            type="primary"
            size="small"
            disabled={!canSave}
            loading={savingUserId === member.user_id}
            onClick={() => handleSave(member)}
          >
            Guardar
          </Button>
        );
      }
    }
  ];

  return (
    <Card title={<><TeamOutlined /> Costo empresa por persona</>} style={{ marginBottom: '24px' }}>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Solo visible para Team Lead"
        description={`Ingresa el costo empresa mensual de cada persona (sueldo + leyes sociales + otros costos). Valor HH = costo empresa ÷ ${monthlyHours} horas del mes. Un cambio aplica desde hoy; las horas ya aprobadas conservan el valor con que se aprobaron.`}
      />
      <Table
        rowKey="user_id"
        size="small"
        loading={loading}
        dataSource={members}
        columns={columns}
        pagination={false}
      />
    </Card>
  );
};
```

Run: `cd frontend && npx vitest run src/__tests__/components/TeamCostsCard.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 4: Reemplazar la sección por rol en `SettingsPage`**

En `frontend/src/pages/settings/SettingsPage.tsx`:
- Borrar la interfaz `TeamSalarySettings` (27-32), el `salaryForm`, `salaryLoading` y `teamSalaries` (36, 38, 45-50), `loadTeamSalaries` (74-95), `handleSaveSalaries` (111-170), la llamada `loadTeamSalaries();` del `useEffect` y todo el `<Form form={salaryForm} ...>...</Form>` (líneas 312-453).
- En el lugar del formulario borrado, renderizar `<TeamCostsCard />` y agregar `import { TeamCostsCard } from '@/components/settings/TeamCostsCard';`.
- Quitar de los imports lo que quede sin usar (`TeamOutlined` e `InputNumber` siguen en uso en la página solo si tsc/lint no los marcan).
- En la tarjeta "Información", cambiar `• Costo/hora empleado = Sueldo mensual ÷ {settings.monthly_hours}h` por `• Valor HH = Costo empresa mensual ÷ {settings.monthly_hours}h`.

- [ ] **Step 5: Test de `ProjectROICard` que falla**

Crear `frontend/src/__tests__/components/ProjectROICard.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectROI: vi.fn(),
    getUserCosts: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'team_lead', full_name: 'Lead' } })
}));

import { apiService } from '@/services/api';
import { ProjectROICard } from '@/components/projects/ProjectROICard';

const base = {
  project_id: 1, project_name: 'P', planned_hours: 100, real_hours: 120, approved_hours: 120,
  client_delay_hours: 0, hourly_rate_uf: 0, uf_value_clp: 38000, engineer_hourly_cost: 10000,
  sale_price: 3000000, planned_cost: 1000000, real_cost: 1200000, planned_profit: 2000000, real_profit: 1800000,
  planned_roi: 200, real_roi: 150, delay_impact: 200000, lost_profit: 200000, alerts: []
};

describe('ProjectROICard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getUserCosts as any).mockResolvedValue([]);
  });

  it('muestra valores reales cuando hay horas aprobadas aunque no haya atraso del cliente', async () => {
    (apiService.getProjectROI as any).mockResolvedValue({ ...base, real_hours_source: 'approved' });

    render(<ProjectROICard projectId={1} projectName="P" />);

    await waitFor(() => expect(screen.getByText('Costo Real')).toBeInTheDocument());
    expect(screen.queryByText('Costo Planificado')).not.toBeInTheDocument();
  });

  it('muestra valores planificados cuando aún no hay horas aprobadas ni atraso', async () => {
    (apiService.getProjectROI as any).mockResolvedValue({ ...base, real_hours_source: 'projected', approved_hours: 0 });

    render(<ProjectROICard projectId={1} projectName="P" />);

    await waitFor(() => expect(screen.getByText('Costo Planificado')).toBeInTheDocument());
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectROICard.test.tsx`
Expected: FAIL en el primer caso (muestra "Costo Planificado").

- [ ] **Step 6: Arreglar `ProjectROICard`**

En `frontend/src/components/projects/ProjectROICard.tsx`:
- En la interfaz `ProjectROIData`, debajo de `real_hours: number;`, agregar:

```typescript
  real_hours_source: 'approved' | 'projected';
  approved_hours: number;
```

- Reemplazar las líneas 93-95 por:

```typescript
  // Hay dato real si ya existen horas aprobadas (Fase 3) o atraso atribuible al cliente.
  const hasClientDelays = (roiData?.client_delay_hours ?? 0) > 0;
  const shouldShowReal = hasClientDelays || roiData?.real_hours_source === 'approved';
```

- [ ] **Step 7: Correr tests, tipos y lint del frontend**

Run: `cd frontend && npx vitest run src/__tests__/components/TeamCostsCard.test.tsx src/__tests__/components/ProjectROICard.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS, tsc limpio y lint sin errores nuevos.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/teamCosts.ts frontend/src/services/api.ts frontend/src/components/settings/TeamCostsCard.tsx frontend/src/pages/settings/SettingsPage.tsx frontend/src/components/projects/ProjectROICard.tsx frontend/src/__tests__/components/TeamCostsCard.test.tsx frontend/src/__tests__/components/ProjectROICard.test.tsx
git commit -m "feat(fase6a): costo empresa por persona en Configuracion y tarjeta de rentabilidad con horas aprobadas reales"
```

---

## Task 7: Verificación de punta a punta

**Files:** ninguno nuevo. Si esta verificación encuentra un fallo, se arregla en un commit propio que explique la causa.

- [ ] **Step 1: Suites completas, tipos y lint**

Run:
```bash
cd backend && npx tsc --noEmit && npm test && npm run lint
cd ../frontend && npx tsc --noEmit && npm test && npm run lint
```
Expected: todo en verde y lint sin errores nuevos. Si la suite completa del frontend tiene timeouts, puede ser el flake de entorno ya conocido: re-correr los archivos afectados en aislado antes de darlo por regresión.

- [ ] **Step 2: Verificar la reparación sobre la BD local real**

Reiniciar el backend (`cd backend && npm run dev`; nodemon lo reinicia solo si ya estaba corriendo). En el log debe aparecer una vez `time_entries reparada: se agregaron columnas faltantes de la migración 30 (...)`. Luego, en solo lectura:

```bash
cd backend && node -e "const s=require('sqlite3');const d=new s.Database('data/database.sqlite',s.OPEN_READONLY);d.all('PRAGMA table_info(time_entries)',(e,r)=>console.log(r.map(x=>x.name).join(',')))"
```
Expected: la lista incluye `approval_status,timesheet_period_id,approved_by,approved_at,cost_rate_snapshot,bill_rate_snapshot,is_locked`. Un segundo reinicio no debe volver a registrar la reparación en el log.

- [ ] **Step 3: Recorrido en navegador (golden path + permisos)**

Con backend (5001) y frontend (3000) corriendo, usar Playwright:
1. Login `admin@rpa.com` / `admin123` (team_lead). En **Configuración** → "Costo empresa por persona", fijar el costo de "RPA Developer 1" en 1.700.000. Debe mostrar un Valor HH de `$10.000` con `monthly_hours` = 170.
2. **Proyectos** → crear un proyecto con 2 miembros, 50 % de dedicación, precio de venta 5.000.000, 200 horas presupuestadas y presupuesto 2.000.000. No debe aparecer "Project saved but failed to update assignments". El estado por defecto es Active y no hay opción "Planning".
3. Abrir el proyecto: la tarjeta de Rentabilidad muestra precio de venta 5.000.000 (no 0).
4. Editar solo el nombre y reabrir: el precio y las horas siguen iguales.
5. Login `dev1@rpa.com` (rpa_developer). Pedir `GET http://localhost:5001/api/financial/dashboard` con su token desde la consola del navegador: debe dar 403. En el detalle de un proyecto asignado, la respuesta de `GET /api/projects/:id` no trae `sale_price`.

- [ ] **Step 4: Registrar cierre**

No mergear. Reportar al usuario (en lenguaje llano, sin código) qué quedó arreglado y preguntar con el menú de `superpowers:finishing-a-development-branch`.

---

## Self-Review

- **Cobertura del spec (Sub-proyecto A):**
  - Validación de `sale_price`/`hours_budgeted`/`client_id`/`area_id`/`pm_user_id`/`currency`: Task 2.
  - UPSERT en `updateProject`: Task 2.
  - `addProjectAssignments` (assigned_by, rol válido, dedicación y fechas por persona): Task 3.
  - `'planning'`: Tasks 2 (backend) y 3 (frontend).
  - Reparación de `time_entries`: Task 1 (hecha al arranque y no como migración v37; ver nota de contexto).
  - `financialRoutes` solo team_lead: Task 5.
  - Valor HH por persona con `monthly_hours`: Tasks 5 y 6.
  - `ProjectROICard`: Task 6.
  - `total_hours_logged`: Task 4.
  - `from-quote`: Task 4.
- **Agregados necesarios, no listados en el spec:**
  - `financeService` usa `sale_price` guardado (Task 5). Sin esto, guardar el precio no cambiaría nada visible.
  - Se enmascaran los financieros en `getProject`/`updateProject`/`getProjectAssignments` (Tasks 2 y 3), por la decisión de producto 7.
  - `from-quote` también fallaba por el `reporter_id` faltante (Task 4).
- **Placeholders:** no hay TBD. Todos los pasos con código lo traen completo.
- **Consistencia de tipos:** `realDbProxy`/`realDbHolder`/`createRealTestDb`/`seedBasicUsers`/`TestUsers` (Task 1) se usan con los mismos nombres en las Tasks 2 a 4. `TeamCostsResponse`/`TeamCostMember` (Task 6) coinciden con la respuesta de `getTeamCosts` (Task 5). `buildUserAssignments` devuelve roles `lead|contributor`, que el backend acepta (Task 3).
- **Review Focus:**
  - Filas preservadas al reparar: Task 1.
  - Editar el nombre no toca los financieros: Task 2.
  - Un rol no team_lead no escribe ni ve `sale_price`: Task 2.
  - Un payload inválido no borra el equipo: Task 3.
  - `monthly_hours` inválido: Task 5.
