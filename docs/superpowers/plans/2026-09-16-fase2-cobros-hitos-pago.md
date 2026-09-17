# Fase 2 — Cobros e Hitos de Pago — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a RPA Team Manager un modelo de cobros real (hitos de pago → facturas → cobros), un dashboard de cobranza diario, generación de PDF de estado de pago, y escritura real en `roi_alerts` (sobrecosto, margen bajo, cobro vencido).

**Architecture:** Backend: 4 tablas nuevas (migración 29) + `billingService.ts` (lógica pura: transición de hitos a `billable`, detección de vencidos, agregación de dashboard, flujo de caja proyectado) + extensión de `financeService.ts` (alertas de sobrecosto/margen persistidas) + `billingController.ts`/`billingRoutes.ts` (HTTP, reutiliza `financeService` para todo cálculo de monto/margen — nunca duplica esa lógica) + `pdfService.ts` (generación de PDF con `pdfkit`). Frontend: `frontend/src/pages/billing/BillingPage.tsx` con tabs (Dashboard, Hitos de pago, Facturas, Pagos) + gráfico de flujo de caja con `recharts` (ya instalado, sin uso — se reutiliza en vez de agregar dependencia).

Diseño clave: no existe scheduler/cron en este proyecto (la app corre en el notebook del usuario, ver Fase 3 del plan maestro). La transición automática de un hito a `billable` y la detección de vencidos se evalúan **de forma perezosa** (lazy) cada vez que se lee el dashboard o la lista de hitos — no hay una tarea de fondo. Esto es una decisión de diseño explícita, no un atajo: sin servidor persistente, un cron no dispararía de forma confiable de todas formas.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente), React 18/TypeScript/Vite/Ant Design/recharts/dayjs (frontend ya existente), `pdfkit` (nueva dependencia backend, para generación de PDF).

**Spec:** `C:\Users\nanon\.claude\plans\hace-mucho-tiempo-que-woolly-orbit.md`, sección "Fase 2 — Cobros e hitos de pago" (líneas 200-216). Ese documento es la autoridad; este plan lo desarrolla en tareas ejecutables. Contexto adicional relevante del mismo documento: Fase 1 ya entregó `financeService.ts` (`backend/src/services/financeService.ts`) como única fuente de cálculo de costo/venta/margen/ROI — este plan lo reutiliza, nunca lo reimplementa. Los roles NO se han renombrado (siguen siendo `team_lead | rpa_developer | rpa_operations | it_support`); esa es una decisión ya tomada por el usuario, no algo a corregir en esta fase.

## Global Constraints

- Nunca calcular costo/venta/margen/ROI/moneda a mano en `billingController`, `billingService` o el PDF — todo pasa por `financeService` (`calculateProjectFinancials`, `toCLP`, `getExchangeRate`). Ver `backend/src/services/financeService.ts:43-217`.
- Roles actuales (`backend/src/types/auth.ts:15`): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. No agregar roles nuevos en esta fase.
- Convención de acceso a BD: `db.query(sql, params)` para múltiples filas, `db.get(sql, params)` para una fila, `db.run(sql, params)` para escritura (devuelve `{ id, changes }`), `db.beginTransaction()`/`db.commit()`/`db.rollback()` para transacciones. Nunca `db.all` (no existe en este wrapper). Ver `backend/src/database/database.ts:578-660`.
- Migraciones: se agregan al final del array `migrations` en `backend/src/database/migrationList.ts`, nunca se editan migraciones ya aplicadas (versiones 1-28 ya existen; la nueva es **versión 29**).
- Controllers nuevos siguen el patrón de clase usado en `financialController.ts`/`supportController.ts`: `export class XController { metodo = async (req: AuthenticatedRequest, res: Response): Promise<void> => { try { ... } catch (error) { logger.error(...); res.status(500).json({ error: '...' }); } } }`. Import `AuthenticatedRequest` desde `../middleware/auth`.
- Validación de escritura: Zod en `backend/src/validation/schemas.ts`, aplicada con el middleware `validate({ body: schema })` de `backend/src/middleware/validation.ts` (no `validateBody`, ese nombre no existe en este repo).
- Autorización: roles de solo-lectura del dashboard y listas = `authorize(['team_lead', 'rpa_operations'])` (igual que PMO, `backend/src/routes/pmoRoutes.ts:14`). Gestión de hitos/facturas (crear/editar) = mismo grupo. Registrar un pago o marcar una factura como cancelada = **solo** `authorize(['team_lead'])` (acción financiera irreversible, igual que `supportAdminRoles` en `backend/src/routes/supportRoutes.ts:16`).
- Todas las rutas nuevas van bajo `router.use(authenticate)` primero, igual que el resto de módulos.
- Frontend: páginas en `frontend/src/pages/<modulo>/`, servicios centralizados en la clase `ApiService` de `frontend/src/services/api.ts` (patrón: método por endpoint, `this.api.get/post/put/delete`, nunca fetch directo salvo para descargas binarias — ver `frontend/src/services/fileService.ts:176-190` para el patrón de descarga con `fetch` + `Authorization: Bearer` cuando el endpoint devuelve un blob).
- Tests backend: mockear `db` completo con `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))`, igual que `backend/src/__tests__/services/financeService.test.ts`. No usar una base de datos real en tests unitarios de servicios/controllers.
- Montos monetarios: `DECIMAL(14,2)` en SQLite (columna numérica, sin problema de precisión de punto flotante para estos volúmenes). Moneda: `VARCHAR(3) CHECK (currency IN ('CLP','USD','UF'))` en todas las tablas nuevas, igual que `exchange_rates.currency`.

---

## Mapa de archivos

- Crear: `backend/src/database/migrationList.ts` (append migración 29 — se modifica, no se crea)
- Crear: `backend/src/services/billingService.ts`
- Modificar: `backend/src/services/financeService.ts` (agregar `syncROIAlerts`)
- Crear: `backend/src/services/pdfService.ts`
- Crear: `backend/src/controllers/billingController.ts`
- Crear: `backend/src/routes/billingRoutes.ts`
- Modificar: `backend/src/validation/schemas.ts` (agregar schemas de billing)
- Modificar: `backend/src/server.ts` (registrar `billingRoutes` + entrada en `GET /api`)
- Modificar: `backend/package.json` (agregar `pdfkit` + `@types/pdfkit`)
- Crear: `backend/src/__tests__/database/migration29.test.ts`
- Crear: `backend/src/__tests__/services/billingService.test.ts`
- Crear: `backend/src/__tests__/services/financeService.roiAlerts.test.ts`
- Crear: `backend/src/__tests__/controllers/billingController.test.ts`
- Crear: `frontend/src/types/billing.ts`
- Modificar: `frontend/src/services/api.ts` (agregar métodos de billing)
- Crear: `frontend/src/pages/billing/BillingPage.tsx`
- Modificar: `frontend/src/App.tsx` (ruta `/billing`)
- Modificar: `frontend/src/components/common/AppLayout.tsx` (entrada de menú + título)
- Crear: `frontend/src/__tests__/pages/BillingPage.test.tsx`

---

### Task 1: Migración 29 — tablas de cobros

**Files:**
- Modify: `backend/src/database/migrationList.ts` (append al final del array `migrations`, después de la migración 28 que termina en `];` al final del archivo)
- Test: `backend/src/__tests__/database/migration29.test.ts`

**Interfaces:**
- Produces: tablas `payment_milestones`, `invoices`, `invoice_lines`, `payments` con las columnas exactas listadas abajo. Todas las tareas siguientes dependen de estos nombres de columna literalmente.

- [ ] **Step 1: Escribir el test que verifica el esquema tras migrar**

Este proyecto no tiene tests de migración previos (es la primera). Se usa `MigrationManager` directamente contra un archivo SQLite temporal, corriendo **todas** las migraciones (1-29) para detectar cualquier conflicto con el historial real.

```typescript
// backend/src/__tests__/database/migration29.test.ts
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
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest migration29.test.ts`
Expected: FAIL — las tablas `payment_milestones`, `invoices`, `invoice_lines`, `payments` no existen todavía (la migración 29 no existe).

- [ ] **Step 3: Agregar la migración 29 al final de `backend/src/database/migrationList.ts`**

Localizar el cierre del array (`];` al final del archivo, después de la migración 28) y agregar antes de ese `];`:

```typescript
  ,

  {
    version: 29,
    description: 'Fase 2: crear payment_milestones, invoices, invoice_lines y payments (cobros e hitos de pago)',
    up: [
      `CREATE TABLE IF NOT EXISTS payment_milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        project_milestone_id INTEGER,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
        currency VARCHAR(3) NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD', 'UF')),
        trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('date', 'progress_pct', 'deliverable_approved')),
        trigger_value DECIMAL(5,2),
        planned_date DATE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'billable', 'invoiced', 'paid', 'overdue')),
        billable_at DATETIME,
        sort_order INTEGER DEFAULT 0,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (project_milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_payment_milestones_project ON payment_milestones(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_payment_milestones_status ON payment_milestones(status)`,

      `CREATE TRIGGER IF NOT EXISTS update_payment_milestones_timestamp
        AFTER UPDATE ON payment_milestones
        BEGIN
          UPDATE payment_milestones SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      `CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        invoice_number VARCHAR(50) NOT NULL UNIQUE,
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD', 'UF')),
        amount DECIMAL(14,2) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled')),
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,

      `CREATE TRIGGER IF NOT EXISTS update_invoices_timestamp
        AFTER UPDATE ON invoices
        BEGIN
          UPDATE invoices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END`,

      `CREATE TABLE IF NOT EXISTS invoice_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        payment_milestone_id INTEGER,
        description VARCHAR(300) NOT NULL,
        amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_milestone_id) REFERENCES payment_milestones(id) ON DELETE SET NULL
      )`,

      `CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id)`,

      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id INTEGER NOT NULL,
        amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
        currency VARCHAR(3) NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD', 'UF')),
        payment_date DATE NOT NULL,
        method VARCHAR(50),
        reference VARCHAR(100),
        notes TEXT,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id)`
    ]
  }
