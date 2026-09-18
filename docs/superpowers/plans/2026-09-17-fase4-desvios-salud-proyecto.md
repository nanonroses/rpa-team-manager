# Fase 4 — Desvíos y Salud del Proyecto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el `progress_percentage` manual y el semáforo inexistente por un baseline congelado por proyecto (fechas + presupuesto, inmutable), un avance derivado de los hitos reales (`project_milestones.completion_percentage`), y un cálculo de desvío tipo EVM simplificado (SPI/CPI, semáforo, fecha proyectada de término) que se recalcula siempre en vivo — nunca se inventa un color o un número cuando falta el dato base (baseline o hitos).

**Architecture:** Backend: migración 31 (tabla `project_baselines` + columna `baseline_planned_date` en `project_milestones`) + `backend/src/services/projectHealthService.ts` (mismo patrón que `financeService.ts`/`billingService.ts`: única fuente de verdad, recalcula siempre, nunca persiste SPI/CPI) + dos endpoints nuevos en `projectController.ts`/`projectRoutes.ts` (`POST /:id/baseline`, `GET /:id/health`) + extensión de `pmoController.getProjectGantt` para exponer el baseline junto a los datos ya existentes. Frontend: nuevo componente autocontenido `ProjectHealthCard.tsx` (mismo patrón que `ProjectROICard.tsx`: fetch propio vía `apiService`, sin pasar datos por props) insertado en `ProjectsPage.tsx` y `ProjectDetailPage.tsx`, y una extensión puntual del render de Gantt ya existente en `PMODashboard.tsx` para dibujar el baseline junto a la barra real de cada hito.

Decisión de diseño explícita (ya acordada con el usuario en brainstorming): el baseline se congela **solo a nivel de proyecto e hitos** (`project_milestones`), no a nivel de tareas kanban (`tasks`) — las tareas del kanban no tienen la disciplina de fechas necesaria y cambian constantemente, mientras los hitos sí representan compromisos reales de negocio. El baseline es **inmutable**: se congela una sola vez (`POST /:id/baseline` devuelve 409 si ya existe) y no hay re-baseline en esta fase. Los hitos creados **después** de congelar el baseline quedan con `baseline_planned_date = NULL`: cuentan para el avance actual (EV%) pero quedan fuera del cálculo de SPI (ni ellos ni un baseline inexistente pueden inventar una fecha planificada que nunca existió).

Decisión de diseño explícita sobre roles: el plan maestro (`hace-mucho-tiempo-que-woolly-orbit.md`) menciona roles aspiracionales (`pm`, `area_manager`, `admin`, `finance_viewer`) que **nunca se migraron** — confirmado en Fase 2 y Fase 3, y re-confirmado aquí (`backend/src/database/migrationList.ts`, `CHECK` de `users.role` sigue en `('team_lead', 'rpa_developer', 'rpa_operations', 'it_support')` desde la migración 1, sin alterar). Congelar el baseline es una acción financiera irreversible (afecta SPI/CPI de ahí en adelante) → se restringe a `authorize(['team_lead'])`, el mismo criterio ya usado para `DELETE /api/projects/:id` y `POST /api/projects/:id/assignments`.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente), `date-fns` (ya instalado desde Fase 3, se reutiliza para `differenceInCalendarDays`/`addDays` — nunca aritmética de fechas a mano), React 18/TypeScript/Vite/Ant Design (frontend ya existente, sin dependencias nuevas). No se agrega ninguna librería de Gantt: `PMODashboard.tsx` sigue renderizando el timeline a mano con la misma fórmula de posición en píxeles ya existente.

**Spec:** `C:\Users\nanon\.claude\plans\hace-mucho-tiempo-que-woolly-orbit.md`, sección "Fase 4 — Desvíos y salud del proyecto" (líneas 233-241). El diseño detallado (granularidad del baseline, fórmulas de EV%/PV%/SPI/CPI, umbrales del semáforo) se acordó con el usuario en la conversación de brainstorming previa a este plan — este documento es la única fuente escrita de esas decisiones, no hay spec separado. Contexto adicional: Fase 1 entregó `financeService.ts` como única fuente de cálculo financiero (este plan lo consume vía `calculateProjectFinancials`, nunca lo reimplementa); Fase 3 entregó horas aprobadas como fuente de `real_cost` (ya lo usa `financeService`, este plan hereda ese dato sin tocarlo).

## Global Constraints

- Roles actuales (`backend/src/database/migrationList.ts:15`, `CHECK` de `users.role`): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. No agregar roles nuevos.
- Convención de acceso a BD: `db.query(sql, params)` para múltiples filas, `db.get(sql, params)` para una fila, `db.run(sql, params)` para escritura (devuelve `{ id, changes }`), `db.beginTransaction()`/`db.commit()`/`db.rollback()` para transacciones. Nunca `db.all` (no existe en este wrapper). Ver `backend/src/database/database.ts:578-660`.
- Migraciones: se agregan al final del array `migrations` en `backend/src/database/migrationList.ts`, nunca se editan migraciones ya aplicadas (versiones 1-30 ya existen; la nueva es **versión 31**).
- Controllers nuevos/extendidos siguen el patrón de clase ya usado en `projectController.ts`/`billingController.ts`: `metodo = async (req: AuthenticatedRequest, res: Response): Promise<void> => { try { ... } catch (error) { logger.error(...); res.status(500).json({ error: '...' }); } }`. Import `AuthenticatedRequest` desde `../middleware/auth`.
- Servicios nuevos siguen el patrón de `financeService.ts`/`billingService.ts`: una clase exportada + una instancia singleton exportada (`export const projectHealthService = new ProjectHealthService();`), nunca calculan moneda a mano (usan `financeService.calculateProjectFinancials`).
- Autorización: `GET /api/projects/:id/health` y la extensión de `GET /api/pmo/projects/:id/gantt` son de solo lectura, sin `authorize()` adicional (mismo criterio que el resto de lecturas de proyecto ya existentes, que solo pasan por `authenticate`). `POST /api/projects/:id/baseline` es irreversible → **solo** `authorize(['team_lead'])`, igual que `DELETE /api/projects/:id` (`backend/src/routes/projectRoutes.ts:73-76`) y `POST /api/projects/:id/assignments` (`backend/src/routes/projectRoutes.ts:93`).
- Fechas: siempre `date-fns` (`differenceInCalendarDays`, `addDays`, `format`). Nunca aritmética de fechas a mano con `Date.getTime()`/`getDay()`.
- Montos monetarios: `DECIMAL` en SQLite, siempre en CLP (el baseline congela `budgeted_cost_clp` ya convertido, igual que los snapshots de tarifa de Fase 3 — nunca se reconvierte con el tipo de cambio de hoy).
- Tests backend: mockear `db` completo con `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() } }))`, igual que `backend/src/__tests__/services/billingService.test.ts`. Para mockear `financeService` dentro de un test de servicio, usar `jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({...})` sobre el singleton importado, igual que `backend/src/__tests__/services/financeService.roiAlerts.test.ts:17`. Nunca una base de datos real en tests unitarios de servicios/controllers.
- Tests frontend: Vitest + Testing Library, mockeando `@/services/api` completo con `vi.mock('@/services/api', () => ({ apiService: { ... } }))` y `@/store/authStore` con `vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: {...} }) }))`, igual que `frontend/src/__tests__/pages/TimeTrackingPage.test.tsx`.
- Frontend: servicios centralizados en la clase `ApiService` de `frontend/src/services/api.ts` (patrón: un método por endpoint, `this.api.get/post`). Componentes de tarjeta de proyecto autocontenidos (fetch propio, no reciben los datos por props) en `frontend/src/components/projects/`, siguiendo el patrón exacto de `ProjectROICard.tsx`.
- No tocar `projectController.getProjectGantt` (`backend/src/controllers/projectController.ts:395`, montado en `/api/projects/:id/gantt`): está huérfano, el frontend siempre llama a `/api/pmo/projects/:id/gantt` (`pmoController.getProjectGantt`). La extensión de Gantt de este plan va en `pmoController.ts`, no en `projectController.ts`.

