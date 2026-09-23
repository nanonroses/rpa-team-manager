# Subtareas (Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar subtareas tipo checklist liviano a las tareas existentes de `TasksPage`: una tarea puede tener una lista de ítems con título + marcado hecho/pendiente, sin asignado propio, sin status propio, y sin afectar el status de la tarea padre. El Kanban muestra un contador "hechas/total" en la tarjeta cuando la tarea tiene subtareas.

**Architecture:** Tabla nueva dedicada `task_subtasks` (relación 1 tarea → N subtareas, `ON DELETE CASCADE` al borrar la tarea padre). CRUD expuesto bajo `/api/tasks/:taskId/subtasks` en el mismo `taskController`/`taskRoutes` existente, reusando el criterio de acceso por pertenencia que ya usan `updateTask`/`deleteTask`/`getTaskById` (sin `authorize()` por rol). Sin integración con `activityLogService` ni `notificationService` — completamente silencioso, por decisión explícita. Frontend: un componente nuevo y autocontenido `TaskSubtasksChecklist` (fetch propio, alta/tilde/borrado propios) que se monta dentro del modal de edición de tarea ya existente en `TasksPage.tsx`, más un contador agregado a la query de `getBoard` para pintarlo en la tarjeta del Kanban.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente), React 18/TypeScript/Vite/Ant Design (frontend ya existente). Sin dependencias nuevas.

**Spec:** Diseño aprobado en chat el 2026-09-22 (sub-proyecto "subtareas" de Fase 5 de RPA Team Manager). Este proyecto no usa un archivo de spec separado — el diseño aprobado vive en la conversación que originó este plan; lo que sigue es su traducción a tareas ejecutables. Una simplificación respecto al diseño conversado: la tabla **no** tiene columna `position` — el usuario decidió explícitamente que no hace falta reordenar en esta primera versión, así que el orden es simplemente `id ASC` (orden de creación), sin necesidad de mantener una columna adicional para eso.

## Global Constraints

- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (nunca `db.all`).
- Roles reales del sistema: `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'` — no relevante acá porque, igual que el resto de `taskController`, los endpoints de subtareas no usan `authorize()` por rol.
- Autorización de subtareas: siempre reutilizar el mismo criterio de acceso a la tarea que ya usan `updateTask`/`deleteTask`/`getTaskById` en `taskController.ts` (`p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?`) — no introducir un chequeo nuevo.
- Sin integración con `activityLogService` ni `notificationService` — las subtareas no generan actividad ni notificaciones, por decisión explícita del usuario.
- El completado de subtareas nunca debe modificar `tasks.status` ni bloquear ninguna transición de status — es puramente informativo.
- Tests backend: mock manual de `db` vía `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))` + `jest.clearAllMocks()` en `beforeEach`. Cualquier test que instancie `TaskController` debe mockear también `activityLogService` y `notificationService` (aunque no se usen en el método bajo prueba), porque `taskController.ts` los importa a nivel de módulo — igual que ya hacen `taskController.getById.test.ts` y `taskController.notifications.test.ts`.
- Tests frontend: Vitest + Testing Library, mock de `@/services/api` vía `vi.mock`, componentes que usen hooks de `react-router-dom` se renderizan envueltos en `<MemoryRouter>`.
- No mergear a `main` ni abrir PR — se sigue trabajando en la rama `fase0-saneamiento-seguridad`.

## Review Focus

- Un usuario sin acceso a la tarea (no es `assignee`, no es `reporter`/`created_by` del proyecto, no es `assigned_to` del proyecto) no debe poder listar/crear/editar/borrar subtareas de esa tarea vía los endpoints nuevos — debe recibir 404, nunca datos ajenos ni un 500 — Task 2.
- Editar o borrar una subtarea pasando un `subtaskId` que en realidad pertenece a OTRA tarea (con un `taskId` distinto en la URL) no debe afectar esa subtarea ajena — el `WHERE` debe filtrar siempre por `id AND task_id` juntos, nunca solo por `id` — Task 2.
- Borrar la tarea padre debe borrar sus subtareas automáticamente vía `ON DELETE CASCADE`, no dejarlas huérfanas en `task_subtasks` — Task 1.
- Un título de subtarea vacío o compuesto solo de espacios no debe crear una fila — Task 2.
- El modal de "Nueva Tarea" (crear, no editar) no debe intentar montar el checklist de subtareas — todavía no existe un `id` real de tarea al que asociarlas hasta que se guarde por primera vez — Task 5.