```

Nota: si el archivo termina con `  }\n];` (sin coma tras el último elemento), agregar una coma después del `}` de la migración 28 antes de pegar el bloque anterior (empieza con `{`, sin la coma inicial `,` de este snippet — ajustar la puntuación exacta al mirar el archivo real).

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest migration29.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration29.test.ts
git commit -m "feat(fase2): migración 29 - tablas payment_milestones, invoices, invoice_lines, payments"
```

---

### Task 2: `billingService.ts` — lógica de negocio de cobranza

**Files:**
- Create: `backend/src/services/billingService.ts`
- Test: `backend/src/__tests__/services/billingService.test.ts`

**Interfaces:**
- Consumes: `financeService.toCLP(amount, currency, asOfDate?)` (`backend/src/services/financeService.ts:64`), `db.query`/`db.get`/`db.run` (`backend/src/database/database.ts`), tablas de Task 1.
- Produces (usados por Task 4 - `billingController.ts`):
  - `billingService.evaluateTriggers(projectId?: number): Promise<{ transitioned: number }>`
  - `billingService.evaluateOverdue(projectId?: number): Promise<{ transitioned: number }>`
  - `billingService.getDashboard(projectId?: number): Promise<BillingDashboard>` (evalúa triggers y overdue internamente antes de leer)
  - `interface BillingDashboard { ready_to_invoice: PaymentMilestoneRow[]; invoiced_unpaid: PaymentMilestoneRow[]; paid: PaymentMilestoneRow[]; overdue: PaymentMilestoneRow[]; cashflow_projection: { month: string; expected_amount_clp: number }[]; summary: { total_pending_clp: number; total_billable_clp: number; total_invoiced_clp: number; total_paid_clp: number; total_overdue_clp: number } }`
  - `interface PaymentMilestoneRow` con al menos: `id, project_id, project_name, name, amount, currency, amount_clp, status, planned_date, trigger_type`

- [ ] **Step 1: Escribir los tests (mock de `db`)**

```typescript
// backend/src/__tests__/services/billingService.test.ts
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn(),
    }
}));

import { db } from '../../database/database';
import { BillingService } from '../../services/billingService';

const TODAY = '2026-09-16';

describe('BillingService', () => {
    let billingService: BillingService;

    beforeEach(() => {
        jest.clearAllMocks();
        billingService = new BillingService();
        jest.useFakeTimers().setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('evaluateTriggers', () => {
        it('pasa a billable un hito con trigger_type=date cuya planned_date ya pasó', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) {
                    return Promise.resolve([{ id: 1, planned_date: '2026-09-01' }]);
                }
                if (sql.includes("trigger_type = 'progress_pct'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'deliverable_approved'")) return Promise.resolve([]);
                return Promise.resolve([]);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

            const result = await billingService.evaluateTriggers();

            expect(result.transitioned).toBe(1);
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE payment_milestones SET status = 'billable'"),
                expect.arrayContaining([1])
            );
        });

        it('no toca un hito con trigger_type=date cuya planned_date es futura', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                return Promise.resolve([]);
            });

            const result = await billingService.evaluateTriggers();
            expect(result.transitioned).toBe(0);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('pasa a billable un hito con trigger_type=progress_pct cuando el avance vinculado alcanza trigger_value', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'progress_pct'")) {
                    return Promise.resolve([{ id: 2, trigger_value: 50, completion_percentage: 60 }]);
                }
                if (sql.includes("trigger_type = 'deliverable_approved'")) return Promise.resolve([]);
                return Promise.resolve([]);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 2, changes: 1 });

            const result = await billingService.evaluateTriggers();
            expect(result.transitioned).toBe(1);
        });

        it('pasa a billable un hito con trigger_type=deliverable_approved cuando el project_milestone vinculado está completed', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'progress_pct'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'deliverable_approved'")) {
                    return Promise.resolve([{ id: 3, milestone_status: 'completed' }]);
                }
                return Promise.resolve([]);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 3, changes: 1 });

            const result = await billingService.evaluateTriggers();
            expect(result.transitioned).toBe(1);
        });
    });

    describe('evaluateOverdue', () => {
        it('marca overdue un hito invoiced cuya factura ya venció y no está pagada', async () => {
            (db.query as jest.Mock).mockResolvedValue([
                { id: 10, invoice_id: 100, due_date: '2026-09-01' }
            ]);
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            const result = await billingService.evaluateOverdue();
            expect(result.transitioned).toBe(1);
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE payment_milestones SET status = 'overdue'"),
                expect.arrayContaining([10])
            );
        });

        it('no marca overdue si no hay hitos invoiced vencidos', async () => {
            (db.query as jest.Mock).mockResolvedValue([]);
            const result = await billingService.evaluateOverdue();
            expect(result.transitioned).toBe(0);
        });
    });

    describe('getDashboard', () => {
        it('agrega montos convertidos a CLP y separa por estado', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'progress_pct'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'deliverable_approved'")) return Promise.resolve([]);
                if (sql.includes('invoices i') && sql.includes('due_date')) return Promise.resolve([]);
                if (sql.includes('FROM payment_milestones pm') && sql.includes('JOIN projects')) {
                    return Promise.resolve([
                        { id: 1, project_id: 1, project_name: 'AGROSUPER', name: 'Hito 1', amount: 1000000, currency: 'CLP', status: 'billable', planned_date: '2026-09-10', trigger_type: 'date' },
                        { id: 2, project_id: 1, project_name: 'AGROSUPER', name: 'Hito 2', amount: 100, currency: 'UF', status: 'paid', planned_date: '2026-08-01', trigger_type: 'date' }
                    ]);
                }
                return Promise.resolve([]);
            });
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM exchange_rates')) return Promise.resolve({ rate_to_clp: 38000 });
                return Promise.resolve(undefined);
            });

            const dashboard = await billingService.getDashboard();

            expect(dashboard.ready_to_invoice).toHaveLength(1);
            expect(dashboard.ready_to_invoice[0].amount_clp).toBe(1000000);
            expect(dashboard.paid).toHaveLength(1);
            expect(dashboard.paid[0].amount_clp).toBe(100 * 38000);
            expect(dashboard.summary.total_billable_clp).toBe(1000000);
            expect(dashboard.summary.total_paid_clp).toBe(100 * 38000);
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest billingService.test.ts`
Expected: FAIL con "Cannot find module '../../services/billingService'"

- [ ] **Step 3: Implementar `backend/src/services/billingService.ts`**

```typescript
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { financeService, Currency } from './financeService';

export interface PaymentMilestoneRow {
    id: number;
    project_id: number;
    project_name: string;
    name: string;
    amount: number;
    currency: Currency;
    amount_clp: number;
    status: string;
    planned_date: string | null;
    trigger_type: string;
}

export interface BillingDashboard {
    ready_to_invoice: PaymentMilestoneRow[];
    invoiced_unpaid: PaymentMilestoneRow[];
    paid: PaymentMilestoneRow[];
    overdue: PaymentMilestoneRow[];
    cashflow_projection: { month: string; expected_amount_clp: number }[];
    summary: {
        total_pending_clp: number;
        total_billable_clp: number;
        total_invoiced_clp: number;
        total_paid_clp: number;
        total_overdue_clp: number;
    };
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Lógica de negocio de cobranza. Todo monto se normaliza a CLP vía financeService;
 * este servicio nunca calcula tipo de cambio por su cuenta.
 */
export class BillingService {
    /**
     * Evalúa los hitos de pago 'pending' y los pasa a 'billable' si su disparador se cumplió.
     * No hay scheduler en este proyecto: se llama de forma perezosa antes de leer el dashboard/listas.
     */
    async evaluateTriggers(projectId?: number): Promise<{ transitioned: number }> {
        const projectFilter = projectId ? 'AND pm.project_id = ?' : '';
        const projectParams = projectId ? [projectId] : [];
        let transitioned = 0;

        const dateDue = await db.query(
            `SELECT pm.id FROM payment_milestones pm
             WHERE pm.status = 'pending' AND pm.trigger_type = 'date'
               AND pm.planned_date IS NOT NULL AND pm.planned_date <= ? ${projectFilter}`,
            [today(), ...projectParams]
        );

        const progressDue = await db.query(
            `SELECT pm.id, pm.trigger_value, mile.completion_percentage
             FROM payment_milestones pm
             JOIN project_milestones mile ON mile.id = pm.project_milestone_id
             WHERE pm.status = 'pending' AND pm.trigger_type = 'progress_pct' ${projectFilter}`,
            projectParams
        );

        const deliverableDue = await db.query(
            `SELECT pm.id, mile.status as milestone_status
             FROM payment_milestones pm
             JOIN project_milestones mile ON mile.id = pm.project_milestone_id
             WHERE pm.status = 'pending' AND pm.trigger_type = 'deliverable_approved' ${projectFilter}`,
            projectParams
        );

        const toTransition: number[] = [
            ...dateDue.map((r: any) => r.id),
            ...progressDue.filter((r: any) => (r.completion_percentage ?? 0) >= (r.trigger_value ?? 101)).map((r: any) => r.id),
            ...deliverableDue.filter((r: any) => r.milestone_status === 'completed').map((r: any) => r.id)
        ];

        for (const id of toTransition) {
            await db.run(
                `UPDATE payment_milestones SET status = 'billable', billable_at = datetime('now') WHERE id = ?`,
                [id]
            );
            transitioned++;
        }

        if (transitioned > 0) {
            logger.info(`Billing: ${transitioned} hito(s) de pago pasaron a billable`);
        }

        return { transitioned };
    }

    /** Marca overdue los hitos invoiced cuya factura venció sin estar paga. */
    async evaluateOverdue(projectId?: number): Promise<{ transitioned: number }> {
        const projectFilter = projectId ? 'AND pm.project_id = ?' : '';
        const projectParams = projectId ? [projectId] : [];

        const overdueRows = await db.query(
            `SELECT DISTINCT pm.id, i.id as invoice_id, i.due_date
             FROM payment_milestones pm
             JOIN invoice_lines il ON il.payment_milestone_id = pm.id
             JOIN invoices i ON i.id = il.invoice_id
             WHERE pm.status = 'invoiced' AND i.due_date < ?
               AND i.status NOT IN ('paid', 'cancelled') ${projectFilter}`,
            [today(), ...projectParams]
        );

        let transitioned = 0;
        for (const row of overdueRows) {
            await db.run(`UPDATE payment_milestones SET status = 'overdue' WHERE id = ?`, [row.id]);
            await db.run(
                `UPDATE invoices SET status = 'overdue' WHERE id = ? AND status NOT IN ('paid', 'cancelled')`,
                [row.invoice_id]
            );
            transitioned++;
        }

        if (transitioned > 0) {
            logger.info(`Billing: ${transitioned} hito(s) de pago marcados overdue`);
        }

        return { transitioned };
    }

    private async toRow(raw: any): Promise<PaymentMilestoneRow> {
        const amountCLP = await financeService.toCLP(raw.amount, raw.currency as Currency);
        return {
            id: raw.id,
            project_id: raw.project_id,
            project_name: raw.project_name,
            name: raw.name,
            amount: raw.amount,
            currency: raw.currency,
            amount_clp: Math.round(amountCLP),
            status: raw.status,
            planned_date: raw.planned_date,
            trigger_type: raw.trigger_type
        };
    }

    async getDashboard(projectId?: number): Promise<BillingDashboard> {
        await this.evaluateTriggers(projectId);
        await this.evaluateOverdue(projectId);

        const projectFilter = projectId ? 'AND pm.project_id = ?' : '';
        const projectParams = projectId ? [projectId] : [];

        const rawRows = await db.query(
            `SELECT pm.id, pm.project_id, p.name as project_name, pm.name, pm.amount, pm.currency,
                    pm.status, pm.planned_date, pm.trigger_type
             FROM payment_milestones pm
             JOIN projects p ON p.id = pm.project_id
             WHERE 1=1 ${projectFilter}
             ORDER BY pm.planned_date ASC`,
            projectParams
        );

        const rows = await Promise.all(rawRows.map((r: any) => this.toRow(r)));

        const ready_to_invoice = rows.filter(r => r.status === 'billable');
        const invoiced_unpaid = rows.filter(r => r.status === 'invoiced');
        const paid = rows.filter(r => r.status === 'paid');
        const overdue = rows.filter(r => r.status === 'overdue');
        const pending = rows.filter(r => r.status === 'pending');

        const sum = (list: PaymentMilestoneRow[]) => list.reduce((s, r) => s + r.amount_clp, 0);

        const cashflowSource = [...pending, ...ready_to_invoice, ...invoiced_unpaid];
        const cashflowMap = new Map<string, number>();
        for (const row of cashflowSource) {
            const month = (row.planned_date || today()).slice(0, 7);
            cashflowMap.set(month, (cashflowMap.get(month) || 0) + row.amount_clp);
        }
        const cashflow_projection = Array.from(cashflowMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, expected_amount_clp]) => ({ month, expected_amount_clp }));

        return {
            ready_to_invoice,
            invoiced_unpaid,
            paid,
            overdue,
            cashflow_projection,
            summary: {
                total_pending_clp: sum(pending),
                total_billable_clp: sum(ready_to_invoice),
                total_invoiced_clp: sum(invoiced_unpaid),
                total_paid_clp: sum(paid),
                total_overdue_clp: sum(overdue)
            }
        };
    }
}

export const billingService = new BillingService();
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest billingService.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/billingService.ts backend/src/__tests__/services/billingService.test.ts
git commit -m "feat(fase2): billingService - transición automática a billable, overdue y dashboard de cobranza"
```

---

### Task 3: `financeService.syncROIAlerts` + `billingService.syncOverdueAlert` — escribir de verdad en `roi_alerts`

**Files:**
- Modify: `backend/src/services/financeService.ts`
- Modify: `backend/src/services/billingService.ts`
- Test: `backend/src/__tests__/services/financeService.roiAlerts.test.ts`
- Test: modify `backend/src/__tests__/services/billingService.test.ts` (agregar describe `syncOverdueAlert`)

**Interfaces:**
- Consumes: `financeService.calculateProjectFinancials` (ya existente), tabla `roi_alerts` (columnas ya existentes: `id, project_id, alert_type, alert_level, message, threshold_value, current_value, is_resolved, resolved_at, resolved_by, created_at` — ver `backend/src/database/migrationList.ts` bloque `roi_alerts`).
- Produces: `financeService.syncROIAlerts(projectId: number): Promise<void>` (upsert de `cost_overrun` y `low_margin`), `billingService.syncOverdueAlert(paymentMilestoneId: number, projectId: number, daysOverdue: number): Promise<void>` (upsert de `overdue_payment`).

- [ ] **Step 1: Escribir el test de `financeService.syncROIAlerts`**

```typescript
// backend/src/__tests__/services/financeService.roiAlerts.test.ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { FinanceService } from '../../services/financeService';

describe('FinanceService.syncROIAlerts', () => {
    let financeService: FinanceService;

    beforeEach(() => {
        jest.clearAllMocks();
        financeService = new FinanceService();
    });

    it('crea una alerta cost_overrun cuando el costo real supera el 80% del precio de venta', async () => {
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            project_id: 1, project_name: 'AGROSUPER', planned_hours: 100, real_hours: 100,
            client_delay_hours: 0, hourly_rate_uf: 1, uf_value_clp: 38000, engineer_hourly_cost: 15000,
            assigned_users: 1, user_cost_breakdown: [], sale_price: 1000000, planned_cost: 900000,
            real_cost: 900000, planned_profit: 100000, real_profit: 100000, planned_roi: 11, real_roi: 11,
            delay_impact: 0, lost_profit: 0
        } as any);
        (db.get as jest.Mock).mockResolvedValue(undefined); // no hay alerta activa previa
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await financeService.syncROIAlerts(1);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO roi_alerts'),
            expect.arrayContaining([1, 'cost_overrun'])
        );
    });

    it('crea una alerta low_margin cuando el ROI real es menor a 20%', async () => {
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            project_id: 1, project_name: 'AGROSUPER', planned_hours: 100, real_hours: 100,
            client_delay_hours: 0, hourly_rate_uf: 1, uf_value_clp: 38000, engineer_hourly_cost: 15000,
            assigned_users: 1, user_cost_breakdown: [], sale_price: 1000000, planned_cost: 500000,
            real_cost: 500000, planned_profit: 500000, real_profit: 500000, planned_roi: 15, real_roi: 15,
            delay_impact: 0, lost_profit: 0
        } as any);
        (db.get as jest.Mock).mockResolvedValue(undefined);
        (db.run as jest.Mock).mockResolvedValue({ id: 2, changes: 1 });

        await financeService.syncROIAlerts(1);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO roi_alerts'),
            expect.arrayContaining([1, 'low_margin'])
        );
    });

    it('resuelve una alerta cost_overrun previa si el costo ya no supera el umbral', async () => {
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            project_id: 1, project_name: 'AGROSUPER', planned_hours: 100, real_hours: 100,
            client_delay_hours: 0, hourly_rate_uf: 1, uf_value_clp: 38000, engineer_hourly_cost: 15000,
            assigned_users: 1, user_cost_breakdown: [], sale_price: 1000000, planned_cost: 100000,
            real_cost: 100000, planned_profit: 900000, real_profit: 900000, planned_roi: 900, real_roi: 900,
            delay_impact: 0, lost_profit: 0
        } as any);
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes("alert_type = 'cost_overrun'")) return Promise.resolve({ id: 99 });
            return Promise.resolve(undefined);
        });
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

        await financeService.syncROIAlerts(1);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('is_resolved = 1'),
            expect.arrayContaining([99])
        );
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest financeService.roiAlerts.test.ts`
Expected: FAIL — `financeService.syncROIAlerts is not a function`

- [ ] **Step 3: Agregar `syncROIAlerts` a `backend/src/services/financeService.ts`**

Agregar como método público de la clase `FinanceService`, después de `calculateProjectFinancials` (antes del cierre `}` de la clase, línea 214 actual):

```typescript
    /**
     * Persiste en roi_alerts los estados de sobrecosto y margen bajo del proyecto.
     * Idempotente: si la condición ya no aplica, resuelve la alerta activa en vez de dejarla huérfana.
     * Se llama de forma perezosa (no hay scheduler): desde el dashboard de cobranza y desde
     * getProjectROI/getROIDashboard en financialController.
     */
    async syncROIAlerts(projectId: number): Promise<void> {
        const financials = await this.calculateProjectFinancials(projectId);

        await this.upsertAlert(projectId, 'cost_overrun',
            financials.sale_price > 0 && financials.real_cost > financials.sale_price * 0.8,
            financials.sale_price * 0.8,
            financials.real_cost,
            `Costo real (${financials.real_cost.toLocaleString('es-CL')}) supera el 80% del precio de venta`,
            financials.real_cost > financials.sale_price ? 'critical' : 'warning'
        );

        await this.upsertAlert(projectId, 'low_margin',
            financials.real_roi < 20,
            20,
            financials.real_roi,
            `ROI real de ${financials.real_roi.toFixed(1)}% por debajo del objetivo de 20%`,
            financials.real_roi < 0 ? 'critical' : 'warning'
        );
    }

    /** Crea, actualiza o resuelve una alerta de roi_alerts según si la condición sigue activa. */
    private async upsertAlert(
        projectId: number,
        alertType: string,
        conditionActive: boolean,
        thresholdValue: number,
        currentValue: number,
        message: string,
        level: 'info' | 'warning' | 'critical'
    ): Promise<void> {
        const existing = await db.get(
            `SELECT id FROM roi_alerts WHERE project_id = ? AND alert_type = ? AND is_resolved = 0`,
            [projectId, alertType]
        );

        if (conditionActive) {
            if (existing) {
                await db.run(
                    `UPDATE roi_alerts SET current_value = ?, threshold_value = ?, message = ?, alert_level = ? WHERE id = ?`,
                    [currentValue, thresholdValue, message, level, existing.id]
                );
            } else {
                await db.run(
                    `INSERT INTO roi_alerts (project_id, alert_type, alert_level, message, threshold_value, current_value)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [projectId, alertType, level, message, thresholdValue, currentValue]
                );
            }
        } else if (existing) {
            await db.run(
                `UPDATE roi_alerts SET is_resolved = 1, resolved_at = datetime('now') WHERE id = ?`,
                [existing.id]
            );
        }
    }
