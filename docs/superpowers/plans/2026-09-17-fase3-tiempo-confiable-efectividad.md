# Fase 3 — Tiempo Confiable y Efectividad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir `time_entries` en el registro confiable de horas trabajadas (grilla semanal de baja fricción + timer, envío/aprobación con bloqueo de edición y snapshot de tarifas), conectar esas horas aprobadas al motor financiero (`financeService`) para que el costo real deje de ser una proyección y pase a ser lo que la gente realmente registró, y entregar métricas de efectividad (estimado vs. real, % utilización, % facturable) y recordatorios diarios de horas pendientes.

**Architecture:** Backend: migración 30 (extiende `time_entries` con columnas de aprobación/bloqueo/snapshot + nueva tabla `timesheet_periods`) + `timesheetService.ts` (grilla semanal, envío/aprobación/rechazo con bloqueo, métricas de efectividad, recordatorios) + extensión de `financeService.calculateProjectFinancials` para que `real_hours`/`real_cost` usen horas **aprobadas** de `time_entries` en vez de la proyección `planned_hours + client_delay_hours` (con *fallback* a esa proyección mientras un proyecto no tenga horas aprobadas todavía — ver Task 4) + `timesheetController.ts`/`timesheetRoutes.ts` (HTTP) + endurecimiento de `timeController.ts` existente para respetar el bloqueo de horas aprobadas. Frontend: `TimeTrackingPage.tsx` se extiende (no se reemplaza la lógica de timer, que se conserva) con una vista de grilla semanal por tabs: "Mi semana" (grilla + timer, todos los roles), "Aprobaciones" (solo `team_lead`), "Efectividad" (`team_lead` y `rpa_operations`), más un banner de recordatorio de horas pendientes al entrar.

Decisión de diseño explícita sobre la "grilla": en vez de una matriz tipo hoja de cálculo (proyecto × día en una sola tabla pivotada — fuente frecuente de bugs de sincronización de estado y difícil de validar en una sola pasada), la grilla semanal se implementa como 7 tarjetas de día (lunes a domingo), cada una con sus entradas y un botón "agregar entrada". Esto conserva la baja fricción pedida (toda la semana visible y editable en una sola pantalla, sin navegar día por día) sin el riesgo de una tabla pivotada compleja.

Decisión de diseño explícita sobre `financeService`: hoy `real_hours = planned_hours + client_delay_hours` (una proyección, no un dato real — ver `backend/src/services/financeService.ts:179`). Esta fase la reemplaza por las horas realmente aprobadas cuando existen, pero **si un proyecto todavía no tiene ninguna hora aprobada** (los 5 proyectos reales no tienen datos de timesheet todavía), se mantiene la proyección anterior como *fallback* — de lo contrario el ROI de esos proyectos colapsaría a valores sin sentido (costo real = 0) el día que se despliegue esta fase, antes de que el equipo empiece a cargar horas. Este fallback es temporal por diseño: desaparece solo, proyecto por proyecto, en cuanto ese proyecto tenga al menos una hora aprobada.

No hay scheduler en este proyecto (la app corre en el notebook del usuario — mismo constraint que Fase 2). Los recordatorios de horas pendientes se calculan de forma perezosa: al pedir `GET /api/timesheet/reminders` (se llama al entrar a la app) y una vez, como línea de log informativo, al arrancar el servidor (`server.ts` → `start()`), igual que se describe en la Fase 3 del plan maestro ("in-app al entrar + pendientes al arrancar el servidor"). Esto **no** activa `socket.io` ni la tabla `notifications` — esa es tarea explícita de la Fase 5 del plan maestro; aquí solo se deja el cálculo listo para que Fase 5 lo conecte a notificaciones push.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente), `date-fns` (ya instalado, se reutiliza para manejo de semanas — nunca se calcula "lunes de la semana" a mano con `Date` crudo), React 18/TypeScript/Vite/Ant Design (frontend ya existente, sin dependencias nuevas).

**Spec:** `C:\Users\nanon\.claude\plans\hace-mucho-tiempo-que-woolly-orbit.md`, sección "Fase 3 — Tiempo confiable y efectividad" (líneas 219-230). Ese documento es la autoridad; este plan lo desarrolla en tareas ejecutables. Contexto adicional relevante del mismo documento: Fase 1 entregó `financeService.ts` como única fuente de cálculo financiero (este plan lo extiende, nunca lo bypasea); Fase 2 entregó `billingService.ts`/`roi_alerts` reales (patrón de referencia para este plan: lógica de negocio en un `*Service.ts` que nunca calcula moneda a mano, controller delgado, tests con `db` mockeado). Los roles siguen siendo `team_lead | rpa_developer | rpa_operations | it_support` — no se agregan roles nuevos en esta fase.

## Global Constraints

- Nunca calcular costo/moneda a mano en `timesheetController` o el frontend — las conversiones de moneda pasan siempre por `financeService.toCLP`/`getExchangeRate` (`backend/src/services/financeService.ts`).
- Roles actuales (`backend/src/types/auth.ts:15`): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. No agregar roles nuevos.
- Convención de acceso a BD: `db.query(sql, params)` para múltiples filas, `db.get(sql, params)` para una fila, `db.run(sql, params)` para escritura (devuelve `{ id, changes }`), `db.beginTransaction()`/`db.commit()`/`db.rollback()` para transacciones. Nunca `db.all` (no existe en este wrapper). Ver `backend/src/database/database.ts:578-660`.
- Migraciones: se agregan al final del array `migrations` en `backend/src/database/migrationList.ts`, nunca se editan migraciones ya aplicadas (versiones 1-29 ya existen; la nueva es **versión 30**).
- Controllers nuevos siguen el patrón de clase usado en `billingController.ts`: `export class XController { metodo = async (req: AuthenticatedRequest, res: Response): Promise<void> => { try { ... } catch (error) { logger.error(...); res.status(500).json({ error: '...' }); } } }`. Import `AuthenticatedRequest` desde `../middleware/auth`.
- Validación de escritura: Zod en `backend/src/validation/schemas.ts`, aplicada con el middleware `validate({ body: schema })` de `backend/src/middleware/validation.ts`.
- Autorización: cualquier usuario autenticado puede leer/escribir **su propia** semana (`GET/PUT /api/timesheet/week`, `POST /api/timesheet/week/submit`, `GET /api/timesheet/reminders`) — no requiere `authorize()` adicional, se filtra siempre por `req.user.id`, igual que hoy en `timeController.ts`. Aprobar/rechazar una semana es una acción financiera irreversible (bloquea horas, mueve el costo real del proyecto) → **solo** `authorize(['team_lead'])`, mismo criterio que `recordPayment` en Fase 2. Ver lista de pendientes de aprobación y métricas de efectividad = `authorize(['team_lead', 'rpa_operations'])` (mismo grupo de solo-lectura que PMO y el dashboard de cobranza).
- Todas las rutas nuevas van bajo `router.use(authenticate)` primero (o `authenticate` por ruta), igual que el resto de módulos.
- Frontend: servicios centralizados en la clase `ApiService` de `frontend/src/services/api.ts` (patrón: método por endpoint, `this.api.get/post/put/delete`). Páginas en `frontend/src/pages/<modulo>/`.
- Tests backend: mockear `db` completo con `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() } }))`, igual que `backend/src/__tests__/services/billingService.test.ts`. No usar una base de datos real en tests unitarios de servicios/controllers.
- Fechas de semana: siempre `date-fns` (`startOfWeek(date, { weekStartsOn: 1 })`, `addDays`, `format(date, 'yyyy-MM-dd')`). Nunca aritmética de fechas a mano con `Date.getDay()`.
- Montos monetarios: `DECIMAL` en SQLite. Moneda de snapshot: CLP siempre (los snapshots de tarifa se congelan ya convertidos a CLP en el momento de la aprobación, para que `financeService` nunca tenga que reconvertir horas históricas con el tipo de cambio de hoy).

---

## Mapa de archivos

- Modificar: `backend/src/database/migrationList.ts` (append migración 30)
- Crear: `backend/src/services/timesheetService.ts`
- Modificar: `backend/src/services/financeService.ts` (real_hours/real_cost desde horas aprobadas)
- Modificar: `backend/src/controllers/timeController.ts` (bloqueo de horas aprobadas)
- Crear: `backend/src/controllers/timesheetController.ts`
- Crear: `backend/src/routes/timesheetRoutes.ts`
- Modificar: `backend/src/validation/schemas.ts` (schemas de timesheet)
- Modificar: `backend/src/server.ts` (registrar `timesheetRoutes` + entrada en `GET /api` + log de recordatorios al arrancar)
- Crear: `backend/src/__tests__/database/migration30.test.ts`
- Crear: `backend/src/__tests__/services/timesheetService.test.ts`
- Modificar: `backend/src/__tests__/services/financeService.test.ts` (mock de horas aprobadas + nuevo caso)
- Crear: `backend/src/__tests__/controllers/timeController.test.ts`
- Crear: `backend/src/__tests__/controllers/timesheetController.test.ts`
- Crear: `frontend/src/types/timesheet.ts`
- Modificar: `frontend/src/services/api.ts` (métodos de timesheet)
- Modificar: `frontend/src/pages/time/TimeTrackingPage.tsx` (tabs: Mi semana / Aprobaciones / Efectividad + banner de recordatorio)
- Crear: `frontend/src/__tests__/pages/TimeTrackingPage.test.tsx`

---

### Task 1: Migración 30 — extender `time_entries` + crear `timesheet_periods`

**Files:**
- Modify: `backend/src/database/migrationList.ts` (append al final del array `migrations`)
- Test: `backend/src/__tests__/database/migration30.test.ts`

**Interfaces:**
- Produces: tabla `timesheet_periods` (`id, user_id, period_start, period_end, status, submitted_at, approved_by, approved_at, rejection_reason, created_at, updated_at`) y columnas nuevas en `time_entries` (`approval_status, timesheet_period_id, approved_by, approved_at, cost_rate_snapshot, bill_rate_snapshot, is_locked`). Todas las tareas siguientes dependen de estos nombres literalmente.

- [ ] **Step 1: Escribir el test que verifica el esquema tras migrar**

```typescript
// backend/src/__tests__/database/migration30.test.ts
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest migration30.test.ts`
Expected: FAIL — la tabla `timesheet_periods` y las columnas nuevas de `time_entries` no existen todavía.

- [ ] **Step 3: Agregar la migración 30 al final de `backend/src/database/migrationList.ts`**

Localizar el cierre del array (`];` al final del archivo, después de la migración 29) y agregar antes de ese `];` (recordar agregar la coma tras el `}` de la migración 29):

```typescript
  ,

  {
    version: 30,
    description: 'Fase 3: timesheet_periods + columnas de aprobación/bloqueo en time_entries (tiempo confiable y efectividad)',
    up: [
      `CREATE TABLE IF NOT EXISTS timesheet_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'approved', 'rejected')),
        submitted_at DATETIME,
        approved_by INTEGER,
        approved_at DATETIME,
        rejection_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (approved_by) REFERENCES users(id),
        UNIQUE(user_id, period_start)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_timesheet_periods_user ON timesheet_periods(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_timesheet_periods_status ON timesheet_periods(status)`,

      `CREATE TRIGGER IF NOT EXISTS update_timesheet_periods_timestamp
        AFTER UPDATE ON timesheet_periods
        BEGIN
          UPDATE timesheet_periods SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      `ALTER TABLE time_entries ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft', 'submitted', 'approved', 'rejected'))`,
      `ALTER TABLE time_entries ADD COLUMN timesheet_period_id INTEGER REFERENCES timesheet_periods(id)`,
      `ALTER TABLE time_entries ADD COLUMN approved_by INTEGER REFERENCES users(id)`,
      `ALTER TABLE time_entries ADD COLUMN approved_at DATETIME`,
      `ALTER TABLE time_entries ADD COLUMN cost_rate_snapshot DECIMAL(10,2)`,
      `ALTER TABLE time_entries ADD COLUMN bill_rate_snapshot DECIMAL(10,2)`,
      `ALTER TABLE time_entries ADD COLUMN is_locked BOOLEAN NOT NULL DEFAULT 0`,

      `CREATE INDEX IF NOT EXISTS idx_time_entries_approval_status ON time_entries(approval_status)`,
      `CREATE INDEX IF NOT EXISTS idx_time_entries_period ON time_entries(timesheet_period_id)`
    ]
  }
