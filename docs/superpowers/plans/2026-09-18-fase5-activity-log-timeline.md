# Fase 5 — Activity Log + Timeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalizar el `activity_log` existente (hoy usado solo por `projectController` para 4 eventos de proyecto) para que también registre eventos de tasks/boards, y exponer esa trazabilidad como un timeline real: dos endpoints nuevos (`GET /api/projects/:id/activity` con feed combinado proyecto+tasks, `GET /api/tasks/:id/activity` por tarea) y un componente `ActivityTimeline` en el detalle de proyecto.

**Architecture:** Backend: nuevo `backend/src/services/activityLogService.ts` que centraliza `logActivity()` (hoy es un método privado duplicable en `projectController.ts`) y agrega `getProjectActivity()`/`getTaskActivity()` (consultas de lectura sobre la tabla `activity_log` ya existente desde la migración v16 — **no hay migración nueva en este plan**, `entity_type` ya es texto libre sin CHECK). `projectController.ts` pasa sus 4 call sites actuales a usar el service, y gana el endpoint `GET /:id/activity` con un chequeo de pertenencia real (`hasProjectAccess`, extraído del patrón ya usado en `getProject`). `taskController.ts` gana logging en `createTask`/`updateTask`/`deleteTask`/`moveTask`/`createBoard`/`batchCreateTasks`/`batchDeleteTasks`, más el endpoint `GET /:id/activity` reutilizando el patrón de pertenencia ya usado en el resto del archivo (JOIN `tasks→task_boards→projects`). Frontend: componente autocontenido `ActivityTimeline.tsx` (mismo patrón que `ProjectHealthCard.tsx`: fetch propio vía `apiService`, sin recibir datos por props) insertado en `ProjectDetailPage.tsx`.

Decisión de diseño explícita (acordada con el usuario en brainstorming): el timeline queda **abierto a cualquier usuario con pertenencia al proyecto** (no restringido a `team_lead` como `ProjectHealthCard`/`ProjectROICard`, porque no expone datos financieros). Como esto expone quién-hizo-qué, se agrega una verificación real de pertenencia solo para los 2 endpoints nuevos de este plan — el resto de `projectRoutes.ts` sigue con el IDOR sistémico documentado en Fase 4 (`fase4_open_items`), fuera de alcance acá.

Decisión de diseño explícita sobre granularidad: una fila de `activity_log` por acción (`created`/`updated`/`deleted`/`moved`), con `old_values`/`new_values` como snapshot/diff completo — mismo patrón que ya usa `projectController`, no se loguea campo por campo. Las operaciones batch (`batchCreateTasks`/`batchDeleteTasks`) loguean **una sola fila resumida con el conteo**, agrupada por proyecto, para no inundar el timeline. No hay backfill de actividad histórica: el logging nuevo empieza a correr desde que se despliega este cambio.

Decisión de diseño explícita sobre `getProject` (`GET /api/projects/:id`): su campo `recent_activities` (query inline ya existente, limitada a `entity_type='project'`) **no se toca en este plan** — sigue como está. El feed combinado nuevo vive únicamente en el endpoint dedicado `GET /:id/activity`.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente, sin dependencias nuevas — la tabla `activity_log` ya existe desde la migración v16). React 18/TypeScript/Vite/Ant Design (frontend ya existente; se usa el componente `Timeline` de Ant Design, ya disponible en la librería instalada, sin dependencias nuevas).

**Spec:** No hay spec separado — este proyecto salta directo de diseño aprobado en chat (brainstorming) a plan escrito. El diseño detallado (alcance de `activity_log` a tasks/boards, quién ve el timeline, chequeo de pertenencia solo para los endpoints nuevos, feed combinado vs. separado) se acordó con el usuario en la conversación de brainstorming previa a este documento. Contexto adicional verificado por reconocimiento de código: memoria `fase5-v16-orphaned-tables` (estado real de las tablas creadas en migración v16); `fase4-open-items` (IDOR sistémico en `projectRoutes.ts`, fuera de alcance de este plan).

## Global Constraints

- Roles actuales (`backend/src/database/migrationList.ts:15`, `CHECK` de `users.role`): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. No agregar roles nuevos.
- Convención de acceso a BD: `db.query(sql, params)` para múltiples filas, `db.get(sql, params)` para una fila, `db.run(sql, params)` para escritura (devuelve `{ id, changes }`). Nunca `db.all`. Ver `backend/src/database/database.ts`.
- No hay migración nueva en este plan: `activity_log` ya existe desde la migración v16 (`id, user_id, entity_type, entity_id, action, old_values, new_values, ip_address, user_agent, created_at`), con índices en `(entity_type, entity_id)`, `user_id`, `created_at`. `entity_type` es `VARCHAR(20)` sin `CHECK` — acepta `'project'` y `'task'` sin cambios de esquema.
- Servicios nuevos siguen el patrón de `financeService.ts`/`projectHealthService.ts`: una clase exportada + una instancia singleton exportada (`export const activityLogService = new ActivityLogService();`).
- Controllers siguen el patrón de clase ya usado en `projectController.ts`/`taskController.ts`: método flecha `async (req: AuthenticatedRequest, res: Response): Promise<void> => { try { ... } catch (error) { logger.error(...); res.status(500).json({ error: '...' }); } }`.
- Autorización de los 2 endpoints nuevos: `GET /api/projects/:id/activity` usa `hasProjectAccess` (mismo criterio que ya usa `projectController.getProject`: solo `rpa_developer` está restringido a proyectos propios/asignados; el resto de los roles ve cualquier proyecto) — **sin** `authorize()` de rol adicional, porque el chequeo real es de pertenencia, no de rol. `GET /api/tasks/:id/activity` reutiliza el patrón de pertenencia ya usado en el resto de `taskController.ts` (`WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)`).
- No tocar el resto de `projectRoutes.ts`/`taskController.ts` (el IDOR sistémico documentado en `fase4_open_items` sigue como deuda aparte). Los chequeos de pertenencia de este plan se agregan **solo** en los 2 endpoints nuevos.
- Tests backend: mockear `db` completo con `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))`. Para mockear `activityLogService` dentro de un test de controller, `jest.mock('../../services/activityLogService', () => ({ activityLogService: { logActivity: jest.fn(), getProjectActivity: jest.fn(), getTaskActivity: jest.fn() } }))` y `jest.spyOn`/cast a `jest.Mock` sobre el singleton importado. Nunca una base de datos real en tests unitarios.
- Tests frontend: Vitest + Testing Library, mockeando `@/services/api` completo con `vi.mock('@/services/api', () => ({ apiService: { ... } }))`, igual que `frontend/src/__tests__/components/ProjectHealthCard.test.tsx`.
- Frontend: servicios centralizados en la clase `ApiService` de `frontend/src/services/api.ts` (patrón: un método por endpoint, `this.api.get/post`). Componentes autocontenidos (fetch propio, no reciben los datos por props) en `frontend/src/components/`, siguiendo el patrón exacto de `ProjectHealthCard.tsx`.