---

## Mapa de archivos

- Modificar: `backend/src/database/migrationList.ts` (append migración 31)
- Crear: `backend/src/__tests__/database/migration31.test.ts`
- Crear: `backend/src/services/projectHealthService.ts`
- Crear: `backend/src/__tests__/services/projectHealthService.test.ts`
- Modificar: `backend/src/controllers/projectController.ts` (agregar `freezeBaseline` y `getProjectHealth`)
- Modificar: `backend/src/routes/projectRoutes.ts` (agregar `POST /:id/baseline`, `GET /:id/health`)
- Crear: `backend/src/__tests__/controllers/projectController.health.test.ts`
- Modificar: `backend/src/controllers/pmoController.ts` (extender `getProjectGantt` con baseline)
- Crear: `backend/src/__tests__/controllers/pmoController.gantt.test.ts`
- Crear: `frontend/src/types/projectHealth.ts`
- Modificar: `frontend/src/services/api.ts` (agregar `freezeProjectBaseline`, `getProjectHealth`)
- Crear: `frontend/src/components/projects/ProjectHealthCard.tsx`
- Crear: `frontend/src/__tests__/components/ProjectHealthCard.test.tsx`
- Modificar: `frontend/src/pages/projects/ProjectsPage.tsx` (insertar `ProjectHealthCard`)
- Modificar: `frontend/src/pages/projects/ProjectDetailPage.tsx` (insertar `ProjectHealthCard`)
- Modificar: `frontend/src/pages/pmo/PMODashboard.tsx` (dibujar baseline en el timeline)

---

### Task 1: Migración 31 — `project_baselines` + `baseline_planned_date`

**Files:**
- Modify: `backend/src/database/migrationList.ts` (append al final del array `migrations`)
- Test: `backend/src/__tests__/database/migration31.test.ts`

**Interfaces:**
- Produces: tabla `project_baselines` (`id, project_id, baseline_date, start_date, end_date, budgeted_cost_clp, budgeted_hours, created_by, created_at`) y columna `baseline_planned_date` (nullable) en `project_milestones`. Todas las tareas siguientes dependen de estos nombres literalmente.

- [ ] **Step 1: Escribir el test que verifica el esquema tras migrar**

```typescript
// backend/src/__tests__/database/migration31.test.ts
import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 31 - project_baselines y baseline_planned_date', () => {
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
        dbPath = path.join(os.tmpdir(), `migration31-test-${Date.now()}.sqlite`);
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

    it('crea project_baselines con las columnas esperadas', async () => {
        const cols = await columnNames('project_baselines');
        expect(cols).toEqual(expect.arrayContaining([
            'id', 'project_id', 'baseline_date', 'start_date', 'end_date',
            'budgeted_cost_clp', 'budgeted_hours', 'created_by', 'created_at'
        ]));
    });

    it('agrega baseline_planned_date a project_milestones', async () => {
        const cols = await columnNames('project_milestones');
        expect(cols).toContain('baseline_planned_date');
    });

    it('rechaza un segundo baseline para el mismo project_id (UNIQUE)', async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO projects (name, start_date, end_date) VALUES ('P1', '2026-01-01', '2026-06-01')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO project_baselines (project_id, start_date, end_date, budgeted_cost_clp, budgeted_hours, created_by)
                 VALUES (1, '2026-01-01', '2026-06-01', 1000000, 100, 1)`,
                (err) => err ? reject(err) : resolve()
            );
        });

        const secondInsertError: Error | null = await new Promise((resolve) => {
            db.run(
                `INSERT INTO project_baselines (project_id, start_date, end_date, budgeted_cost_clp, budgeted_hours, created_by)
                 VALUES (1, '2026-01-01', '2026-06-01', 1000000, 100, 1)`,
                (err) => resolve(err)
            );
        });

        expect(secondInsertError).not.toBeNull();
        expect(secondInsertError!.message).toContain('UNIQUE');
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest database/migration31.test.ts -v`
Expected: FAIL — `project_baselines` no existe / `baseline_planned_date` no está en `project_milestones`.

- [ ] **Step 3: Agregar la migración 31**

Al final del array `migrations` en `backend/src/database/migrationList.ts` (después del objeto `version: 30`):

```typescript
  {
    version: 31,
    description: 'Agregar project_baselines y baseline_planned_date en project_milestones (Fase 4 - desvíos y salud del proyecto)',
    up: [
      `CREATE TABLE IF NOT EXISTS project_baselines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL UNIQUE,
        baseline_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        budgeted_cost_clp DECIMAL(12,2) NOT NULL DEFAULT 0,
        budgeted_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_project_baselines_project ON project_baselines(project_id)`,

      `ALTER TABLE project_milestones ADD COLUMN baseline_planned_date DATE`
    ]
  },
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest database/migration31.test.ts -v`
Expected: PASS — 3 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration31.test.ts
git commit -m "feat(fase4): migración 31 - project_baselines y baseline_planned_date"
```