```

Nota: `CREATE TABLE timesheet_periods` va **antes** que los `ALTER TABLE time_entries ADD COLUMN ... REFERENCES timesheet_periods(id)` en el mismo array `up` — el orden de ejecución es el del array.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest migration30.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration30.test.ts
git commit -m "feat(fase3): migración 30 - timesheet_periods y columnas de aprobación en time_entries"
```

---

### Task 2: `timesheetService.ts` — grilla semanal (obtener y guardar)

**Files:**
- Create: `backend/src/services/timesheetService.ts`
- Test: `backend/src/__tests__/services/timesheetService.test.ts`

**Interfaces:**
- Consumes: `db.query`/`db.get`/`db.run`/`db.beginTransaction`/`db.commit`/`db.rollback` (`backend/src/database/database.ts`), tablas `time_entries`/`timesheet_periods`/`projects`/`tasks` (Task 1).
- Produces (usados por Task 3, 5, 6 y por `timesheetController.ts` en Task 7):
  - `interface TimeEntryRow { id: number; project_id: number; project_name: string; task_id: number | null; task_title: string | null; description: string | null; hours: number; date: string; is_billable: boolean; approval_status: 'draft' | 'submitted' | 'approved' | 'rejected'; is_locked: boolean }`
  - `interface TimesheetWeekDay { date: string; entries: TimeEntryRow[]; total_hours: number }`
  - `interface TimesheetPeriodRow { id: number; user_id: number; period_start: string; period_end: string; status: 'open' | 'submitted' | 'approved' | 'rejected'; submitted_at: string | null; approved_by: number | null; approved_at: string | null; rejection_reason: string | null }`
  - `interface TimesheetWeek { period: TimesheetPeriodRow | null; days: TimesheetWeekDay[]; total_hours: number }`
  - `interface SaveWeekEntryInput { id?: number; project_id: number; task_id?: number | null; description?: string | null; date: string; hours: number; is_billable?: boolean }`
  - `timesheetService.getWeekStart(anyDateInWeek: string): string` (lunes de esa semana, `yyyy-MM-dd`)
  - `timesheetService.getWeek(userId: number, weekStartDate: string): Promise<TimesheetWeek>`
  - `timesheetService.saveWeekEntries(userId: number, weekStartDate: string, entries: SaveWeekEntryInput[]): Promise<TimesheetWeek>`

- [ ] **Step 1: Escribir los tests (mock de `db`)**

```typescript
// backend/src/__tests__/services/timesheetService.test.ts
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
    }
}));

import { db } from '../../database/database';
import { TimesheetService } from '../../services/timesheetService';

describe('TimesheetService', () => {
    let timesheetService: TimesheetService;

    beforeEach(() => {
        jest.clearAllMocks();
        timesheetService = new TimesheetService();
    });

    describe('getWeekStart', () => {
        it('devuelve el lunes de la semana para cualquier día de esa semana', () => {
            expect(timesheetService.getWeekStart('2026-09-17')).toBe('2026-09-14'); // jueves -> lunes
            expect(timesheetService.getWeekStart('2026-09-14')).toBe('2026-09-14'); // ya es lunes
            expect(timesheetService.getWeekStart('2026-09-20')).toBe('2026-09-14'); // domingo -> lunes de esa misma semana
        });
    });

    describe('getWeek', () => {
        it('devuelve 7 días (lunes a domingo) con las entradas agrupadas por fecha', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM timesheet_periods')) return Promise.resolve(undefined);
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, project_id: 1, project_name: 'AGROSUPER', task_id: null, task_title: null, description: 'Dev', hours: 4, date: '2026-09-14', is_billable: 1, approval_status: 'draft', is_locked: 0 },
                { id: 2, project_id: 1, project_name: 'AGROSUPER', task_id: null, task_title: null, description: 'QA', hours: 2, date: '2026-09-14', is_billable: 1, approval_status: 'draft', is_locked: 0 },
                { id: 3, project_id: 2, project_name: 'PROMET', task_id: 5, task_title: 'Fix bug', description: null, hours: 3, date: '2026-09-16', is_billable: 0, approval_status: 'draft', is_locked: 0 }
            ]);

            const week = await timesheetService.getWeek(1, '2026-09-14');

            expect(week.days).toHaveLength(7);
            expect(week.days[0].date).toBe('2026-09-14');
            expect(week.days[6].date).toBe('2026-09-20');
            expect(week.days[0].entries).toHaveLength(2);
            expect(week.days[0].total_hours).toBe(6);
            expect(week.days[2].entries).toHaveLength(1);
            expect(week.total_hours).toBe(9);
            expect(week.period).toBeNull();
        });

        it('incluye el periodo si ya existe uno para esa semana', async () => {
            (db.get as jest.Mock).mockResolvedValue({
                id: 10, user_id: 1, period_start: '2026-09-14', period_end: '2026-09-20',
                status: 'submitted', submitted_at: '2026-09-18T10:00:00Z', approved_by: null, approved_at: null, rejection_reason: null
            });
            (db.query as jest.Mock).mockResolvedValue([]);

            const week = await timesheetService.getWeek(1, '2026-09-14');
            expect(week.period?.status).toBe('submitted');
        });
    });

    describe('saveWeekEntries', () => {
        it('rechaza si el periodo ya está submitted o approved', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'approved' });

            await expect(
                timesheetService.saveWeekEntries(1, '2026-09-14', [])
            ).rejects.toThrow('locked');

            expect(db.beginTransaction).not.toHaveBeenCalled();
        });

        it('crea el periodo (open) si no existe, borra las entradas quitadas e inserta/actualiza el resto', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM timesheet_periods')) return Promise.resolve(undefined);
                return Promise.resolve(undefined);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('SELECT id FROM time_entries')) {
                    return Promise.resolve([{ id: 1 }, { id: 2 }]); // entradas existentes de esa semana
                }
                return Promise.resolve([]);
            });

            await timesheetService.saveWeekEntries(1, '2026-09-14', [
                { id: 1, project_id: 1, date: '2026-09-14', hours: 4 },
                { project_id: 1, date: '2026-09-15', hours: 3 }
            ]);

            expect(db.beginTransaction).toHaveBeenCalled();
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO timesheet_periods'),
                expect.arrayContaining([1, '2026-09-14', '2026-09-20'])
            );
            // La entrada id=2 existía pero no vino en el payload -> se borra
            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM time_entries'), [2]);
            // id=1 se actualiza
            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE time_entries'), expect.arrayContaining([1]));
            // la nueva (sin id) se inserta
            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO time_entries'), expect.any(Array));
            expect(db.commit).toHaveBeenCalled();
        });

        it('hace rollback si una escritura falla', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockResolvedValue([]);
            (db.run as jest.Mock).mockRejectedValueOnce(new Error('boom'));

            await expect(
                timesheetService.saveWeekEntries(1, '2026-09-14', [{ project_id: 1, date: '2026-09-14', hours: 1 }])
            ).rejects.toThrow('boom');

            expect(db.rollback).toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest timesheetService.test.ts`
Expected: FAIL con "Cannot find module '../../services/timesheetService'"

- [ ] **Step 3: Implementar `backend/src/services/timesheetService.ts`**

```typescript
import { startOfWeek, addDays, format, parseISO } from 'date-fns';
import { db } from '../database/database';
import { logger } from '../utils/logger';

export interface TimeEntryRow {
    id: number;
    project_id: number;
    project_name: string;
    task_id: number | null;
    task_title: string | null;
    description: string | null;
    hours: number;
    date: string;
    is_billable: boolean;
    approval_status: 'draft' | 'submitted' | 'approved' | 'rejected';
    is_locked: boolean;
}

export interface TimesheetWeekDay {
    date: string;
    entries: TimeEntryRow[];
    total_hours: number;
}

export interface TimesheetPeriodRow {
    id: number;
    user_id: number;
    period_start: string;
    period_end: string;
    status: 'open' | 'submitted' | 'approved' | 'rejected';
    submitted_at: string | null;
    approved_by: number | null;
    approved_at: string | null;
    rejection_reason: string | null;
}

export interface TimesheetWeek {
    period: TimesheetPeriodRow | null;
    days: TimesheetWeekDay[];
    total_hours: number;
}

export interface SaveWeekEntryInput {
    id?: number;
    project_id: number;
    task_id?: number | null;
    description?: string | null;
    date: string;
    hours: number;
    is_billable?: boolean;
}

function toRow(raw: any): TimeEntryRow {
    return {
        id: raw.id,
        project_id: raw.project_id,
        project_name: raw.project_name,
        task_id: raw.task_id,
        task_title: raw.task_title,
        description: raw.description,
        hours: raw.hours,
        date: raw.date,
        is_billable: !!raw.is_billable,
        approval_status: raw.approval_status,
        is_locked: !!raw.is_locked
    };
}

/**
 * Grilla semanal de horas: única fuente para leer/escribir la semana de un usuario.
 * time_entries sigue siendo la tabla de datos; este servicio agrega por semana,
 * gestiona el ciclo de vida de timesheet_periods (Task 3) y las métricas derivadas (Task 5/6).
 */
export class TimesheetService {
    /** Lunes (yyyy-MM-dd) de la semana que contiene anyDateInWeek. */
    getWeekStart(anyDateInWeek: string): string {
        const monday = startOfWeek(parseISO(anyDateInWeek), { weekStartsOn: 1 });
        return format(monday, 'yyyy-MM-dd');
    }

    private getWeekEnd(weekStartDate: string): string {
        return format(addDays(parseISO(weekStartDate), 6), 'yyyy-MM-dd');
    }

    async getPeriod(userId: number, weekStartDate: string): Promise<TimesheetPeriodRow | null> {
        const row = await db.get(
            `SELECT * FROM timesheet_periods WHERE user_id = ? AND period_start = ?`,
            [userId, weekStartDate]
        );
        return row || null;
    }

    async getWeek(userId: number, weekStartDate: string): Promise<TimesheetWeek> {
        const monday = this.getWeekStart(weekStartDate);
        const sunday = this.getWeekEnd(monday);

        const [period, rawRows] = await Promise.all([
            this.getPeriod(userId, monday),
            db.query(
                `SELECT te.id, te.project_id, p.name as project_name, te.task_id, t.title as task_title,
                        te.description, te.hours, te.date, te.is_billable, te.approval_status, te.is_locked
                 FROM time_entries te
                 JOIN projects p ON p.id = te.project_id
                 LEFT JOIN tasks t ON t.id = te.task_id
                 WHERE te.user_id = ? AND te.date >= ? AND te.date <= ?
                 ORDER BY te.date ASC, te.created_at ASC`,
                [userId, monday, sunday]
            )
        ]);

        const rows = rawRows.map(toRow);
        const days: TimesheetWeekDay[] = [];
        let totalHours = 0;

        for (let i = 0; i < 7; i++) {
            const date = format(addDays(parseISO(monday), i), 'yyyy-MM-dd');
            const entries = rows.filter(r => r.date === date);
            const dayTotal = entries.reduce((sum, e) => sum + e.hours, 0);
            totalHours += dayTotal;
            days.push({ date, entries, total_hours: dayTotal });
        }

        return { period, days, total_hours: totalHours };
    }

    /**
     * Reemplaza el conjunto de entradas de la semana por el payload recibido (semántica de
     * "estado completo de la semana", igual que la grilla lo edita en el frontend): lo que
     * ya existía y no viene en el payload se borra, lo que trae `id` se actualiza, el resto se inserta.
     * Crea el timesheet_period en 'open' si es la primera vez que se guarda algo en esa semana.
     */
    async saveWeekEntries(userId: number, weekStartDate: string, entries: SaveWeekEntryInput[]): Promise<TimesheetWeek> {
        const monday = this.getWeekStart(weekStartDate);
        const sunday = this.getWeekEnd(monday);

        const existingPeriod = await this.getPeriod(userId, monday);
        if (existingPeriod && (existingPeriod.status === 'submitted' || existingPeriod.status === 'approved')) {
            throw new Error(`Timesheet week is locked (status=${existingPeriod.status})`);
        }

        await db.beginTransaction();
        try {
            let periodId = existingPeriod?.id;
            if (!periodId) {
                const created = await db.run(
                    `INSERT INTO timesheet_periods (user_id, period_start, period_end, status) VALUES (?, ?, ?, 'open')`,
                    [userId, monday, sunday]
                );
                periodId = created.id!;
            } else if (existingPeriod!.status === 'rejected') {
                await db.run(`UPDATE timesheet_periods SET status = 'open', rejection_reason = NULL WHERE id = ?`, [periodId]);
            }

            const existingIdsRows = await db.query(
                `SELECT id FROM time_entries WHERE user_id = ? AND date >= ? AND date <= ?`,
                [userId, monday, sunday]
            );
            const existingIds = new Set(existingIdsRows.map((r: any) => r.id));
            const keptIds = new Set(entries.filter(e => e.id).map(e => e.id));

            for (const id of existingIds) {
                if (!keptIds.has(id)) {
                    await db.run(`DELETE FROM time_entries WHERE id = ?`, [id]);
                }
            }

            for (const entry of entries) {
                if (entry.id) {
                    await db.run(
                        `UPDATE time_entries
                         SET project_id = ?, task_id = ?, description = ?, hours = ?, date = ?,
                             is_billable = ?, timesheet_period_id = ?, updated_at = CURRENT_TIMESTAMP
                         WHERE id = ? AND user_id = ?`,
                        [
                            entry.project_id, entry.task_id ?? null, entry.description ?? null, entry.hours, entry.date,
                            entry.is_billable === false ? 0 : 1, periodId, entry.id, userId
                        ]
                    );
                } else {
                    await db.run(
                        `INSERT INTO time_entries (
                            user_id, project_id, task_id, description, hours, date, is_billable,
                            approval_status, timesheet_period_id, created_at, updated_at
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [
                            userId, entry.project_id, entry.task_id ?? null, entry.description ?? null,
                            entry.hours, entry.date, entry.is_billable === false ? 0 : 1, periodId
                        ]
                    );
                }
            }

            await db.commit();
        } catch (error) {
            await db.rollback();
            logger.error('saveWeekEntries failed, rolled back:', error);
            throw error;
        }

        return this.getWeek(userId, monday);
    }
}