---

## Task 1: Migración v33 — tabla `task_subtasks`

**Files:**
- Modify: `backend/src/database/migrationList.ts` (agregar al final del array `migrations`, después del cierre de `version: 32` en la línea 1560)
- Create: `backend/src/__tests__/database/migration33.test.ts`

**Interfaces:**
- Produces: tabla `task_subtasks (id, task_id, title, is_done, created_at, updated_at)` con `FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE`, usada por Tasks 2 y 3.

- [ ] **Step 1: Escribir el test de migración (falla porque la migración no existe todavía)**

Crear `backend/src/__tests__/database/migration33.test.ts`:

```typescript
import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 33 - task_subtasks (checklist liviano de subtareas)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration33-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('crea la tabla task_subtasks con las columnas esperadas', async () => {
        const cols = await columnNames('task_subtasks');
        expect(cols).toEqual(expect.arrayContaining(['id', 'task_id', 'title', 'is_done', 'created_at', 'updated_at']));
    });

    it('permite insertar una subtarea asociada a una tarea existente', async () => {
        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`);
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto X', 1)`);
        await run(`INSERT INTO task_boards (project_id, name) VALUES (1, 'Board 1')`);
        await run(`INSERT INTO task_columns (board_id, name, position) VALUES (1, 'To Do', 0)`);
        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea', 1)`);

        const result = await run(`INSERT INTO task_subtasks (task_id, title) VALUES (1, 'Sub 1')`);
        expect(result.changes).toBe(1);

        const rows = await all(`SELECT * FROM task_subtasks WHERE task_id = 1`);
        expect(rows).toHaveLength(1);
        expect(rows[0].is_done).toBe(0);
    });

    it('borra en cascada las subtareas cuando se borra la tarea padre', async () => {
        await run('PRAGMA foreign_keys = ON');

        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea a borrar', 1)`);
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea a borrar'`);
        const taskId = taskRow[0].id;
        await run(`INSERT INTO task_subtasks (task_id, title) VALUES (?, 'Sub huerfana')`, [taskId]);

        await run(`DELETE FROM tasks WHERE id = ?`, [taskId]);

        const remaining = await all(`SELECT * FROM task_subtasks WHERE task_id = ?`, [taskId]);
        expect(remaining).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest __tests__/database/migration33.test.ts`
Expected: FAIL — la tabla `task_subtasks` no existe todavía.

- [ ] **Step 3: Agregar la migración 33**

En `backend/src/database/migrationList.ts`, reemplazar el cierre del array (líneas 1558-1561 actuales):

```typescript
      `CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(user_id, event_key, entity_id)`
    ]
  }
];
```

por:

```typescript
      `CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(user_id, event_key, entity_id)`
    ]
  },

  {
    version: 33,
    description: 'Subtareas (checklist liviano) para tasks - Fase 5',
    up: [
      `CREATE TABLE IF NOT EXISTS task_subtasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        is_done BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )`,

      `CREATE INDEX IF NOT EXISTS idx_task_subtasks_task ON task_subtasks(task_id)`
    ]
  }
];
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest __tests__/database/migration33.test.ts`
Expected: PASS (los 3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration33.test.ts
git commit -m "feat(fase5): migracion v33 - tabla task_subtasks"
```

---