---

## Mapa de archivos

- Crear: `backend/src/services/activityLogService.ts`
- Crear: `backend/src/__tests__/services/activityLogService.test.ts`
- Modificar: `backend/src/controllers/projectController.ts` (quitar `logActivity` privado, usar `activityLogService`, agregar `hasProjectAccess` y `getProjectActivity`)
- Crear: `backend/src/__tests__/controllers/projectController.activity.test.ts`
- Modificar: `backend/src/routes/projectRoutes.ts` (agregar `GET /:id/activity`)
- Modificar: `backend/src/controllers/taskController.ts` (agregar `getTaskActivity` + logging en `createTask`/`updateTask`/`deleteTask`/`moveTask`/`createBoard`/`batchCreateTasks`/`batchDeleteTasks`)
- Crear: `backend/src/__tests__/controllers/taskController.activity.test.ts`
- Crear: `backend/src/__tests__/controllers/taskController.logging.test.ts`
- Modificar: `backend/src/routes/taskRoutes.ts` (agregar `GET /tasks/:id/activity`)
- Crear: `frontend/src/types/activity.ts`
- Modificar: `frontend/src/services/api.ts` (agregar `getProjectActivity`, `getTaskActivity`)
- Crear: `frontend/src/components/activity/ActivityTimeline.tsx`
- Crear: `frontend/src/__tests__/components/ActivityTimeline.test.tsx`
- Modificar: `frontend/src/pages/projects/ProjectDetailPage.tsx` (insertar `ActivityTimeline`)

---

### Task 1: `activityLogService.logActivity` — extraer el método existente

**Files:**
- Create: `backend/src/services/activityLogService.ts`
- Modify: `backend/src/controllers/projectController.ts:471-495` (quitar el método privado `logActivity`), líneas 221, 323, 379, 922 (cambiar `this.logActivity(...)` por `activityLogService.logActivity(...)`)
- Test: `backend/src/__tests__/services/activityLogService.test.ts`

**Interfaces:**
- Produces: `export class ActivityLogService { async logActivity(userId: number | undefined, entityType: string, entityId: number, action: string, oldValues: any, newValues: any): Promise<void> }` y `export const activityLogService = new ActivityLogService();`. Task 2 agrega métodos a esta misma clase/archivo. Task 3-6 dependen de importar `{ activityLogService }` desde `'../services/activityLogService'`.

- [ ] **Step 1: Escribir los tests de `logActivity`**

```typescript
// backend/src/__tests__/services/activityLogService.test.ts
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

import { db } from '../../database/database';
import { ActivityLogService } from '../../services/activityLogService';

describe('ActivityLogService.logActivity', () => {
    let service: ActivityLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ActivityLogService();
    });

    it('inserta la fila con old_values/new_values serializados a JSON', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.logActivity(3, 'project', 7, 'updated', { name: 'A' }, { name: 'B' });

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO activity_log'),
            [3, 'project', 7, 'updated', JSON.stringify({ name: 'A' }), JSON.stringify({ name: 'B' })]
        );
    });

    it('guarda null cuando old_values/new_values no se pasan', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.logActivity(3, 'project', 7, 'deleted', null, null);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO activity_log'),
            [3, 'project', 7, 'deleted', null, null]
        );
    });

    it('guarda user_id null cuando userId es undefined', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.logActivity(undefined, 'project', 7, 'created', null, null);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO activity_log'),
            [null, 'project', 7, 'created', null, null]
        );
    });

    it('nunca lanza si el insert falla (error solo se loguea)', async () => {
        (db.run as jest.Mock).mockRejectedValue(new Error('disk full'));

        await expect(service.logActivity(3, 'project', 7, 'created', null, null)).resolves.toBeUndefined();
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest services/activityLogService.test.ts -v`
Expected: FAIL — `Cannot find module '../../services/activityLogService'`.

- [ ] **Step 3: Crear el service con `logActivity`**

```typescript
// backend/src/services/activityLogService.ts
import { db } from '../database/database';
import { logger } from '../utils/logger';

/**
 * Única fuente de escritura/lectura de activity_log (migración v16).
 * logActivity nunca lanza: un fallo de auditoría no debe romper la operación que lo dispara.
 */
export class ActivityLogService {
    async logActivity(
        userId: number | undefined,
        entityType: string,
        entityId: number,
        action: string,
        oldValues: any,
        newValues: any
    ): Promise<void> {
        try {
            await db.run(`
                INSERT INTO activity_log (
                    user_id, entity_type, entity_id, action, old_values, new_values
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId || null,
                entityType,
                entityId,
                action,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null
            ]);
        } catch (error) {
            logger.error('Failed to log activity:', error);
        }
    }
}