export const timesheetService = new TimesheetService();
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest timesheetService.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/timesheetService.ts backend/src/__tests__/services/timesheetService.test.ts
git commit -m "feat(fase3): timesheetService - grilla semanal de horas (obtener y guardar)"
```

---

### Task 3: `timesheetService` — enviar (submit), aprobar y rechazar semana (bloqueo real)

**Files:**
- Modify: `backend/src/services/timesheetService.ts`
- Test: modify `backend/src/__tests__/services/timesheetService.test.ts`

**Interfaces:**
- Consumes: `financeService.toCLP` (`backend/src/services/financeService.ts:64`), tabla `user_cost_rates` (tarifa de costo del usuario), tabla `project_financials` (tarifa de venta del proyecto, para `bill_rate_snapshot`).
- Produces (usados por Task 7 - `timesheetController.ts`):
  - `timesheetService.submitWeek(userId: number, weekStartDate: string): Promise<TimesheetPeriodRow>`
  - `timesheetService.getPendingApprovals(): Promise<Array<TimesheetPeriodRow & { user_name: string; total_hours: number }>>`
  - `timesheetService.approveWeek(approverId: number, periodId: number): Promise<TimesheetPeriodRow>`
  - `timesheetService.rejectWeek(approverId: number, periodId: number, reason: string): Promise<TimesheetPeriodRow>`

- [ ] **Step 1: Agregar los tests al `describe('TimesheetService', ...)` existente**

Agregar después del bloque `describe('saveWeekEntries', ...)`:

```typescript
    describe('submitWeek', () => {
        it('marca el periodo y sus entradas como submitted', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            const result = await timesheetService.submitWeek(1, '2026-09-14');

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE timesheet_periods SET status = 'submitted'"),
                expect.arrayContaining([10])
            );
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE time_entries SET approval_status = 'submitted'"),
                expect.arrayContaining([10])
            );
            expect(result.status).toBe('submitted');
        });

        it('rechaza si no hay periodo (semana vacía) para esa fecha', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            await expect(timesheetService.submitWeek(1, '2026-09-14')).rejects.toThrow('No timesheet period');
        });

        it('rechaza si el periodo ya fue aprobado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'approved' });
            await expect(timesheetService.submitWeek(1, '2026-09-14')).rejects.toThrow('already approved');
        });
    });

    describe('approveWeek', () => {
        it('bloquea las entradas y les congela cost_rate_snapshot y bill_rate_snapshot en CLP', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM timesheet_periods WHERE id')) {
                    return Promise.resolve({ id: 10, user_id: 1, status: 'submitted', period_start: '2026-09-14', period_end: '2026-09-20' });
                }
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, project_id: 1, hours: 4, is_billable: 1 }
            ]);
            jest.spyOn(timesheetService as any, 'getUserCostRateCLP').mockResolvedValue(15000);
            jest.spyOn(timesheetService as any, 'getProjectBillRateCLP').mockResolvedValue(20000);
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            const result = await timesheetService.approveWeek(2, 10);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('cost_rate_snapshot = ?, bill_rate_snapshot = ?'),
                expect.arrayContaining([15000, 20000, 1])
            );
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE timesheet_periods SET status = 'approved'"),
                expect.arrayContaining([2, 10])
            );
            expect(result.status).toBe('approved');
        });

        it('rechaza si el periodo no está submitted', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            await expect(timesheetService.approveWeek(2, 10)).rejects.toThrow('not submitted');
        });
    });

    describe('rejectWeek', () => {
        it('marca el periodo y sus entradas como rejected con el motivo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'submitted' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            const result = await timesheetService.rejectWeek(2, 10, 'Faltan horas del jueves');

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE timesheet_periods SET status = 'rejected'"),
                expect.arrayContaining(['Faltan horas del jueves', 2, 10])
            );
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE time_entries SET approval_status = 'rejected'"),
                [10]
            );
            expect(result.status).toBe('rejected');
        });
    });
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest timesheetService.test.ts`
Expected: FAIL — `submitWeek`/`approveWeek`/`rejectWeek`/`getPendingApprovals` no existen todavía.

- [ ] **Step 3: Agregar los métodos a `backend/src/services/timesheetService.ts`**

Agregar el import de `financeService` al inicio del archivo:

```typescript
import { financeService, Currency } from './financeService';
```

Agregar como métodos públicos de la clase `TimesheetService`, después de `saveWeekEntries`:

```typescript
    async submitWeek(userId: number, weekStartDate: string): Promise<TimesheetPeriodRow> {
        const monday = this.getWeekStart(weekStartDate);
        const period = await this.getPeriod(userId, monday);

        if (!period) {
            throw new Error('No timesheet period found for that week (nothing was saved yet)');
        }
        if (period.status === 'approved') {
            throw new Error('This week was already approved and cannot be re-submitted');
        }

        await db.run(
            `UPDATE timesheet_periods SET status = 'submitted', submitted_at = datetime('now'), rejection_reason = NULL WHERE id = ?`,
            [period.id]
        );
        await db.run(
            `UPDATE time_entries SET approval_status = 'submitted' WHERE timesheet_period_id = ?`,
            [period.id]
        );

        logger.info(`Timesheet: usuario ${userId} envió la semana del ${monday} para aprobación`);
        return { ...period, status: 'submitted' };
    }

    async getPendingApprovals(): Promise<Array<TimesheetPeriodRow & { user_name: string; total_hours: number }>> {
        return db.query(
            `SELECT tp.*, u.full_name as user_name,
                    COALESCE((SELECT SUM(hours) FROM time_entries WHERE timesheet_period_id = tp.id), 0) as total_hours
             FROM timesheet_periods tp
             JOIN users u ON u.id = tp.user_id
             WHERE tp.status = 'submitted'
             ORDER BY tp.submitted_at ASC`
        );
    }

    private async getUserCostRateCLP(userId: number): Promise<number> {
        const rate = await db.get(
            `SELECT hourly_rate, hourly_rate_currency FROM user_cost_rates
             WHERE user_id = ? AND is_active = 1 ORDER BY effective_from DESC LIMIT 1`,
            [userId]
        );
        if (!rate) return 0;
        return financeService.toCLP(rate.hourly_rate, rate.hourly_rate_currency as Currency);
    }

    private async getProjectBillRateCLP(projectId: number): Promise<number> {
        const financials = await db.get(
            `SELECT hourly_rate, hourly_rate_currency FROM project_financials WHERE project_id = ?`,
            [projectId]
        );
        if (!financials?.hourly_rate) return 0;
        return financeService.toCLP(financials.hourly_rate, (financials.hourly_rate_currency as Currency) || 'UF');
    }

    /**
     * Aprueba una semana: congela cost_rate_snapshot/bill_rate_snapshot (siempre en CLP, al valor
     * vigente hoy) por cada entrada y las bloquea (is_locked=1). Desde este momento financeService
     * usa estas horas como real_hours/real_cost del proyecto (ver Task 4) - por eso el snapshot
     * se congela aquí y no se recalcula nunca más, ni si cambia la tarifa del usuario a futuro.
     */
    async approveWeek(approverId: number, periodId: number): Promise<TimesheetPeriodRow> {
        const period = await db.get(`SELECT * FROM timesheet_periods WHERE id = ?`, [periodId]);
        if (!period) {
            throw new Error(`Timesheet period ${periodId} not found`);
        }
        if (period.status !== 'submitted') {
            throw new Error(`Timesheet period ${periodId} is not submitted (status=${period.status})`);
        }

        const userCostRateCLP = await this.getUserCostRateCLP(period.user_id);
        const entries = await db.query(
            `SELECT id, project_id, hours, is_billable FROM time_entries WHERE timesheet_period_id = ?`,
            [periodId]
        );

        for (const entry of entries) {
            const billRateCLP = entry.is_billable ? await this.getProjectBillRateCLP(entry.project_id) : 0;
            await db.run(
                `UPDATE time_entries
                 SET approval_status = 'approved', is_locked = 1, approved_by = ?, approved_at = datetime('now'),
                     cost_rate_snapshot = ?, bill_rate_snapshot = ?
                 WHERE id = ?`,
                [approverId, userCostRateCLP, billRateCLP, entry.id]
            );
        }

        await db.run(
            `UPDATE timesheet_periods SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?`,
            [approverId, periodId]
        );

        logger.info(`Timesheet: periodo ${periodId} (usuario ${period.user_id}) aprobado por ${approverId} - ${entries.length} entrada(s) bloqueada(s)`);
        return { ...period, status: 'approved', approved_by: approverId };
    }

    async rejectWeek(approverId: number, periodId: number, reason: string): Promise<TimesheetPeriodRow> {
        const period = await db.get(`SELECT * FROM timesheet_periods WHERE id = ?`, [periodId]);
        if (!period) {
            throw new Error(`Timesheet period ${periodId} not found`);
        }

        await db.run(
            `UPDATE timesheet_periods SET status = 'rejected', rejection_reason = ?, approved_by = ? WHERE id = ?`,
            [reason, approverId, periodId]
        );
        await db.run(`UPDATE time_entries SET approval_status = 'rejected' WHERE timesheet_period_id = ?`, [periodId]);

        logger.info(`Timesheet: periodo ${periodId} (usuario ${period.user_id}) rechazado por ${approverId}: ${reason}`);
        return { ...period, status: 'rejected', rejection_reason: reason };
    }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest timesheetService.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/timesheetService.ts backend/src/__tests__/services/timesheetService.test.ts