## Task 2: Endpoints CRUD de subtareas en `taskController`

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/routes/taskRoutes.ts`
- Create: `backend/src/__tests__/controllers/taskController.subtasks.test.ts`

**Interfaces:**
- Consumes: tabla `task_subtasks` (Task 1).
- Produces (usado por Task 4): `GET /api/tasks/:taskId/subtasks`, `POST /api/tasks/:taskId/subtasks` (`{ title }`), `PATCH /api/tasks/:taskId/subtasks/:subtaskId` (`{ title?, is_done? }`), `DELETE /api/tasks/:taskId/subtasks/:subtaskId`. Cada fila devuelta tiene forma `{ id, task_id, title, is_done, created_at, updated_at }`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.subtasks.test.ts`:

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

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - subtareas', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskSubtasks', () => {
        it('devuelve las subtareas de la tarea si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, task_id: 55, title: 'Sub A', is_done: 0 }
            ]);
            const req = { params: { taskId: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskSubtasks(req, res);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM task_subtasks'), ['55']);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, task_id: 55, title: 'Sub A', is_done: 0 }]);
        });

        it('devuelve 404 si la tarea no existe o el usuario no tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskSubtasks(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.query).not.toHaveBeenCalled();
        });
    });

    describe('createTaskSubtask', () => {
        it('crea la subtarea y devuelve la fila creada', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce({ id: 7, task_id: 55, title: 'Nueva sub', is_done: 0 });
            (db.run as jest.Mock).mockResolvedValue({ id: 7, changes: 1 });
            const req = { params: { taskId: '55' }, body: { title: 'Nueva sub' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO task_subtasks'), ['55', 'Nueva sub']);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 7, task_id: 55, title: 'Nueva sub', is_done: 0 });
        });

        it('devuelve 400 si el titulo viene vacio o solo con espacios', async () => {
            const req = { params: { taskId: '55' }, body: { title: '   ' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, body: { title: 'X' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('updateTaskSubtask', () => {
        it('marca is_done y devuelve la fila actualizada', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce({ id: 7, task_id: 55, title: 'Sub A', is_done: 1 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = {
                params: { taskId: '55', subtaskId: '7' }, body: { is_done: true }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE task_subtasks'),
                [undefined, 1, '7', '55']
            );
            expect(res.json).toHaveBeenCalledWith({ id: 7, task_id: 55, title: 'Sub A', is_done: 1 });
        });

        it('devuelve 404 si el subtaskId no pertenece a esa tarea (no afecta subtareas de otra tarea)', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });
            const req = {
                params: { taskId: '55', subtaskId: '999' }, body: { is_done: true }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.any(String), [undefined, 1, '999', '55']);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = {
                params: { taskId: '999', subtaskId: '7' }, body: { is_done: true }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('deleteTaskSubtask', () => {
        it('borra la subtarea de esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { taskId: '55', subtaskId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM task_subtasks'), ['7', '55']);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: '7' });
        });

        it('devuelve 404 si el subtaskId no pertenece a esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });
            const req = { params: { taskId: '55', subtaskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', subtaskId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.subtasks.test.ts`
Expected: FAIL — `controller.getTaskSubtasks`/`createTaskSubtask`/`updateTaskSubtask`/`deleteTaskSubtask` no son funciones todavía.

- [ ] **Step 3: Implementar los 4 métodos en `taskController.ts`**

Agregar en `backend/src/controllers/taskController.ts`, justo antes del cierre de la clase (después del método `moveTask`, que termina en la línea 728 actual, y antes de `getMyTasks` en la línea 730):

```typescript
  // GET /api/tasks/:taskId/subtasks - List subtasks for a task
  getTaskSubtasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const subtasks = await db.query(`
        SELECT id, task_id, title, is_done, created_at, updated_at
        FROM task_subtasks
        WHERE task_id = ?
        ORDER BY id ASC
      `, [taskId]);

      res.json(subtasks);
    } catch (error) {
      logger.error('Get task subtasks error:', error);
      res.status(500).json({ error: 'Failed to get subtasks' });
    }
  };

  // POST /api/tasks/:taskId/subtasks - Create a subtask
  createTaskSubtask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const userId = req.user?.id;
      const { title } = req.body;

      if (!title || !title.trim()) {
        res.status(400).json({ error: 'Title is required' });
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

      const result = await db.run(`
        INSERT INTO task_subtasks (task_id, title)
        VALUES (?, ?)
      `, [taskId, title.trim()]);

      const subtask = await db.get(`
        SELECT id, task_id, title, is_done, created_at, updated_at
        FROM task_subtasks WHERE id = ?
      `, [result.id]);

      res.status(201).json(subtask);
    } catch (error) {
      logger.error('Create task subtask error:', error);
      res.status(500).json({ error: 'Failed to create subtask' });
    }
  };

  // PATCH /api/tasks/:taskId/subtasks/:subtaskId - Update a subtask (title and/or is_done)
  updateTaskSubtask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId, subtaskId } = req.params;
      const userId = req.user?.id;
      const { title, is_done } = req.body;

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

      const result = await db.run(`
        UPDATE task_subtasks
        SET title = COALESCE(?, title),
            is_done = COALESCE(?, is_done),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND task_id = ?
      `, [title, is_done === undefined ? undefined : (is_done ? 1 : 0), subtaskId, taskId]);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Subtask not found' });
        return;
      }

      const subtask = await db.get(`
        SELECT id, task_id, title, is_done, created_at, updated_at
        FROM task_subtasks WHERE id = ?
      `, [subtaskId]);

      res.json(subtask);
    } catch (error) {
      logger.error('Update task subtask error:', error);
      res.status(500).json({ error: 'Failed to update subtask' });
    }
  };

  // DELETE /api/tasks/:taskId/subtasks/:subtaskId - Delete a subtask
  deleteTaskSubtask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId, subtaskId } = req.params;
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

      const result = await db.run(`
        DELETE FROM task_subtasks WHERE id = ? AND task_id = ?
      `, [subtaskId, taskId]);

      if (result.changes === 0) {
        res.status(404).json({ error: 'Subtask not found' });
        return;
      }

      res.json({ success: true, deletedId: subtaskId });
    } catch (error) {
      logger.error('Delete task subtask error:', error);
      res.status(500).json({ error: 'Failed to delete subtask' });
    }
  };

```

- [ ] **Step 4: Registrar las rutas**

En `backend/src/routes/taskRoutes.ts`, agregar después de la línea 29 (`router.get('/tasks/:id/activity', authenticate, taskController.getTaskActivity);`) y antes de la línea 30 (`router.get('/tasks/my-tasks', ...)`):

```typescript
// Subtareas (checklist liviano) - path de 3 segmentos, no colisiona con /tasks/:id
router.get('/tasks/:taskId/subtasks', authenticate, taskController.getTaskSubtasks);
router.post('/tasks/:taskId/subtasks', authenticate, taskController.createTaskSubtask);
router.patch('/tasks/:taskId/subtasks/:subtaskId', authenticate, taskController.updateTaskSubtask);
router.delete('/tasks/:taskId/subtasks/:subtaskId', authenticate, taskController.deleteTaskSubtask);
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.subtasks.test.ts`
Expected: PASS (los 12 tests)

- [ ] **Step 6: Correr toda la suite de taskController para confirmar que nada existente se rompió**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 7: Compilar para confirmar que todo tipa bien**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/routes/taskRoutes.ts backend/src/__tests__/controllers/taskController.subtasks.test.ts
git commit -m "feat(fase5): endpoints CRUD de subtareas (task_subtasks)"
```

---

## Task 3: Contador de subtareas en `getBoard`

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/__tests__/controllers/taskController.subtasks.test.ts`

**Interfaces:**
- Produces (usado por Task 5): cada tarea devuelta por `GET /api/tasks/boards/:id` incluye ahora `subtasks_total: number` y `subtasks_done: number` (0 cuando la tarea no tiene subtareas).

- [ ] **Step 1: Agregar el test que falla**

Agregar al final de `backend/src/__tests__/controllers/taskController.subtasks.test.ts`, un nuevo `describe` (fuera del `describe('TaskController - subtareas', ...)` existente, al final del archivo):

```typescript
describe('TaskController.getBoard - contador de subtareas', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('incluye subtasks_total y subtasks_done en cada tarea del board', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 2, name: 'Board 1', project_name: 'AGROSUPER' });
        (db.query as jest.Mock)
            .mockResolvedValueOnce([{ id: 1, name: 'To Do', position: 0 }])
            .mockResolvedValueOnce([
                { id: 55, title: 'Con subtareas', subtasks_total: 3, subtasks_done: 1 },
                { id: 56, title: 'Sin subtareas', subtasks_total: 0, subtasks_done: 0 }
            ]);
        const req = { params: { id: '2' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getBoard(req, res);

        expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('subtasks_total'), ['2']);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            tasks: [
                { id: 55, title: 'Con subtareas', subtasks_total: 3, subtasks_done: 1 },
                { id: 56, title: 'Sin subtareas', subtasks_total: 0, subtasks_done: 0 }
            ]
        }));
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest __tests__/controllers/taskController.subtasks.test.ts -t "contador de subtareas"`
Expected: FAIL — la query de `getBoard` todavía no selecciona `subtasks_total`/`subtasks_done`, así que el segundo `db.query` no recibe una consulta que contenga `'subtasks_total'`.

- [ ] **Step 3: Modificar la query de tasks en `getBoard`**

En `backend/src/controllers/taskController.ts`, reemplazar (líneas 84-106 actuales):

```typescript
      // Get tasks for this board with user info
      const tasks = await db.query(`
        SELECT
          t.*,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name,
          te.total_hours,
          te.total_value
        FROM tasks t
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        LEFT JOIN (
          SELECT
            task_id,
            SUM(hours) as total_hours,
            SUM(hours * hourly_rate) as total_value
          FROM time_entries
          WHERE task_id IS NOT NULL
          GROUP BY task_id
        ) te ON t.id = te.task_id
        WHERE t.board_id = ?
        ORDER BY t.position ASC
      `, [id]);
```

por:

```typescript
      // Get tasks for this board with user info
      const tasks = await db.query(`
        SELECT
          t.*,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name,
          te.total_hours,
          te.total_value,
          COALESCE(st.subtasks_total, 0) as subtasks_total,
          COALESCE(st.subtasks_done, 0) as subtasks_done
        FROM tasks t
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        LEFT JOIN (
          SELECT
            task_id,
            SUM(hours) as total_hours,
            SUM(hours * hourly_rate) as total_value
          FROM time_entries
          WHERE task_id IS NOT NULL
          GROUP BY task_id
        ) te ON t.id = te.task_id
        LEFT JOIN (
          SELECT
            task_id,
            COUNT(*) as subtasks_total,
            SUM(CASE WHEN is_done = 1 THEN 1 ELSE 0 END) as subtasks_done
          FROM task_subtasks
          GROUP BY task_id
        ) st ON t.id = st.task_id
        WHERE t.board_id = ?
        ORDER BY t.position ASC
      `, [id]);
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.subtasks.test.ts`
Expected: PASS (todos los tests del archivo, incluidos los de Task 2)

- [ ] **Step 5: Correr toda la suite de taskController**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/__tests__/controllers/taskController.subtasks.test.ts
git commit -m "feat(fase5): contador de subtareas (subtasks_total/subtasks_done) en getBoard"
```

---

## Task 4: Componente frontend `TaskSubtasksChecklist` + métodos de API

**Files:**
- Create: `frontend/src/components/tasks/TaskSubtasksChecklist.tsx`
- Create: `frontend/src/__tests__/components/TaskSubtasksChecklist.test.tsx`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Consumes: `apiService.getTaskSubtasks`, `apiService.createTaskSubtask`, `apiService.updateTaskSubtask`, `apiService.deleteTaskSubtask` (agregados en este task).
- Produces (usado por Task 5): `export const TaskSubtasksChecklist: React.FC<{ taskId: number; onChange?: () => void }>`.

- [ ] **Step 1: Agregar los métodos de API que fallan (no existen todavía)**

En `frontend/src/services/api.ts`, agregar después de `getMyTasks` (línea 587 actual, antes de `getProjectGantt`):

```typescript
  async getTaskSubtasks(taskId: number): Promise<any[]> {
    const response = await this.api.get(`/tasks/${taskId}/subtasks`);
    return response.data;
  }

  async createTaskSubtask(taskId: number, title: string): Promise<any> {
    const response = await this.api.post(`/tasks/${taskId}/subtasks`, { title });
    return response.data;
  }

  async updateTaskSubtask(taskId: number, subtaskId: number, data: { title?: string; is_done?: boolean }): Promise<any> {
    const response = await this.api.patch(`/tasks/${taskId}/subtasks/${subtaskId}`, data);
    return response.data;
  }

  async deleteTaskSubtask(taskId: number, subtaskId: number): Promise<any> {
    const response = await this.api.delete(`/tasks/${taskId}/subtasks/${subtaskId}`);
    return response.data;
  }
```

(Este archivo no tiene tests dedicados propios — es una capa fina de wrappers de axios, siguiendo la convención ya establecida en el repo: ningún otro método de `api.ts` tiene test propio, se verifican indirectamente vía los tests de los componentes que los usan.)

- [ ] **Step 2: Escribir los tests del componente (fallan porque no existe)**

Crear `frontend/src/__tests__/components/TaskSubtasksChecklist.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getTaskSubtasks: vi.fn(),
    createTaskSubtask: vi.fn(),
    updateTaskSubtask: vi.fn(),
    deleteTaskSubtask: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TaskSubtasksChecklist } from '@/components/tasks/TaskSubtasksChecklist';

describe('TaskSubtasksChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra las subtareas existentes con el contador de hechas', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 1 },
      { id: 2, task_id: 10, title: 'Sub B', is_done: 0 }
    ]);

    render(<TaskSubtasksChecklist taskId={10} />);

    expect(await screen.findByText('Sub A')).toBeInTheDocument();
    expect(screen.getByText('Subtareas (1/2)')).toBeInTheDocument();
  });

  it('muestra un estado vacio cuando la tarea no tiene subtareas', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);

    render(<TaskSubtasksChecklist taskId={10} />);

    expect(await screen.findByText('Sin subtareas todavía')).toBeInTheDocument();
  });

  it('agrega una subtarea nueva al escribir y presionar el boton Agregar', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
    (apiService.createTaskSubtask as any).mockResolvedValue({ id: 3, task_id: 10, title: 'Nueva sub', is_done: 0 });

    render(<TaskSubtasksChecklist taskId={10} />);
    await waitFor(() => expect(apiService.getTaskSubtasks).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('Agregar subtarea...'), 'Nueva sub');
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));

    expect(apiService.createTaskSubtask).toHaveBeenCalledWith(10, 'Nueva sub');
    expect(await screen.findByText('Nueva sub')).toBeInTheDocument();
  });

  it('marca una subtarea como hecha al tildar el checkbox', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 0 }
    ]);
    (apiService.updateTaskSubtask as any).mockResolvedValue({ id: 1, task_id: 10, title: 'Sub A', is_done: 1 });

    render(<TaskSubtasksChecklist taskId={10} />);
    await screen.findByText('Sub A');

    await userEvent.click(screen.getByRole('checkbox'));

    expect(apiService.updateTaskSubtask).toHaveBeenCalledWith(10, 1, { is_done: true });
  });

  it('elimina una subtarea al hacer click en el boton de borrar', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 0 }
    ]);
    (apiService.deleteTaskSubtask as any).mockResolvedValue({ success: true });

    render(<TaskSubtasksChecklist taskId={10} />);
    await screen.findByText('Sub A');

    await userEvent.click(screen.getByRole('button', { name: /eliminar subtarea/i }));

    expect(apiService.deleteTaskSubtask).toHaveBeenCalledWith(10, 1);
    await waitFor(() => expect(screen.queryByText('Sub A')).not.toBeInTheDocument());
  });

  it('llama a onChange despues de agregar, tildar o borrar una subtarea', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 0 }
    ]);
    (apiService.updateTaskSubtask as any).mockResolvedValue({ id: 1, task_id: 10, title: 'Sub A', is_done: 1 });
    const onChange = vi.fn();

    render(<TaskSubtasksChecklist taskId={10} onChange={onChange} />);
    await screen.findByText('Sub A');

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/components/TaskSubtasksChecklist.test.tsx`
Expected: FAIL — "Cannot find module '@/components/tasks/TaskSubtasksChecklist'"

- [ ] **Step 4: Implementar el componente**

Crear `frontend/src/components/tasks/TaskSubtasksChecklist.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { List, Checkbox, Input, Button, Typography, Space, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';

const { Text } = Typography;

export interface TaskSubtask {
  id: number;
  task_id: number;
  title: string;
  is_done: boolean | number;
}

interface TaskSubtasksChecklistProps {
  taskId: number;
  onChange?: () => void;
}

export const TaskSubtasksChecklist: React.FC<TaskSubtasksChecklistProps> = ({ taskId, onChange }) => {
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getTaskSubtasks(taskId)
      .then((data) => { if (!cancelled) setSubtasks(data); })
      .catch(() => { if (!cancelled) message.error('Error al cargar subtareas'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [taskId]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) return;

    try {
      setAdding(true);
      const created = await apiService.createTaskSubtask(taskId, title);
      setSubtasks((prev) => [...prev, created]);
      setNewTitle('');
      onChange?.();
    } catch (error) {
      message.error('Error al crear la subtarea');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (subtask: TaskSubtask, checked: boolean) => {
    const previous = subtask.is_done;
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_done: checked } : s)));
    try {
      await apiService.updateTaskSubtask(taskId, subtask.id, { is_done: checked });
      onChange?.();
    } catch (error) {
      message.error('Error al actualizar la subtarea');
      setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_done: previous } : s)));
    }
  };

  const handleDelete = async (subtaskId: number) => {
    const previous = subtasks;
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    try {
      await apiService.deleteTaskSubtask(taskId, subtaskId);
      onChange?.();
    } catch (error) {
      message.error('Error al eliminar la subtarea');
      setSubtasks(previous);
    }
  };

  const doneCount = subtasks.filter((s) => !!s.is_done).length;

  return (
    <div>
      <Text strong>
        Subtareas{subtasks.length > 0 ? ` (${doneCount}/${subtasks.length})` : ''}
      </Text>
      <List
        size="small"
        loading={loading}
        dataSource={subtasks}
        locale={{ emptyText: 'Sin subtareas todavía' }}
        style={{ margin: '8px 0' }}
        renderItem={(subtask) => (
          <List.Item
            actions={[
              <Button
                key="delete"
                type="text"
                size="small"
                danger
                aria-label="Eliminar subtarea"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(subtask.id)}
              />
            ]}
          >
            <Checkbox
              checked={!!subtask.is_done}
              onChange={(e) => handleToggle(subtask, e.target.checked)}
            >
              <Text delete={!!subtask.is_done}>{subtask.title}</Text>
            </Checkbox>
          </List.Item>
        )}
      />
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="Agregar subtarea..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onPressEnter={handleAdd}
        />
        <Button icon={<PlusOutlined />} onClick={handleAdd} loading={adding}>
          Agregar
        </Button>
      </Space.Compact>
    </div>
  );
};
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/components/TaskSubtasksChecklist.test.tsx`
Expected: PASS (los 6 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/tasks/TaskSubtasksChecklist.tsx frontend/src/__tests__/components/TaskSubtasksChecklist.test.tsx frontend/src/services/api.ts
git commit -m "feat(fase5): componente TaskSubtasksChecklist + metodos de API de subtareas"
```