export const activityLogService = new ActivityLogService();
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest services/activityLogService.test.ts -v`
Expected: PASS — 4 tests verdes.

- [ ] **Step 5: Actualizar `projectController.ts` para usar el service**

Agregar el import junto a los existentes (`backend/src/controllers/projectController.ts`, después de `import { projectHealthService } from '../services/projectHealthService';`):

```typescript
import { activityLogService } from '../services/activityLogService';
```

Quitar el método privado completo (líneas 471-495):

```typescript
    private async logActivity(
        userId: number | undefined,
        entityType: string,
        entityId: number,
        action: string,
        oldValues: any,
        newValues: any
    ): Promise<void> {
        try {
            await db.run(`
                INSERT INTO activity_log (
                    user_id, entity_type, entity_id, action, old_values, new_values
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId || null,
                entityType,
                entityId,
                action,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null
            ]);
        } catch (error) {
            logger.error('Failed to log activity:', error);
        }
    }
```

Y reemplazar las 4 llamadas `this.logActivity(` por `activityLogService.logActivity(` manteniendo exactamente los mismos argumentos (líneas 221, 323, 379, 922). Por ejemplo, la de la línea 221:

```typescript
            // Log activity
            await activityLogService.logActivity(
                req.user?.id,
                'project',
                projectId,
                'created',
                null,
                { name, status, priority }
            );
```

El mismo cambio mecánico (`this.logActivity` → `activityLogService.logActivity`, sin tocar ningún argumento) en las otras 3 llamadas:

`updateProject` (línea 323):

```typescript
            // Log activity
            await activityLogService.logActivity(
                req.user?.id,
                'project',
                parseInt(id),
                'updated',
                currentProject,
                updates
            );
```

`deleteProject` (línea 379):

```typescript
            // Log activity
            await activityLogService.logActivity(
                req.user?.id,
                'project',
                parseInt(id),
                'deleted',
                project,
                null
            );
```

`createProjectFromQuote` (línea 922):

```typescript
                // 7. Log activity
                await activityLogService.logActivity(
                    userId,
                    'project',
                    projectId,
                    'created_from_quote',
                    null,
                    {
                        project_name: quote_data.project_name,
                        // ... resto del objeto newValues sin cambios
                    }
                );
```

No hay test nuevo para este paso: el comportamiento de las 4 llamadas queda cubierto por los tests de `activityLogService.logActivity` (Step 1) — no existía ningún test previo de `createProject`/`updateProject`/`deleteProject`/`createProjectFromQuote` en el repo que este cambio pudiera romper (verificado: no hay `projectController.test.ts` genérico, solo `projectController.health.test.ts`).

- [ ] **Step 6: Verificar que compila**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos en `projectController.ts` (no debe quedar ninguna referencia a `this.logActivity`).

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/activityLogService.ts backend/src/__tests__/services/activityLogService.test.ts backend/src/controllers/projectController.ts
git commit -m "feat(fase5): extrae logActivity a activityLogService, projectController lo reutiliza"
```

---

### Task 2: `activityLogService.getProjectActivity` / `getTaskActivity` — feed de lectura

**Files:**
- Modify: `backend/src/services/activityLogService.ts`
- Modify: `backend/src/__tests__/services/activityLogService.test.ts`

**Interfaces:**
- Consumes: `db.query(sql, params): Promise<any[]>`.
- Produces: `export interface ActivityLogEntry { id: number; user_id: number | null; user_name: string | null; entity_type: string; entity_id: number; action: string; old_values: Record<string, any> | null; new_values: Record<string, any> | null; created_at: string; }`, `export interface ActivityQueryOptions { limit: number; offset: number; }`, `async getProjectActivity(projectId: number, options: ActivityQueryOptions): Promise<ActivityLogEntry[]>` (feed combinado: eventos `entity_type='project'` de ese proyecto + eventos `entity_type='task'` de las tasks de sus boards) y `async getTaskActivity(taskId: number, options: ActivityQueryOptions): Promise<ActivityLogEntry[]>` en `ActivityLogService`. Task 3 y Task 4 devuelven el resultado de estos métodos tal cual.

- [ ] **Step 1: Agregar los tests de `getProjectActivity`/`getTaskActivity`**

Agregar al final de `backend/src/__tests__/services/activityLogService.test.ts` (mismo archivo, después del `describe('ActivityLogService.logActivity', ...)`):

```typescript
describe('ActivityLogService.getProjectActivity', () => {
    let service: ActivityLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ActivityLogService();
    });

    it('consulta eventos de proyecto y de tasks del proyecto, con paginación', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            {
                id: 2, user_id: 3, user_name: 'Ana', entity_type: 'task', entity_id: 10,
                action: 'created', old_values: null, new_values: '{"title":"Nueva tarea"}',
                created_at: '2026-09-18T10:00:00Z'
            },
            {
                id: 1, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
                action: 'created', old_values: null, new_values: '{"name":"AGROSUPER"}',
                created_at: '2026-09-17T10:00:00Z'
            }
        ]);

        const result = await service.getProjectActivity(7, { limit: 50, offset: 0 });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("entity_type = 'project'"),
            [7, 7, 50, 0]
        );
        expect(result).toHaveLength(2);
        expect(result[0].new_values).toEqual({ title: 'Nueva tarea' });
        expect(result[1].new_values).toEqual({ name: 'AGROSUPER' });
    });

    it('devuelve old_values/new_values null si vienen null o el JSON es inválido', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            {
                id: 1, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
                action: 'created', old_values: null, new_values: 'no-es-json',
                created_at: '2026-09-17T10:00:00Z'
            }
        ]);

        const result = await service.getProjectActivity(7, { limit: 50, offset: 0 });

        expect(result[0].old_values).toBeNull();
        expect(result[0].new_values).toBeNull();
    });
});