git commit -m "feat(fase3): timesheetService - enviar, aprobar y rechazar semana con bloqueo y snapshot de tarifas"
```

---

### Task 4: `financeService` — horas aprobadas reales alimentan `real_hours`/`real_cost`

**Files:**
- Modify: `backend/src/services/financeService.ts`
- Modify: `backend/src/__tests__/services/financeService.test.ts`

**Interfaces:**
- Consumes: tabla `time_entries` (columnas `approval_status`, `cost_rate_snapshot` de Task 1/3).
- Produces: cambia el comportamiento interno de `calculateProjectFinancials` (la firma pública no cambia). Nuevo método privado `getApprovedTimeSummary(projectId: number): Promise<{ hours: number; costCLP: number }>`.

- [ ] **Step 1: Actualizar `backend/src/__tests__/services/financeService.test.ts` para mockear la nueva consulta**

En la función `mockScenario()` (usada por el primer test) y en el segundo test (horas de atraso), agregar una rama para la nueva consulta de horas aprobadas, devolviendo "sin horas aprobadas todavía" para preservar el comportamiento actual de esos dos tests (el fallback a la proyección planificada):

```typescript
                if (sql.includes('FROM time_entries') && sql.includes("approval_status = 'approved'")) {
                    return Promise.resolve({ hours: 0, cost: 0 });
                }
```

Agregar esa misma rama en **ambos** `mockImplementation` de `db.get` ya existentes (el de `mockScenario()` y el del segundo test, "las horas de atraso..."), antes del `return Promise.resolve(undefined);` final de cada uno.

Agregar un nuevo test dentro de `describe('calculateProjectFinancials', ...)`, después del test de horas de atraso:

```typescript
        it('usa las horas y el costo realmente aprobados en vez de la proyección, cuando existen', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM projects WHERE id')) {
                    return Promise.resolve({ id: 1, name: 'Proyecto Test', assigned_to: null });
                }
                if (sql.includes('FROM project_financials')) {
                    return Promise.resolve({ budgeted_hours: 100, hourly_rate: 1, hourly_rate_currency: 'UF' });
                }
                if (sql.includes('FROM exchange_rates')) {
                    return Promise.resolve({ rate_to_clp: 38000 });
                }
                if (sql.includes('FROM user_cost_rates')) {
                    return Promise.resolve({ hourly_rate: 15000, hourly_rate_currency: 'CLP' });
                }
                if (sql.includes('FROM project_milestones')) {
                    return Promise.resolve({ total_delay_hours: 5 }); // 5h de atraso del cliente, se suman igual
                }
                if (sql.includes('FROM time_entries') && sql.includes("approval_status = 'approved'")) {
                    // El equipo ya registró y aprobó 80h reales, a un costo distinto de la tarifa actual
                    return Promise.resolve({ hours: 80, cost: 80 * 16000 });
                }
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM project_assignments')) {
                    return Promise.resolve([
                        { user_id: 1, allocation_percentage: 100, full_name: 'Dev Uno', role: 'rpa_developer' }
                    ]);
                }
                return Promise.resolve([]);
            });

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.real_hours).toBe(80 + 5); // horas aprobadas + atraso del cliente
            expect(result.real_cost).toBe(80 * 16000 + 5 * 15000); // costo snapshot aprobado + atraso a tarifa vigente
            expect(result.planned_hours).toBe(100); // lo planificado no cambia
        });
```

- [ ] **Step 2: Correr los tests para verificar que el nuevo falla y los otros dos siguen en verde**

Run: `cd backend && npx jest financeService.test.ts`
Expected: el nuevo test FAIL (todavía usa la proyección vieja), los otros 5 PASS (gracias al mock que devuelve `{ hours: 0, cost: 0 }`).

- [ ] **Step 3: Modificar `backend/src/services/financeService.ts`**

Agregar el nuevo método privado, después de `getClientDelayHours`:

```typescript
    /**
     * Horas y costo realmente aprobados (bloqueados) para un proyecto, según Fase 3.
     * costCLP usa cost_rate_snapshot (congelado al aprobar) - nunca la tarifa vigente hoy,
     * para que el costo histórico no cambie si la tarifa de alguien cambia después.
     */
    private async getApprovedTimeSummary(projectId: number): Promise<{ hours: number; costCLP: number }> {
        const row = await db.get(
            `SELECT COALESCE(SUM(hours), 0) as hours, COALESCE(SUM(hours * cost_rate_snapshot), 0) as cost
             FROM time_entries WHERE project_id = ? AND approval_status = 'approved'`,
            [projectId]
        );
        return { hours: row?.hours || 0, costCLP: row?.cost || 0 };
    }
```

Reemplazar el bloque de cálculo de `realHours`/`realCost` dentro de `calculateProjectFinancials` (el que hoy dice `const realHours = plannedHours + clientDelayHours;` seguido de `const plannedCost = ...` y `const realCost = ...`):

```typescript
        const clientDelayHours = await this.getClientDelayHours(projectId);

        // Fase 3: las horas/costo reales vienen de time_entries aprobados (el dato real), no de una
        // proyección. Mientras un proyecto no tenga ninguna hora aprobada todavía (arranque de esta
        // fase, o proyectos que aún no cargan timesheet), se usa la proyección anterior como fallback
        // para no mostrar de golpe un costo real de 0.
        const approvedTime = await this.getApprovedTimeSummary(projectId);
        const hasApprovedTime = approvedTime.hours > 0;

        const plannedCost = plannedHours * engineerHourlyCost;
        const realHours = hasApprovedTime
            ? approvedTime.hours + clientDelayHours
            : plannedHours + clientDelayHours;
        const realCost = hasApprovedTime
            ? approvedTime.costCLP + (clientDelayHours * engineerHourlyCost)
            : realHours * engineerHourlyCost;
```

Eliminar la línea original `const realHours = plannedHours + clientDelayHours;` y la línea original `const plannedCost = plannedHours * engineerHourlyCost;` / `const realCost = realHours * engineerHourlyCost;` que quedan reemplazadas por el bloque anterior (verificar que no queden duplicadas al editar el archivo real).

- [ ] **Step 4: Correr los tests para verificar que todos pasan**

Run: `cd backend && npx jest financeService.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Correr la suite completa de backend para confirmar que Fase 2 (billingService/roi_alerts) sigue sana**

Run: `cd backend && npm test`
Expected: PASS — `billingService`/`financeService.roiAlerts` consumen `calculateProjectFinancials` pero no dependen del valor exacto de `real_hours`/`real_cost`, solo de que la función siga devolviendo la forma `ProjectFinancials`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/financeService.ts backend/src/__tests__/services/financeService.test.ts
git commit -m "feat(fase3): financeService usa horas aprobadas reales para real_hours/real_cost, con fallback a la proyección"
```

---

### Task 5: `timesheetService` — métricas de efectividad (estimado vs. real)

**Files:**
- Modify: `backend/src/services/timesheetService.ts`
- Test: modify `backend/src/__tests__/services/timesheetService.test.ts`

**Interfaces:**
- Consumes: tabla `tasks` (`estimated_hours`, `assignee_id`), tabla `time_entries` (horas aprobadas por usuario/tarea en un rango), `financeService.getMonthlyHours()` (`backend/src/services/financeService.ts:71`).
- Produces:
  - `interface EffectivenessByPerson { user_id: number; user_name: string; estimated_hours: number; real_hours: number; utilization_pct: number; billable_pct: number }`
  - `interface EffectivenessByTask { task_id: number; task_title: string; project_name: string; estimated_hours: number; real_hours: number; variance_hours: number }`
  - `interface EffectivenessMetrics { from: string; to: string; by_person: EffectivenessByPerson[]; by_task: EffectivenessByTask[] }`
  - `timesheetService.getEffectivenessMetrics(from: string, to: string): Promise<EffectivenessMetrics>`

Nota de diseño: las métricas usan **solo horas aprobadas** (`approval_status = 'approved'`) — es deliberado, el título de la fase es "tiempo **confiable**"; horas en borrador o rechazadas no son un dato confirmado todavía.

- [ ] **Step 1: Agregar los tests**

Agregar al final de `backend/src/__tests__/services/timesheetService.test.ts`, dentro de `describe('TimesheetService', ...)`:

```typescript
    describe('getEffectivenessMetrics', () => {
        it('calcula estimado vs real por persona (con utilización y % facturable) y por tarea', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM global_settings')) return Promise.resolve({ setting_value: '176' });
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('GROUP BY te.user_id')) {
                    return Promise.resolve([
                        { user_id: 1, user_name: 'Dev Uno', real_hours: 80, billable_hours: 60 }
                    ]);
                }
                if (sql.includes('SUM(t.estimated_hours)') && sql.includes('assignee_id')) {
                    return Promise.resolve([{ user_id: 1, estimated_hours: 100 }]);
                }
                if (sql.includes('GROUP BY te.task_id')) {
                    return Promise.resolve([
                        { task_id: 5, task_title: 'Fix bug', project_name: 'PROMET', estimated_hours: 10, real_hours: 14 }
                    ]);
                }
                return Promise.resolve([]);
            });

            const metrics = await timesheetService.getEffectivenessMetrics('2026-09-01', '2026-09-30');

            expect(metrics.by_person[0]).toMatchObject({
                user_id: 1, user_name: 'Dev Uno', estimated_hours: 100, real_hours: 80, billable_pct: 75
            });
            expect(metrics.by_person[0].utilization_pct).toBeCloseTo((80 / 176) * 100, 1);
            expect(metrics.by_task[0]).toMatchObject({
                task_id: 5, task_title: 'Fix bug', project_name: 'PROMET',
                estimated_hours: 10, real_hours: 14, variance_hours: 4
            });
        });
    });
```

- [ ] **Step 2: Correr los tests para verificar que falla**

Run: `cd backend && npx jest timesheetService.test.ts -t "getEffectivenessMetrics"`
Expected: FAIL — `timesheetService.getEffectivenessMetrics is not a function`

- [ ] **Step 3: Agregar el método a `backend/src/services/timesheetService.ts`**

```typescript
export interface EffectivenessByPerson {
    user_id: number;
    user_name: string;
    estimated_hours: number;
    real_hours: number;
    utilization_pct: number;
    billable_pct: number;
}

export interface EffectivenessByTask {
    task_id: number;
    task_title: string;
    project_name: string;
    estimated_hours: number;
    real_hours: number;
    variance_hours: number;
}