---

## Task 5: Wirear el checklist y el contador en `TasksPage`

**Files:**
- Modify: `frontend/src/pages/tasks/TasksPage.tsx`
- Modify: `frontend/src/__tests__/pages/TasksPage.test.tsx`

**Interfaces:**
- Consumes: `TaskSubtasksChecklist` (Task 4), campos `subtasks_total`/`subtasks_done` que ahora vienen en cada tarea de `GET /api/tasks/boards/:id` (Task 3).

- [ ] **Step 1: Arreglar el mock existente de `apiService` en el test de `TasksPage` (si no, el test actual de deep-link se rompe apenas montemos el checklist)**

En `frontend/src/__tests__/pages/TasksPage.test.tsx`, reemplazar el mock (líneas 5-11 actuales):

```typescript
vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    getTaskById: vi.fn()
  }
}));
```

por:

```typescript
vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    getTaskById: vi.fn(),
    getTaskSubtasks: vi.fn()
  }
}));
```

Y en el `beforeEach` compartido, reemplazar (líneas 31-40 actuales):

```typescript
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
  });
```

por:

```typescript
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
  });
```

Esto asegura que cualquier test que abra el modal de edición (y por lo tanto monte `TaskSubtasksChecklist`) tenga una respuesta por defecto, sin romper los tests ya existentes en este archivo.