```

- [ ] **Step 4: Correr el test de `financeService.roiAlerts.test.ts` para verificar que pasa**

Run: `cd backend && npx jest financeService.roiAlerts.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Agregar el test de `syncOverdueAlert` a `backend/src/__tests__/services/billingService.test.ts`**

Agregar dentro del `describe('BillingService', ...)` existente, después del bloque `describe('getDashboard', ...)`:

```typescript
    describe('syncOverdueAlert', () => {
        it('crea una alerta overdue_payment para un hito vencido', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

            await billingService.syncOverdueAlert(10, 1, 15);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO roi_alerts'),
                expect.arrayContaining([1, 'overdue_payment'])
            );
        });
    });
```

- [ ] **Step 6: Correr el test para verificar que falla**

Run: `cd backend && npx jest billingService.test.ts -t "syncOverdueAlert"`
Expected: FAIL — `billingService.syncOverdueAlert is not a function`

- [ ] **Step 7: Agregar `syncOverdueAlert` a `backend/src/services/billingService.ts`**

Agregar como método público de `BillingService`, y llamarlo desde `evaluateOverdue` por cada hito recién marcado overdue:

```typescript
    /** Persiste en roi_alerts una alerta de cobro vencido para un hito de pago específico. */
    async syncOverdueAlert(paymentMilestoneId: number, projectId: number, daysOverdue: number): Promise<void> {
        const existing = await db.get(
            `SELECT id FROM roi_alerts WHERE project_id = ? AND alert_type = 'overdue_payment' AND is_resolved = 0
             AND message LIKE ?`,
            [projectId, `%hito #${paymentMilestoneId}%`]
        );

        const message = `Cobro vencido para el hito #${paymentMilestoneId} (${daysOverdue} días de atraso)`;
        const level = daysOverdue > 30 ? 'critical' : 'warning';

        if (existing) {
            await db.run(
                `UPDATE roi_alerts SET current_value = ?, message = ?, alert_level = ? WHERE id = ?`,
                [daysOverdue, message, level, existing.id]
            );
        } else {
            await db.run(
                `INSERT INTO roi_alerts (project_id, alert_type, alert_level, message, threshold_value, current_value)
                 VALUES (?, 'overdue_payment', ?, ?, 0, ?)`,
                [projectId, level, message, daysOverdue]
            );
        }
    }