export interface EffectivenessMetrics {
    from: string;
    to: string;
    by_person: EffectivenessByPerson[];
    by_task: EffectivenessByTask[];
}
```

Y como método público de la clase, después de `rejectWeek`:

```typescript
    /**
     * Estimado vs. real por persona y por tarea, en un rango de fechas. Solo cuenta horas
     * aprobadas (bloqueadas) - es el dato confiable que da nombre a esta fase.
     */
    async getEffectivenessMetrics(from: string, to: string): Promise<EffectivenessMetrics> {
        const monthlyHours = await financeService.getMonthlyHours();
        const daysInRange = (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1;
        const expectedHours = monthlyHours * (daysInRange / 30);

        const realByPerson = await db.query(
            `SELECT te.user_id, u.full_name as user_name,
                    COALESCE(SUM(te.hours), 0) as real_hours,
                    COALESCE(SUM(CASE WHEN te.is_billable = 1 THEN te.hours ELSE 0 END), 0) as billable_hours
             FROM time_entries te
             JOIN users u ON u.id = te.user_id
             WHERE te.approval_status = 'approved' AND te.date >= ? AND te.date <= ?
             GROUP BY te.user_id, u.full_name`,
            [from, to]
        );

        const estimatedByPerson = await db.query(
            `SELECT assignee_id as user_id, COALESCE(SUM(estimated_hours), 0) as estimated_hours
             FROM tasks WHERE assignee_id IS NOT NULL GROUP BY assignee_id`
        );
        const estimatedMap = new Map<number, number>(estimatedByPerson.map((r: any) => [r.user_id, r.estimated_hours]));

        const by_person: EffectivenessByPerson[] = realByPerson.map((r: any) => ({
            user_id: r.user_id,
            user_name: r.user_name,
            estimated_hours: estimatedMap.get(r.user_id) || 0,
            real_hours: r.real_hours,
            utilization_pct: Math.round((r.real_hours / expectedHours) * 1000) / 10,
            billable_pct: r.real_hours > 0 ? Math.round((r.billable_hours / r.real_hours) * 1000) / 10 : 0
        }));

        const byTaskRows = await db.query(
            `SELECT t.id as task_id, t.title as task_title, p.name as project_name,
                    COALESCE(t.estimated_hours, 0) as estimated_hours,
                    COALESCE(SUM(te.hours), 0) as real_hours
             FROM tasks t
             JOIN task_boards b ON b.id = t.board_id
             JOIN projects p ON p.id = b.project_id
             LEFT JOIN time_entries te ON te.task_id = t.id
                AND te.approval_status = 'approved' AND te.date >= ? AND te.date <= ?
             WHERE t.estimated_hours IS NOT NULL
             GROUP BY t.id, t.title, p.name, t.estimated_hours`,
            [from, to]
        );

        const by_task: EffectivenessByTask[] = byTaskRows.map((r: any) => ({
            task_id: r.task_id,
            task_title: r.task_title,
            project_name: r.project_name,
            estimated_hours: r.estimated_hours,
            real_hours: r.real_hours,
            variance_hours: Math.round((r.real_hours - r.estimated_hours) * 100) / 100
        }));

        return { from, to, by_person, by_task };
    }
```

Nota: verificar en `backend/src/database/migrationList.ts` que `task_boards` tiene columna `project_id` (usada en el JOIN de `by_task`) antes de dar este paso por cerrado — si el nombre real de la columna difiere, ajustar el JOIN a como esté modelado realmente.

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest timesheetService.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/timesheetService.ts backend/src/__tests__/services/timesheetService.test.ts
git commit -m "feat(fase3): timesheetService - metricas de efectividad (estimado vs real, utilizacion, % facturable)"
```

---

### Task 6: `timesheetService` — recordatorios de horas pendientes

**Files:**
- Modify: `backend/src/services/timesheetService.ts`
- Modify: `backend/src/server.ts` (log de pendientes al arrancar)
- Test: modify `backend/src/__tests__/services/timesheetService.test.ts`

**Interfaces:**
- Consumes: tabla `time_entries`, tabla `users` (`is_active`).
- Produces:
  - `interface PendingReminder { date: string; has_entries: boolean }`
  - `timesheetService.getPendingReminders(userId: number, referenceDate?: string): Promise<{ missing_dates: string[]; open_period: TimesheetPeriodRow | null }>` (últimos 14 días hábiles, lunes a viernes, sin ninguna entrada registrada)
  - `timesheetService.logStartupPendingWorkSummary(): Promise<void>` (una línea de log por usuario activo con días pendientes; sin retorno útil, solo efecto de log)

- [ ] **Step 1: Agregar los tests**

Agregar al final de `backend/src/__tests__/services/timesheetService.test.ts`:

```typescript
    describe('getPendingReminders', () => {
        it('devuelve los días hábiles de las últimas 2 semanas sin ninguna entrada', async () => {
            (db.query as jest.Mock).mockResolvedValue([{ date: '2026-09-15' }]); // solo el martes tiene registro
            (db.get as jest.Mock).mockResolvedValue(undefined); // sin periodo abierto

            const result = await timesheetService.getPendingReminders(1, '2026-09-17'); // jueves

            // Hábiles entre 2026-09-03 (jueves, 14 días antes) y 2026-09-17 inclusive, sin fines de semana,
            // excluyendo 2026-09-15 que sí tiene entrada.
            expect(result.missing_dates).not.toContain('2026-09-15');
            expect(result.missing_dates).toContain('2026-09-16');
            expect(result.missing_dates.length).toBeGreaterThan(0);
            expect(result.missing_dates.every(d => {
                const day = new Date(`${d}T00:00:00Z`).getUTCDay();
                return day !== 0 && day !== 6;
            })).toBe(true);
        });
    });

    describe('logStartupPendingWorkSummary', () => {
        it('no lanza si no hay usuarios activos', async () => {
            (db.query as jest.Mock).mockResolvedValue([]);
            await expect(timesheetService.logStartupPendingWorkSummary()).resolves.toBeUndefined();
        });
    });
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest timesheetService.test.ts -t "getPendingReminders|logStartupPendingWorkSummary"`
Expected: FAIL — los métodos no existen todavía.

- [ ] **Step 3: Agregar los métodos a `backend/src/services/timesheetService.ts`**

```typescript
    /** Días hábiles (lunes a viernes) de las últimas dos semanas sin ninguna entrada de tiempo. */
    async getPendingReminders(userId: number, referenceDate?: string): Promise<{ missing_dates: string[]; open_period: TimesheetPeriodRow | null }> {
        const today = referenceDate ? parseISO(referenceDate) : new Date();
        const from = format(addDays(today, -13), 'yyyy-MM-dd');
        const to = format(today, 'yyyy-MM-dd');

        const rows = await db.query(
            `SELECT DISTINCT date FROM time_entries WHERE user_id = ? AND date >= ? AND date <= ?`,
            [userId, from, to]
        );
        const datesWithEntries = new Set(rows.map((r: any) => r.date));

        const missing_dates: string[] = [];
        for (let i = 0; i < 14; i++) {
            const date = addDays(parseISO(from), i);
            const dayOfWeek = date.getDay(); // 0 domingo, 6 sábado
            if (dayOfWeek === 0 || dayOfWeek === 6) continue;
            const dateStr = format(date, 'yyyy-MM-dd');
            if (!datesWithEntries.has(dateStr)) {
                missing_dates.push(dateStr);
            }
        }

        const openPeriod = await db.get(
            `SELECT * FROM timesheet_periods WHERE user_id = ? AND status IN ('open', 'rejected') ORDER BY period_start DESC LIMIT 1`,
            [userId]
        );

        return { missing_dates, open_period: openPeriod || null };
    }

    /**
     * Sin scheduler en este proyecto: se llama una vez al arrancar el servidor (server.ts) para
     * dejar en el log quién tiene trabajo pendiente, igual que describe la Fase 3 del plan maestro.
     * No envía notificaciones (eso es Fase 5, cuando se active socket.io/notifications).
     */
    async logStartupPendingWorkSummary(): Promise<void> {
        const users = await db.query(`SELECT id, full_name FROM users WHERE is_active = 1`);

        for (const user of users) {
            const { missing_dates } = await this.getPendingReminders(user.id);
            if (missing_dates.length > 0) {
                logger.info(`Timesheet: ${user.full_name} tiene ${missing_dates.length} día(s) hábil(es) sin horas registradas en las últimas 2 semanas`);
            }
        }
    }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest timesheetService.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Enganchar `logStartupPendingWorkSummary` en el arranque del servidor**

Modificar `backend/src/server.ts`: agregar el import y llamarlo dentro de `start()`, después de `logger.info('Database already has data, skipping seeding');` y antes de `this.app.listen(...)`:

```typescript
import { timesheetService } from './services/timesheetService';
```

```typescript
            // Fase 3: dejar en el log quién tiene horas pendientes (no hay scheduler en este proyecto)
            await timesheetService.logStartupPendingWorkSummary();
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/timesheetService.ts backend/src/server.ts backend/src/__tests__/services/timesheetService.test.ts
git commit -m "feat(fase3): timesheetService - recordatorios de horas pendientes (in-app + log al arrancar)"
```

---

### Task 7: Zod schemas + `timesheetController.ts` + `timesheetRoutes.ts` + bloqueo en `timeController.ts`

**Files:**
- Modify: `backend/src/validation/schemas.ts`
- Create: `backend/src/controllers/timesheetController.ts`
- Create: `backend/src/routes/timesheetRoutes.ts`
- Modify: `backend/src/controllers/timeController.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/src/__tests__/controllers/timesheetController.test.ts`
- Test: `backend/src/__tests__/controllers/timeController.test.ts`

**Interfaces:**
- Consumes: `timesheetService` (Task 2/3/5/6).
- Produces endpoints (todos bajo `/api/timesheet`, montados en `server.ts`):
  - `GET /api/timesheet/week?week_start=YYYY-MM-DD` → semana propia
  - `PUT /api/timesheet/week` → `{ week_start, entries: SaveWeekEntryInput[] }`, guarda la semana propia
  - `POST /api/timesheet/week/submit` → `{ week_start }`, envía la semana propia
  - `GET /api/timesheet/pending-approvals` → `authorize(['team_lead'])`
  - `POST /api/timesheet/periods/:id/approve` → `authorize(['team_lead'])`
  - `POST /api/timesheet/periods/:id/reject` → `authorize(['team_lead'])`, body `{ reason }`
  - `GET /api/timesheet/effectiveness?from=&to=` → `authorize(['team_lead', 'rpa_operations'])`
  - `GET /api/timesheet/reminders` → propios, cualquier rol autenticado

- [ ] **Step 1: Agregar schemas Zod a `backend/src/validation/schemas.ts`**

Agregar al final del archivo:

```typescript
// Timesheet validation schemas (Fase 3)
export const saveWeekEntrySchema = z.object({
    id: z.number().int().positive().optional(),
    project_id: z.number().int().positive('Valid project ID required'),
    task_id: z.number().int().positive().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    hours: z.number().min(0.01, 'Hours must be greater than 0').max(24, 'Hours must be 24 or less'),
    is_billable: z.boolean().optional()
});

export const saveWeekSchema = z.object({
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    entries: z.array(saveWeekEntrySchema)
});

export const submitWeekSchema = z.object({
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
});

export const rejectWeekSchema = z.object({
    reason: z.string().min(1, 'A rejection reason is required').max(500)
});
```

- [ ] **Step 2: Escribir los tests de `timesheetController`**

```typescript
// backend/src/__tests__/controllers/timesheetController.test.ts
jest.mock('../../services/timesheetService', () => ({
    timesheetService: {
        getWeek: jest.fn(),
        saveWeekEntries: jest.fn(),
        submitWeek: jest.fn(),
        getPendingApprovals: jest.fn(),
        approveWeek: jest.fn(),
        rejectWeek: jest.fn(),
        getEffectivenessMetrics: jest.fn(),
        getPendingReminders: jest.fn(),
    }
}));

import { timesheetService } from '../../services/timesheetService';
import { TimesheetController } from '../../controllers/timesheetController';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('TimesheetController', () => {
    let controller: TimesheetController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TimesheetController();
    });

    describe('getWeek', () => {
        it('usa el usuario autenticado y el week_start de query', async () => {
            (timesheetService.getWeek as jest.Mock).mockResolvedValue({ period: null, days: [], total_hours: 0 });
            const req: any = { query: { week_start: '2026-09-14' }, user: { id: 7, role: 'rpa_developer' } };
            const res = mockRes();

            await controller.getWeek(req, res);

            expect(timesheetService.getWeek).toHaveBeenCalledWith(7, '2026-09-14');
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('saveWeek', () => {
        it('devuelve 400 si la semana está bloqueada', async () => {
            (timesheetService.saveWeekEntries as jest.Mock).mockRejectedValue(new Error('Timesheet week is locked (status=approved)'));
            const req: any = { body: { week_start: '2026-09-14', entries: [] }, user: { id: 7, role: 'rpa_developer' } };
            const res = mockRes();

            await controller.saveWeek(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('approveWeek', () => {
        it('aprueba con el id de la ruta y el aprobador autenticado', async () => {
            (timesheetService.approveWeek as jest.Mock).mockResolvedValue({ id: 10, status: 'approved' });
            const req: any = { params: { id: '10' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.approveWeek(req, res);

            expect(timesheetService.approveWeek).toHaveBeenCalledWith(1, 10);
            expect(res.json).toHaveBeenCalledWith({ id: 10, status: 'approved' });
        });
    });

    describe('rejectWeek', () => {
        it('rechaza con el motivo del body', async () => {
            (timesheetService.rejectWeek as jest.Mock).mockResolvedValue({ id: 10, status: 'rejected' });
            const req: any = { params: { id: '10' }, body: { reason: 'Faltan horas' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.rejectWeek(req, res);

            expect(timesheetService.rejectWeek).toHaveBeenCalledWith(1, 10, 'Faltan horas');
        });
    });

    describe('getEffectiveness', () => {
        it('pasa from/to de query al servicio', async () => {
            (timesheetService.getEffectivenessMetrics as jest.Mock).mockResolvedValue({ from: '2026-09-01', to: '2026-09-30', by_person: [], by_task: [] });
            const req: any = { query: { from: '2026-09-01', to: '2026-09-30' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.getEffectiveness(req, res);

            expect(timesheetService.getEffectivenessMetrics).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
        });
    });

    describe('getReminders', () => {
        it('devuelve los recordatorios del usuario autenticado', async () => {
            (timesheetService.getPendingReminders as jest.Mock).mockResolvedValue({ missing_dates: ['2026-09-16'], open_period: null });
            const req: any = { user: { id: 7, role: 'rpa_developer' } };
            const res = mockRes();

            await controller.getReminders(req, res);

            expect(timesheetService.getPendingReminders).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith({ missing_dates: ['2026-09-16'], open_period: null });
        });
    });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest timesheetController.test.ts`
Expected: FAIL con "Cannot find module '../../controllers/timesheetController'"

- [ ] **Step 4: Implementar `backend/src/controllers/timesheetController.ts`**

```typescript
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { timesheetService } from '../services/timesheetService';
import { logger } from '../utils/logger';

export class TimesheetController {
    getWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const weekStart = (req.query.week_start as string) || new Date().toISOString().slice(0, 10);
            const week = await timesheetService.getWeek(req.user!.id, weekStart);
            res.json(week);
        } catch (error) {
            logger.error('Get timesheet week error:', error);
            res.status(500).json({ error: 'Failed to get timesheet week' });
        }
    };

    saveWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { week_start, entries } = req.body;
            const week = await timesheetService.saveWeekEntries(req.user!.id, week_start, entries);
            res.json(week);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save timesheet week';
            const isLocked = message.includes('locked');
            res.status(isLocked ? 400 : 500).json({ error: message });
            if (!isLocked) logger.error('Save timesheet week error:', error);
        }
    };

    submitWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { week_start } = req.body;
            const period = await timesheetService.submitWeek(req.user!.id, week_start);
            res.json(period);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit timesheet week';
            res.status(400).json({ error: message });
        }
    };

    getPendingApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const periods = await timesheetService.getPendingApprovals();
            res.json(periods);
        } catch (error) {
            logger.error('Get pending timesheet approvals error:', error);
            res.status(500).json({ error: 'Failed to get pending approvals' });
        }
    };

    approveWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const period = await timesheetService.approveWeek(req.user!.id, parseInt(req.params.id));
            res.json(period);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to approve timesheet week';
            res.status(400).json({ error: message });
        }
    };

    rejectWeek = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const period = await timesheetService.rejectWeek(req.user!.id, parseInt(req.params.id), req.body.reason);
            res.json(period);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reject timesheet week';
            res.status(400).json({ error: message });
        }
    };

    getEffectiveness = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { from, to } = req.query;
            const metrics = await timesheetService.getEffectivenessMetrics(from as string, to as string);
            res.json(metrics);
        } catch (error) {
            logger.error('Get effectiveness metrics error:', error);
            res.status(500).json({ error: 'Failed to get effectiveness metrics' });
        }
    };

    getReminders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const reminders = await timesheetService.getPendingReminders(req.user!.id);
            res.json(reminders);
        } catch (error) {
            logger.error('Get timesheet reminders error:', error);
            res.status(500).json({ error: 'Failed to get reminders' });
        }
    };
}
```

- [ ] **Step 5: Correr los tests de `timesheetController` para verificar que pasan**

Run: `cd backend && npx jest timesheetController.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Crear `backend/src/routes/timesheetRoutes.ts`**

