# Dependencias entre Tareas (Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exponer vía API la tabla `task_dependencies` (existente desde la migración v16 y hasta ahora huérfana) para que una tarea pueda declarar que depende de otra tarea del mismo proyecto, y para poder listar y borrar esos vínculos. Puramente informativo: no bloquea ninguna transición de status de tareas. Sin UI en este sub-proyecto.

**Architecture:** Nuevo servicio `taskDependencyService.ts` (patrón clase + instancia singleton, igual que `notificationService`) responsable de las reglas de negocio: no auto-dependencia, ambas tareas en el mismo proyecto, sin duplicados, y sin dependencias circulares (detectadas con una búsqueda en amplitud en memoria sobre los vínculos existentes, no con una consulta recursiva de SQLite). El controller (`taskController.ts`, mismo archivo que ya tiene los métodos de subtareas) sigue el mismo split ya usado en el resto de Fase 5: el controller resuelve el acceso a las tareas involucradas (reusando inline el `WHERE` de siempre, sin helper) y delega el resto al servicio, traduciendo sus errores de negocio a códigos HTTP.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente). Sin dependencias nuevas, sin migración nueva (la tabla ya existe), sin cambios de frontend.

**Spec:** Diseño aprobado en chat el 2026-09-24 (sub-proyecto "dependencias entre tareas" de Fase 5 de RPA Team Manager). Este proyecto no usa un archivo de spec separado — el diseño aprobado vive en la conversación que originó este plan. Decisiones clave tomadas ahí: (1) alcance solo backend, sin UI; (2) una dependencia solo puede crearse entre tareas del mismo proyecto; (3) las dependencias circulares (directas o transitivas) se rechazan; (4) las dependencias son puramente informativas, no bloquean ninguna acción; (5) rama de trabajo `fase5-dependencias-tareas`, creada desde `main` (no desde `fase5-comentarios-menciones`, que sigue sin mergear).

## Global Constraints

- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (nunca `db.all`). Firmas reales: `db.query(sql, params[]) => Promise<any[]>`, `db.run(sql, params[]) => Promise<{ id?: number; changes: number }>`, `db.get(sql, params[]) => Promise<any | undefined>`.
- Roles reales del sistema: `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'` — no relevante acá porque, igual que el resto de `taskController`, los endpoints nuevos no usan `authorize()` por rol, solo `authenticate`.
- Autorización: reutilizar siempre el mismo criterio de acceso a una tarea que ya usan `getTaskSubtasks`/`updateTask`/`deleteTask` en `taskController.ts` (`WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)`, vía `LEFT JOIN task_boards tb ON t.board_id = tb.id LEFT JOIN projects p ON tb.project_id = p.id`) — no introducir un chequeo nuevo. No existe ningún helper reutilizable para esto en el código real; está repetido inline en cada método, así se debe seguir haciendo.
- Al crear un vínculo hay que resolver el acceso a **las dos tareas** (la de la URL y `depends_on_task_id` del body), con la misma consulta aplicada a cada una. Si cualquiera de las dos falla, responder 404 "Task not found or access denied" sin indicar cuál de las dos.
- Las reglas de negocio (auto-dependencia, proyectos distintos, duplicado, ciclo, dependencia no encontrada al borrar) las señaliza el servicio lanzando `TaskDependencyError` (clase con `status` numérico) — nunca dejar que un error crudo de SQLite (por ejemplo, la violación del `UNIQUE(predecessor_id, successor_id)` ya existente en la tabla) llegue tal cual al cliente.
- Detección de ciclos: se hace en JS (recorrido en amplitud sobre un mapa de adyacencia armado a partir de todas las filas de `task_dependencies`), no con `WITH RECURSIVE` de SQLite — no existe ningún precedente de detección de grafos/ciclos en el código, se construye desde cero en este sub-proyecto.
- Las dependencias no bloquean ninguna transición de `tasks.status` ni ninguna otra acción — son puramente informativas, por decisión explícita del usuario.
- Sin UI ni cambios de frontend en este sub-proyecto — alcance explícito, decisión del usuario.
- Tests backend: mock manual de `db` vía `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))` + `jest.clearAllMocks()` en `beforeEach`. Cualquier test que instancie `TaskController` debe mockear también `activityLogService` y `notificationService` (aunque no se usen en el método bajo prueba), porque `taskController.ts` los importa a nivel de módulo — igual que ya hacen los tests existentes de `taskController`.
- No mergear a `main` ni abrir PR sin preguntar — se sigue trabajando en la rama `fase5-dependencias-tareas`.