describe('ActivityLogService.getTaskActivity', () => {
    let service: ActivityLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ActivityLogService();
    });

    it('consulta solo eventos entity_type=task de esa tarea, con paginación', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            {
                id: 5, user_id: 3, user_name: 'Ana', entity_type: 'task', entity_id: 10,
                action: 'updated', old_values: '{"status":"todo"}', new_values: '{"status":"in_progress"}',
                created_at: '2026-09-18T11:00:00Z'
            }
        ]);

        const result = await service.getTaskActivity(10, { limit: 20, offset: 0 });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("entity_type = 'task'"),
            [10, 20, 0]
        );
        expect(result[0].old_values).toEqual({ status: 'todo' });
        expect(result[0].new_values).toEqual({ status: 'in_progress' });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest services/activityLogService.test.ts -v`
Expected: FAIL — `service.getProjectActivity is not a function`.

- [ ] **Step 3: Implementar `getProjectActivity`/`getTaskActivity`**

Agregar en `backend/src/services/activityLogService.ts`, antes de `export const activityLogService`:

```typescript
export interface ActivityLogEntry {
    id: number;
    user_id: number | null;
    user_name: string | null;
    entity_type: string;
    entity_id: number;
    action: string;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    created_at: string;
}

export interface ActivityQueryOptions {
    limit: number;
    offset: number;
}

function parseJsonColumn(value: string | null): Record<string, any> | null {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function mapActivityRow(row: any): ActivityLogEntry {
    return {
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        action: row.action,
        old_values: parseJsonColumn(row.old_values),
        new_values: parseJsonColumn(row.new_values),
        created_at: row.created_at
    };
}
```

Y dentro de la clase `ActivityLogService`, después de `logActivity`:

```typescript
    async getProjectActivity(projectId: number, options: ActivityQueryOptions): Promise<ActivityLogEntry[]> {
        const rows = await db.query(`
            SELECT al.*, u.full_name as user_name
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE (al.entity_type = 'project' AND al.entity_id = ?)
               OR (al.entity_type = 'task' AND al.entity_id IN (
                     SELECT t.id FROM tasks t
                     JOIN task_boards tb ON t.board_id = tb.id
                     WHERE tb.project_id = ?
                   ))
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [projectId, projectId, options.limit, options.offset]);

        return rows.map(mapActivityRow);
    }

    async getTaskActivity(taskId: number, options: ActivityQueryOptions): Promise<ActivityLogEntry[]> {
        const rows = await db.query(`
            SELECT al.*, u.full_name as user_name
            FROM activity_log al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.entity_type = 'task' AND al.entity_id = ?
            ORDER BY al.created_at DESC
            LIMIT ? OFFSET ?
        `, [taskId, options.limit, options.offset]);

        return rows.map(mapActivityRow);
    }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest services/activityLogService.test.ts -v`
Expected: PASS — 7 tests verdes en total.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/activityLogService.ts backend/src/__tests__/services/activityLogService.test.ts
git commit -m "feat(fase5): activityLogService.getProjectActivity/getTaskActivity"
```

---

### Task 3: `GET /api/projects/:id/activity` — feed combinado con chequeo de pertenencia

**Files:**
- Modify: `backend/src/controllers/projectController.ts`
- Modify: `backend/src/routes/projectRoutes.ts`
- Test: `backend/src/__tests__/controllers/projectController.activity.test.ts`

**Interfaces:**
- Consumes: `activityLogService.getProjectActivity(projectId, options)` (Task 2), `db.get`.
- Produces: `GET /api/projects/:id/activity` (200 con `ActivityLogEntry[]`, 404 si el proyecto no existe, 403 si el usuario no tiene pertenencia). `private hasProjectAccess(user, project): boolean` en `ProjectController` — mismo criterio que ya usa `getProject` (solo `rpa_developer` restringido a proyectos propios/asignados).

- [ ] **Step 1: Escribir los tests del endpoint**

```typescript
// backend/src/__tests__/controllers/projectController.activity.test.ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getProjectActivity: jest.fn(), logActivity: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController.getProjectActivity', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce(null);
        const req = { params: { id: '999' }, user: { id: 1, role: 'team_lead' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('devuelve 403 si un rpa_developer sin pertenencia pide el timeline', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 });
        const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(activityLogService.getProjectActivity).not.toHaveBeenCalled();
    });

    it('permite a un rpa_developer con pertenencia (created_by) ver el timeline', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 1 });
        (activityLogService.getProjectActivity as jest.Mock).mockResolvedValue([{ id: 1, action: 'created' }]);
        const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(activityLogService.getProjectActivity).toHaveBeenCalledWith(7, { limit: 50, offset: 0 });
        expect(res.json).toHaveBeenCalledWith([{ id: 1, action: 'created' }]);
    });

    it('permite a team_lead ver el timeline de cualquier proyecto aunque no le pertenezca', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 });
        (activityLogService.getProjectActivity as jest.Mock).mockResolvedValue([]);
        const req = { params: { id: '7' }, user: { id: 1, role: 'team_lead' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it('usa limit/offset de la query string cuando vienen', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 1, created_by: 1 });
        (activityLogService.getProjectActivity as jest.Mock).mockResolvedValue([]);
        const req = {
            params: { id: '7' }, user: { id: 1, role: 'rpa_developer' }, query: { limit: '10', offset: '20' }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(activityLogService.getProjectActivity).toHaveBeenCalledWith(7, { limit: 10, offset: 20 });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest controllers/projectController.activity.test.ts -v`
Expected: FAIL — `controller.getProjectActivity is not a function`.

- [ ] **Step 3: Implementar `getProjectActivity` y `hasProjectAccess`**

Agregar dentro de la clase `ProjectController` en `backend/src/controllers/projectController.ts`, después de `getProjectHealth` (donde estaba el `logActivity` privado que se quitó en Task 1):

```typescript
    // GET /api/projects/:id/activity
    getProjectActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const project = await db.get(
                'SELECT id, assigned_to, created_by FROM projects WHERE id = ?',
                [projectId]
            );

            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            if (!this.hasProjectAccess(req.user, project)) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const limit = parseInt(req.query.limit as string) || 50;
            const offset = parseInt(req.query.offset as string) || 0;

            const activity = await activityLogService.getProjectActivity(projectId, { limit, offset });
            res.json(activity);
        } catch (error) {
            logger.error('Get project activity error:', error);
            res.status(500).json({ error: 'Failed to get project activity' });
        }
    };

    private hasProjectAccess(
        user: AuthenticatedRequest['user'],
        project: { assigned_to: number | null; created_by: number }
    ): boolean {
        if (user?.role === 'rpa_developer' && project.assigned_to !== user.id && project.created_by !== user.id) {
            return false;
        }
        return true;
    }