---

### Task 2: `projectHealthService.freezeBaseline` — congelar el baseline

**Files:**
- Create: `backend/src/services/projectHealthService.ts`
- Test: `backend/src/__tests__/services/projectHealthService.test.ts`

**Interfaces:**
- Consumes: `financeService.calculateProjectFinancials(projectId): Promise<ProjectFinancials>` (ya existente, `planned_cost`/`planned_hours`), `db.get/run/query/beginTransaction/commit/rollback` (`backend/src/database/database.ts`).
- Produces: `export interface ProjectBaseline { id: number; project_id: number; baseline_date: string; start_date: string; end_date: string; budgeted_cost_clp: number; budgeted_hours: number; created_by: number; created_at: string; }` y `export class ProjectHealthService { async freezeBaseline(projectId: number, userId: number): Promise<ProjectBaseline> }`. Lanza `Error('PROJECT_NOT_FOUND')`, `Error('PROJECT_MISSING_DATES')` o `Error('BASELINE_ALREADY_EXISTS')` — Task 4 depende de estos mensajes literales para mapear códigos HTTP. Task 3 depende de la instancia singleton `export const projectHealthService = new ProjectHealthService();` en este mismo archivo.

- [ ] **Step 1: Escribir los tests que verifican `freezeBaseline`**

```typescript
// backend/src/__tests__/services/projectHealthService.test.ts
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn()
    }
}));

import { db } from '../../database/database';
import { financeService } from '../../services/financeService';
import { ProjectHealthService } from '../../services/projectHealthService';

describe('ProjectHealthService.freezeBaseline', () => {
    let service: ProjectHealthService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectHealthService();
    });

    it('lanza PROJECT_NOT_FOUND si el proyecto no existe', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce(null);

        await expect(service.freezeBaseline(999, 1)).rejects.toThrow('PROJECT_NOT_FOUND');
    });

    it('lanza PROJECT_MISSING_DATES si el proyecto no tiene start_date/end_date', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 1, start_date: null, end_date: '2026-06-01' });

        await expect(service.freezeBaseline(1, 1)).rejects.toThrow('PROJECT_MISSING_DATES');
    });

    it('lanza BASELINE_ALREADY_EXISTS si ya hay un baseline para el proyecto', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, start_date: '2026-01-01', end_date: '2026-06-01' })
            .mockResolvedValueOnce({ id: 5 });

        await expect(service.freezeBaseline(1, 1)).rejects.toThrow('BASELINE_ALREADY_EXISTS');
    });

    it('congela el baseline y copia planned_date a baseline_planned_date en los hitos', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, start_date: '2026-01-01', end_date: '2026-06-01' }) // proyecto
            .mockResolvedValueOnce(null) // no hay baseline previo
            .mockResolvedValueOnce({ // baseline recién insertado, para el SELECT final
                id: 1, project_id: 1, baseline_date: '2026-09-17', start_date: '2026-01-01',
                end_date: '2026-06-01', budgeted_cost_clp: 5000000, budgeted_hours: 400,
                created_by: 1, created_at: '2026-09-17'
            });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            planned_cost: 5000000, planned_hours: 400
        } as any);
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        const result = await service.freezeBaseline(1, 1);

        expect(db.beginTransaction).toHaveBeenCalled();
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO project_baselines'),
            [1, '2026-01-01', '2026-06-01', 5000000, 400, 1]
        );
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE project_milestones SET baseline_planned_date = planned_date'),
            [1]
        );
        expect(db.commit).toHaveBeenCalled();
        expect(result.budgeted_cost_clp).toBe(5000000);
    });

    it('hace rollback si la escritura falla', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, start_date: '2026-01-01', end_date: '2026-06-01' })
            .mockResolvedValueOnce(null);
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            planned_cost: 5000000, planned_hours: 400
        } as any);
        (db.run as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

        await expect(service.freezeBaseline(1, 1)).rejects.toThrow('disk full');
        expect(db.rollback).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest services/projectHealthService.test.ts -v`
Expected: FAIL — `Cannot find module '../../services/projectHealthService'`.

- [ ] **Step 3: Implementar `freezeBaseline`**

```typescript
// backend/src/services/projectHealthService.ts
import { db } from '../database/database';
import { financeService } from './financeService';

export interface ProjectBaseline {
    id: number;
    project_id: number;
    baseline_date: string;
    start_date: string;
    end_date: string;
    budgeted_cost_clp: number;
    budgeted_hours: number;
    created_by: number;
    created_at: string;
}

/**
 * Única fuente de verdad para el baseline y la salud (SPI/CPI/semáforo) de un proyecto.
 * El baseline se congela una sola vez (inmutable); la salud se recalcula siempre en vivo.
 */
export class ProjectHealthService {
    async freezeBaseline(projectId: number, userId: number): Promise<ProjectBaseline> {
        const project = await db.get(
            `SELECT id, start_date, end_date FROM projects WHERE id = ?`,
            [projectId]
        );
        if (!project) {
            throw new Error('PROJECT_NOT_FOUND');
        }
        if (!project.start_date || !project.end_date) {
            throw new Error('PROJECT_MISSING_DATES');
        }

        const existing = await db.get(
            `SELECT id FROM project_baselines WHERE project_id = ?`,
            [projectId]
        );
        if (existing) {
            throw new Error('BASELINE_ALREADY_EXISTS');
        }

        const financials = await financeService.calculateProjectFinancials(projectId);

        await db.beginTransaction();
        try {
            await db.run(
                `INSERT INTO project_baselines (project_id, start_date, end_date, budgeted_cost_clp, budgeted_hours, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [projectId, project.start_date, project.end_date, financials.planned_cost, financials.planned_hours, userId]
            );

            await db.run(
                `UPDATE project_milestones SET baseline_planned_date = planned_date WHERE project_id = ?`,
                [projectId]
            );

            await db.commit();
        } catch (error) {
            await db.rollback();
            throw error;
        }

        return db.get(`SELECT * FROM project_baselines WHERE project_id = ?`, [projectId]);
    }
}

export const projectHealthService = new ProjectHealthService();
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest services/projectHealthService.test.ts -v`
Expected: PASS — 5 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/projectHealthService.ts backend/src/__tests__/services/projectHealthService.test.ts
git commit -m "feat(fase4): projectHealthService.freezeBaseline congela baseline de proyecto e hitos"
```

---

### Task 3: `projectHealthService.getProjectHealth` — EV%/PV%/SPI/CPI/semáforo/fecha proyectada