```

Y modificar el bucle de `evaluateOverdue` (Task 2) para llamar a `syncOverdueAlert` con los días de atraso:

```typescript
        let transitioned = 0;
        for (const row of overdueRows) {
            const daysOverdue = Math.floor((Date.now() - new Date(row.due_date).getTime()) / 86400000);
            await db.run(`UPDATE payment_milestones SET status = 'overdue' WHERE id = ?`, [row.id]);
            await db.run(
                `UPDATE invoices SET status = 'overdue' WHERE id = ? AND status NOT IN ('paid', 'cancelled')`,
                [row.invoice_id]
            );
            await this.syncOverdueAlert(row.id, projectId ?? row.project_id, daysOverdue);
            transitioned++;
        }
```

Nota: la consulta de `overdueRows` en `evaluateOverdue` debe incluir `pm.project_id` en el `SELECT` para que `row.project_id` esté disponible cuando `projectId` es `undefined` — ajustar el `SELECT DISTINCT pm.id, pm.project_id, i.id as invoice_id, i.due_date` en el Step 3 de la Task 2 (editar el archivo ya creado en esa tarea).

- [ ] **Step 8: Correr todos los tests de billingService para verificar que pasan**

Run: `cd backend && npx jest billingService.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 9: Enganchar `syncROIAlerts` en el dashboard de ROI existente**

`financialController.getROIDashboard` (`backend/src/controllers/financialController.ts:222-302`) ya recorre todos los proyectos activos con `financeService.calculateProjectFinancials` dentro de un `Promise.all` (líneas 229-238). Ese es el punto natural para persistir las alertas cada vez que alguien mira el dashboard de ROI, sin depender de que el dashboard de cobranza haya sido abierto primero. Modificar ese bloque:

```typescript
            const perProject = await Promise.all(
                projects.map(async (p: any) => {
                    try {
                        const financials = await financeService.calculateProjectFinancials(p.id);
                        await financeService.syncROIAlerts(p.id);
                        return financials;
                    } catch (error) {
                        logger.warn(`Skipping project ${p.id} in ROI dashboard: ${(error as Error).message}`);
                        return null;
                    }
                })
            );
```

Esto reemplaza el `return await financeService.calculateProjectFinancials(p.id);` original de esa función por las dos líneas de arriba (calcular y sincronizar alertas), sin tocar el resto del método.

- [ ] **Step 10: Correr la suite completa de backend para confirmar que no se rompió nada**

Run: `cd backend && npm test`
Expected: PASS (incluye cualquier test existente de `financialController` si lo hubiera, más todos los de esta fase)

- [ ] **Step 11: Commit**

```bash
git add backend/src/services/financeService.ts backend/src/services/billingService.ts backend/src/controllers/financialController.ts backend/src/__tests__/services/financeService.roiAlerts.test.ts backend/src/__tests__/services/billingService.test.ts
git commit -m "feat(fase2): escribir de verdad en roi_alerts - sobrecosto, margen bajo, cobro vencido"
```

---

### Task 4: Zod schemas + `billingController.ts` + `billingRoutes.ts`

**Files:**
- Modify: `backend/src/validation/schemas.ts`
- Create: `backend/src/controllers/billingController.ts`
- Create: `backend/src/routes/billingRoutes.ts`
- Modify: `backend/src/server.ts`
- Test: `backend/src/__tests__/controllers/billingController.test.ts`

**Interfaces:**
- Consumes: `billingService` (Task 2/3), `financeService` (existente), `db` directo para CRUD simple.
- Produces endpoints (todos bajo `/api/billing`, montados en `server.ts`):
  - `GET /api/billing/dashboard?project_id=` → `billingService.getDashboard`
  - `GET /api/billing/payment-milestones?project_id=` → lista de hitos (crudos, sin filtrar por estado)
  - `POST /api/billing/payment-milestones` → crear hito
  - `PUT /api/billing/payment-milestones/:id` → editar hito
  - `DELETE /api/billing/payment-milestones/:id` → eliminar hito (solo si `status = 'pending'`)
  - `GET /api/billing/invoices?project_id=` → lista de facturas con sus líneas
  - `POST /api/billing/invoices` → crear factura a partir de hitos `billable` seleccionados
  - `POST /api/billing/invoices/:id/payments` → registrar un cobro contra una factura
  - `POST /api/billing/evaluate` → dispara `evaluateTriggers` + `evaluateOverdue` manualmente (uso interno/tests)

- [ ] **Step 1: Agregar schemas Zod a `backend/src/validation/schemas.ts`**

Agregar al final del archivo:

```typescript
// Billing / Payment Milestones validation schemas (Fase 2)
export const createPaymentMilestoneSchema = z.object({
    project_id: z.number().int().positive('Valid project ID required'),
    project_milestone_id: z.number().int().positive().optional().nullable(),
    name: z.string().min(1, 'Milestone name is required').max(200),
    description: z.string().max(1000).optional(),
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['CLP', 'USD', 'UF']),
    trigger_type: z.enum(['date', 'progress_pct', 'deliverable_approved']),
    trigger_value: z.number().min(0).max(100).optional().nullable(),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    sort_order: z.number().int().optional()
}).refine(
    (data) => data.trigger_type !== 'progress_pct' || (data.trigger_value !== null && data.trigger_value !== undefined),
    { message: 'trigger_value is required when trigger_type is progress_pct', path: ['trigger_value'] }
).refine(
    (data) => (data.trigger_type !== 'progress_pct' && data.trigger_type !== 'deliverable_approved') || !!data.project_milestone_id,
    { message: 'project_milestone_id is required for progress_pct and deliverable_approved triggers', path: ['project_milestone_id'] }
).refine(
    (data) => data.trigger_type !== 'date' || !!data.planned_date,
    { message: 'planned_date is required when trigger_type is date', path: ['planned_date'] }
);

export const updatePaymentMilestoneSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    amount: z.number().positive().optional(),
    currency: z.enum(['CLP', 'USD', 'UF']).optional(),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    trigger_value: z.number().min(0).max(100).optional().nullable(),
    sort_order: z.number().int().optional()
});

export const createInvoiceSchema = z.object({
    project_id: z.number().int().positive('Valid project ID required'),
    invoice_number: z.string().min(1, 'Invoice number is required').max(50),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    payment_milestone_ids: z.array(z.number().int().positive()).min(1, 'At least one payment milestone is required'),
    notes: z.string().max(2000).optional()
});

export const createPaymentSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['CLP', 'USD', 'UF']),
    payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    method: z.string().max(50).optional(),
    reference: z.string().max(100).optional(),
    notes: z.string().max(1000).optional()
});
```

- [ ] **Step 2: Escribir los tests de `billingController` (invocando el controller directo con mock req/res)**

```typescript
// backend/src/__tests__/controllers/billingController.test.ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/billingService', () => ({
    billingService: { getDashboard: jest.fn(), evaluateTriggers: jest.fn(), evaluateOverdue: jest.fn() }
}));

import { db } from '../../database/database';
import { billingService } from '../../services/billingService';
import { BillingController } from '../../controllers/billingController';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('BillingController', () => {
    let controller: BillingController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new BillingController();
    });

    describe('getDashboard', () => {
        it('devuelve el dashboard de billingService', async () => {
            const fakeDashboard = { ready_to_invoice: [], invoiced_unpaid: [], paid: [], overdue: [], cashflow_projection: [], summary: {} };
            (billingService.getDashboard as jest.Mock).mockResolvedValue(fakeDashboard);

            const req: any = { query: {}, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.getDashboard(req, res);

            expect(billingService.getDashboard).toHaveBeenCalledWith(undefined);
            expect(res.json).toHaveBeenCalledWith(fakeDashboard);
        });

        it('pasa project_id como número cuando viene en query', async () => {
            (billingService.getDashboard as jest.Mock).mockResolvedValue({});
            const req: any = { query: { project_id: '5' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.getDashboard(req, res);

            expect(billingService.getDashboard).toHaveBeenCalledWith(5);
        });
    });

    describe('createPaymentMilestone', () => {
        it('crea un hito y devuelve 201 con el registro creado', async () => {
            (db.run as jest.Mock).mockResolvedValue({ id: 42, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({ id: 42, name: 'Hito 1', status: 'pending' });

            const req: any = {
                body: { project_id: 1, name: 'Hito 1', amount: 500000, currency: 'CLP', trigger_type: 'date', planned_date: '2026-12-01' },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.createPaymentMilestone(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payment_milestones'), expect.any(Array));
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('deletePaymentMilestone', () => {
        it('rechaza con 400 si el hito ya no está pending', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, status: 'invoiced' });
            const req: any = { params: { id: '1' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.deletePaymentMilestone(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('elimina un hito pending', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, status: 'pending' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req: any = { params: { id: '1' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.deletePaymentMilestone(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM payment_milestones'), [1]);
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('createInvoice', () => {
        it('rechaza con 400 si algún hito seleccionado no está billable', async () => {
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, status: 'billable', amount: 100, currency: 'CLP', project_id: 1 },
                { id: 2, status: 'pending', amount: 200, currency: 'CLP', project_id: 1 }
            ]);
            const req: any = {
                body: { project_id: 1, invoice_number: 'F-1', issue_date: '2026-09-16', due_date: '2026-10-16', payment_milestone_ids: [1, 2] },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.createInvoice(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.beginTransaction).not.toHaveBeenCalled();
        });

        it('crea la factura, sus líneas, y marca los hitos como invoiced', async () => {
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, status: 'billable', amount: 100, currency: 'CLP', project_id: 1 }
            ]);
            (db.run as jest.Mock).mockResolvedValue({ id: 999, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({ id: 999, invoice_number: 'F-1' });

            const req: any = {
                body: { project_id: 1, invoice_number: 'F-1', issue_date: '2026-09-16', due_date: '2026-10-16', payment_milestone_ids: [1] },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.createInvoice(req, res);

            expect(db.beginTransaction).toHaveBeenCalled();
            expect(db.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('recordPayment', () => {
        it('registra el pago y marca la factura paid cuando el total cubre el monto', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM invoices WHERE id')) return Promise.resolve({ id: 5, amount: 1000, currency: 'CLP', status: 'issued', project_id: 1 });
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockResolvedValue([{ total_paid: 1000 }]);
            (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

            const req: any = {
                params: { id: '5' },
                body: { amount: 1000, currency: 'CLP', payment_date: '2026-09-16' },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.recordPayment(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining("SET status = 'paid'"), expect.any(Array));
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest billingController.test.ts`
Expected: FAIL — `Cannot find module '../../controllers/billingController'`