```

Agregar la ruta en `backend/src/routes/projectRoutes.ts`, después de la línea `router.get('/:id/health', projectController.getProjectHealth);`:

```typescript
// GET /api/projects/:id/activity - Combined activity timeline (project + its tasks)
router.get('/:id/activity', projectController.getProjectActivity);
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest controllers/projectController.activity.test.ts -v`
Expected: PASS — 5 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.activity.test.ts
git commit -m "feat(fase5): endpoint GET /projects/:id/activity con chequeo de pertenencia"
```

---

### Task 4: `GET /api/tasks/:id/activity` — timeline de una tarea

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/routes/taskRoutes.ts`
- Test: `backend/src/__tests__/controllers/taskController.activity.test.ts`

**Interfaces:**
- Consumes: `activityLogService.getTaskActivity(taskId, options)` (Task 2), `db.get`.
- Produces: `GET /api/tasks/:id/activity` (200 con `ActivityLogEntry[]`, 404 si la tarea no existe o el usuario no tiene pertenencia — mismo criterio que el resto de `taskController.ts`).

- [ ] **Step 1: Escribir los tests del endpoint**

```typescript
// backend/src/__tests__/controllers/taskController.activity.test.ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getTaskActivity: jest.fn(), logActivity: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController.getTaskActivity', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('devuelve 404 si la tarea no existe o no hay pertenencia', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce(null);
        const req = { params: { id: '10' }, user: { id: 1 }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskActivity(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(activityLogService.getTaskActivity).not.toHaveBeenCalled();
    });

    it('devuelve el feed de la tarea cuando hay pertenencia', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 10, project_id: 7 });
        (activityLogService.getTaskActivity as jest.Mock).mockResolvedValue([{ id: 1, action: 'created' }]);
        const req = { params: { id: '10' }, user: { id: 1 }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskActivity(req, res);

        expect(activityLogService.getTaskActivity).toHaveBeenCalledWith(10, { limit: 50, offset: 0 });
        expect(res.json).toHaveBeenCalledWith([{ id: 1, action: 'created' }]);
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest controllers/taskController.activity.test.ts -v`
Expected: FAIL — `controller.getTaskActivity is not a function`.

- [ ] **Step 3: Implementar `getTaskActivity`**

Agregar el import al inicio de `backend/src/controllers/taskController.ts` (junto a los existentes):

```typescript
import { activityLogService } from '../services/activityLogService';
```

Agregar el método dentro de la clase `TaskController`, después de `moveTask` (antes del cierre de la clase):

```typescript
  // GET /api/tasks/:id/activity
  getTaskActivity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const task = await db.get(`
        SELECT t.id, tb.project_id, p.assigned_to, p.created_by
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [id, userId, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const activity = await activityLogService.getTaskActivity(parseInt(id), { limit, offset });
      res.json(activity);
    } catch (error) {
      logger.error('Get task activity error:', error);
      res.status(500).json({ error: 'Failed to get task activity' });
    }
  };
```

Agregar la ruta en `backend/src/routes/taskRoutes.ts`, en la sección "Task operations" (después de `router.post('/tasks/:id/move', ...)`):

```typescript
router.get('/tasks/:id/activity', authenticate, taskController.getTaskActivity);
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest controllers/taskController.activity.test.ts -v`
Expected: PASS — 2 tests verdes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/routes/taskRoutes.ts backend/src/__tests__/controllers/taskController.activity.test.ts
git commit -m "feat(fase5): endpoint GET /tasks/:id/activity"
```

---

### Task 5: Logging en `createTask`/`updateTask`/`deleteTask`/`moveTask`/`createBoard`

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Test: `backend/src/__tests__/controllers/taskController.logging.test.ts`

**Interfaces:**
- Consumes: `activityLogService.logActivity(userId, entityType, entityId, action, oldValues, newValues)` (Task 1).
- Produces: cada operación de escritura de tasks/boards ahora llama a `activityLogService.logActivity` con `entity_type='task'` (para `createTask`/`updateTask`/`deleteTask`/`moveTask`, `entity_id` = id de la tarea) o `entity_type='project'` (para `createBoard`, `entity_id` = `project_id`, porque un board no es una task y así entra en el feed combinado de Task 2 sin lógica extra).

- [ ] **Step 1: Escribir los tests de logging**

```typescript
// backend/src/__tests__/controllers/taskController.logging.test.ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - logging de actividad', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('createTask loguea entity_type=task con action=created', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 }) // board access check
            .mockResolvedValueOnce({ max_position: 0 })      // lastTask
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' }); // newTask (SELECT final)
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva', task_type: 'task', priority: 'medium' },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.createTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'task', 55, 'created', null,
            expect.objectContaining({ title: 'Nueva' })
        );
    });

    it('updateTask loguea entity_type=task con action=updated, oldValues=snapshot previo', async () => {
        const previousTask = { id: 55, column_id: 2, position: 1, title: 'Vieja', status: 'todo' };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)              // access check
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' }); // updated task (SELECT final)
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { title: 'Nueva' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.updateTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'task', 55, 'updated', previousTask,
            expect.objectContaining({ title: 'Nueva' })
        );
    });

    it('updateTask no loguea si el body no trae ningún campo actualizable', async () => {
        const previousTask = { id: 55, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55 });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = { params: { id: '55' }, body: {}, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.updateTask(req, res);

        expect(activityLogService.logActivity).not.toHaveBeenCalled();
    });

    it('deleteTask loguea entity_type=task con action=deleted antes del commit', async () => {
        const existsCheck = { id: 55, column_id: 2, position: 1, project_id: 7, assigned_to: 3, created_by: 3 };
        (db.get as jest.Mock).mockResolvedValueOnce(existsCheck);
        (db.run as jest.Mock)
            .mockResolvedValueOnce({ id: 55, changes: 1 }) // DELETE
            .mockResolvedValueOnce({ changes: 0 });        // reorder
        const req = { params: { id: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.deleteTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'task', 55, 'deleted', existsCheck, null
        );
        expect(db.commit).toHaveBeenCalled();
    });

    it('moveTask loguea entity_type=task con action=moved', async () => {
        const task = { id: 55, column_id: 2, position: 1, project_id: 7, assigned_to: 3, created_by: 3 };
        (db.get as jest.Mock).mockResolvedValueOnce(task);
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { column_id: 4, position: 0 }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.moveTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'task', 55, 'moved',
            { column_id: 2, position: 1 },
            { column_id: 4, position: 0 }
        );
    });

    it('createBoard loguea entity_type=project con action=board_created', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 9, project_id: 7 })       // access check al proyecto
            .mockResolvedValueOnce({ id: 9, name: 'Board X', project_id: 7 }); // newBoard (SELECT final)
        (db.run as jest.Mock).mockResolvedValue({ id: 9, changes: 1 });
        const req = {
            body: { project_id: 7, name: 'Board X', board_type: 'kanban' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.createBoard(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'board_created', null,
            expect.objectContaining({ name: 'Board X' })
        );
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest controllers/taskController.logging.test.ts -v`
Expected: FAIL — `activityLogService.logActivity` no se llama en ningún caso todavía.

- [ ] **Step 3: Agregar el logging en cada método**

En `createTask` (`backend/src/controllers/taskController.ts`), justo antes de `res.status(201).json(newTask);`:

```typescript
      await activityLogService.logActivity(
        userId, 'task', result.id!, 'created', null,
        { title, task_type, priority, column_id, board_id }
      );

      res.status(201).json(newTask);
```

En `updateTask`, guardar una copia de `task` (ya se obtiene en el chequeo de acceso) y, justo antes de `res.json(updatedTask);`, loguear solo si el body trajo algún campo actualizable:

```typescript
      const updatePayload = {
        title, description, task_type, status, priority,
        assignee_id, estimated_hours, story_points, start_date, due_date, column_id, position
      };
      const hasChanges = Object.values(updatePayload).some((value) => value !== undefined);
      if (hasChanges) {
        await activityLogService.logActivity(userId, 'task', parseInt(id), 'updated', task, updatePayload);
      }

      res.json(updatedTask);
```

En `deleteTask`, justo antes de `await db.commit();` (dentro del mismo `try` que ya tiene, después del `UPDATE` de reordenamiento):

```typescript
        await activityLogService.logActivity(userId, 'task', parseInt(id), 'deleted', existsCheck, null);

        await db.commit();
```

En `moveTask`, justo antes de `await db.commit();` (dentro del `try` de la transacción de movimiento):

```typescript
        await activityLogService.logActivity(
          userId, 'task', parseInt(id), 'moved',
          { column_id: task.column_id, position: task.position },
          { column_id, position }
        );

        await db.commit();
```

En `createBoard`, justo antes de `res.status(201).json(newBoard);`:

```typescript
      await activityLogService.logActivity(
        userId, 'project', project_id, 'board_created', null,
        { name, board_type }
      );

      res.status(201).json(newBoard);
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest controllers/taskController.logging.test.ts -v`
Expected: PASS — 6 tests verdes.

- [ ] **Step 5: Correr toda la suite de `taskController` para verificar que no se rompió nada existente**

Run: `cd backend && npx jest controllers/taskController -v`
Expected: PASS — todos los tests de `taskController.activity.test.ts` y `taskController.logging.test.ts` en verde.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/__tests__/controllers/taskController.logging.test.ts
git commit -m "feat(fase5): logging de activity_log en createTask/updateTask/deleteTask/moveTask/createBoard"
```

---

### Task 6: Logging resumido en `batchCreateTasks`/`batchDeleteTasks`

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/__tests__/controllers/taskController.logging.test.ts`

**Interfaces:**
- Consumes: `activityLogService.logActivity` (Task 1).
- Produces: `batchCreateTasks` loguea **una** fila (`entity_type='project'`, `action='tasks_batch_created'`, `new_values={ count, board_id }`). `batchDeleteTasks` loguea **una fila por proyecto distinto** afectado (`action='tasks_batch_deleted'`, `new_values={ count }`), agrupando por `project_id` de las tareas efectivamente borradas — nunca una fila por tarea individual.

- [ ] **Step 1: Agregar los tests de logging batch**

Agregar al final de `backend/src/__tests__/controllers/taskController.logging.test.ts` (dentro del mismo `describe`, dos `it` nuevos):

```typescript
    it('batchCreateTasks loguea UNA sola fila resumida con el conteo', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 }) // board access check
            .mockResolvedValueOnce({ max_position: 0 });     // maxPos para la única columna
        (db.query as jest.Mock).mockResolvedValueOnce([{ id: 2, position: 1 }]); // columns
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const req = {
            body: { board_id: 1, tasks: [{ column_id: 2, title: 'T1' }, { column_id: 2, title: 'T2' }] },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.batchCreateTasks(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledTimes(1);
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'tasks_batch_created', null,
            expect.objectContaining({ count: 2, board_id: 1 })
        );
    });

    it('batchDeleteTasks agrupa el logging por proyecto (una fila por proyecto distinto)', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 55, column_id: 2, position: 1, project_id: 7, assigned_to: 3, created_by: 3 })
            .mockResolvedValueOnce({ id: 56, column_id: 2, position: 2, project_id: 7, assigned_to: 3, created_by: 3 })
            .mockResolvedValueOnce({ id: 57, column_id: 5, position: 1, project_id: 9, assigned_to: 3, created_by: 3 });
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const req = { body: { taskIds: [55, 56, 57] }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.batchDeleteTasks(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledTimes(2);
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'tasks_batch_deleted', null, expect.objectContaining({ count: 2 })
        );
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 9, 'tasks_batch_deleted', null, expect.objectContaining({ count: 1 })
        );
    });
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest controllers/taskController.logging.test.ts -v`
Expected: FAIL — 2 tests nuevos fallan (0 llamadas a `logActivity` en batch).

- [ ] **Step 3: Implementar el logging agrupado**

En `batchCreateTasks`, justo antes de `res.status(201).json({ ... });` (después de `await db.commit();`):

```typescript
        await activityLogService.logActivity(
          userId, 'project', board.project_id, 'tasks_batch_created', null,
          { count: createdTasks.length, board_id }
        );

        logger.info(`Batch task creation completed: ${createdTasks.length} tasks created by user ${userId}`);