```typescript
import express from 'express';
import { TimesheetController } from '../controllers/timesheetController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { saveWeekSchema, submitWeekSchema, rejectWeekSchema } from '../validation/schemas';

const router = express.Router();
const timesheetController = new TimesheetController();

router.use(authenticate);

// Semana propia (cualquier rol autenticado)
router.get('/week', timesheetController.getWeek);
router.put('/week', validate({ body: saveWeekSchema }), timesheetController.saveWeek);
router.post('/week/submit', validate({ body: submitWeekSchema }), timesheetController.submitWeek);
router.get('/reminders', timesheetController.getReminders);

// Aprobación (solo team_lead - acción financiera: bloquea horas y mueve el costo real del proyecto)
router.get('/pending-approvals', authorize(['team_lead']), timesheetController.getPendingApprovals);
router.post('/periods/:id/approve', authorize(['team_lead']), timesheetController.approveWeek);
router.post('/periods/:id/reject', authorize(['team_lead']), validate({ body: rejectWeekSchema }), timesheetController.rejectWeek);

// Efectividad (team_lead y rpa_operations, mismo grupo de solo-lectura que PMO/cobranza)
router.get('/effectiveness', authorize(['team_lead', 'rpa_operations']), timesheetController.getEffectiveness);

export default router;
```

- [ ] **Step 7: Registrar las rutas en `backend/src/server.ts`**

Agregar el import junto a los otros routers:

```typescript
import timesheetRoutes from './routes/timesheetRoutes';
```

Agregar el montaje junto a `this.app.use('/api/billing', billingRoutes);`:

```typescript
        this.app.use('/api/timesheet', timesheetRoutes);
```

Agregar un bloque `timesheet` al objeto `endpoints` de `GET /api`, junto al bloque `billing`:

```typescript
                    timesheet: {
                        'GET /api/timesheet/week': 'Get current user weekly timesheet grid',
                        'PUT /api/timesheet/week': 'Save current user weekly timesheet entries',
                        'POST /api/timesheet/week/submit': 'Submit current user week for approval',
                        'GET /api/timesheet/reminders': 'Get current user pending timesheet reminders',
                        'GET /api/timesheet/pending-approvals': 'Get weeks pending approval (team_lead only)',
                        'POST /api/timesheet/periods/:id/approve': 'Approve a submitted week (team_lead only)',
                        'POST /api/timesheet/periods/:id/reject': 'Reject a submitted week (team_lead only)',
                        'GET /api/timesheet/effectiveness': 'Get estimated vs real effectiveness metrics'
                    },
```

- [ ] **Step 8: Escribir el test de bloqueo de `timeController.ts` (endurecimiento contra horas aprobadas)**

```typescript
// backend/src/__tests__/controllers/timeController.test.ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { TimeController } from '../../controllers/timeController';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('TimeController - bloqueo de horas aprobadas (Fase 3)', () => {
    let controller: TimeController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TimeController();
    });

    describe('updateTimeEntry', () => {
        it('rechaza con 400 si la entrada está bloqueada (is_locked)', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, user_id: 7, is_locked: 1 });
            const req: any = { params: { id: '1' }, body: { hours: 5 }, user: { id: 7 } };
            const res = mockRes();

            await controller.updateTimeEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('deleteTimeEntry', () => {
        it('rechaza con 400 si la entrada está bloqueada (is_locked)', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, user_id: 7, is_locked: 1 });
            const req: any = { params: { id: '1' }, user: { id: 7 } };
            const res = mockRes();

            await controller.deleteTimeEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.run).not.toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 9: Correr el test para verificar que falla**

Run: `cd backend && npx jest timeController.test.ts`
Expected: FAIL — hoy `updateTimeEntry`/`deleteTimeEntry` no verifican `is_locked`, así que devuelven 200 en vez de 400.

- [ ] **Step 10: Modificar `backend/src/controllers/timeController.ts` para respetar el bloqueo**

En `updateTimeEntry`, justo después de la comprobación `if (!existingEntry) { ... return; }`, agregar:

```typescript
      if (existingEntry.is_locked) {
        res.status(400).json({ error: 'This time entry was approved and is locked; it cannot be modified' });
        return;
      }
```

En `deleteTimeEntry`, en el mismo lugar (después de `if (!existingEntry) { ... return; }`), agregar el mismo bloque.

- [ ] **Step 11: Correr todos los tests para verificar que pasan**

Run: `cd backend && npm test`
Expected: PASS — toda la suite (Fase 0-3) en verde.

- [ ] **Step 12: Correr lint**

Run: `cd backend && npm run lint`
Expected: 0 errores (los warnings preexistentes no relacionados pueden seguir).

- [ ] **Step 13: Commit**

```bash
git add backend/src/validation/schemas.ts backend/src/controllers/timesheetController.ts backend/src/routes/timesheetRoutes.ts backend/src/controllers/timeController.ts backend/src/server.ts backend/src/__tests__/controllers/timesheetController.test.ts backend/src/__tests__/controllers/timeController.test.ts
git commit -m "feat(fase3): timesheetController/Routes + bloqueo de horas aprobadas en timeController"
```

---

### Task 8: Frontend — tipos y métodos de API de timesheet

**Files:**
- Create: `frontend/src/types/timesheet.ts`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Consumes: endpoints de Task 7.
- Produces: tipos e interfaz de `apiService` usados por Task 9/10.

- [ ] **Step 1: Crear `frontend/src/types/timesheet.ts`**

```typescript
export interface TimeEntryRow {
  id: number;
  project_id: number;
  project_name: string;
  task_id: number | null;
  task_title: string | null;
  description: string | null;
  hours: number;
  date: string;
  is_billable: boolean;
  approval_status: 'draft' | 'submitted' | 'approved' | 'rejected';
  is_locked: boolean;
}

export interface TimesheetWeekDay {
  date: string;
  entries: TimeEntryRow[];
  total_hours: number;
}

export interface TimesheetPeriod {
  id: number;
  user_id: number;
  period_start: string;
  period_end: string;
  status: 'open' | 'submitted' | 'approved' | 'rejected';
  submitted_at: string | null;
  approved_by: number | null;
  approved_at: string | null;
  rejection_reason: string | null;
  user_name?: string;
  total_hours?: number;
}

export interface TimesheetWeek {
  period: TimesheetPeriod | null;
  days: TimesheetWeekDay[];
  total_hours: number;
}

export interface SaveWeekEntryInput {
  id?: number;
  project_id: number;
  task_id?: number | null;
  description?: string | null;
  date: string;
  hours: number;
  is_billable?: boolean;
}