- [ ] **Step 4: Implementar `backend/src/controllers/billingController.ts`**

```typescript
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { billingService } from '../services/billingService';

export class BillingController {

    getDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
            const dashboard = await billingService.getDashboard(projectId);
            res.json(dashboard);
        } catch (error) {
            logger.error('Get billing dashboard error:', error);
            res.status(500).json({ error: 'Failed to get billing dashboard' });
        }
    };

    getPaymentMilestones = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
            const filter = projectId ? 'WHERE pm.project_id = ?' : '';
            const params = projectId ? [projectId] : [];

            const rows = await db.query(
                `SELECT pm.*, p.name as project_name
                 FROM payment_milestones pm
                 JOIN projects p ON p.id = pm.project_id
                 ${filter}
                 ORDER BY pm.sort_order ASC, pm.planned_date ASC`,
                params
            );

            res.json(rows);
        } catch (error) {
            logger.error('Get payment milestones error:', error);
            res.status(500).json({ error: 'Failed to get payment milestones' });
        }
    };

    createPaymentMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const {
                project_id, project_milestone_id, name, description,
                amount, currency, trigger_type, trigger_value, planned_date, sort_order
            } = req.body;

            const result = await db.run(
                `INSERT INTO payment_milestones (
                    project_id, project_milestone_id, name, description, amount, currency,
                    trigger_type, trigger_value, planned_date, sort_order, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [project_id, project_milestone_id ?? null, name, description ?? null, amount, currency,
                 trigger_type, trigger_value ?? null, planned_date ?? null, sort_order ?? 0, req.user?.id]
            );

            const created = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [result.id]);
            res.status(201).json(created);
        } catch (error) {
            logger.error('Create payment milestone error:', error);
            res.status(500).json({ error: 'Failed to create payment milestone' });
        }
    };

    updatePaymentMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [id]);
            if (!existing) {
                res.status(404).json({ error: 'Payment milestone not found' });
                return;
            }
            if (existing.status !== 'pending') {
                res.status(400).json({ error: `Cannot edit a payment milestone in status '${existing.status}'` });
                return;
            }

            const fields = ['name', 'description', 'amount', 'currency', 'planned_date', 'trigger_value', 'sort_order'];
            const updates = fields.filter(f => req.body[f] !== undefined);
            if (updates.length === 0) {
                res.status(400).json({ error: 'No fields to update' });
                return;
            }

            const setClause = updates.map(f => `${f} = ?`).join(', ');
            const values = updates.map(f => req.body[f]);
            await db.run(`UPDATE payment_milestones SET ${setClause} WHERE id = ?`, [...values, id]);

            const updated = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [id]);
            res.json(updated);
        } catch (error) {
            logger.error('Update payment milestone error:', error);
            res.status(500).json({ error: 'Failed to update payment milestone' });
        }
    };

    deletePaymentMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [id]);
            if (!existing) {
                res.status(404).json({ error: 'Payment milestone not found' });
                return;
            }
            if (existing.status !== 'pending') {
                res.status(400).json({ error: `Cannot delete a payment milestone in status '${existing.status}'` });
                return;
            }

            await db.run(`DELETE FROM payment_milestones WHERE id = ?`, [id]);
            res.status(200).json({ message: 'Payment milestone deleted' });
        } catch (error) {
            logger.error('Delete payment milestone error:', error);
            res.status(500).json({ error: 'Failed to delete payment milestone' });
        }
    };

    getInvoices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
            const filter = projectId ? 'WHERE i.project_id = ?' : '';
            const params = projectId ? [projectId] : [];

            const invoices = await db.query(
                `SELECT i.*, p.name as project_name FROM invoices i
                 JOIN projects p ON p.id = i.project_id
                 ${filter}
                 ORDER BY i.issue_date DESC`,
                params
            );

            const withLines = await Promise.all(invoices.map(async (inv: any) => ({
                ...inv,
                lines: await db.query(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [inv.id]),
                payments: await db.query(`SELECT * FROM payments WHERE invoice_id = ?`, [inv.id])
            })));

            res.json(withLines);
        } catch (error) {
            logger.error('Get invoices error:', error);
            res.status(500).json({ error: 'Failed to get invoices' });
        }
    };

    createInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { project_id, invoice_number, issue_date, due_date, payment_milestone_ids, notes } = req.body;

            const placeholders = payment_milestone_ids.map(() => '?').join(',');
            const milestones = await db.query(
                `SELECT * FROM payment_milestones WHERE id IN (${placeholders})`,
                payment_milestone_ids
            );

            if (milestones.length !== payment_milestone_ids.length) {
                res.status(400).json({ error: 'One or more payment milestones not found' });
                return;
            }
            const notBillable = milestones.filter((m: any) => m.status !== 'billable');
            if (notBillable.length > 0) {
                res.status(400).json({ error: `Payment milestones not in billable status: ${notBillable.map((m: any) => m.id).join(', ')}` });
                return;
            }
            const wrongProject = milestones.filter((m: any) => m.project_id !== project_id);
            if (wrongProject.length > 0) {
                res.status(400).json({ error: 'All payment milestones must belong to the given project_id' });
                return;
            }
            const currencies = new Set(milestones.map((m: any) => m.currency));
            if (currencies.size > 1) {
                res.status(400).json({ error: 'All payment milestones in one invoice must share the same currency' });
                return;
            }

            const currency = milestones[0].currency;
            const amount = milestones.reduce((sum: number, m: any) => sum + m.amount, 0);

            await db.beginTransaction();
            try {
                const invoiceResult = await db.run(
                    `INSERT INTO invoices (project_id, invoice_number, issue_date, due_date, currency, amount, status, notes, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, 'issued', ?, ?)`,
                    [project_id, invoice_number, issue_date, due_date, currency, amount, notes ?? null, req.user?.id]
                );
                const invoiceId = invoiceResult.id!;

                for (const m of milestones) {
                    await db.run(
                        `INSERT INTO invoice_lines (invoice_id, payment_milestone_id, description, amount)
                         VALUES (?, ?, ?, ?)`,
                        [invoiceId, m.id, m.name, m.amount]
                    );
                    await db.run(`UPDATE payment_milestones SET status = 'invoiced' WHERE id = ?`, [m.id]);
                }

                await db.commit();

                const created = await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);
                res.status(201).json(created);
            } catch (txError) {
                await db.rollback();
                throw txError;
            }
        } catch (error) {
            logger.error('Create invoice error:', error);
            res.status(500).json({ error: 'Failed to create invoice' });
        }
    };

    recordPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { amount, currency, payment_date, method, reference, notes } = req.body;

            const invoice = await db.get(`SELECT * FROM invoices WHERE id = ?`, [id]);
            if (!invoice) {
                res.status(404).json({ error: 'Invoice not found' });
                return;
            }
            if (invoice.status === 'paid' || invoice.status === 'cancelled') {
                res.status(400).json({ error: `Cannot record a payment against an invoice in status '${invoice.status}'` });
                return;
            }

            const result = await db.run(
                `INSERT INTO payments (invoice_id, amount, currency, payment_date, method, reference, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, amount, currency, payment_date, method ?? null, reference ?? null, notes ?? null, req.user?.id]
            );

            const totals = await db.query(
                `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ? AND currency = ?`,
                [id, invoice.currency]
            );
            const totalPaid = totals[0]?.total_paid ?? 0;

            if (totalPaid >= invoice.amount) {
                await db.run(`UPDATE invoices SET status = 'paid' WHERE id = ?`, [id]);
                await db.run(
                    `UPDATE payment_milestones SET status = 'paid'
                     WHERE id IN (SELECT payment_milestone_id FROM invoice_lines WHERE invoice_id = ?)`,
                    [id]
                );
            } else {
                await db.run(`UPDATE invoices SET status = 'partially_paid' WHERE id = ?`, [id]);
            }

            const created = await db.get(`SELECT * FROM payments WHERE id = ?`, [result.id]);
            res.status(201).json(created);
        } catch (error) {
            logger.error('Record payment error:', error);
            res.status(500).json({ error: 'Failed to record payment' });
        }
    };

    evaluate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.body.project_id ? parseInt(req.body.project_id) : undefined;
            const triggers = await billingService.evaluateTriggers(projectId);
            const overdue = await billingService.evaluateOverdue(projectId);
            res.json({ ...triggers, ...overdue });
        } catch (error) {
            logger.error('Evaluate billing triggers error:', error);
            res.status(500).json({ error: 'Failed to evaluate billing triggers' });
        }
    };
}
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest billingController.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Crear `backend/src/routes/billingRoutes.ts`**

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
    createPaymentMilestoneSchema, updatePaymentMilestoneSchema,
    createInvoiceSchema, createPaymentSchema
} from '../validation/schemas';
import { BillingController } from '../controllers/billingController';

const router = Router();
const billingController = new BillingController();

router.use(authenticate);

// Lectura de dashboard y listas: mismo nivel que PMO
const billingReadRoles = authorize(['team_lead', 'rpa_operations']);
// Gestión de hitos y facturas
const billingWriteRoles = authorize(['team_lead', 'rpa_operations']);
// Registrar cobros: acción financiera irreversible, solo team_lead
const billingPaymentRoles = authorize(['team_lead']);

// ========================================
// DASHBOARD DE COBRANZA
// ========================================
router.get('/dashboard', billingReadRoles, billingController.getDashboard);
router.post('/evaluate', billingReadRoles, billingController.evaluate);

// ========================================
// HITOS DE PAGO
// ========================================
router.get('/payment-milestones', billingReadRoles, billingController.getPaymentMilestones);
router.post('/payment-milestones', billingWriteRoles, validate({ body: createPaymentMilestoneSchema }), billingController.createPaymentMilestone);
router.put('/payment-milestones/:id', billingWriteRoles, validate({ body: updatePaymentMilestoneSchema }), billingController.updatePaymentMilestone);
router.delete('/payment-milestones/:id', billingWriteRoles, billingController.deletePaymentMilestone);

// ========================================
// FACTURAS
// ========================================
router.get('/invoices', billingReadRoles, billingController.getInvoices);
router.post('/invoices', billingWriteRoles, validate({ body: createInvoiceSchema }), billingController.createInvoice);

// ========================================
// PAGOS
// ========================================
router.post('/invoices/:id/payments', billingPaymentRoles, validate({ body: createPaymentSchema }), billingController.recordPayment);

export default router;
```

- [ ] **Step 7: Registrar `billingRoutes` en `backend/src/server.ts`**

Agregar el import junto a los demás (después de la línea `import llmConfigRoutes from './routes/llmConfigRoutes';`):

```typescript
import billingRoutes from './routes/billingRoutes';
```

Agregar el montaje de la ruta junto a los demás `this.app.use(...)` (después de `this.app.use('/api/llm-config', llmConfigRoutes);`):

```typescript
        this.app.use('/api/billing', billingRoutes);
```

Agregar la entrada en el bloque `GET /api` (`endpoints: { ... }`), después del bloque `support: { ... }`:

```typescript
                    billing: {
                        'GET /api/billing/dashboard': 'Get cobranza dashboard (ready to invoice, invoiced, paid, overdue, cashflow projection)',
                        'POST /api/billing/evaluate': 'Manually re-evaluate payment milestone triggers and overdue status',
                        'GET /api/billing/payment-milestones': 'Get payment milestones with optional project_id filter',
                        'POST /api/billing/payment-milestones': 'Create a payment milestone',
                        'PUT /api/billing/payment-milestones/:id': 'Update a pending payment milestone',
                        'DELETE /api/billing/payment-milestones/:id': 'Delete a pending payment milestone',
                        'GET /api/billing/invoices': 'Get invoices with lines and payments',
                        'POST /api/billing/invoices': 'Create an invoice from billable payment milestones',
                        'POST /api/billing/invoices/:id/payments': 'Record a payment against an invoice (team_lead only)'
                    },
```

- [ ] **Step 8: Correr toda la suite de backend para verificar que nada se rompió**

Run: `cd backend && npm test`
Expected: PASS (todos los tests existentes + los nuevos)

- [ ] **Step 9: Commit**

```bash
git add backend/src/validation/schemas.ts backend/src/controllers/billingController.ts backend/src/routes/billingRoutes.ts backend/src/server.ts backend/src/__tests__/controllers/billingController.test.ts
git commit -m "feat(fase2): billingController + billingRoutes - CRUD de hitos de pago, facturas y cobros"
```

---

### Task 5: PDF de estado de pago

**Files:**
- Modify: `backend/package.json` (agregar `pdfkit` + `@types/pdfkit`)
- Create: `backend/src/services/pdfService.ts`
- Modify: `backend/src/controllers/billingController.ts` (agregar `getPaymentStatement`)
- Modify: `backend/src/routes/billingRoutes.ts` (agregar la ruta)
- Test: `backend/src/__tests__/services/pdfService.test.ts`

**Interfaces:**
- Consumes: `financeService.calculateProjectFinancials` (montos validados), `db.query` para hitos de pago y horas del proyecto.
- Produces: `pdfService.generatePaymentStatement(data: PaymentStatementData): Promise<Buffer>`; endpoint `GET /api/billing/projects/:projectId/payment-statement`.

- [ ] **Step 1: Instalar `pdfkit`**

Run: `cd backend && npm install pdfkit && npm install --save-dev @types/pdfkit`
Expected: `backend/package.json` y `backend/package-lock.json` actualizados con `pdfkit` en `dependencies` y `@types/pdfkit` en `devDependencies`.

- [ ] **Step 2: Escribir el test de `pdfService`**

```typescript
// backend/src/__tests__/services/pdfService.test.ts
import { generatePaymentStatement, PaymentStatementData } from '../../services/pdfService';

describe('pdfService.generatePaymentStatement', () => {
    it('genera un buffer con cabecera PDF válida', async () => {
        const data: PaymentStatementData = {
            project_name: 'AGROSUPER - Toma de Control',
            client_name: 'Agrosuper S.A.',
            generated_at: '2026-09-16',
            financials: {
                sale_price: 4470102,
                real_cost: 1500000,
                real_roi: 198,
                real_profit: 2970102
            },
            milestones: [
                { name: 'Hito 1', amount: 1000000, currency: 'CLP', status: 'paid', planned_date: '2026-06-01' },
                { name: 'Hito 2', amount: 1000000, currency: 'CLP', status: 'billable', planned_date: '2026-09-01' }
            ],
            hours_summary: [
                { user_name: 'Dev Uno', total_hours: 120 }
            ]
        };

        const buffer = await generatePaymentStatement(data);

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(100);
        expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('no lanza si no hay horas registradas', async () => {
        const data: PaymentStatementData = {
            project_name: 'PROMET',
            client_name: 'Promet',
            generated_at: '2026-09-16',
            financials: { sale_price: 1000000, real_cost: 500000, real_roi: 100, real_profit: 500000 },
            milestones: [],
            hours_summary: []
        };

        await expect(generatePaymentStatement(data)).resolves.toBeInstanceOf(Buffer);
    });
});
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `cd backend && npx jest pdfService.test.ts`
Expected: FAIL — `Cannot find module '../../services/pdfService'`

- [ ] **Step 4: Implementar `backend/src/services/pdfService.ts`**

```typescript
import PDFDocument from 'pdfkit';

export interface PaymentStatementMilestone {
    name: string;
    amount: number;
    currency: string;
    status: string;
    planned_date: string | null;
}

export interface PaymentStatementHours {
    user_name: string;
    total_hours: number;
}

export interface PaymentStatementData {
    project_name: string;
    client_name: string;
    generated_at: string;
    financials: {
        sale_price: number;
        real_cost: number;
        real_roi: number;
        real_profit: number;
    };
    milestones: PaymentStatementMilestone[];
    hours_summary: PaymentStatementHours[];
}

const STATUS_LABEL: Record<string, string> = {
    pending: 'Pendiente',
    billable: 'Por facturar',
    invoiced: 'Facturado',
    paid: 'Pagado',
    overdue: 'Vencido'
};

function formatCLP(amount: number): string {
    return `$${Math.round(amount).toLocaleString('es-CL')}`;
}

/** Genera el PDF de estado de pago de un proyecto. Los montos ya vienen calculados por financeService/billingService. */
export function generatePaymentStatement(data: PaymentStatementData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(18).text('Estado de Pago', { align: 'center' });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Proyecto: ${data.project_name}`);
        doc.text(`Cliente: ${data.client_name}`);
        doc.text(`Generado: ${data.generated_at}`);
        doc.moveDown();

        doc.fontSize(13).text('Resumen financiero', { underline: true });
        doc.fontSize(11);
        doc.text(`Precio de venta: ${formatCLP(data.financials.sale_price)}`);
        doc.text(`Costo real: ${formatCLP(data.financials.real_cost)}`);
        doc.text(`Margen real: ${formatCLP(data.financials.real_profit)}`);
        doc.text(`ROI real: ${data.financials.real_roi.toFixed(1)}%`);
        doc.moveDown();

        doc.fontSize(13).text('Hitos de pago', { underline: true });
        doc.fontSize(10);
        if (data.milestones.length === 0) {
            doc.text('Sin hitos de pago registrados.');
        } else {
            for (const m of data.milestones) {
                const statusLabel = STATUS_LABEL[m.status] || m.status;
                const dateLabel = m.planned_date || 's/f';
                doc.text(`${m.name} — ${m.amount.toLocaleString('es-CL')} ${m.currency} — ${statusLabel} — ${dateLabel}`);
            }
        }
        doc.moveDown();

        doc.fontSize(13).text('Horas registradas', { underline: true });
        doc.fontSize(10);
        if (data.hours_summary.length === 0) {
            doc.text('Sin horas registradas para este proyecto.');
        } else {
            for (const h of data.hours_summary) {
                doc.text(`${h.user_name}: ${h.total_hours}h`);
            }
        }

        doc.end();
    });
}
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `cd backend && npx jest pdfService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Agregar `getPaymentStatement` a `billingController.ts`**

Agregar el import al inicio del archivo:

```typescript
import { financeService } from '../services/financeService';
import { generatePaymentStatement } from '../services/pdfService';
```

Agregar el método a la clase `BillingController` (después de `evaluate`):

```typescript
    getPaymentStatement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId);

            const project = await db.get(
                `SELECT p.*, c.name as client_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = ?`,
                [projectId]
            );
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            const financials = await financeService.calculateProjectFinancials(projectId);

            const milestones = await db.query(
                `SELECT name, amount, currency, status, planned_date FROM payment_milestones
                 WHERE project_id = ? ORDER BY planned_date ASC`,
                [projectId]
            );

            const hoursSummary = await db.query(
                `SELECT u.full_name as user_name, COALESCE(SUM(te.hours), 0) as total_hours
                 FROM time_entries te
                 JOIN users u ON u.id = te.user_id
                 WHERE te.project_id = ?
                 GROUP BY te.user_id`,
                [projectId]
            );

            const buffer = await generatePaymentStatement({
                project_name: project.name,
                client_name: project.client_name || 'N/A',
                generated_at: new Date().toISOString().slice(0, 10),
                financials: {
                    sale_price: financials.sale_price,
                    real_cost: financials.real_cost,
                    real_roi: financials.real_roi,
                    real_profit: financials.real_profit
                },
                milestones,
                hours_summary: hoursSummary
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="estado-pago-${projectId}.pdf"`);
            res.send(buffer);
        } catch (error) {
            logger.error('Get payment statement error:', error);
            res.status(500).json({ error: 'Failed to generate payment statement' });
        }
    };