```

En `batchDeleteTasks`, agregar un `Map<number, number>` para acumular conteos por proyecto dentro del `for` existente (junto a `deletedTaskIds`/`columnsToReorder`):

```typescript
        const deletedTaskIds: number[] = [];
        const columnsToReorder: Set<number> = new Set();
        const projectCounts: Map<number, number> = new Map();
```

Dentro del `if (taskCheck) { ... }`, después de `columnsToReorder.add(taskCheck.column_id);`:

```typescript
            projectCounts.set(taskCheck.project_id, (projectCounts.get(taskCheck.project_id) || 0) + 1);
```

Y después de `await reorderColumnPositions(db, columnsToReorder, 'tasks');`, antes de `await db.commit();`:

```typescript
        for (const [projectId, count] of projectCounts) {
          await activityLogService.logActivity(userId, 'project', projectId, 'tasks_batch_deleted', null, { count });
        }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest controllers/taskController.logging.test.ts -v`
Expected: PASS — 8 tests verdes en total.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/__tests__/controllers/taskController.logging.test.ts
git commit -m "feat(fase5): logging resumido y agrupado por proyecto en operaciones batch de tasks"
```

---

### Task 7: Frontend — tipos y métodos de API

**Files:**
- Create: `frontend/src/types/activity.ts`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Produces: `export interface ActivityLogEntry { ... }` (mismos campos que el backend, Task 2) en `frontend/src/types/activity.ts`; `apiService.getProjectActivity(projectId: number, params?: { limit?: number; offset?: number }): Promise<ActivityLogEntry[]>` y `apiService.getTaskActivity(taskId: number, params?: { limit?: number; offset?: number }): Promise<ActivityLogEntry[]>` en `frontend/src/services/api.ts`. Task 8 depende de estos dos métodos y del tipo literalmente.