- [ ] **Step 2: Escribir el test que falla (el contador de subtareas todavía no se pinta en la tarjeta)**

En `frontend/src/__tests__/pages/TasksPage.test.tsx`, agregar el import de `userEvent` al inicio del archivo, reemplazando (líneas 1-3 actuales):

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

por:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

Luego agregar al final del `describe('TasksPage - deep link ?taskId=', ...)`:

```typescript
  it('muestra el contador de subtareas en la tarjeta cuando la tarea tiene subtareas', async () => {
    const boardWithSubtasks = {
      ...board,
      tasks: [{ ...board.tasks[0], subtasks_total: 3, subtasks_done: 1 }]
    };
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([boardWithSubtasks]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(boardWithSubtasks);
      return Promise.resolve(null);
    });
    (apiService.getTaskById as any).mockResolvedValue({ ...boardWithSubtasks.tasks[0], project_id: 7 });

    renderWithTaskId('42');

    expect(await screen.findByText('1/3')).toBeInTheDocument();
  });

  it('no muestra el checklist de subtareas en el modal de "Nueva Tarea" (crear, no editar)', async () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <TasksPage />
      </MemoryRouter>
    );

    // Esperar a que el board termine de auto-seleccionarse y el botón deje de estar disabled
    // (el botón "Nueva Tarea" está deshabilitado mientras no hay board seleccionado).
    const newTaskButton = await screen.findByRole('button', { name: /nueva tarea/i });
    await waitFor(() => expect(newTaskButton).not.toBeDisabled());
    await userEvent.click(newTaskButton);

    expect(await screen.findByText('Título')).toBeInTheDocument();
    expect(screen.queryByText(/^Subtareas/)).not.toBeInTheDocument();
    expect(apiService.getTaskSubtasks).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx`