```

- [ ] **Step 7: Agregar la ruta en `billingRoutes.ts`**

```typescript
router.get('/projects/:projectId/payment-statement', billingReadRoles, billingController.getPaymentStatement);
```

Y agregar la entrada correspondiente al bloque `billing: {...}` de `server.ts`:

```typescript
                        'GET /api/billing/projects/:projectId/payment-statement': 'Download the project payment statement PDF',
```

- [ ] **Step 8: Correr toda la suite de backend**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/services/pdfService.ts backend/src/controllers/billingController.ts backend/src/routes/billingRoutes.ts backend/src/server.ts backend/src/__tests__/services/pdfService.test.ts
git commit -m "feat(fase2): generación de PDF de estado de pago con pdfkit"
```

---

### Task 6: Frontend — tipos, servicio API, página de Cobranza

**Files:**
- Create: `frontend/src/types/billing.ts`
- Modify: `frontend/src/services/api.ts`
- Create: `frontend/src/pages/billing/BillingPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/common/AppLayout.tsx`

**Interfaces:**
- Consumes: endpoints de Task 4/5 (`/billing/dashboard`, `/billing/payment-milestones`, `/billing/invoices`, `/billing/invoices/:id/payments`, `/billing/projects/:id/payment-statement`), `apiService.getBaseURL()` / `apiService.getToken()` (patrón de `fileService.ts:176-190`), `apiService.getProjects()` (ya existente, para el selector de proyecto).