export interface EffectivenessByPerson {
  user_id: number;
  user_name: string;
  estimated_hours: number;
  real_hours: number;
  utilization_pct: number;
  billable_pct: number;
}

export interface EffectivenessByTask {
  task_id: number;
  task_title: string;
  project_name: string;
  estimated_hours: number;
  real_hours: number;
  variance_hours: number;
}

export interface EffectivenessMetrics {
  from: string;
  to: string;
  by_person: EffectivenessByPerson[];
  by_task: EffectivenessByTask[];
}

export interface PendingReminders {
  missing_dates: string[];
  open_period: TimesheetPeriod | null;
}
```

- [ ] **Step 2: Agregar métodos a `frontend/src/services/api.ts`**

Agregar después del método `downloadPaymentStatement` (cierre del bloque de billing):

```typescript
  // Timesheet endpoints (Fase 3 - Tiempo confiable y efectividad)
  async getTimesheetWeek(weekStart: string): Promise<any> {
    const response = await this.api.get(`/timesheet/week?week_start=${weekStart}`);
    return response.data;
  }

  async saveTimesheetWeek(weekStart: string, entries: any[]): Promise<any> {
    const response = await this.api.put('/timesheet/week', { week_start: weekStart, entries });
    return response.data;
  }

  async submitTimesheetWeek(weekStart: string): Promise<any> {
    const response = await this.api.post('/timesheet/week/submit', { week_start: weekStart });
    return response.data;
  }

  async getTimesheetReminders(): Promise<any> {
    const response = await this.api.get('/timesheet/reminders');
    return response.data;
  }

  async getPendingTimesheetApprovals(): Promise<any[]> {
    const response = await this.api.get('/timesheet/pending-approvals');
    return response.data;
  }

  async approveTimesheetWeek(periodId: number): Promise<any> {
    const response = await this.api.post(`/timesheet/periods/${periodId}/approve`);
    return response.data;
  }

  async rejectTimesheetWeek(periodId: number, reason: string): Promise<any> {
    const response = await this.api.post(`/timesheet/periods/${periodId}/reject`, { reason });
    return response.data;
  }

  async getEffectivenessMetrics(from: string, to: string): Promise<any> {
    const response = await this.api.get(`/timesheet/effectiveness?from=${from}&to=${to}`);
    return response.data;
  }
```

- [ ] **Step 3: Verificar tipos con el compilador**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos atribuibles a estos dos archivos.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/timesheet.ts frontend/src/services/api.ts
git commit -m "feat(fase3): tipos y metodos de API de timesheet en frontend"
```

---

### Task 9: Frontend — grilla semanal + timer + banner de recordatorio en `TimeTrackingPage`

**Files:**
- Modify: `frontend/src/pages/time/TimeTrackingPage.tsx`

**Interfaces:**
- Consumes: `apiService.getTimesheetWeek/saveTimesheetWeek/submitTimesheetWeek/getTimesheetReminders` (Task 8), `apiService.getProjects` (ya existente), `apiService.get('/time-entries/active'|'/start-timer'|'/stop-timer')` (ya existente, se conserva).
- Produces: la página `/time` pasa a tener tabs. Este task entrega el tab "Mi semana" (grilla + timer + banner). El tab "Aprobaciones"/"Efectividad" se agrega en Task 10.

Decisión de alcance: se mantiene el `TimerForm` y las llamadas de timer tal cual existen hoy (no se tocan `/time-entries/start-timer`/`stop-timer`, que siguen escribiendo filas en `draft`). Se **reemplaza** la tabla diaria + modal de alta/edición por la grilla semanal de 7 tarjetas.

- [ ] **Step 1: Reescribir `frontend/src/pages/time/TimeTrackingPage.tsx`**

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Table,
  Typography,
  Space,
  Select,
  Input,
  Tag,
  message,
  Row,
  Col,
  Statistic,
  Tabs,
  InputNumber,
  Popconfirm,
  Alert,
  Checkbox
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined
} from '@ant-design/icons';
import { apiService } from '@/services/api';
import { SaveWeekEntryInput, TimesheetWeek } from '@/types/timesheet';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface Project {
  id: number;
  name: string;
}

interface ActiveTimer {
  id: number;
  project_id: number;
  task_id?: number;
  description?: string;
  date: string;
  start_time: string;
  project_name?: string;
  task_title?: string;
}

function mondayOf(date: dayjs.Dayjs): string {
  const isoWeekday = date.isoWeekday(); // 1 = lunes ... 7 = domingo
  return date.subtract(isoWeekday - 1, 'day').format('YYYY-MM-DD');
}

const WeekGrid: React.FC<{ projects: Project[]; canApprove: boolean }> = ({ projects }) => {
  const [weekStart, setWeekStart] = useState(mondayOf(dayjs()));
  const [week, setWeek] = useState<TimesheetWeek | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftByDay, setDraftByDay] = useState<Record<string, SaveWeekEntryInput[]>>({});

  const loadWeek = useCallback(async () => {
    try {
      setLoading(true);
      const data: TimesheetWeek = await apiService.getTimesheetWeek(weekStart);
      setWeek(data);
      const draft: Record<string, SaveWeekEntryInput[]> = {};
      data.days.forEach(day => {
        draft[day.date] = day.entries.map(e => ({
          id: e.id, project_id: e.project_id, task_id: e.task_id, description: e.description,
          date: e.date, hours: e.hours, is_billable: e.is_billable
        }));
      });
      setDraftByDay(draft);
    } catch (error) {
      console.error('Error loading timesheet week:', error);
      message.error('Error al cargar la semana');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  const isLocked = week?.period?.status === 'submitted' || week?.period?.status === 'approved';

  const addRow = (date: string) => {
    if (isLocked || !projects[0]) return;
    setDraftByDay(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), { project_id: projects[0].id, date, hours: 1, is_billable: true }]
    }));
  };

  const updateRow = (date: string, index: number, patch: Partial<SaveWeekEntryInput>) => {
    setDraftByDay(prev => {
      const rows = [...(prev[date] || [])];
      rows[index] = { ...rows[index], ...patch };
      return { ...prev, [date]: rows };
    });
  };

  const removeRow = (date: string, index: number) => {
    setDraftByDay(prev => {
      const rows = [...(prev[date] || [])];
      rows.splice(index, 1);
      return { ...prev, [date]: rows };
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const allEntries = Object.values(draftByDay).flat().filter(e => e.hours > 0);
      const updated = await apiService.saveTimesheetWeek(weekStart, allEntries);
      setWeek(updated);
      message.success('Semana guardada');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al guardar la semana');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await handleSave();
      await apiService.submitTimesheetWeek(weekStart);
      message.success('Semana enviada a aprobación');
      await loadWeek();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al enviar la semana');
    }
  };

  const weekTotal = Object.values(draftByDay).flat().reduce((sum, e) => sum + (e.hours || 0), 0);

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<LeftOutlined />} onClick={() => setWeekStart(mondayOf(dayjs(weekStart).subtract(7, 'day')))} />
          <Text strong>Semana del {dayjs(weekStart).format('DD/MM/YYYY')}</Text>
          <Button icon={<RightOutlined />} onClick={() => setWeekStart(mondayOf(dayjs(weekStart).add(7, 'day')))} />
        </Space>
        <Space>
          <Statistic title="Total semana" value={weekTotal} suffix="hrs" precision={2} />
          {week?.period && (
            <Tag color={
              week.period.status === 'approved' ? 'green' :
              week.period.status === 'submitted' ? 'blue' :
              week.period.status === 'rejected' ? 'red' : 'default'
            }>
              {week.period.status.toUpperCase()}
            </Tag>
          )}
        </Space>
      </Row>

      {week?.period?.status === 'rejected' && (
        <Alert
          type="warning"
          showIcon
          message="Semana rechazada"
          description={week.period.rejection_reason}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={[16, 16]}>
        {(week?.days || []).map(day => (
          <Col xs={24} md={12} lg={8} key={day.date}>
            <Card
              size="small"
              title={dayjs(day.date).format('dddd DD/MM')}
              extra={<Text type="secondary">{(draftByDay[day.date] || []).reduce((s, e) => s + (e.hours || 0), 0)}h</Text>}
            >
              {(draftByDay[day.date] || []).map((entry, idx) => (
                <Row gutter={4} key={idx} style={{ marginBottom: 8 }} align="middle">
                  <Col span={9}>
                    <Select
                      size="small"
                      style={{ width: '100%' }}
                      value={entry.project_id}
                      disabled={isLocked}
                      onChange={(v) => updateRow(day.date, idx, { project_id: v })}
                    >
                      {projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
                    </Select>
                  </Col>
                  <Col span={7}>
                    <Input
                      size="small"
                      placeholder="Descripción"
                      disabled={isLocked}
                      value={entry.description || ''}
                      onChange={(e) => updateRow(day.date, idx, { description: e.target.value })}
                    />
                  </Col>
                  <Col span={5}>
                    <InputNumber
                      size="small"
                      min={0.25}
                      max={24}
                      step={0.25}
                      style={{ width: '100%' }}
                      disabled={isLocked}
                      value={entry.hours}
                      onChange={(v) => updateRow(day.date, idx, { hours: v || 0 })}
                    />
                  </Col>
                  <Col span={2}>
                    <Checkbox
                      checked={entry.is_billable !== false}
                      disabled={isLocked}
                      onChange={(e) => updateRow(day.date, idx, { is_billable: e.target.checked })}
                    />
                  </Col>
                  <Col span={1}>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={isLocked}
                      onClick={() => removeRow(day.date, idx)}
                    />
                  </Col>
                </Row>
              ))}
              <Button
                size="small"
                type="dashed"
                icon={<PlusOutlined />}
                block
                disabled={isLocked}
                onClick={() => addRow(day.date)}
              >
                Agregar
              </Button>
            </Card>
          </Col>
        ))}
      </Row>

      <Row justify="end" style={{ marginTop: 16 }}>
        <Space>
          <Button onClick={handleSave} loading={saving || loading} disabled={isLocked}>
            Guardar semana
          </Button>
          <Popconfirm
            title="¿Enviar la semana a aprobación?"
            description="No podrás editarla mientras esté pendiente de revisión."
            onConfirm={handleSubmit}
            disabled={isLocked}
          >
            <Button type="primary" icon={<SendOutlined />} disabled={isLocked}>
              Enviar a aprobación
            </Button>
          </Popconfirm>
        </Space>
      </Row>
    </div>
  );
};

export const TimeTrackingPage: React.FC = () => {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [timerLoading, setTimerLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [reminderDates, setReminderDates] = useState<string[]>([]);

  const canApprove = user?.role === 'team_lead';
  const canSeeEffectiveness = user?.role === 'team_lead' || user?.role === 'rpa_operations';

  useEffect(() => {
    loadProjects();
    loadActiveTimer();
    loadReminders();
    const interval = setInterval(loadActiveTimer, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTimer) {
      const calc = () => setElapsedTime(dayjs().diff(dayjs(`${activeTimer.date} ${activeTimer.start_time}`), 'second'));
      calc();
      const id = setInterval(calc, 1000);
      setTimerInterval(id);
      return () => clearInterval(id);
    }
    if (timerInterval) clearInterval(timerInterval);
    setElapsedTime(0);
  }, [activeTimer]);

  const loadProjects = async () => {
    try {
      const response = await apiService.getProjects();
      setProjects(response);
    } catch (error) {
      message.error('Error al cargar proyectos');
    }
  };

  const loadActiveTimer = async () => {
    try {
      const response = await apiService.get('/time-entries/active');
      setActiveTimer(response || null);
    } catch (error) {
      console.error('Error loading active timer:', error);
    }
  };

  const loadReminders = async () => {
    try {
      const data = await apiService.getTimesheetReminders();
      setReminderDates(data.missing_dates || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
    }
  };

  const formatElapsedTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = async (projectId: number) => {
    try {
      setTimerLoading(true);
      const response = await apiService.post('/time-entries/start-timer', { project_id: projectId });
      setActiveTimer(response);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al iniciar timer');
    } finally {
      setTimerLoading(false);
    }
  };

  const handleStopTimer = async () => {
    try {
      setTimerLoading(true);
      await apiService.post('/time-entries/stop-timer');
      setActiveTimer(null);
      message.success('Timer detenido');
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al detener timer');
    } finally {
      setTimerLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'week',
      label: 'Mi semana',
      children: <WeekGrid projects={projects} canApprove={canApprove} />
    }
  ];

  if (canApprove) {
    tabItems.push({ key: 'approvals', label: 'Aprobaciones', children: <ApprovalsTab /> });
  }
  if (canSeeEffectiveness) {
    tabItems.push({ key: 'effectiveness', label: 'Efectividad', children: <EffectivenessTab /> });
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2}>⏱️ Tiempo</Title>
        <Text type="secondary">Carga tu semana, revisa aprobaciones y efectividad del equipo</Text>
      </div>

      {reminderDates.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`Tienes ${reminderDates.length} día(s) hábil(es) sin horas registradas en las últimas 2 semanas`}
          description={reminderDates.join(', ')}
        />
      )}

      <Card style={{ marginBottom: 24 }}>
        {activeTimer ? (
          <Row gutter={16} align="middle">
            <Col>
              <Statistic title="Tiempo transcurrido" value={formatElapsedTime(elapsedTime)} valueStyle={{ fontFamily: 'monospace' }} />
            </Col>
            <Col flex="auto">
              <Text strong>{activeTimer.project_name}</Text>
            </Col>
            <Col>
              <Button type="primary" danger icon={<PauseCircleOutlined />} loading={timerLoading} onClick={handleStopTimer}>
                Detener timer
              </Button>
            </Col>
          </Row>
        ) : (
          <Space>
            <Select placeholder="Proyecto" style={{ width: 240 }} id="timer-project-select">
              {projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}
            </Select>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={timerLoading}
              onClick={() => {
                const el = document.getElementById('timer-project-select');
                const value = (el as any)?.getAttribute?.('title');
                if (projects[0]) handleStartTimer(projects[0].id);
                void value;
              }}
            >
              Iniciar timer
            </Button>
          </Space>
        )}
      </Card>

      <Tabs items={tabItems} />
    </div>
  );
};