## Review Focus

- Un usuario sin acceso a alguna de las dos tareas (ni `assignee`, ni `reporter`/`created_by` del proyecto, ni `assigned_to` del proyecto) no debe poder crear una dependencia — debe recibir 404 en cualquiera de los dos casos, nunca un 500 ni datos ajenos — Task 2.
- Un vínculo que generaría un ciclo **indirecto** de 3 o más tareas (no solo el caso directo A↔B) debe rechazarse igual que el ciclo directo — Task 1.
- Un vínculo entre tareas de dos proyectos distintos debe rechazarse aunque el usuario tenga acceso a ambas — Task 1.
- Crear la misma dependencia dos veces debe devolver un error de negocio claro (409), nunca un error crudo de SQLite por violar el `UNIQUE(predecessor_id, successor_id)` ya existente en la tabla — Task 1.
- Borrar una dependencia pasando un `dependencyId` que en realidad no involucra a `taskId` (ni como predecesora ni como sucesora) no debe borrar nada ajeno — debe responder 404 — Task 1 y Task 2.

---

## Task 1: `taskDependencyService.ts` — reglas de negocio y detección de ciclos

**Files:**
- Create: `backend/src/services/taskDependencyService.ts`
- Create: `backend/src/__tests__/services/taskDependencyService.test.ts`

**Interfaces:**
- Consumes: tabla `task_dependencies` (ya existe desde migración v16: `id, predecessor_id, successor_id, dependency_type, lag_days, created_at`, FK a `tasks(id)` con `ON DELETE CASCADE`, `UNIQUE(predecessor_id, successor_id)`).
- Produces (usado por Task 2): clase exportada `TaskDependencyService` y singleton `taskDependencyService`, clase de error exportada `TaskDependencyError` (con `message` y `status: number`), interfaces exportadas `TaskDependencyRow` (`{ id, predecessor_id, successor_id, dependency_type, lag_days, created_at }`) y `DependencyTaskSummary` (`{ dependency_id, task_id, title, status, dependency_type, lag_days }`). Métodos: `createDependency(taskId: number, dependsOnTaskId: number, dependencyType?: string, lagDays?: number): Promise<TaskDependencyRow>`, `getDependenciesForTask(taskId: number): Promise<{ depends_on: DependencyTaskSummary[]; blocks: DependencyTaskSummary[] }>`, `deleteDependency(taskId: number, dependencyId: number): Promise<void>`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/services/taskDependencyService.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { TaskDependencyService, TaskDependencyError } from '../../services/taskDependencyService';