**Files:**
- Modify: `backend/src/services/projectHealthService.ts`
- Modify: `backend/src/__tests__/services/projectHealthService.test.ts`

**Interfaces:**
- Consumes: `db.get/query`, `financeService.calculateProjectFinancials` (`real_cost`), `date-fns` (`differenceInCalendarDays`, `addDays`).
- Produces: `export interface ProjectHealth { project_id: number; has_baseline: boolean; status: 'insufficient_data' | 'ok'; ev_percentage: number; pv_percentage: number | null; spi: number | null; cpi: number | null; semaphore: 'green' | 'yellow' | 'red' | 'gray'; projected_end_date: string | null; schedule_variance_days: number | null; }` y `async getProjectHealth(projectId: number): Promise<ProjectHealth>` en `ProjectHealthService`. Task 4 (`GET /:id/health`) devuelve este objeto tal cual.

- [ ] **Step 1: Agregar los tests de `getProjectHealth`**

Agregar dentro del mismo `describe('ProjectHealthService.freezeBaseline', ...)` un segundo bloque en `backend/src/__tests__/services/projectHealthService.test.ts` (después del `describe` existente, mismo archivo):

```typescript
describe('ProjectHealthService.getProjectHealth', () => {
    let service: ProjectHealthService;
    const TODAY = '2026-09-17';

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectHealthService();
        jest.useFakeTimers().setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('devuelve insufficient_data si el proyecto no tiene baseline', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 50, baseline_planned_date: null }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce(null); // sin baseline

        const health = await service.getProjectHealth(1);

        expect(health.status).toBe('insufficient_data');
        expect(health.has_baseline).toBe(false);
        expect(health.semaphore).toBe('gray');
        expect(health.spi).toBeNull();
        expect(health.cpi).toBeNull();
        expect(health.ev_percentage).toBe(50);
    });

    it('devuelve insufficient_data si el baseline no tiene ningún hito con baseline_planned_date', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 0, baseline_planned_date: null }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce({
            id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 5000000
        });

        const health = await service.getProjectHealth(1);

        expect(health.status).toBe('insufficient_data');
        expect(health.has_baseline).toBe(true);
        expect(health.semaphore).toBe('gray');
    });

    it('calcula SPI<1 y semáforo rojo cuando los hitos van atrasados', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 100, baseline_planned_date: '2026-01-01' }, // a tiempo
            { completion_percentage: 0, baseline_planned_date: '2026-02-01' },   // debía estar listo, no lo está
            { completion_percentage: 0, baseline_planned_date: '2026-12-01' }    // futuro, no cuenta en PV
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 6000000 })
            .mockResolvedValueOnce({ status: 'active', actual_end_date: null });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            real_cost: 4000000
        } as any);

        const health = await service.getProjectHealth(1);

        // EV% = (100+0+0)/3 = 33.33 ; PV% = 2 de 3 hitos con baseline_planned_date <= hoy => 66.67
        expect(health.status).toBe('ok');
        expect(health.ev_percentage).toBeCloseTo(33.33, 1);
        expect(health.pv_percentage).toBeCloseTo(66.67, 1);
        expect(health.spi).toBeLessThan(1);
        expect(health.semaphore).toBe('red');
        expect(health.projected_end_date).not.toBeNull();
        expect(health.schedule_variance_days).toBeGreaterThan(0);
    });

    it('usa actual_end_date en vez de proyectar cuando el proyecto ya está completed', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 100, baseline_planned_date: '2026-01-01' }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 6000000 })
            .mockResolvedValueOnce({ status: 'completed', actual_end_date: '2026-07-01' });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            real_cost: 6000000
        } as any);

        const health = await service.getProjectHealth(1);

        expect(health.projected_end_date).toBe('2026-07-01');
        expect(health.schedule_variance_days).toBe(30);
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest services/projectHealthService.test.ts -v`
Expected: FAIL — `service.getProjectHealth is not a function`.

- [ ] **Step 3: Implementar `getProjectHealth`**

Agregar al final de `backend/src/database/../services/projectHealthService.ts`, dentro de la clase `ProjectHealthService` (después de `freezeBaseline`), y agregar el import de `date-fns` arriba del archivo:

```typescript
// Agregar en el import existente:
import { differenceInCalendarDays, addDays } from 'date-fns';

// Agregar junto a ProjectBaseline:
export interface ProjectHealth {
    project_id: number;
    has_baseline: boolean;
    status: 'insufficient_data' | 'ok';
    ev_percentage: number;
    pv_percentage: number | null;
    spi: number | null;
    cpi: number | null;
    semaphore: 'green' | 'yellow' | 'red' | 'gray';
    projected_end_date: string | null;
    schedule_variance_days: number | null;
}
```

Dentro de la clase, después de `freezeBaseline`:

```typescript
    async getProjectHealth(projectId: number): Promise<ProjectHealth> {
        const milestones = await db.query(
            `SELECT completion_percentage, baseline_planned_date FROM project_milestones WHERE project_id = ?`,
            [projectId]
        );

        const evPercentage = milestones.length > 0
            ? milestones.reduce((sum: number, m: any) => sum + (m.completion_percentage || 0), 0) / milestones.length
            : 0;

        const baseline = await db.get(`SELECT * FROM project_baselines WHERE project_id = ?`, [projectId]);
        const baselineMilestones = milestones.filter((m: any) => m.baseline_planned_date !== null);

        if (!baseline || baselineMilestones.length === 0) {
            return {
                project_id: projectId,
                has_baseline: !!baseline,
                status: 'insufficient_data',
                ev_percentage: Math.round(evPercentage * 100) / 100,
                pv_percentage: null,
                spi: null,
                cpi: null,
                semaphore: 'gray',
                projected_end_date: null,
                schedule_variance_days: null
            };
        }

        const today = new Date().toISOString().slice(0, 10);
        const dueCount = baselineMilestones.filter((m: any) => m.baseline_planned_date <= today).length;
        const pvPercentage = (dueCount / baselineMilestones.length) * 100;

        const financials = await financeService.calculateProjectFinancials(projectId);
        const evDollars = (evPercentage / 100) * baseline.budgeted_cost_clp;

        const spi = pvPercentage > 0
            ? evPercentage / pvPercentage
            : (evPercentage > 0 ? 2 : 1);

        const cpi = financials.real_cost > 0
            ? evDollars / financials.real_cost
            : (evDollars > 0 ? 2 : 1);

        const project = await db.get(`SELECT status, actual_end_date FROM projects WHERE id = ?`, [projectId]);

        let projectedEndDate: string;
        let scheduleVarianceDays: number;

        if (project?.status === 'completed' && project.actual_end_date) {
            projectedEndDate = project.actual_end_date;
            scheduleVarianceDays = differenceInCalendarDays(
                new Date(project.actual_end_date),
                new Date(baseline.end_date)
            );
        } else {
            const baselineDurationDays = differenceInCalendarDays(
                new Date(baseline.end_date),
                new Date(baseline.start_date)
            );
            const effectiveSpi = spi > 0 ? spi : 0.01;
            const projectedDurationDays = Math.round(baselineDurationDays / effectiveSpi);
            const projectedEnd = addDays(new Date(baseline.start_date), projectedDurationDays);
            projectedEndDate = projectedEnd.toISOString().slice(0, 10);
            scheduleVarianceDays = differenceInCalendarDays(projectedEnd, new Date(baseline.end_date));
        }

        return {
            project_id: projectId,
            has_baseline: true,
            status: 'ok',
            ev_percentage: Math.round(evPercentage * 100) / 100,
            pv_percentage: Math.round(pvPercentage * 100) / 100,
            spi: Math.round(spi * 100) / 100,
            cpi: Math.round(cpi * 100) / 100,
            semaphore: this.classifySemaphore(spi, cpi),
            projected_end_date: projectedEndDate,
            schedule_variance_days: scheduleVarianceDays
        };
    }

    private classifySemaphore(spi: number, cpi: number): 'green' | 'yellow' | 'red' {
        const classify = (value: number): 'green' | 'yellow' | 'red' =>
            value >= 1.0 ? 'green' : value >= 0.9 ? 'yellow' : 'red';

        const scheduleColor = classify(spi);
        const costColor = classify(cpi);

        if (scheduleColor === 'red' || costColor === 'red') return 'red';
        if (scheduleColor === 'yellow' || costColor === 'yellow') return 'yellow';
        return 'green';
    }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest services/projectHealthService.test.ts -v`