Expected: FAIL — no existe ningún `1/3` en pantalla todavía (el card no pinta el contador), y `TaskSubtasksChecklist` tampoco existe montado en el modal de crear tarea para verificar su ausencia de forma significativa.

- [ ] **Step 4: Agregar el campo al interface `Task` y los imports nuevos**

En `frontend/src/pages/tasks/TasksPage.tsx`, agregar a los imports de antd (línea 2-21 actual) `Divider`:

```typescript
import { 
  Card, 
  Button, 
  Select, 
  Typography, 
  Space, 
  Row, 
  Col, 
  Tag, 
  Avatar,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Empty,
  Tooltip,
  Badge,
  Spin,
  Divider
} from 'antd';
```

Agregar a los imports de íconos (línea 22-30 actual) `CheckSquareOutlined`:

```typescript
import {
  PlusOutlined,
  UserOutlined,
  CalendarOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CheckSquareOutlined
} from '@ant-design/icons';
```

Agregar el import del componente nuevo, después de la línea `import { apiService } from '@/services/api';`:

```typescript
import { TaskSubtasksChecklist } from '@/components/tasks/TaskSubtasksChecklist';
```

En el `interface Task` (líneas 61-82 actuales), agregar después de `total_value?: number;`:

```typescript
  subtasks_total?: number;
  subtasks_done?: number;
```