describe('TaskDependencyService', () => {
    let service: TaskDependencyService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TaskDependencyService();
    });

    describe('createDependency', () => {
        it('crea la dependencia con dependency_type y lag_days por defecto', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([]);
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({
                id: 99, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });

            const result = await service.createDependency(10, 20);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO task_dependencies'),
                [20, 10, 'finish_to_start', 0]
            );
            expect(result).toEqual({
                id: 99, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });
        });

        it('crea la dependencia con dependency_type y lag_days explicitos', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([]);
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({
                id: 99, predecessor_id: 20, successor_id: 10, dependency_type: 'start_to_start', lag_days: 2
            });

            await service.createDependency(10, 20, 'start_to_start', 2);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO task_dependencies'),
                [20, 10, 'start_to_start', 2]
            );
        });

        it('rechaza la auto-dependencia sin consultar la base de datos', async () => {
            await expect(service.createDependency(10, 10)).rejects.toThrow(TaskDependencyError);
            expect(db.query).not.toHaveBeenCalled();
        });

        it('rechaza si alguna de las dos tareas no existe', async () => {
            (db.query as jest.Mock).mockResolvedValueOnce([{ id: 10, project_id: 1 }]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 404 });
        });

        it('rechaza si las tareas pertenecen a proyectos distintos', async () => {
            (db.query as jest.Mock).mockResolvedValueOnce([
                { id: 10, project_id: 1 }, { id: 20, project_id: 2 }
            ]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 400 });
        });

        it('rechaza una dependencia duplicada sin llegar al INSERT', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([{ predecessor_id: 20, successor_id: 10 }]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 409 });
            expect(db.run).not.toHaveBeenCalled();
        });

        it('rechaza un ciclo directo (la tarea 10 depende de la 20, que ya depende de la 10)', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([{ predecessor_id: 10, successor_id: 20 }]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 400 });
            expect(db.run).not.toHaveBeenCalled();
        });

        it('rechaza un ciclo indirecto de 3 tareas (10 depende de 20, 20 depende de 30, se intenta 30 depende de 10)', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 30, project_id: 1 }, { id: 10, project_id: 1 }])
                .mockResolvedValueOnce([
                    { predecessor_id: 20, successor_id: 10 },
                    { predecessor_id: 30, successor_id: 20 }
                ]);

            await expect(service.createDependency(30, 10)).rejects.toMatchObject({ status: 400 });
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('getDependenciesForTask', () => {
        it('devuelve depends_on y blocks por separado', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }])
                .mockResolvedValueOnce([{ dependency_id: 2, task_id: 30, title: 'C', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }]);

            const result = await service.getDependenciesForTask(10);

            expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('td.successor_id = ?'), [10]);
            expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('td.predecessor_id = ?'), [10]);
            expect(result).toEqual({
                depends_on: [{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }],
                blocks: [{ dependency_id: 2, task_id: 30, title: 'C', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }]
            });
        });
    });

    describe('deleteDependency', () => {
        it('borra la dependencia cuando la tarea es predecesora o sucesora', async () => {
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            await service.deleteDependency(10, 99);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM task_dependencies'),
                [99, 10, 10]
            );
        });

        it('lanza 404 si no borro ninguna fila (el dependencyId no involucra a esa tarea)', async () => {
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });

            await expect(service.deleteDependency(10, 99)).rejects.toMatchObject({ status: 404 });
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/services/taskDependencyService.test.ts`
Expected: FAIL — `../../services/taskDependencyService` no existe todavía.

- [ ] **Step 3: Implementar el servicio**

Crear `backend/src/services/taskDependencyService.ts`:

```typescript
import { db } from '../database/database';

export class TaskDependencyError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'TaskDependencyError';
        this.status = status;
    }
}

export interface TaskDependencyRow {
    id: number;
    predecessor_id: number;
    successor_id: number;
    dependency_type: string;
    lag_days: number;
    created_at: string;
}

export interface DependencyTaskSummary {
    dependency_id: number;
    task_id: number;
    title: string;
    status: string;
    dependency_type: string;
    lag_days: number;
}

interface DependencyEdge {
    predecessor_id: number;
    successor_id: number;
}

export class TaskDependencyService {