- [ ] **Step 1: Crear `frontend/src/types/billing.ts`**

```typescript
export type PaymentMilestoneStatus = 'pending' | 'billable' | 'invoiced' | 'paid' | 'overdue';
export type TriggerType = 'date' | 'progress_pct' | 'deliverable_approved';
export type Currency = 'CLP' | 'USD' | 'UF';
export type InvoiceStatus = 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface PaymentMilestone {
  id: number;
  project_id: number;
  project_milestone_id: number | null;
  name: string;
  description: string | null;
  amount: number;
  currency: Currency;
  trigger_type: TriggerType;
  trigger_value: number | null;
  planned_date: string | null;
  status: PaymentMilestoneStatus;
  billable_at: string | null;
  sort_order: number;
  project_name?: string;
}

export interface InvoiceLine {
  id: number;
  invoice_id: number;
  payment_milestone_id: number | null;
  description: string;
  amount: number;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: number;
  currency: Currency;
  payment_date: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
}

export interface Invoice {
  id: number;
  project_id: number;
  project_name?: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  currency: Currency;
  amount: number;
  status: InvoiceStatus;
  notes: string | null;
  lines: InvoiceLine[];
  payments: Payment[];
}

export interface BillingDashboardRow {
  id: number;
  project_id: number;
  project_name: string;
  name: string;
  amount: number;
  currency: Currency;
  amount_clp: number;
  status: PaymentMilestoneStatus;
  planned_date: string | null;
  trigger_type: TriggerType;
}

export interface BillingDashboard {
  ready_to_invoice: BillingDashboardRow[];
  invoiced_unpaid: BillingDashboardRow[];
  paid: BillingDashboardRow[];
  overdue: BillingDashboardRow[];
  cashflow_projection: { month: string; expected_amount_clp: number }[];
  summary: {
    total_pending_clp: number;
    total_billable_clp: number;
    total_invoiced_clp: number;
    total_paid_clp: number;
    total_overdue_clp: number;
  };
}
```

- [ ] **Step 2: Agregar métodos de billing a `frontend/src/services/api.ts`**

Agregar después del bloque `// Financial endpoints` existente (cerca de la línea 363), siguiendo el mismo estilo que los métodos de `getProjectROI`:

```typescript
  // Billing endpoints (Fase 2 - Cobros e hitos de pago)
  async getBillingDashboard(projectId?: number): Promise<any> {
    const url = projectId ? `/billing/dashboard?project_id=${projectId}` : '/billing/dashboard';
    const response = await this.api.get(url);
    return response.data;
  }

  async getPaymentMilestones(projectId?: number): Promise<any[]> {
    const url = projectId ? `/billing/payment-milestones?project_id=${projectId}` : '/billing/payment-milestones';
    const response = await this.api.get(url);
    return response.data;
  }

  async createPaymentMilestone(data: any): Promise<any> {
    const response = await this.api.post('/billing/payment-milestones', data);
    return response.data;
  }

  async updatePaymentMilestone(id: number, data: any): Promise<any> {
    const response = await this.api.put(`/billing/payment-milestones/${id}`, data);
    return response.data;
  }

  async deletePaymentMilestone(id: number): Promise<void> {
    await this.api.delete(`/billing/payment-milestones/${id}`);
  }

  async getInvoices(projectId?: number): Promise<any[]> {
    const url = projectId ? `/billing/invoices?project_id=${projectId}` : '/billing/invoices';
    const response = await this.api.get(url);
    return response.data;
  }

  async createInvoice(data: any): Promise<any> {
    const response = await this.api.post('/billing/invoices', data);
    return response.data;
  }

  async recordPayment(invoiceId: number, data: any): Promise<any> {
    const response = await this.api.post(`/billing/invoices/${invoiceId}/payments`, data);
    return response.data;
  }

  getPaymentStatementUrl(projectId: number): string {
    return `${this.baseURL}/api/billing/projects/${projectId}/payment-statement`;
  }

  async downloadPaymentStatement(projectId: number): Promise<Blob> {
    const response = await fetch(this.getPaymentStatementUrl(projectId), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('rpa_token')}` },
    });
    if (!response.ok) {
      throw new Error('No se pudo generar el estado de pago');
    }
    return response.blob();
  }
```

Nota: verificar si `ApiService` ya expone `getBaseURL()`/`getToken()` públicos (usados por `fileService.ts`); si existen, usarlos en `downloadPaymentStatement` en vez de `this.baseURL`/`localStorage` directo, para ser consistentes. Si el método se define dentro de la propia clase `ApiService`, `this.baseURL` ya es accesible directamente sin necesitar un getter.

- [ ] **Step 3: Crear `frontend/src/pages/billing/BillingPage.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Table, Tag, Tabs, Button, Space, Select,
  Modal, Form, Input, InputNumber, DatePicker, message, Popconfirm
} from 'antd';
import { DollarOutlined, FileTextOutlined, PlusOutlined, DownloadOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
import apiService from '../../services/api';
import { BillingDashboard, PaymentMilestone, Invoice } from '../../types/billing';

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  billable: 'blue',
  invoiced: 'gold',
  paid: 'green',
  overdue: 'red'
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  billable: 'Por facturar',
  invoiced: 'Facturado',
  paid: 'Pagado',
  overdue: 'Vencido'
};