Expected: PASS — 9 tests verdes en total (5 de `freezeBaseline` + 4 de `getProjectHealth`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/projectHealthService.ts backend/src/__tests__/services/projectHealthService.test.ts
git commit -m "feat(fase4): projectHealthService.getProjectHealth calcula EV/PV/SPI/CPI/semaforo"
```

---

### Task 4: Endpoints `POST /api/projects/:id/baseline` y `GET /api/projects/:id/health`

**Files:**
- Modify: `backend/src/controllers/projectController.ts`
- Modify: `backend/src/routes/projectRoutes.ts`
- Test: `backend/src/__tests__/controllers/projectController.health.test.ts`

**Interfaces:**
- Consumes: `projectHealthService.freezeBaseline(projectId, userId)`, `projectHealthService.getProjectHealth(projectId)` (Task 2/3).
- Produces: `POST /api/projects/:id/baseline` (201 con el `ProjectBaseline`, 404/400/409 según el error, `authorize(['team_lead'])`), `GET /api/projects/:id/health` (200 con `ProjectHealth`, sin `authorize()` adicional). Task 5 (frontend `api.ts`) depende de estas rutas y formas de respuesta literalmente.

- [ ] **Step 1: Escribir los tests de los dos endpoints**

```typescript
// backend/src/__tests__/controllers/projectController.health.test.ts
jest.mock('../../services/projectHealthService', () => ({
    projectHealthService: {
        freezeBaseline: jest.fn(),
        getProjectHealth: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { projectHealthService } from '../../services/projectHealthService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - baseline y health', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    describe('freezeBaseline', () => {
        it('devuelve 201 con el baseline creado', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockResolvedValue({ id: 1, project_id: 7 });
            const req = { params: { id: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(projectHealthService.freezeBaseline).toHaveBeenCalledWith(7, 3);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 1, project_id: 7 });
        });

        it('devuelve 404 si el proyecto no existe', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockRejectedValue(new Error('PROJECT_NOT_FOUND'));
            const req = { params: { id: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 400 si el proyecto no tiene fechas', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockRejectedValue(new Error('PROJECT_MISSING_DATES'));
            const req = { params: { id: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('devuelve 409 si ya existe un baseline', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockRejectedValue(new Error('BASELINE_ALREADY_EXISTS'));
            const req = { params: { id: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
        });
    });

    describe('getProjectHealth', () => {
        it('devuelve 200 con la salud del proyecto', async () => {
            (projectHealthService.getProjectHealth as jest.Mock).mockResolvedValue({
                project_id: 7, status: 'ok', semaphore: 'green'
            });
            const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectHealth(req, res);

            expect(projectHealthService.getProjectHealth).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith({ project_id: 7, status: 'ok', semaphore: 'green' });
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest controllers/projectController.health.test.ts -v`
Expected: FAIL — `controller.freezeBaseline is not a function`.

- [ ] **Step 3: Implementar los dos métodos en `projectController.ts`**

Agregar el import y los dos métodos dentro de la clase `ProjectController` (junto al resto de métodos existentes, p. ej. después de `getProjectGantt`):

```typescript
// Agregar junto a los imports existentes de projectController.ts:
import { projectHealthService } from '../services/projectHealthService';
```

```typescript
    // POST /api/projects/:id/baseline
    freezeBaseline = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const baseline = await projectHealthService.freezeBaseline(projectId, req.user!.id);
            res.status(201).json(baseline);
        } catch (error) {
            const message = (error as Error).message;
            if (message === 'PROJECT_NOT_FOUND') {
                res.status(404).json({ error: 'Project not found' });
            } else if (message === 'PROJECT_MISSING_DATES') {
                res.status(400).json({ error: 'Project must have start_date and end_date before freezing a baseline' });
            } else if (message === 'BASELINE_ALREADY_EXISTS') {
                res.status(409).json({ error: 'Baseline already exists for this project' });
            } else {
                logger.error('Freeze baseline error:', error);
                res.status(500).json({ error: 'Failed to freeze baseline' });
            }
        }
    };

    // GET /api/projects/:id/health
    getProjectHealth = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const health = await projectHealthService.getProjectHealth(projectId);
            res.json(health);
        } catch (error) {
            logger.error('Get project health error:', error);
            res.status(500).json({ error: 'Failed to get project health' });
        }
    };
```

Agregar las dos rutas en `backend/src/routes/projectRoutes.ts`, después de la línea `router.get('/:id/gantt', projectController.getProjectGantt);`:

```typescript
// GET /api/projects/:id/health - Derived progress, SPI/CPI, semaphore
router.get('/:id/health', projectController.getProjectHealth);

// POST /api/projects/:id/baseline - Freeze project baseline (irreversible, team_lead only)
router.post('/:id/baseline', authorize(['team_lead']), projectController.freezeBaseline);
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest controllers/projectController.health.test.ts -v`
Expected: PASS — 5 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.health.test.ts
git commit -m "feat(fase4): endpoints POST /projects/:id/baseline y GET /projects/:id/health"
```

---

### Task 5: Extender `pmoController.getProjectGantt` con el baseline

**Files:**
- Modify: `backend/src/controllers/pmoController.ts` (función `getProjectGantt`, alrededor de la línea 126)
- Test: `backend/src/__tests__/controllers/pmoController.gantt.test.ts`

**Interfaces:**
- Consumes: tabla `project_baselines` (Task 1), columna `project_milestones.baseline_planned_date` (Task 1).
- Produces: el JSON de `GET /api/pmo/projects/:id/gantt` gana un campo `project.baseline` (`{ start_date, end_date, budgeted_cost_clp } | null`) y cada elemento de `milestones[]` gana `baseline_planned_date`. Task 6 (frontend `PMODashboard.tsx`) depende de estos dos campos literalmente.

- [ ] **Step 1: Escribir el test de la extensión**

```typescript
// backend/src/__tests__/controllers/pmoController.gantt.test.ts
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { PMOController } from '../../controllers/pmoController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('PMOController.getProjectGantt - baseline', () => {
    let controller: PMOController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new PMOController();
    });

    it('incluye project.baseline y milestone.baseline_planned_date cuando existe un baseline', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 7, name: 'AGROSUPER' }) // proyecto
            .mockResolvedValueOnce({ // baseline
                start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 5000000
            });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM tasks')) return Promise.resolve([]);
            if (sql.includes('FROM project_milestones')) {
                return Promise.resolve([
                    { id: 1, planned_date: '2026-02-01', baseline_planned_date: '2026-02-01', status: 'completed' }
                ]);
            }
            if (sql.includes('project_dependencies')) return Promise.resolve([]);
            if (sql.includes('task_dependencies')) return Promise.resolve([]);
            return Promise.resolve([]);
        });

        const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectGantt(req, res);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.project.baseline).toEqual({
            start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 5000000
        });
        expect(payload.milestones[0].baseline_planned_date).toBe('2026-02-01');
    });

    it('devuelve project.baseline = null cuando el proyecto no tiene baseline', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 7, name: 'AGROSUPER' })
            .mockResolvedValueOnce(null);
        (db.query as jest.Mock).mockResolvedValue([]);

        const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectGantt(req, res);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.project.baseline).toBeNull();
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest controllers/pmoController.gantt.test.ts -v`
Expected: FAIL — `payload.project.baseline` es `undefined`.

- [ ] **Step 3: Extender `getProjectGantt`**

En `backend/src/controllers/pmoController.ts`, dentro de `getProjectGantt`, agregar después de la consulta de `milestones` (después del bloque que termina en `logger.info(\`Found ${milestones.length} milestones\`);`, alrededor de la línea 210) la carga del baseline:

```typescript
            // Get project baseline (Fase 4 - puede no existir todavía)
            const baseline = await db.get(
                `SELECT start_date, end_date, budgeted_cost_clp FROM project_baselines WHERE project_id = ?`,
                [id]
            );
```

Modificar la construcción de `projectWithCompletion` (línea ~261) para incluir el baseline:

```typescript
            const projectWithCompletion = {
                ...project,
                completion_percentage: calculatedCompletion,
                baseline: baseline || null
            };
```

`milestones` ya trae `baseline_planned_date` sin cambios adicionales, porque la consulta existente usa `m.*` (`SELECT m.*, u.full_name as responsible_name FROM project_milestones m ...`) y esa columna ya forma parte de `project_milestones` desde la migración 31 — no requiere tocar el `SELECT`.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest controllers/pmoController.gantt.test.ts -v`
Expected: PASS — 2 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/pmoController.ts backend/src/__tests__/controllers/pmoController.gantt.test.ts
git commit -m "feat(fase4): getProjectGantt expone baseline de proyecto e hitos"
```

---

### Task 6: Frontend — tipos y métodos de API

**Files:**
- Create: `frontend/src/types/projectHealth.ts`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Produces: `export interface ProjectHealth { ... }` (mismos campos que el backend, Task 3) y `export interface ProjectBaseline { ... }` en `frontend/src/types/projectHealth.ts`; `apiService.getProjectHealth(projectId: number): Promise<ProjectHealth>` y `apiService.freezeProjectBaseline(projectId: number): Promise<ProjectBaseline>` en `frontend/src/services/api.ts`. Task 7 depende de estos dos métodos y tipos literalmente.

No hay TDD de tipos/HTTP puro aquí (no hay lógica que probar de forma aislada sin un componente que la consuma) — este task es la única excepción sin test propio del plan; su cobertura llega vía el test de `ProjectHealthCard` en Task 7.

- [ ] **Step 1: Crear los tipos**

```typescript
// frontend/src/types/projectHealth.ts
export interface ProjectBaseline {
  id: number;
  project_id: number;
  baseline_date: string;
  start_date: string;
  end_date: string;
  budgeted_cost_clp: number;
  budgeted_hours: number;
  created_by: number;
  created_at: string;
}

export interface ProjectHealth {
  project_id: number;
  has_baseline: boolean;
  status: 'insufficient_data' | 'ok';
  ev_percentage: number;
  pv_percentage: number | null;
  spi: number | null;
  cpi: number | null;
  semaphore: 'green' | 'yellow' | 'red' | 'gray';
  projected_end_date: string | null;
  schedule_variance_days: number | null;
}
```

- [ ] **Step 2: Agregar los métodos a `ApiService`**

En `frontend/src/services/api.ts`, agregar junto a `getProjectROI` (línea ~360):

```typescript
  async getProjectHealth(projectId: number): Promise<ProjectHealth> {
    const response = await this.api.get(`/projects/${projectId}/health`);
    return response.data;
  }

  async freezeProjectBaseline(projectId: number): Promise<ProjectBaseline> {
    const response = await this.api.post(`/projects/${projectId}/baseline`);
    return response.data;
  }
```

Agregar el import correspondiente arriba del archivo, junto a los demás imports de `types`:

```typescript
import { ProjectHealth, ProjectBaseline } from '../types/projectHealth';
```

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `projectHealth`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/projectHealth.ts frontend/src/services/api.ts
git commit -m "feat(fase4): tipos y metodos de API para project health y baseline"
```

---

### Task 7: Frontend — `ProjectHealthCard.tsx`

**Files:**
- Create: `frontend/src/components/projects/ProjectHealthCard.tsx`
- Test: `frontend/src/__tests__/components/ProjectHealthCard.test.tsx`
- Modify: `frontend/src/pages/projects/ProjectsPage.tsx`
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx`

**Interfaces:**
- Consumes: `apiService.getProjectHealth`, `apiService.freezeProjectBaseline` (Task 6), `useAuthStore` (`user.role`).
- Produces: `export const ProjectHealthCard: React.FC<{ projectId: number }>`. Se monta en `ProjectsPage.tsx` (junto a `ProjectROICard`) y en `ProjectDetailPage.tsx` (junto a `ProjectROICard`).

- [ ] **Step 1: Escribir el test del componente**

```typescript
// frontend/src/__tests__/components/ProjectHealthCard.test.tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectHealth: vi.fn(),
    freezeProjectBaseline: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'team_lead', full_name: 'PM Uno' } })
}));

import { apiService } from '@/services/api';
import { ProjectHealthCard } from '@/components/projects/ProjectHealthCard';

describe('ProjectHealthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el semáforo y SPI/CPI cuando la salud está ok', async () => {
    (apiService.getProjectHealth as any).mockResolvedValue({
      project_id: 1, has_baseline: true, status: 'ok',
      ev_percentage: 40, pv_percentage: 60, spi: 0.67, cpi: 0.9,
      semaphore: 'red', projected_end_date: '2026-08-01', schedule_variance_days: 45
    });

    render(<ProjectHealthCard projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/SPI/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/0.67/)).toBeInTheDocument();
  });

  it('muestra el botón "Congelar baseline" para team_lead cuando no hay baseline, y lo llama al hacer click', async () => {
    (apiService.getProjectHealth as any).mockResolvedValue({
      project_id: 1, has_baseline: false, status: 'insufficient_data',
      ev_percentage: 0, pv_percentage: null, spi: null, cpi: null,
      semaphore: 'gray', projected_end_date: null, schedule_variance_days: null
    });
    (apiService.freezeProjectBaseline as any).mockResolvedValue({ id: 1, project_id: 1 });

    render(<ProjectHealthCard projectId={1} />);

    const button = await screen.findByRole('button', { name: /congelar baseline/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiService.freezeProjectBaseline).toHaveBeenCalledWith(1);
    });
  });

  it('no muestra el botón "Congelar baseline" si ya existe un baseline', async () => {
    (apiService.getProjectHealth as any).mockResolvedValue({
      project_id: 1, has_baseline: true, status: 'insufficient_data',
      ev_percentage: 0, pv_percentage: null, spi: null, cpi: null,
      semaphore: 'gray', projected_end_date: null, schedule_variance_days: null
    });

    render(<ProjectHealthCard projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/sin datos suficientes/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /congelar baseline/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectHealthCard.test.tsx`
Expected: FAIL — no se puede resolver `@/components/projects/ProjectHealthCard`.

- [ ] **Step 3: Implementar `ProjectHealthCard.tsx`**

```typescript
// frontend/src/components/projects/ProjectHealthCard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Tag, Statistic, Row, Col, Button, Typography, message } from 'antd';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { ProjectHealth } from '@/types/projectHealth';

const { Text } = Typography;

const SEMAPHORE_LABEL: Record<ProjectHealth['semaphore'], string> = {
  green: 'En curso',
  yellow: 'En riesgo',
  red: 'Desviado',
  gray: 'Sin datos'
};

const SEMAPHORE_COLOR: Record<ProjectHealth['semaphore'], string> = {
  green: 'green',
  yellow: 'orange',
  red: 'red',
  gray: 'default'
};

interface ProjectHealthCardProps {
  projectId: number;
}

export const ProjectHealthCard: React.FC<ProjectHealthCardProps> = ({ projectId }) => {
  const [health, setHealth] = useState<ProjectHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [freezing, setFreezing] = useState(false);
  const { user } = useAuthStore();

  const loadHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjectHealth(projectId);
      setHealth(data);
    } catch (error) {
      message.error('No se pudo cargar la salud del proyecto');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleFreezeBaseline = async () => {
    try {
      setFreezing(true);
      await apiService.freezeProjectBaseline(projectId);
      message.success('Baseline congelado');
      await loadHealth();
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'No se pudo congelar el baseline');
    } finally {
      setFreezing(false);
    }
  };

  if (loading || !health) {
    return <Card loading title="Salud del proyecto" />;
  }

  return (
    <Card title="Salud del proyecto" size="small">
      <Tag color={SEMAPHORE_COLOR[health.semaphore]} style={{ marginBottom: 12 }}>
        {SEMAPHORE_LABEL[health.semaphore]}
      </Tag>

      {health.status === 'insufficient_data' ? (
        <>
          <Text type="secondary">
            Sin datos suficientes para calcular desvío (falta baseline o hitos con fecha planificada).
          </Text>
          {user?.role === 'team_lead' && !health.has_baseline && (
            <div style={{ marginTop: 12 }}>
              <Button type="primary" loading={freezing} onClick={handleFreezeBaseline}>
                Congelar baseline
              </Button>
            </div>
          )}
        </>
      ) : (
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="Avance" value={health.ev_percentage} suffix="%" />
          </Col>
          <Col span={6}>
            <Statistic title="SPI" value={health.spi ?? 0} precision={2} />
          </Col>
          <Col span={6}>
            <Statistic title="CPI" value={health.cpi ?? 0} precision={2} />
          </Col>
          <Col span={6}>
            <Statistic
              title="Fin proyectado"
              value={health.projected_end_date ?? '-'}
              valueStyle={{ fontSize: 14 }}
            />
          </Col>
        </Row>
      )}
    </Card>
  );
};
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectHealthCard.test.tsx`
Expected: PASS — 3 tests verdes.

- [ ] **Step 5: Insertar `ProjectHealthCard` en `ProjectsPage.tsx` y `ProjectDetailPage.tsx`**

En `frontend/src/pages/projects/ProjectsPage.tsx`, agregar el import y colocarlo junto a `ProjectROICard` (líneas 306-312):

```typescript
import { ProjectHealthCard } from '@/components/projects/ProjectHealthCard';
```

```typescript
                {user?.role === 'team_lead' && (
                  <ProjectROICard
                    projectId={project.id}
                    projectName={project.name}
                    assignedUserId={project.assigned_to}
                  />
                )}
                <ProjectHealthCard projectId={project.id} />
```

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, agregar el import y colocarlo justo después del bloque de `ProjectROICard` (después de la línea 476, antes del comentario `{/* PMO Quick Actions */}`):

```typescript
import { ProjectHealthCard } from '@/components/projects/ProjectHealthCard';
```

```typescript
                    <ProjectHealthCard projectId={project.id} />
```

- [ ] **Step 6: Verificar manualmente en el navegador**

Levantar `cd backend && npm run dev` y `cd frontend && npm run dev`, entrar como `team_lead`, abrir `/projects` y confirmar que cada card muestra "Salud del proyecto" con el tag "Sin datos" y el botón "Congelar baseline" (los 5 proyectos reales no tienen baseline todavía). Click en el botón y confirmar que pasa a mostrar Avance/SPI/CPI/Fin proyectado.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/projects/ProjectHealthCard.tsx frontend/src/__tests__/components/ProjectHealthCard.test.tsx frontend/src/pages/projects/ProjectsPage.tsx frontend/src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat(fase4): ProjectHealthCard con semaforo y boton congelar baseline"
```

---

### Task 8: Frontend — baseline en el Gantt de `PMODashboard.tsx`

**Files:**
- Modify: `frontend/src/pages/pmo/PMODashboard.tsx`

**Interfaces:**
- Consumes: `ganttData.project.baseline` y `ganttData.milestones[].baseline_planned_date` (Task 5), ambos ya presentes en el objeto `any` que devuelve `useGanttData` sin cambios de tipo necesarios.

No hay test unitario nuevo en este task: `PMODashboard.tsx` no tiene suite de tests hoy (no existe ningún `.test.tsx` para ese archivo en el repo) y agregar la primera suite de un componente de &gt;2900 líneas está fuera del alcance de esta fase — la verificación es manual (Step 3).

- [ ] **Step 1: Ubicar el bloque de render del timeline de cada milestone**

En `frontend/src/pages/pmo/PMODashboard.tsx`, dentro del `.map((item: any, index: number) => { ... })` del panel derecho del timeline (alrededor de la línea 2697-2709, el mismo bloque que calcula `startDate`, `endDate`, `daysSinceToday`, `durationDays` para posicionar la barra actual), agregar el cálculo de la posición del baseline **antes** del `return` de ese `.map` (justo después de la línea que calcula `durationDays`):

```typescript
                          const baselinePlannedDate = item.type === 'milestone' && item.baseline_planned_date
                            ? dayjs(item.baseline_planned_date)
                            : null;
                          const baselineDaysSinceToday = baselinePlannedDate ? baselinePlannedDate.diff(dayjs(), 'day') : null;
                          const baselineLeftPosition = baselineDaysSinceToday !== null ? Math.max(0, baselineDaysSinceToday * 30) : null;
```

- [ ] **Step 2: Dibujar la marca de baseline junto a la barra real**

Inmediatamente antes del cierre de ese `.map` (donde hoy se renderiza la barra real del item, ubicar el `<div>` que usa `leftPosition`/`durationDays` para la barra — está a continuación del bloque leído en el Step 1), agregar un marcador de baseline como hermano de esa barra:

```typescript
                          {baselineLeftPosition !== null && (
                            <div
                              title={`Baseline: ${baselinePlannedDate!.format('DD/MM/YYYY')}`}
                              style={{
                                position: 'absolute',
                                left: `${baselineLeftPosition}px`,
                                top: index * 47 + 4,
                                width: '3px',
                                height: '37px',
                                background: '#8c8c8c',
                                borderRadius: '1px',
                                zIndex: 1
                              }}
                            />
                          )}
```

Esto agrega una marca vertical gris (el baseline) al lado de la barra de color existente (el real), sin reemplazar la lógica de posicionamiento actual — mismo patrón (`dayjs().diff(...)`, `* 30` px por día) ya usado para todo lo demás en este archivo.

- [ ] **Step 3: Verificar manualmente en el navegador**

Con backend y frontend levantados, congelar el baseline de un proyecto con al menos un hito (Task 7, Step 6), ir a `/pmo`, seleccionar ese proyecto y confirmar visualmente que aparece la marca gris de baseline junto a la barra de color del hito en el Gantt.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/pmo/PMODashboard.tsx
git commit -m "feat(fase4): Gantt dibuja marca de baseline junto a la barra real de cada hito"
```

---

### Task 9: Verificación final del branch

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Lint y tests completos de backend**

Run: `cd backend && npm run lint && npm test`
Expected: 0 errores de lint; todos los tests verdes, incluyendo los 9+9+5+2 = 25 tests nuevos de esta fase sumados a los ya existentes.

- [ ] **Step 2: Lint y tests completos de frontend**

Run: `cd frontend && npm run lint && npm test`
Expected: 0 errores de lint; todos los tests verdes, incluyendo los 3 tests nuevos de `ProjectHealthCard`.

- [ ] **Step 3: Prueba end-to-end manual del flujo completo**

Con `cd backend && npm run dev` y `cd frontend && npm run dev` levantados:
1. Entrar como `team_lead`, abrir un proyecto con al menos 3 hitos con `planned_date` distintas (pasadas y futuras).
2. Congelar el baseline desde `ProjectHealthCard` y confirmar 201 en Network.
3. Marcar como `completed` (`completion_percentage = 100`) solo el hito cuya `planned_date` ya pasó, dejar los demás en 0.
4. Refrescar y confirmar que el semáforo se pone rojo o amarillo (no verde), que `SPI < 1`, y que "Fin proyectado" muestra una fecha posterior a `baseline.end_date`.
5. Ir a `/pmo`, abrir el Gantt de ese proyecto y confirmar que aparece la marca de baseline junto a la barra real de cada hito.
6. Intentar congelar el baseline una segunda vez (repetir el POST desde devtools o el botón si sigue visible) y confirmar 409.
7. Loguearse como `rpa_developer` y confirmar que no puede llamar a `POST /api/projects/:id/baseline` (403).

- [ ] **Step 4: Commit final (si quedó algo pendiente de los pasos anteriores)**

```bash
git status
git add -A
git commit -m "chore(fase4): verificacion final - lint y tests verdes en backend y frontend"
```

(Omitir este commit si `git status` no muestra cambios — los commits de cada task ya dejaron el branch limpio.)