    async createDependency(
        taskId: number,
        dependsOnTaskId: number,
        dependencyType: string = 'finish_to_start',
        lagDays: number = 0
    ): Promise<TaskDependencyRow> {
        if (taskId === dependsOnTaskId) {
            throw new TaskDependencyError('Una tarea no puede depender de si misma', 400);
        }

        const tasks = await db.query(`
            SELECT t.id, tb.project_id
            FROM tasks t
            LEFT JOIN task_boards tb ON t.board_id = tb.id
            WHERE t.id IN (?, ?)
        `, [taskId, dependsOnTaskId]);

        const taskRow = tasks.find((t: any) => t.id === taskId);
        const dependsOnRow = tasks.find((t: any) => t.id === dependsOnTaskId);

        if (!taskRow || !dependsOnRow) {
            throw new TaskDependencyError('Task not found', 404);
        }

        if (taskRow.project_id !== dependsOnRow.project_id) {
            throw new TaskDependencyError('Las dos tareas deben pertenecer al mismo proyecto', 400);
        }

        const edges: DependencyEdge[] = await db.query(`
            SELECT predecessor_id, successor_id FROM task_dependencies
        `);

        const isDuplicate = edges.some((e) => e.predecessor_id === dependsOnTaskId && e.successor_id === taskId);
        if (isDuplicate) {
            throw new TaskDependencyError('Esta dependencia ya existe', 409);
        }

        if (this.hasPath(edges, taskId, dependsOnTaskId)) {
            throw new TaskDependencyError('Esta dependencia generaria un ciclo entre tareas', 400);
        }

        const result = await db.run(`
            INSERT INTO task_dependencies (predecessor_id, successor_id, dependency_type, lag_days)
            VALUES (?, ?, ?, ?)
        `, [dependsOnTaskId, taskId, dependencyType, lagDays]);

        return db.get(`
            SELECT id, predecessor_id, successor_id, dependency_type, lag_days, created_at
            FROM task_dependencies WHERE id = ?
        `, [result.id]);
    }

    async getDependenciesForTask(taskId: number): Promise<{ depends_on: DependencyTaskSummary[]; blocks: DependencyTaskSummary[] }> {
        const dependsOn = await db.query(`
            SELECT td.id as dependency_id, t.id as task_id, t.title, t.status, td.dependency_type, td.lag_days
            FROM task_dependencies td
            JOIN tasks t ON t.id = td.predecessor_id
            WHERE td.successor_id = ?
            ORDER BY td.id ASC
        `, [taskId]);

        const blocks = await db.query(`
            SELECT td.id as dependency_id, t.id as task_id, t.title, t.status, td.dependency_type, td.lag_days
            FROM task_dependencies td
            JOIN tasks t ON t.id = td.successor_id
            WHERE td.predecessor_id = ?
            ORDER BY td.id ASC
        `, [taskId]);

        return { depends_on: dependsOn, blocks };
    }

    async deleteDependency(taskId: number, dependencyId: number): Promise<void> {
        const result = await db.run(`
            DELETE FROM task_dependencies WHERE id = ? AND (predecessor_id = ? OR successor_id = ?)
        `, [dependencyId, taskId, taskId]);

        if (result.changes === 0) {
            throw new TaskDependencyError('Dependency not found', 404);
        }
    }

    private hasPath(edges: DependencyEdge[], fromId: number, toId: number): boolean {
        const adjacency = new Map<number, number[]>();
        for (const edge of edges) {
            const list = adjacency.get(edge.predecessor_id) || [];
            list.push(edge.successor_id);
            adjacency.set(edge.predecessor_id, list);
        }

        const visited = new Set<number>();
        const queue: number[] = [fromId];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === toId) {
                return true;
            }
            if (visited.has(current)) continue;
            visited.add(current);
            queue.push(...(adjacency.get(current) || []));
        }

        return false;
    }
}

export const taskDependencyService = new TaskDependencyService();
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/services/taskDependencyService.test.ts`
Expected: PASS (los 11 tests)

- [ ] **Step 5: Compilar para confirmar que todo tipa bien**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/taskDependencyService.ts backend/src/__tests__/services/taskDependencyService.test.ts
git commit -m "feat(fase5): taskDependencyService con deteccion de ciclos y validaciones"
```

---