const BillingPage: React.FC = () => {
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([]);
  const [projectFilter, setProjectFilter] = useState<number | undefined>(undefined);
  const [dashboard, setDashboard] = useState<BillingDashboard | null>(null);
  const [milestones, setMilestones] = useState<PaymentMilestone[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    apiService.getProjects().then(p => setProjects(p.map((x: any) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);

  useEffect(() => {
    loadAll();
  }, [projectFilter]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [dash, ms, inv] = await Promise.all([
        apiService.getBillingDashboard(projectFilter),
        apiService.getPaymentMilestones(projectFilter),
        apiService.getInvoices(projectFilter)
      ]);
      setDashboard(dash);
      setMilestones(ms);
      setInvoices(inv);
    } catch (error) {
      message.error('Error al cargar datos de cobranza');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMilestone = async (values: any) => {
    try {
      await apiService.createPaymentMilestone({
        ...values,
        planned_date: values.planned_date ? values.planned_date.format('YYYY-MM-DD') : undefined
      });
      message.success('Hito de pago creado');
      setCreateModalOpen(false);
      form.resetFields();
      loadAll();
    } catch (error) {
      message.error('Error al crear el hito de pago');
    }
  };

  const handleDeleteMilestone = async (id: number) => {
    try {
      await apiService.deletePaymentMilestone(id);
      message.success('Hito eliminado');
      loadAll();
    } catch (error) {
      message.error('No se pudo eliminar (¿ya no está pendiente?)');
    }
  };

  const handleDownloadStatement = async (projectId: number) => {
    try {
      const blob = await apiService.downloadPaymentStatement(projectId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `estado-pago-${projectId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      message.error('No se pudo generar el PDF');
    }
  };

  const milestoneColumns = [
    { title: 'Proyecto', dataIndex: 'project_name', key: 'project_name' },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Monto', key: 'amount', render: (_: any, r: PaymentMilestone) => `${r.amount.toLocaleString('es-CL')} ${r.currency}` },
    { title: 'Fecha planificada', dataIndex: 'planned_date', key: 'planned_date' },
    {
      title: 'Estado', dataIndex: 'status', key: 'status',
      render: (status: string) => <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status] || status}</Tag>
    },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, r: PaymentMilestone) => r.status === 'pending' ? (
        <Popconfirm title="¿Eliminar este hito?" onConfirm={() => handleDeleteMilestone(r.id)}>
          <Button danger size="small">Eliminar</Button>
        </Popconfirm>
      ) : null
    }
  ];

  const dashboardRowColumns = [
    { title: 'Proyecto', dataIndex: 'project_name', key: 'project_name' },
    { title: 'Hito', dataIndex: 'name', key: 'name' },
    { title: 'Monto (CLP)', dataIndex: 'amount_clp', key: 'amount_clp', render: (v: number) => `$${v.toLocaleString('es-CL')}` },
    { title: 'Fecha', dataIndex: 'planned_date', key: 'planned_date' }
  ];

  const invoiceColumns = [
    { title: 'N° Factura', dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: 'Proyecto', dataIndex: 'project_name', key: 'project_name' },
    { title: 'Emisión', dataIndex: 'issue_date', key: 'issue_date' },
    { title: 'Vencimiento', dataIndex: 'due_date', key: 'due_date' },
    { title: 'Monto', key: 'amount', render: (_: any, r: Invoice) => `${r.amount.toLocaleString('es-CL')} ${r.currency}` },
    {
      title: 'Estado', dataIndex: 'status', key: 'status',
      render: (status: string) => <Tag color={STATUS_COLOR[status] || 'default'}>{status}</Tag>
    },
    {
      title: 'Acciones', key: 'actions',
      render: (_: any, r: Invoice) => (
        <Button icon={<DownloadOutlined />} size="small" onClick={() => handleDownloadStatement(r.project_id)}>
          Estado de pago
        </Button>
      )
    }
  ];

  return (
    <div className="page-container">
      <Card
        title="Cobranza"
        extra={
          <Space>
            <Select
              allowClear
              placeholder="Todos los proyectos"
              style={{ width: 240 }}
              value={projectFilter}
              onChange={setProjectFilter}
              options={projects.map(p => ({ value: p.id, label: p.name }))}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Nuevo hito de pago
            </Button>
          </Space>
        }
      >
        <Tabs
          defaultActiveKey="dashboard"
          items={[
            {
              key: 'dashboard',
              label: 'Dashboard',
              children: (
                <>
                  <Row gutter={16} style={{ marginBottom: 24 }}>
                    <Col span={5}><Card><Statistic title="Por facturar" value={dashboard?.summary.total_billable_clp || 0} prefix="$" /></Card></Col>
                    <Col span={5}><Card><Statistic title="Facturado (no pagado)" value={dashboard?.summary.total_invoiced_clp || 0} prefix="$" /></Card></Col>
                    <Col span={5}><Card><Statistic title="Cobrado" value={dashboard?.summary.total_paid_clp || 0} prefix="$" valueStyle={{ color: '#3f8600' }} /></Card></Col>
                    <Col span={5}><Card><Statistic title="Vencido" value={dashboard?.summary.total_overdue_clp || 0} prefix="$" valueStyle={{ color: '#cf1322' }} /></Card></Col>
                    <Col span={4}><Card><Statistic title="Pendiente" value={dashboard?.summary.total_pending_clp || 0} prefix="$" /></Card></Col>
                  </Row>

                  <Card title="Flujo de caja proyectado (CLP)" style={{ marginBottom: 24 }} size="small">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dashboard?.cashflow_projection || []}>
                        <XAxis dataKey="month" />
                        <YAxis />
                        <RechartsTooltip formatter={(v: number) => `$${v.toLocaleString('es-CL')}`} />
                        <Bar dataKey="expected_amount_clp" fill="#1890ff" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card title="Listo para facturar hoy" size="small" style={{ marginBottom: 24 }}>
                    <Table dataSource={dashboard?.ready_to_invoice || []} columns={dashboardRowColumns} rowKey="id" loading={loading} pagination={false} />
                  </Card>

                  <Card title="Vencido" size="small">
                    <Table dataSource={dashboard?.overdue || []} columns={dashboardRowColumns} rowKey="id" loading={loading} pagination={false} />
                  </Card>
                </>
              )
            },
            {
              key: 'milestones',
              label: 'Hitos de pago',
              children: <Table dataSource={milestones} columns={milestoneColumns} rowKey="id" loading={loading} />
            },
            {
              key: 'invoices',
              label: 'Facturas',
              children: <Table dataSource={invoices} columns={invoiceColumns} rowKey="id" loading={loading} />
            }
          ]}
        />
      </Card>

      <Modal
        title="Nuevo hito de pago"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateMilestone}>
          <Form.Item name="project_id" label="Proyecto" rules={[{ required: true }]}>
            <Select options={projects.map(p => ({ value: p.id, label: p.name }))} />
          </Form.Item>
          <Form.Item name="name" label="Nombre" rules={[{ required: true }]}>
            <Input placeholder="Ej: Anticipo 30%" />
          </Form.Item>
          <Form.Item name="amount" label="Monto" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
          <Form.Item name="currency" label="Moneda" initialValue="CLP" rules={[{ required: true }]}>
            <Select options={[{ value: 'CLP', label: 'CLP' }, { value: 'USD', label: 'USD' }, { value: 'UF', label: 'UF' }]} />
          </Form.Item>
          <Form.Item name="trigger_type" label="Disparador" initialValue="date" rules={[{ required: true }]}>
            <Select options={[
              { value: 'date', label: 'Fecha' },
              { value: 'progress_pct', label: '% de avance' },
              { value: 'deliverable_approved', label: 'Entregable aprobado' }
            ]} />
          </Form.Item>
          <Form.Item name="planned_date" label="Fecha planificada">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BillingPage;
```

- [ ] **Step 4: Agregar la ruta en `frontend/src/App.tsx`**

Agregar el import junto a los demás (después de `import PMODashboard from '@/pages/pmo/PMODashboard';`):

```typescript
import BillingPage from '@/pages/billing/BillingPage';
```

Agregar la ruta dentro del árbol de rutas protegidas, después del bloque `{/* PMO Gantt for specific projects... */}` y antes de `{/* Admin (Team Lead only) */}`:

```tsx
              {/* Billing / Cobranza */}
              <Route path="billing" element={
                <ProtectedRoute requiredRoles={['team_lead', 'rpa_operations']}>
                  <BillingPage />
                </ProtectedRoute>
              } />
```

- [ ] **Step 5: Agregar la entrada de menú y el título de página en `frontend/src/components/common/AppLayout.tsx`**

En `getMenuItems()`, dentro del bloque `if (user?.role === 'team_lead' || user?.role === 'rpa_operations')` que ya agrega `/pmo`, agregar justo después:

```typescript
      baseItems.push({
        key: '/billing',
        icon: <DollarOutlined />,
        label: 'Cobranza'
      });
```

(Verificar que `DollarOutlined` ya está importado desde `@ant-design/icons` en este archivo — si no, agregarlo al import existente.)

En `getPageTitle()`, agregar un `case` junto a los demás:

```typescript
      case '/billing':
        return 'Cobranza';
```

- [ ] **Step 6: Verificación manual**

Run: `cd frontend && npm run dev` (con el backend corriendo en paralelo)
Expected: navegar a `/billing` como usuario `team_lead` muestra la página sin errores de consola; el selector de proyecto filtra; "Nuevo hito de pago" crea un registro visible en la tabla de Hitos de pago.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/billing.ts frontend/src/services/api.ts frontend/src/pages/billing/BillingPage.tsx frontend/src/App.tsx frontend/src/components/common/AppLayout.tsx
git commit -m "feat(fase2): página de Cobranza en frontend (dashboard, hitos, facturas)"
```

---

### Task 7: Tests de frontend para BillingPage

**Files:**
- Test: `frontend/src/__tests__/pages/BillingPage.test.tsx`

**Interfaces:**
- Consumes: `BillingPage` (Task 6), mock de `apiService`.

- [ ] **Step 1: Escribir el test**

```tsx
// frontend/src/__tests__/pages/BillingPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BillingPage from '../../pages/billing/BillingPage';

vi.mock('../../services/api', () => ({
  default: {
    getProjects: vi.fn().mockResolvedValue([{ id: 1, name: 'AGROSUPER' }]),
    getBillingDashboard: vi.fn().mockResolvedValue({
      ready_to_invoice: [],
      invoiced_unpaid: [],
      paid: [],
      overdue: [],
      cashflow_projection: [{ month: '2026-09', expected_amount_clp: 1000000 }],
      summary: { total_pending_clp: 0, total_billable_clp: 500000, total_invoiced_clp: 0, total_paid_clp: 200000, total_overdue_clp: 0 }
    }),
    getPaymentMilestones: vi.fn().mockResolvedValue([]),
    getInvoices: vi.fn().mockResolvedValue([])
  }
}));

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el título Cobranza y los totales del dashboard', async () => {
    render(<BillingPage />);

    expect(await screen.findByText('Cobranza')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Por facturar')).toBeInTheDocument();
      expect(screen.getByText('Cobrado')).toBeInTheDocument();
    });
  });

  it('muestra el botón para crear un nuevo hito de pago', async () => {
    render(<BillingPage />);
    expect(await screen.findByText('Nuevo hito de pago')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla o pasa**

Run: `cd frontend && npm test -- BillingPage`
Expected: si `BillingPage.tsx` ya existe de la Task 6, este test debería pasar directamente (TDD invertido aquí porque la Task 6 ya construyó el componente); si falla, ajustar los textos/selectores del test para que coincidan exactamente con el render real de `BillingPage.tsx` — no ajustar el componente para que coincida con el test.

- [ ] **Step 3: Ejecutar toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/__tests__/pages/BillingPage.test.tsx
git commit -m "test(fase2): tests de BillingPage (dashboard y creación de hitos)"
```

---

## Verificación global de la Fase 2 (a correr al final, no delegar a un task)

1. `cd backend && npm run lint` → 0 errores.
2. `cd backend && npm test` → todo verde, incluyendo `migration29.test.ts`, `billingService.test.ts`, `financeService.roiAlerts.test.ts`, `billingController.test.ts`, `pdfService.test.ts`.
3. `cd frontend && npm run lint` → 0 errores.
4. `cd frontend && npm test` → todo verde, incluyendo `BillingPage.test.tsx`.
5. Manual: crear un proyecto de prueba con 3 hitos de pago (uno `date` con `planned_date` de hoy, uno `progress_pct` vinculado a un `project_milestone` al 50%, uno `deliverable_approved`), llamar `POST /api/billing/evaluate`, y confirmar en `GET /api/billing/dashboard` que el hito de fecha aparece en `ready_to_invoice`.
6. Manual: `GET /api/billing/projects/:id/payment-statement` para un proyecto real descarga un PDF abrible, con montos que coinciden con `GET /api/financial/project-roi/:id`.
7. Manual: confirmar que `roi_alerts` tiene filas reales (`SELECT * FROM roi_alerts`) para al menos un proyecto real tras llamar `GET /api/financial/dashboard` (Task 3, Step 9, ya deja `financialController.getROIDashboard` escribiendo en `roi_alerts` en cada llamada).