No hay TDD de tipos/HTTP puro aquí (no hay lógica aislada que probar sin un componente que la consuma) — su cobertura llega vía el test de `ActivityTimeline` en Task 8.

- [ ] **Step 1: Crear los tipos**

```typescript
// frontend/src/types/activity.ts
export interface ActivityLogEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  entity_type: string;
  entity_id: number;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  created_at: string;
}
```

- [ ] **Step 2: Agregar los métodos a `ApiService`**

En `frontend/src/services/api.ts`, agregar junto a `getProjectHealth`/`freezeProjectBaseline`:

```typescript
  async getProjectActivity(projectId: number, params?: { limit?: number; offset?: number }): Promise<ActivityLogEntry[]> {
    const response = await this.api.get(`/projects/${projectId}/activity`, { params });
    return response.data;
  }

  async getTaskActivity(taskId: number, params?: { limit?: number; offset?: number }): Promise<ActivityLogEntry[]> {
    const response = await this.api.get(`/tasks/${taskId}/activity`, { params });
    return response.data;
  }
```

Agregar el import correspondiente arriba del archivo, junto a los demás imports de `types`:

```typescript
import { ActivityLogEntry } from '../types/activity';
```

- [ ] **Step 3: Verificar que compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos relacionados a `activity`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/activity.ts frontend/src/services/api.ts
git commit -m "feat(fase5): tipos y metodos de API para activity log"
```

---

### Task 8: Frontend — `ActivityTimeline.tsx` e integración en `ProjectDetailPage`

**Files:**
- Create: `frontend/src/components/activity/ActivityTimeline.tsx`
- Test: `frontend/src/__tests__/components/ActivityTimeline.test.tsx`
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx`

**Interfaces:**
- Consumes: `apiService.getProjectActivity` (Task 7).
- Produces: `export const ActivityTimeline: React.FC<{ projectId: number }>`. Se monta en `ProjectDetailPage.tsx` junto a `ProjectHealthCard`/`ProjectROICard`, pero **sin** restricción de rol (a diferencia de esas dos, visible para cualquier usuario con acceso a la página del proyecto).