## Task 2: Endpoints REST de dependencias en `taskController`/`taskRoutes`

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/routes/taskRoutes.ts`
- Create: `backend/src/__tests__/controllers/taskController.dependencies.test.ts`

**Interfaces:**
- Consumes: `taskDependencyService.createDependency`, `taskDependencyService.getDependenciesForTask`, `taskDependencyService.deleteDependency`, `TaskDependencyError` (Task 1).
- Produces: `GET /api/tasks/:taskId/dependencies` → `{ depends_on: DependencyTaskSummary[], blocks: DependencyTaskSummary[] }`; `POST /api/tasks/:taskId/dependencies` (body `{ depends_on_task_id, dependency_type?, lag_days? }`) → `TaskDependencyRow` con status 201; `DELETE /api/tasks/:taskId/dependencies/:dependencyId` → `{ success: true, deletedId }`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.dependencies.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));
jest.mock('../../services/taskDependencyService', () => {
    const actual = jest.requireActual('../../services/taskDependencyService');
    return {
        ...actual,
        taskDependencyService: {
            createDependency: jest.fn(),
            getDependenciesForTask: jest.fn(),
            deleteDependency: jest.fn()
        }
    };
});

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { TaskController } from '../../controllers/taskController';
import { taskDependencyService, TaskDependencyError } from '../../services/taskDependencyService';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - dependencias entre tareas', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskDependencies', () => {
        it('devuelve depends_on/blocks si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10 });
            (taskDependencyService.getDependenciesForTask as jest.Mock).mockResolvedValue({
                depends_on: [{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }],
                blocks: []
            });
            const req = { params: { taskId: '10' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskDependencies(req, res);

            expect(taskDependencyService.getDependenciesForTask).toHaveBeenCalledWith(10);
            expect(res.json).toHaveBeenCalledWith({
                depends_on: [{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }],
                blocks: []
            });
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskDependencies(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.getDependenciesForTask).not.toHaveBeenCalled();
        });
    });

    describe('createTaskDependency', () => {
        it('crea la dependencia cuando el usuario tiene acceso a ambas tareas', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce({ id: 20 });
            (taskDependencyService.createDependency as jest.Mock).mockResolvedValue({
                id: 5, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(taskDependencyService.createDependency).toHaveBeenCalledWith(10, 20, undefined, undefined);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                id: 5, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });
        });

        it('devuelve 400 si falta depends_on_task_id', async () => {
            const req = { params: { taskId: '10' }, body: {}, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea de la URL', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce(undefined);
            const req = {
                params: { taskId: '999' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.createDependency).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea de la que se depende', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce(undefined);
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 999 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.createDependency).not.toHaveBeenCalled();
        });

        it('traduce un error de negocio del service a su status code', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce({ id: 20 });
            (taskDependencyService.createDependency as jest.Mock).mockRejectedValue(
                new TaskDependencyError('Esta dependencia generaria un ciclo entre tareas', 400)
            );
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Esta dependencia generaria un ciclo entre tareas' });
        });

        it('devuelve 500 si el service lanza un error inesperado', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce({ id: 20 });
            (taskDependencyService.createDependency as jest.Mock).mockRejectedValue(new Error('disk full'));
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('deleteTaskDependency', () => {
        it('borra la dependencia cuando el usuario tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10 });
            (taskDependencyService.deleteDependency as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '10', dependencyId: '5' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskDependency(req, res);

            expect(taskDependencyService.deleteDependency).toHaveBeenCalledWith(10, 5);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: '5' });
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', dependencyId: '5' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.deleteDependency).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el dependencyId no pertenece a esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10 });
            (taskDependencyService.deleteDependency as jest.Mock).mockRejectedValue(
                new TaskDependencyError('Dependency not found', 404)
            );
            const req = { params: { taskId: '10', dependencyId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Dependency not found' });
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.dependencies.test.ts`
Expected: FAIL — `controller.getTaskDependencies`/`createTaskDependency`/`deleteTaskDependency` no son funciones todavía.

- [ ] **Step 3: Agregar el import del servicio en `taskController.ts`**

En `backend/src/controllers/taskController.ts`, reemplazar (líneas 11-12 actuales):

```typescript
import { activityLogService } from '../services/activityLogService';
import { notificationService } from '../services/notificationService';
```

por:

```typescript
import { activityLogService } from '../services/activityLogService';
import { notificationService } from '../services/notificationService';
import { taskDependencyService, TaskDependencyError } from '../services/taskDependencyService';
```

- [ ] **Step 4: Implementar los 3 métodos en `taskController.ts`**

Agregar en `backend/src/controllers/taskController.ts`, justo después del cierre de `deleteTaskSubtask` (línea 893 actual, antes del comentario `// GET /api/tasks/my-tasks` en la línea 895):