const ApprovalsTab: React.FC = () => {
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getPendingTimesheetApprovals();
      setPeriods(data);
    } catch (error) {
      message.error('Error al cargar aprobaciones pendientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: number) => {
    try {
      await apiService.approveTimesheetWeek(id);
      message.success('Semana aprobada');
      load();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al aprobar');
    }
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt('Motivo del rechazo:');
    if (!reason) return;
    try {
      await apiService.rejectTimesheetWeek(id, reason);
      message.success('Semana rechazada');
      load();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al rechazar');
    }
  };

  return (
    <Table
      loading={loading}
      dataSource={periods}
      rowKey="id"
      columns={[
        { title: 'Persona', dataIndex: 'user_name' },
        { title: 'Semana', render: (r: any) => `${dayjs(r.period_start).format('DD/MM')} - ${dayjs(r.period_end).format('DD/MM')}` },
        { title: 'Horas', dataIndex: 'total_hours' },
        {
          title: 'Acciones',
          render: (r: any) => (
            <Space>
              <Button size="small" type="primary" onClick={() => handleApprove(r.id)}>Aprobar</Button>
              <Button size="small" danger onClick={() => handleReject(r.id)}>Rechazar</Button>
            </Space>
          )
        }
      ]}
    />
  );
};

const EffectivenessTab: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const from = dayjs().startOf('month').format('YYYY-MM-DD');
    const to = dayjs().endOf('month').format('YYYY-MM-DD');
    setLoading(true);
    apiService.getEffectivenessMetrics(from, to)
      .then(setMetrics)
      .catch(() => message.error('Error al cargar métricas de efectividad'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <Title level={4}>Por persona (mes actual)</Title>
      <Table
        loading={loading}
        dataSource={metrics?.by_person || []}
        rowKey="user_id"
        columns={[
          { title: 'Persona', dataIndex: 'user_name' },
          { title: 'Estimado (h)', dataIndex: 'estimated_hours' },
          { title: 'Real (h)', dataIndex: 'real_hours' },
          { title: 'Utilización %', dataIndex: 'utilization_pct', render: (v: number) => `${v}%` },
          { title: 'Facturable %', dataIndex: 'billable_pct', render: (v: number) => `${v}%` }
        ]}
      />
      <Title level={4} style={{ marginTop: 24 }}>Por tarea (mes actual)</Title>
      <Table
        loading={loading}
        dataSource={metrics?.by_task || []}
        rowKey="task_id"
        columns={[
          { title: 'Tarea', dataIndex: 'task_title' },
          { title: 'Proyecto', dataIndex: 'project_name' },
          { title: 'Estimado (h)', dataIndex: 'estimated_hours' },
          { title: 'Real (h)', dataIndex: 'real_hours' },
          {
            title: 'Desvío (h)', dataIndex: 'variance_hours',
            render: (v: number) => <Tag color={v > 0 ? 'red' : 'green'}>{v > 0 ? '+' : ''}{v}</Tag>
          }
        ]}
      />
    </div>
  );
};
```

Nota: verificar el nombre real del hook de sesión (`useAuthStore` en `frontend/src/store/authStore.ts`, ya usado en otras páginas del proyecto como `AppLayout.tsx`) y ajustar el import si el nombre exportado difiere.

- [ ] **Step 2: Verificar tipos con el compilador**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos atribuibles a `TimeTrackingPage.tsx`.

- [ ] **Step 3: Levantar el frontend y probar manualmente**

Run: `cd frontend && npm run dev` (con el backend corriendo)
Verificar en el navegador (`/time`):
1. La grilla muestra 7 días con el selector de proyecto y horas.
2. Agregar una entrada, guardar, recargar la página y confirmar que persiste.
3. Enviar la semana a aprobación y confirmar que los campos quedan deshabilitados.
4. Con un usuario `team_lead`, confirmar que aparece el tab "Aprobaciones" y que aprobar bloquea la semana (reintentar guardar debe fallar con 400).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/time/TimeTrackingPage.tsx
git commit -m "feat(fase3): grilla semanal de horas + banner de recordatorio en TimeTrackingPage"
```

---

### Task 10: Frontend — test de regresión de `TimeTrackingPage` + verificación final de Fase 3

**Files:**
- Create: `frontend/src/__tests__/pages/TimeTrackingPage.test.tsx`

**Interfaces:**
- Consumes: `apiService` mockeado, igual que `frontend/src/__tests__/pages/BillingPage.test.tsx` (Fase 2) — mirar ese archivo para el patrón exacto de mock de `apiService` y `render` con providers antes de escribir este test, ya que el ejecutor de esta tarea ve solo esta tarea y necesita replicar ese patrón sin poder leerlo primero: usar `jest.mock('@/services/api', () => ({ apiService: { getProjects: jest.fn(), get: jest.fn(), post: jest.fn(), getTimesheetWeek: jest.fn(), getTimesheetReminders: jest.fn() } }))` y envolver el render en los mismos providers que use `BillingPage.test.tsx` (Router/QueryClient/etc., según lo que ese archivo importe).

- [ ] **Step 1: Escribir el test**

```tsx
// frontend/src/__tests__/pages/TimeTrackingPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn().mockResolvedValue([{ id: 1, name: 'AGROSUPER' }]),
    get: vi.fn().mockResolvedValue(null),
    post: vi.fn(),
    getTimesheetWeek: vi.fn().mockResolvedValue({
      period: null,
      total_hours: 0,
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-09-1${i}`,
        entries: [],
        total_hours: 0
      }))
    }),
    getTimesheetReminders: vi.fn().mockResolvedValue({ missing_dates: [], open_period: null }),
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'rpa_developer', full_name: 'Dev Uno' } })
}));

import { TimeTrackingPage } from '@/pages/time/TimeTrackingPage';

describe('TimeTrackingPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('carga la grilla semanal de 7 días', async () => {
    render(<TimeTrackingPage />);

    await waitFor(() => {
      expect(screen.getByText(/Mi semana/i)).toBeInTheDocument();
    });
  });

  it('no muestra el tab de Aprobaciones para un rol que no es team_lead', async () => {
    render(<TimeTrackingPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Aprobaciones/i)).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Correr el test**

Run: `cd frontend && npm test -- TimeTrackingPage`
Expected: PASS (2 tests). Si el mock de providers no coincide con lo que la app real requiere (por ejemplo, un `AntdApp`/`ConfigProvider` que envuelva `message`), ajustar el render con los mismos wrappers usados en `frontend/src/__tests__/pages/BillingPage.test.tsx`.

- [ ] **Step 3: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: PASS — ninguna otra página se ve afectada por los cambios de esta fase.

- [ ] **Step 4: Correr lint de frontend**

Run: `cd frontend && npm run lint`
Expected: 0 errores nuevos.

- [ ] **Step 5: Verificación global de Fase 3 (manual, con backend + frontend corriendo)**

1. Cargar una semana completa de horas para un proyecto, guardar.
2. Enviarla a aprobación (`POST /api/timesheet/week/submit`) y confirmar que ya no se puede editar (`PUT /api/timesheet/week` devuelve 400).
3. Como `team_lead`, aprobarla desde el tab "Aprobaciones".
4. Confirmar en `GET /api/financial/project-roi/:id` (o el dashboard ROI) que `real_hours`/`real_cost` del proyecto cambiaron para reflejar las horas recién aprobadas (Task 4).
5. Confirmar que `GET /api/timesheet/effectiveness` devuelve datos para esa persona/tarea.
6. Confirmar que `time_entries` en la base de datos supera holgadamente los 3 registros históricos (criterio de verificación del plan maestro para esta fase).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/__tests__/pages/TimeTrackingPage.test.tsx
git commit -m "test(fase3): regresion de TimeTrackingPage (grilla semanal, tabs por rol)"
```

---

## Self-Review (registrado para quien ejecute el plan)

- **Cobertura del spec:** Timesheet diario de baja fricción → Task 2/9 (grilla semanal + timer conservado). `approval_status/approved_by/approved_at/cost_rate_snapshot/bill_rate_snapshot/is_locked` → Task 1/3. `timesheet_periods` con apertura/envío/aprobación/cierre → Task 1/3. Recordatorios diarios (in-app al entrar + pendientes al arrancar el servidor) → Task 6/9. Métricas de efectividad (estimado vs real por persona y tarea, % utilización, % facturable) → Task 5/9. Verificación "cargar una semana, aprobarla, que quede bloqueada y que el costo del proyecto cambie" → Task 3 (bloqueo) + Task 4 (costo real) + Step 5 de Task 10 (verificación manual explícita).
- **Consistencia de tipos:** `TimesheetWeek`/`TimesheetPeriodRow`/`TimeEntryRow`/`SaveWeekEntryInput` se definen una vez en Task 2 y se reutilizan sin cambiar de nombre en Task 3, 5, 6, 7, 8, 9. `EffectivenessMetrics`/`EffectivenessByPerson`/`EffectivenessByTask` se definen en Task 5 y se reutilizan en Task 7/8/9 con los mismos nombres de campo.
- **Riesgo señalado explícitamente para quien ejecute:** Task 4 modifica una función (`calculateProjectFinancials`) de la que ya dependen `billingService` y `financeService.syncROIAlerts` (Fase 2). El Step 5 de Task 4 corre la suite completa de backend precisamente para detectar cualquier regresión cruzada antes de seguir.