- [ ] **Step 1: Escribir el test del componente**

```typescript
// frontend/src/__tests__/components/ActivityTimeline.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectActivity: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';

describe('ActivityTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra un mensaje cuando no hay actividad registrada', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([]);

    render(<ActivityTimeline projectId={7} />);

    await waitFor(() => {
      expect(screen.getByText(/sin actividad registrada/i)).toBeInTheDocument();
    });
  });

  it('renderiza cada entrada con el nombre de usuario y la acción', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([
      {
        id: 1, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
        action: 'created', old_values: null, new_values: { name: 'AGROSUPER' },
        created_at: '2026-09-17T10:00:00Z'
      },
      {
        id: 2, user_id: 3, user_name: 'Ana', entity_type: 'task', entity_id: 10,
        action: 'updated', old_values: { status: 'todo' }, new_values: { status: 'in_progress' },
        created_at: '2026-09-18T10:00:00Z'
      }
    ]);

    render(<ActivityTimeline projectId={7} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Ana/)).not.toHaveLength(0);
    });
    expect(screen.getByText(/status/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd frontend && npx vitest run src/__tests__/components/ActivityTimeline.test.tsx`
Expected: FAIL — no se encuentra el módulo `@/components/activity/ActivityTimeline`.

- [ ] **Step 3: Implementar el componente**

```typescript
// frontend/src/components/activity/ActivityTimeline.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { Card, Timeline, Typography, message } from 'antd';
import { apiService } from '@/services/api';
import { ActivityLogEntry } from '@/types/activity';

const { Text } = Typography;

const ACTION_LABEL: Record<string, string> = {
  created: 'creó',
  updated: 'actualizó',
  deleted: 'eliminó',
  moved: 'movió',
  board_created: 'creó el tablero de',
  tasks_batch_created: 'creó en lote',
  tasks_batch_deleted: 'eliminó en lote',
  created_from_quote: 'creó desde cotización'
};

function renderDiffSummary(entry: ActivityLogEntry): string | null {
  if (!entry.new_values) return null;

  const fields = Object.keys(entry.new_values);
  if (fields.length === 0) return null;

  return fields
    .map((field) => {
      const newValue = entry.new_values?.[field];
      const oldValue = entry.old_values?.[field];
      if (oldValue !== undefined && oldValue !== newValue) {
        return `${field}: ${oldValue ?? '—'} → ${newValue ?? '—'}`;
      }
      return `${field}: ${newValue ?? '—'}`;
    })
    .join(', ');
}

interface ActivityTimelineProps {
  projectId: number;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadActivity = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getProjectActivity(projectId, { limit: 50, offset: 0 });
      setEntries(data);
    } catch (error) {
      message.error('No se pudo cargar el historial de actividad');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  if (loading) {
    return <Card loading title="Actividad" />;
  }

  return (
    <Card title="Actividad" size="small">
      {entries.length === 0 ? (
        <Text type="secondary">Sin actividad registrada todavía.</Text>
      ) : (
        <Timeline
          items={entries.map((entry) => ({
            key: entry.id,
            children: (
              <div>
                <Text strong>{entry.user_name || 'Usuario desconocido'}</Text>
                {' '}
                <Text>{ACTION_LABEL[entry.action] || entry.action}</Text>
                {' '}
                <Text type="secondary">
                  {entry.entity_type === 'task' ? 'una tarea' : 'el proyecto'}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(entry.created_at).toLocaleString('es-CL')}
                </Text>
                {renderDiffSummary(entry) && (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {renderDiffSummary(entry)}
                    </Text>
                  </div>
                )}
              </div>
            )
          }))}
        />
      )}
    </Card>
  );
};
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd frontend && npx vitest run src/__tests__/components/ActivityTimeline.test.tsx`
Expected: PASS — 2 tests verdes.

- [ ] **Step 5: Integrar en `ProjectDetailPage.tsx`**

Agregar el import junto a los existentes (`frontend/src/pages/projects/ProjectDetailPage.tsx`, después de `import { ProjectHealthCard } from '@/components/projects/ProjectHealthCard';`):

```typescript
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
```

Insertar el componente después del bloque de `ProjectHealthCard` (líneas 476-478), **sin** el condicional `user?.role === 'team_lead'` que envuelve a ese y a `ProjectROICard`, porque el timeline es visible para cualquier usuario con acceso a la página:

```typescript
                    {user?.role === 'team_lead' && (
                      <ProjectHealthCard projectId={project.id} />
                    )}

                    <ActivityTimeline projectId={project.id} />

```

- [ ] **Step 6: Verificar que compila**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/activity/ActivityTimeline.tsx frontend/src/__tests__/components/ActivityTimeline.test.tsx frontend/src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat(fase5): componente ActivityTimeline integrado en ProjectDetailPage"
```

---

## Fuera de alcance de este plan (explícito)

- UI de timeline dentro de un modal de detalle de tarea: el endpoint `GET /api/tasks/:id/activity` (Task 4) ya existe y está testeado, pero no hay componente de detalle de tarea en el repo hoy (no existe `TaskDetail*.tsx`) — integrarlo ahí queda para cuando ese modal exista.
- Backfill de actividad histórica: no se reconstruye el pasado, el logging nuevo corre desde el deploy de este cambio.
- Arreglar el IDOR sistémico del resto de `projectRoutes.ts`/`taskController.ts` (documentado en `fase4_open_items`): los chequeos de pertenencia de este plan son solo para los 2 endpoints nuevos.
- El resto del alcance de Fase 5 (comentarios/@menciones, notificaciones in-app/socket.io, subtareas, multi-asignados, etiquetas, búsqueda global, filtros, edición masiva, dependencias, carga del equipo): son sub-proyectos separados, cada uno con su propio brainstorming → plan.