```typescript
  // GET /api/tasks/:taskId/dependencies - List dependencies for a task (depends_on / blocks)
  getTaskDependencies = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const userId = req.user?.id;

      const task = await db.get(`
        SELECT t.id
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [taskId, userId, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      const dependencies = await taskDependencyService.getDependenciesForTask(Number(taskId));

      res.json(dependencies);
    } catch (error) {
      logger.error('Get task dependencies error:', error);
      res.status(500).json({ error: 'Failed to get dependencies' });
    }
  };

  // POST /api/tasks/:taskId/dependencies - Create a dependency (:taskId depends on depends_on_task_id)
  createTaskDependency = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const userId = req.user?.id;
      const { depends_on_task_id, dependency_type, lag_days } = req.body;

      if (!depends_on_task_id) {
        res.status(400).json({ error: 'depends_on_task_id is required' });
        return;
      }

      const task = await db.get(`
        SELECT t.id
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [taskId, userId, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      const dependsOnTask = await db.get(`
        SELECT t.id
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [depends_on_task_id, userId, userId, userId]);

      if (!dependsOnTask) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      const dependency = await taskDependencyService.createDependency(
        Number(taskId),
        Number(depends_on_task_id),
        dependency_type,
        lag_days
      );

      res.status(201).json(dependency);
    } catch (error) {
      if (error instanceof TaskDependencyError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Create task dependency error:', error);
      res.status(500).json({ error: 'Failed to create dependency' });
    }
  };

  // DELETE /api/tasks/:taskId/dependencies/:dependencyId - Delete a dependency
  deleteTaskDependency = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId, dependencyId } = req.params;
      const userId = req.user?.id;

      const task = await db.get(`
        SELECT t.id
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [taskId, userId, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      await taskDependencyService.deleteDependency(Number(taskId), Number(dependencyId));

      res.json({ success: true, deletedId: dependencyId });
    } catch (error) {
      if (error instanceof TaskDependencyError) {
        res.status(error.status).json({ error: error.message });
        return;
      }
      logger.error('Delete task dependency error:', error);
      res.status(500).json({ error: 'Failed to delete dependency' });
    }
  };

```

- [ ] **Step 5: Registrar las rutas**

En `backend/src/routes/taskRoutes.ts`, agregar después de la línea 35 (`router.delete('/tasks/:taskId/subtasks/:subtaskId', authenticate, taskController.deleteTaskSubtask);`) y antes de la línea 37 (`router.get('/tasks/my-tasks', ...)`):

```typescript

// Dependencias entre tareas - path de 3 segmentos, no colisiona con /tasks/:id
router.get('/tasks/:taskId/dependencies', authenticate, taskController.getTaskDependencies);
router.post('/tasks/:taskId/dependencies', authenticate, taskController.createTaskDependency);
router.delete('/tasks/:taskId/dependencies/:dependencyId', authenticate, taskController.deleteTaskDependency);
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.dependencies.test.ts`
Expected: PASS (los 11 tests)

- [ ] **Step 7: Correr toda la suite de taskController y de services para confirmar que nada existente se rompió**

Run: `cd backend && npx jest taskController taskDependencyService`
Expected: PASS

- [ ] **Step 8: Compilar para confirmar que todo tipa bien**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/routes/taskRoutes.ts backend/src/__tests__/controllers/taskController.dependencies.test.ts
git commit -m "feat(fase5): endpoints REST de dependencias entre tareas"
```

---

## Task 3: Revisión final del sub-proyecto

- [ ] **Step 1: Correr toda la suite de backend**

Run: `cd backend && npm test`
Expected: todos los tests en PASS (los existentes + los agregados en Tasks 1-2)

- [ ] **Step 2: Compilar el backend**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 3: Revisión de todo el diff del sub-proyecto (desde el primer commit de Task 1 hasta el último de Task 2), no de `main..HEAD` completo**

Usar `superpowers:requesting-code-review` acotado a los commits de esta rama (`fase5-dependencias-tareas`), igual que se hizo al cerrar los sub-proyectos anteriores de Fase 5.