- [ ] **Step 5: Agregar el contador a la tarjeta del Kanban**

En `renderTaskCard`, dentro del `<Space wrap size="small">` (líneas 519-549 actuales), agregar después del bloque de `task.total_hours` (que cierra en la línea 548) y antes de `</Space>`:

```typescript
                  {!!task.subtasks_total && (
                    <Tooltip title={`Subtareas: ${task.subtasks_done}/${task.subtasks_total} completadas`}>
                      <Tag icon={<CheckSquareOutlined />}>
                        {task.subtasks_done}/{task.subtasks_total}
                      </Tag>
                    </Tooltip>
                  )}
```

- [ ] **Step 6: Agregar el checklist al modal de edición**

En el `Form` del modal de crear/editar tarea, reemplazar (líneas 950-956 actuales):

```typescript
            <Col span={12}>
              <Form.Item name="story_points" label="Story Points">
                <Input type="number" placeholder="Ej: 5" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item>
```

por:

```typescript
            <Col span={12}>
              <Form.Item name="story_points" label="Story Points">
                <Input type="number" placeholder="Ej: 5" />
              </Form.Item>
            </Col>
          </Row>

          {editingTask && (
            <>
              <Divider />
              <TaskSubtasksChecklist
                taskId={editingTask.id}
                onChange={() => selectedBoard && loadBoard(selectedBoard.id)}
              />
            </>
          )}

          <Form.Item>
```

- [ ] **Step 7: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx`
Expected: PASS (todos los tests del archivo, incluidos los 2 nuevos)

- [ ] **Step 8: Correr toda la suite de frontend y compilar para confirmar que nada existente se rompió**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: PASS / sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/tasks/TasksPage.tsx frontend/src/__tests__/pages/TasksPage.test.tsx
git commit -m "feat(fase5): checklist de subtareas y contador en TasksPage"
```

---

## Task 6: Revisión final del sub-proyecto

- [ ] **Step 1: Correr toda la suite de backend**

Run: `cd backend && npm test`
Expected: todos los tests en PASS (los existentes + los agregados en Tasks 1-3)

- [ ] **Step 2: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests en PASS (los existentes + los agregados en Tasks 4-5)

- [ ] **Step 3: Compilar ambos proyectos**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: sin errores en ninguno de los dos

- [ ] **Step 4: Revisión de todo el diff del sub-proyecto (desde el primer commit de Task 1 hasta el último de Task 5), no de `main..HEAD` completo**

Usar `superpowers:requesting-code-review` acotado a los commits de este sub-proyecto (igual que se hizo al cerrar los sub-proyectos de activity_log y notificaciones).
