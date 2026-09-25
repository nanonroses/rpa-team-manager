# Multi-asignado Completo (Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el responsable único de una tarea (`tasks.assignee_id`) por una lista de responsables igualmente principales (tabla nueva `task_assignees`), de modo que una tarea pueda tener varios responsables reales — no colaboradores secundarios (eso ya existe, `task_collaborators`, sin tocar). Cada responsable cuenta la tarea completa para carga de trabajo, notificaciones y horas estimadas (decisiones de producto ya tomadas por el usuario, no se reparten entre varios).

**Architecture:** Tabla nueva `task_assignees` (molde idéntico a v34/v35: `id/task_id/user_id/created_at`, `UNIQUE(task_id, user_id)`, `ON DELETE CASCADE`), con backfill desde `tasks.assignee_id` en la propia migración. `tasks.assignee_id` **no se borra** — pasa a ser "el primer responsable" de conveniencia interna (nunca expuesto como selector en la UI), y sigue sincronizado: se fija al primer elemento de la lista en cada escritura. Los ~29 puntos de control de acceso que hoy comparan `t.assignee_id = ?` pasan a comprobar `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)` — reemplazo mecánico de texto en el mismo WHERE, sin cambiar la cantidad de parámetros bindeados (el mismo `userId` que hoy se pasaba para `assignee_id = ?` se pasa igual para el nuevo `EXISTS`). Lecturas exponen la lista completa vía `GROUP_CONCAT` (mismo patrón que colaboradores/etiquetas). Escrituras (`createTask`/`updateTask`/`batchUpdateTasks`) aceptan `assignee_ids: number[]` y reemplazan el contenido de `task_assignees` completo en cada guardado. Frontend: el campo "Asignado a" pasa de `Select` simple a `Select mode="multiple"`, reusando el patrón visual de `TaskCollaboratorsEditor` para mostrar los responsables en la tarjeta del Kanban.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend, Jest). React 18/TypeScript/Ant Design (frontend, Vitest + Testing Library). Sin dependencias nuevas.

**Spec:** Diseño aprobado en brainstorming de chat el 2026-09-25 (sin doc de spec separado — convención de este repo, ver memoria `workflow_convention`). Decisiones de producto confirmadas por el usuario el 2026-09-24 (ver memoria `fase5_multiasignado_scope`): carga de trabajo, notificaciones y horas estimadas cuentan **completas para cada responsable** (no se reparten). Decisión técnica confirmada en brainstorming del 2026-09-25: `assignee_id` se **mantiene** como "primer responsable" de conveniencia, sin selector de "principal" en la UI.

## Global Constraints

- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (nunca `db.all`). Firmas reales (`backend/src/database/database.ts`): `db.query(sql, params[]) => Promise<any[]>`, `db.run(sql, params[]) => Promise<{ id?: number; changes: number }>`, `db.get(sql, params[]) => Promise<any>`, `db.beginTransaction(mode?) => Promise<void>`, `db.commit()`/`db.rollback() => Promise<void>`.
- Roles reales: `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'` — no relevante acá, todos los endpoints tocados solo usan `authenticate`, sin `authorize()` por rol (igual que hoy).
- **El patrón de acceso a migrar es literalmente el mismo texto repetido, verificado contra el código real (25 veces en `backend/src/controllers/taskController.ts`, 4 en `backend/src/controllers/fileController.ts`):**
  - En `taskController.ts`: `WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)` (o su variante `WHERE t.id IN (...) AND (...)` en batch), bindeado siempre como `[..., userId, userId, userId]`.
  - En `fileController.ts`: orden distinto, `t.assignee_id = ? OR p.assigned_to = ? OR p.created_by = ?`, mismo bind `[userId, userId, userId]`.
  - **El reemplazo NO agrega parámetros nuevos**: `t.assignee_id = ?` se reemplaza por `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)`, un solo `?`, mismo valor (`userId`) que ya se bindeaba ahí.
- No existe ningún helper reutilizable para este chequeo — está repetido inline en cada método (confirmado leyendo el archivo completo), así se debe seguir haciendo: no crear una abstracción nueva que un sitio pueda "olvidar" usar.
- `assignee_id` sigue siendo una columna real de `tasks` (no se borra ni se deprecia el tipo). Cualquier lectura que hoy hace `LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id` (para nombre/avatar del "responsable principal") se mantiene sin cambios.
- Al escribir `task_assignees` en `createTask`/`updateTask`/`batchUpdateTasks`, usar borrar-e-insertar (no diffing fila por fila) dentro de una transacción existente o nueva según el método.
- Tests backend: mock manual de `db` vía `jest.mock('../../database/database', ...)` + `jest.clearAllMocks()` en `beforeEach`, exactamente como en `taskController.batchUpdate.test.ts` (ya existente). Mockear también `activityLogService` y `notificationService` cuando el módulo los importe.
- Tests de migración: SQLite real vía `sqlite3` + `MigrationManager`, mismo molde que `migration35.test.ts` (ya existente, léelo como plantilla exacta).
- Tests frontend: **Vitest**, no Jest (`import { describe, it, expect, vi, beforeEach } from 'vitest'`). Ver `frontend/src/__tests__/pages/TasksPage.test.tsx` y `TasksPage.bulkEdit.test.tsx` como plantilla.
- No mergear a `main` ni abrir PR sin preguntar — se trabaja en una rama nueva `fase5-multiasignado`, creada desde `main`.

## Review Focus

- Un usuario que es **únicamente** co-responsable en `task_assignees` (no `assignee_id`, no `assigned_to`/`created_by` del proyecto) debe poder acceder a CUALQUIERA de los ~29 endpoints migrados — un solo sitio olvidado es un agujero de permisos silencioso. Cubierto por el test estático de "sin residuos" de la Task 2 + tests funcionales representativos.
- Reasignar una tarea a una lista que ya incluye a alguien no debe volver a notificarlo — solo a los recién agregados. Cubierto en Task 5.
- Vaciar la lista de responsables (`assignee_ids: []`) debe dejar `assignee_id` en `NULL`, no en el valor anterior. Cubierto en Task 5.
- `teamWorkload` y `estimatedByPerson` deben contar una tarea con 2 responsables como carga/horas completas para **cada uno** (no la mitad) — es la decisión de producto ya tomada, y un `JOIN` mal armado podría diluirla sin que ningún test lo note. Cubierto en Task 6.
- El filtro por asignado en `GET /api/tasks` (`?assignee_id=`) y el filtro del board en el frontend deben pasar de "es igual a" a "está entre los responsables" — si se olvida, un usuario agregado como co-responsable no aparecería al filtrar por él. Cubierto en Task 2 (backend) y Task 7 (frontend).

---

## Task 1: Migración v36 — tabla `task_assignees` + backfill

**Files:**
- Modify: `backend/src/database/migrationList.ts` (agregar migración después de la v35, línea 1613 actual: `  }\n];`)
- Create: `backend/src/__tests__/database/migration36.test.ts`

**Interfaces:**
- Produces: tabla `task_assignees(id, task_id, user_id, created_at)`, usada por todas las tareas siguientes.

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/__tests__/database/migration36.test.ts` (mismo molde que `migration35.test.ts`, agregando el caso de backfill):

```typescript
import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 36 - task_assignees (multi-asignado completo)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration36-assignees-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);

        // Insertar datos ANTES de correr la migración 36 no es posible con este runner
        // (runMigrations corre todas las migraciones en orden desde una BD vacía), así que
        // el backfill se verifica insertando una tarea con assignee_id directamente vía SQL
        // crudo entre la migración que crea `tasks` y la que crea `task_assignees` no es
        // posible tampoco (runMigrations es atómico). En su lugar, se verifica el backfill
        // corriendo TODAS las migraciones, insertando una tarea con assignee_id manualmente,
        // y re-ejecutando manualmente el SQL de backfill de la migración 36 (el mismo texto
        // que usa migrationList.ts) para confirmar que es idempotente y correcto.
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });

        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`);
        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u2', 'u2@x.com', 'h', 'U2', 'rpa_developer')`);
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto X', 1)`);
        await run(`INSERT INTO task_boards (project_id, name) VALUES (1, 'Board 1')`);
        await run(`INSERT INTO task_columns (board_id, name, position) VALUES (1, 'To Do', 0)`);
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('crea la tabla task_assignees con las columnas esperadas', async () => {
        const cols = await columnNames('task_assignees');
        expect(cols).toEqual(expect.arrayContaining(['id', 'task_id', 'user_id', 'created_at']));
    });

    it('permite agregar un responsable a una tarea existente', async () => {
        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea', 1)`);
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea'`);
        const taskId = taskRow[0].id;

        const result = await run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, 2)`, [taskId]);
        expect(result.changes).toBe(1);

        const rows = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(rows).toHaveLength(1);
        expect(rows[0].user_id).toBe(2);
    });

    it('no permite agregar el mismo responsable dos veces a la misma tarea', async () => {
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea'`);
        const taskId = taskRow[0].id;
        await expect(run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, 2)`, [taskId])).rejects.toThrow();
    });

    it('borra en cascada los responsables cuando se borra la tarea padre', async () => {
        await run('PRAGMA foreign_keys = ON');

        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id) VALUES (1, 1, 'Tarea a borrar', 1)`);
        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea a borrar'`);
        const taskId = taskRow[0].id;
        await run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, 2)`, [taskId]);

        await run(`DELETE FROM tasks WHERE id = ?`, [taskId]);

        const remaining = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(remaining).toHaveLength(0);
    });

    it('el backfill (mismo SQL que la migración) copia assignee_id existente a task_assignees sin duplicar', async () => {
        await run(`INSERT INTO tasks (board_id, column_id, title, reporter_id, assignee_id) VALUES (1, 1, 'Tarea con assignee previo', 1, 2)`);

        // Mismo SQL que se agrega como paso de backfill en migrationList.ts (v36)
        await run(`INSERT OR IGNORE INTO task_assignees (task_id, user_id) SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL`);

        const taskRow = await all(`SELECT id FROM tasks WHERE title = 'Tarea con assignee previo'`);
        const taskId = taskRow[0].id;
        const rows = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(rows).toHaveLength(1);
        expect(rows[0].user_id).toBe(2);

        // Re-correr el mismo backfill no debe duplicar (idempotente)
        await run(`INSERT OR IGNORE INTO task_assignees (task_id, user_id) SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL`);
        const rowsAfterRerun = await all(`SELECT * FROM task_assignees WHERE task_id = ?`, [taskId]);
        expect(rowsAfterRerun).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest __tests__/database/migration36.test.ts`
Expected: FAIL — la tabla `task_assignees` no existe todavía.

- [ ] **Step 3: Agregar la migración**

En `backend/src/database/migrationList.ts`, reemplazar el cierre del array (línea 1613 actual: `  }\n];`) por:

```typescript
  },

  {
    version: 36,
    description: 'Multi-asignado completo: lista de responsables por tarea (task_assignees) - Fase 5',
    up: [
      `CREATE TABLE IF NOT EXISTS task_assignees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE (task_id, user_id)
      )`,

      `CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id)`,

      `INSERT OR IGNORE INTO task_assignees (task_id, user_id) SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL`
    ]
  }
];
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest __tests__/database/migration36.test.ts`
Expected: PASS (los 5 tests)

- [ ] **Step 5: Correr toda la suite de migraciones para confirmar que nada se rompió**

Run: `cd backend && npx jest __tests__/database`
Expected: PASS

- [ ] **Step 6: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 7: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration36.test.ts
git commit -m "feat(fase5): migracion v36 - tabla task_assignees con backfill desde assignee_id"
```

---

## Task 2: Migrar los puntos de control de acceso en `taskController.ts` (25 sitios) + filtros por asignado

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Create: `backend/src/__tests__/controllers/taskController.multiAssignee.test.ts`

**Interfaces:**
- Consumes: tabla `task_assignees` (Task 1).
- Produces: ningún endpoint cambia de firma en este task — solo cambia el criterio SQL interno de acceso. Los endpoints siguen devolviendo lo mismo que antes.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.multiAssignee.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(), run: jest.fn(), query: jest.fn(),
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn()
    }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));
jest.mock('../../services/taskDependencyService', () => ({
    taskDependencyService: {
        getDependenciesForTask: jest.fn(),
        createDependency: jest.fn(),
        deleteDependency: jest.fn()
    },
    TaskDependencyError: class TaskDependencyError extends Error {
        status: number;
        constructor(message: string, status = 400) { super(message); this.status = status; }
    }
}));
jest.mock('../../services/commentService', () => ({
    commentService: {
        getForEntity: jest.fn(), create: jest.fn(), findById: jest.fn(),
        update: jest.fn(), delete: jest.fn(), getMentionableUsers: jest.fn()
    }
}));

import fs from 'fs';
import path from 'path';
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

function req(params: any = {}, body: any = {}, userId = 3): AuthenticatedRequest {
    return { params, body, query: {}, user: { id: userId } } as unknown as AuthenticatedRequest;
}

describe('TaskController - acceso multi-asignado (co-responsable via task_assignees)', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('getTaskById: un usuario que SOLO es co-responsable via task_assignees tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42, title: 'Tarea', project_id: 7 });
        const res = mockRes();

        await controller.getTaskById(req({ id: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
        const [sql, params] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toEqual(['42', 9, 9, 9]);
    });

    it('updateTask: la query de chequeo de acceso usa EXISTS contra task_assignees, no assignee_id directo', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: 5, status: 'todo' }) // access check
            .mockResolvedValueOnce({ max_position: 1 }) // no aplica (sin column_id)
            .mockResolvedValueOnce({ id: 42, title: 'Tarea', assignee_id: 5 }); // updated task
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask(req({ id: '42' }, { title: 'Nuevo titulo' }, 9), res);

        const [sql, params] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toEqual(['42', 9, 9, 9]);
    });

    it('getTaskSubtasks: co-responsable via task_assignees tiene acceso a subtareas', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42 });
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTaskSubtasks(req({ taskId: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
        const [sql] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
    });

    it('createTaskDependency: ambos chequeos de acceso (tarea y depends_on_task) usan EXISTS', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42 })
            .mockResolvedValueOnce({ id: 43 });
        const res = mockRes();

        await controller.createTaskDependency(req({ taskId: '42' }, { depends_on_task_id: 43 }, 9), res);

        expect((db.get as jest.Mock).mock.calls[0][0]).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect((db.get as jest.Mock).mock.calls[1][0]).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
    });

    it('getTaskCollaborators: co-responsable via task_assignees tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42 });
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTaskCollaborators(req({ taskId: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
    });

    it('getTaskComments: co-responsable via task_assignees tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42 });
        const { commentService } = require('../../services/commentService');
        commentService.getForEntity.mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTaskComments(req({ taskId: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
    });

    it('batchUpdateTasks: la query de tareas accesibles usa EXISTS contra task_assignees', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.batchUpdateTasks(req({}, { taskIds: [42], updates: { priority: 'high' } }, 9), res);

        const [sql] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
    });

    it('getTasks: el filtro ?assignee_id= comprueba pertenencia a task_assignees, no igualdad directa', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTasks({ query: { assignee_id: '9' }, user: { id: 9 } } as unknown as AuthenticatedRequest, res);

        const [sql, params] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toContain('9');
    });

    it('getMyTasks: incluye tareas donde el usuario es co-responsable via task_assignees, no solo assignee_id principal', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getMyTasks(req({}, {}, 9), res);

        const [sql, params] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toEqual([9]);
    });

    it('no queda ningun chequeo de acceso residual con el criterio viejo (t.assignee_id = ? dentro de un OR de acceso)', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../../controllers/taskController.ts'),
            'utf-8'
        );

        // Cualquier "OR t.assignee_id = ?" (el criterio viejo de acceso) ya no debe existir:
        // todos los sitios de control de acceso deben usar el EXISTS contra task_assignees.
        expect(source).not.toMatch(/OR t\.assignee_id = \?/);

        // El JOIN de lectura legitimo (para mostrar nombre/avatar del responsable principal)
        // SI debe seguir existiendo tal cual, no se toca:
        expect(source).toContain('LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id');
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.multiAssignee.test.ts`
Expected: FAIL — el criterio SQL todavía usa `t.assignee_id = ?` directo, no `EXISTS`.

- [ ] **Step 3: Reemplazar el patrón de acceso en los 25 sitios de `taskController.ts`**

En cada una de las siguientes líneas (verificadas contra el archivo real; los números pueden haberse corrido 1-2 líneas si un paso anterior ya editó el archivo — buscar por el texto exacto, no confiar ciegamente en el número), reemplazar:

```sql
OR t.assignee_id = ?)
```

por:

```sql
OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?))
```

Sitios exactos (mismo texto `(p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)` o su variante `IN (...)`, sin tocar el resto de cada query):

- Línea 261 (`getTasks`, WHERE principal)
- Línea 417 (`getTaskById`)
- Línea 458 (`updateTask`)
- Línea 696 (`moveTask`)
- Línea 779 (`getTaskSubtasks`)
- Línea 818 (`createTaskSubtask`)
- Línea 855 (`updateTaskSubtask`)
- Línea 899 (`deleteTaskSubtask`)
- Línea 934 (`getTaskDependencies`)
- Línea 968 (`createTaskDependency`, chequeo de `taskId`)
- Línea 981 (`createTaskDependency`, chequeo de `depends_on_task_id`)
- Línea 1018 (`deleteTaskDependency`)
- Línea 1050 (`getTaskTags`)
- Línea 1096 (`createTaskTag`)
- Línea 1141 (`deleteTaskTag`)
- Línea 1176 (`getTaskCollaborators`)
- Línea 1216 (`addTaskCollaborator`)
- Línea 1271 (`removeTaskCollaborator`)
- Línea 1572 (`batchUpdateTasks`, dentro de `WHERE t.id IN (${placeholders}) AND (...)`)
- Línea 1725 (`getTaskActivity`)
- Línea 1757 (`getTaskComments`)
- Línea 1790 (`createTaskComment`)
- Línea 1823 (`updateTaskComment`)
- Línea 1860 (`deleteTaskComment`)
- Línea 1897 (`getTaskMentionableUsers`)

**No tocar** ninguna otra ocurrencia de `assignee_id` en el archivo (los `LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id`, las columnas de `INSERT`/`UPDATE` de `tasks`, y el `SELECT ... t.assignee_id` de `batchUpdateTasks` — esos se tocan en Tasks 4 y 5).

- [ ] **Step 4: Migrar el filtro por asignado en `getTasks` (línea 276-278 actual)**

Reemplazar:

```typescript
      if (assignee_id) {
        query += ' AND t.assignee_id = ?';
        params.push(assignee_id);
      }
```

por:

```typescript
      if (assignee_id) {
        query += ' AND EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)';
        params.push(assignee_id);
      }
```

- [ ] **Step 5: Migrar `getMyTasks` (línea 1312 actual) para incluir cualquier tarea donde el usuario sea co-responsable**

Reemplazar:

```typescript
        WHERE t.assignee_id = ? AND t.status != 'done'
```

por:

```typescript
        WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?) AND t.status != 'done'
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.multiAssignee.test.ts`
Expected: PASS (los 10 tests, incluido el de "sin residuos")

- [ ] **Step 7: Correr toda la suite de `taskController` para confirmar que nada existente se rompió**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 8: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/__tests__/controllers/taskController.multiAssignee.test.ts
git commit -m "feat(fase5): migrar los 25 puntos de control de acceso de taskController a task_assignees"
```

---

## Task 3: Migrar los puntos de control de acceso en `fileController.ts` (4 sitios)

**Files:**
- Modify: `backend/src/controllers/fileController.ts`
- Create: `backend/src/__tests__/controllers/fileController.multiAssignee.test.ts`

**Interfaces:**
- Consumes: tabla `task_assignees` (Task 1).

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/__tests__/controllers/fileController.multiAssignee.test.ts`:

```typescript
import fs from 'fs';
import path from 'path';

describe('fileController - acceso multi-asignado (sin ejecutar controller, chequeo estatico de la migracion)', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../../controllers/fileController.ts'),
        'utf-8'
    );

    it('no queda ningun chequeo de acceso residual con el criterio viejo (t.assignee_id = ? dentro de un OR de acceso)', () => {
        expect(source).not.toMatch(/t\.assignee_id = \? OR p\.assigned_to = \?/);
    });

    it('los 4 sitios de acceso a tareas usan EXISTS contra task_assignees', () => {
        const matches = source.match(/EXISTS \(SELECT 1 FROM task_assignees ta WHERE ta\.task_id = t\.id AND ta\.user_id = \?\)/g) || [];
        expect(matches.length).toBe(4);
    });
});
```

(Test estático en vez de invocar el controller: `fileController.ts` maneja `multer`/streams de archivo real y su suite existente ya cubre el comportamiento funcional — acá solo interesa confirmar que el criterio SQL cambió en los 4 sitios, igual que el test de "sin residuos" de la Task 2.)

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest __tests__/controllers/fileController.multiAssignee.test.ts`
Expected: FAIL — 0 matches de `EXISTS`, y el patrón viejo todavía está presente.

- [ ] **Step 3: Reemplazar el patrón de acceso en los 4 sitios de `fileController.ts`**

En cada una de las siguientes líneas (verificar contra el archivo real), reemplazar `t.assignee_id = ?` por `EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)`, dejando el resto del OR igual:

- Línea 262 (`getFiles`, subquery de `file_associations` tipo `task`): `WHERE t.assignee_id = ? OR p.assigned_to = ? OR p.created_by = ?` → `WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?) OR p.assigned_to = ? OR p.created_by = ?`
- Línea 358 (`getFile`), mismo reemplazo.
- Línea 434 (`downloadFile`), mismo reemplazo.
- Línea 586 (`validateEntityAccess`, caso `'task'`): `WHERE t.id = ? AND (t.assignee_id = ? OR p.assigned_to = ? OR p.created_by = ?)` → `WHERE t.id = ? AND (EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?) OR p.assigned_to = ? OR p.created_by = ?)`

No cambia la cantidad de parámetros bindeados en ninguno de los 4 sitios (mismo `userId` repetido).

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest __tests__/controllers/fileController.multiAssignee.test.ts`
Expected: PASS

- [ ] **Step 5: Correr toda la suite de `fileController` para confirmar que nada existente se rompió**

Run: `cd backend && npx jest fileController`
Expected: PASS

- [ ] **Step 6: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/fileController.ts backend/src/__tests__/controllers/fileController.multiAssignee.test.ts
git commit -m "feat(fase5): migrar los 4 puntos de control de acceso de fileController a task_assignees"
```

---

## Task 4: Lecturas — exponer `assignee_ids`/`assignee_names` completos

**Files:**
- Modify: `backend/src/controllers/taskController.ts` (`getBoard` línea 86-137 actual, `getTasks` línea 235-262 actual, `getTaskById` línea 412-418 actual)
- Create: `backend/src/__tests__/controllers/taskController.assigneesRead.test.ts`

**Interfaces:**
- Consumes: tabla `task_assignees` (Task 1).
- Produces: cada tarea devuelta por `getBoard`/`getTasks`/`getTaskById` incluye `assignee_ids: string | null` (ids concatenados con `'||'`, mismo formato que `tags`/`collaborators_names`) y `assignee_names: string | null`. Consumido por el frontend en Task 7 (`row.assignee_ids.split('||').map(Number)`).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.assigneesRead.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
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

describe('TaskController - lecturas exponen assignee_ids/assignee_names', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('getBoard: la query de tareas incluye el subquery GROUP_CONCAT de task_assignees', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 2, name: 'Board 1', project_name: 'X' });
        (db.query as jest.Mock)
            .mockResolvedValueOnce([]) // columns
            .mockResolvedValueOnce([]); // tasks
        const res = mockRes();

        await controller.getBoard({ params: { id: '2' }, user: { id: 9 } } as unknown as AuthenticatedRequest, res);

        const tasksCall = (db.query as jest.Mock).mock.calls[1];
        expect(tasksCall[0]).toContain("GROUP_CONCAT(ta.user_id, '||') as assignee_ids");
        expect(tasksCall[0]).toContain("GROUP_CONCAT(u_ta.full_name, '||') as assignee_names");
        expect(tasksCall[0]).toContain('FROM task_assignees ta');
    });

    it('getTaskById: incluye assignee_ids/assignee_names', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42, title: 'Tarea', assignee_ids: '5||9', assignee_names: 'Ana||Beto' });
        const res = mockRes();

        await controller.getTaskById({ params: { id: '42' }, user: { id: 9 } } as unknown as AuthenticatedRequest, res);

        const [sql] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain("GROUP_CONCAT(ta2.user_id, '||') as assignee_ids");
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ assignee_ids: '5||9', assignee_names: 'Ana||Beto' }));
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.assigneesRead.test.ts`
Expected: FAIL — las queries todavía no incluyen el subquery de `task_assignees`.

- [ ] **Step 3: Agregar el subquery a `getBoard` (línea 99-137 actual)**

Reemplazar (dentro del `SELECT` de tareas, después del bloque `col` de colaboradores, línea 126-134 actual):

```typescript
        LEFT JOIN (
          SELECT
            tc.task_id,
            COUNT(*) as collaborators_count,
            GROUP_CONCAT(u.full_name, '||') as collaborators_names
          FROM task_collaborators tc
          JOIN users u ON tc.user_id = u.id
          GROUP BY tc.task_id
        ) col ON t.id = col.task_id
        WHERE t.board_id = ?
```

por:

```typescript
        LEFT JOIN (
          SELECT
            tc.task_id,
            COUNT(*) as collaborators_count,
            GROUP_CONCAT(u.full_name, '||') as collaborators_names
          FROM task_collaborators tc
          JOIN users u ON tc.user_id = u.id
          GROUP BY tc.task_id
        ) col ON t.id = col.task_id
        LEFT JOIN (
          SELECT
            ta.task_id,
            GROUP_CONCAT(ta.user_id, '||') as assignee_ids,
            GROUP_CONCAT(u_ta.full_name, '||') as assignee_names
          FROM task_assignees ta
          JOIN users u_ta ON ta.user_id = u_ta.id
          GROUP BY ta.task_id
        ) tas ON t.id = tas.task_id
        WHERE t.board_id = ?
```

Y agregar `tas.assignee_ids, tas.assignee_names,` a la lista de columnas del `SELECT` (después de `col.collaborators_names as collaborators_names,` línea 98 actual).

- [ ] **Step 4: Agregar el mismo subquery a `getTasks` (línea 236-262 actual)**

Mismo patrón que el Step 3, agregado al `SELECT` y a los `LEFT JOIN` de `getTasks` (después del `LEFT JOIN` de `te` en línea 260 actual, antes del `WHERE`).

- [ ] **Step 5: Agregar el subquery a `getTaskById` (línea 412-418 actual)**

Reemplazar:

```typescript
      const task = await db.get(`
        SELECT t.*, tb.project_id
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?))
      `, [id, userId, userId, userId]);
```

por:

```typescript
      const task = await db.get(`
        SELECT
          t.*, tb.project_id,
          ta2.assignee_ids, ta2.assignee_names
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        LEFT JOIN (
          SELECT
            ta.task_id,
            GROUP_CONCAT(ta.user_id, '||') as assignee_ids,
            GROUP_CONCAT(u_ta.full_name, '||') as assignee_names
          FROM task_assignees ta
          JOIN users u_ta ON ta.user_id = u_ta.id
          GROUP BY ta.task_id
        ) ta2 ON t.id = ta2.task_id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?))
      `, [id, userId, userId, userId]);
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.assigneesRead.test.ts`
Expected: PASS

- [ ] **Step 7: Correr toda la suite de `taskController` para confirmar que nada existente se rompió**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 8: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/__tests__/controllers/taskController.assigneesRead.test.ts
git commit -m "feat(fase5): exponer assignee_ids/assignee_names en getBoard/getTasks/getTaskById"
```

---

## Task 5: Escrituras — `createTask`/`updateTask`/`batchUpdateTasks` aceptan `assignee_ids: number[]`

**Files:**
- Modify: `backend/src/controllers/taskController.ts` (`createTask` línea 309-404, `updateTask` línea 433-572, `batchUpdateTasks` línea 1536-1668)
- Create: `backend/src/__tests__/controllers/taskController.assigneesWrite.test.ts`

**Interfaces:**
- Consumes: tabla `task_assignees` (Task 1).
- Produces: `POST /tasks` y `PUT /tasks/:id` aceptan `assignee_ids?: number[]` en el body (en vez de `assignee_id` único — se mantiene aceptando `assignee_id` también por compatibilidad con llamadores viejos, pero el frontend de Task 7 solo manda `assignee_ids`). `PATCH /tasks/batch` acepta `updates.assignee_ids?: number[]` en vez de `updates.assignee_id`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.assigneesWrite.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(), run: jest.fn(), query: jest.fn(),
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn()
    }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { notificationService } from '../../services/notificationService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function req(body: any, userId = 3): AuthenticatedRequest {
    return { body, params: {}, user: { id: userId } } as unknown as AuthenticatedRequest;
}

describe('TaskController - escrituras con assignee_ids (multi-asignado)', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('createTask: con assignee_ids=[5,9], tasks.assignee_id queda en 5 (primero) y task_assignees tiene ambas filas', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, assigned_to: 3 }) // board access
            .mockResolvedValueOnce({ max_position: 0 }) // last position
            .mockResolvedValueOnce({ id: 100, title: 'Nueva tarea', assignee_id: 5 }); // created task
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.createTask(req({
            board_id: 1, column_id: 10, title: 'Nueva tarea', assignee_ids: [5, 9]
        }), res);

        const insertCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('INSERT INTO tasks'));
        expect(insertCall[1]).toContain(5); // assignee_id = primer elemento

        const assigneeInserts = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(assigneeInserts).toHaveLength(2);
        expect(assigneeInserts[0][1]).toEqual([100, 5]);
        expect(assigneeInserts[1][1]).toEqual([100, 9]);
    });

    it('createTask: notifica a todos los assignee_ids (menos al que crea), no solo al primero', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, assigned_to: 3 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 100, title: 'Nueva tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.createTask(req({
            board_id: 1, column_id: 10, title: 'Nueva tarea', assignee_ids: [5, 9]
        }, 3), res);

        expect(notificationService.notify).toHaveBeenCalledTimes(2);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 5, eventKey: 'task_assigned' }));
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, eventKey: 'task_assigned' }));
    });

    it('updateTask: reemplaza la lista completa de responsables y notifica solo a los recien agregados', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: 5, status: 'todo' }) // access check
            .mockResolvedValueOnce({ id: 42, title: 'Tarea' }); // updated task
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 5 }]); // responsables actuales (solo 5)
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask({ params: { id: '42' }, body: { assignee_ids: [5, 9] }, user: { id: 3 } } as unknown as AuthenticatedRequest, res);

        const deleteCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('DELETE FROM task_assignees'));
        expect(deleteCall[1]).toEqual(['42']);

        const insertCalls = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(insertCalls).toHaveLength(2);

        // Solo 9 es nuevo (5 ya era responsable) -> una sola notificacion
        expect(notificationService.notify).toHaveBeenCalledTimes(1);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, eventKey: 'task_assigned' }));
    });

    it('updateTask: assignee_ids=[] deja tasks.assignee_id en NULL y vacia task_assignees', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: 5, status: 'todo' })
            .mockResolvedValueOnce({ id: 42, title: 'Tarea', assignee_id: null });
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 5 }]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask({ params: { id: '42' }, body: { assignee_ids: [] }, user: { id: 3 } } as unknown as AuthenticatedRequest, res);

        const updateCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('UPDATE tasks'));
        expect(updateCall[1]).toContain(null);
        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('batchUpdateTasks: updates.assignee_ids reemplaza responsables de todas las tareas accesibles y notifica agrupado por usuario nuevo', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([
                { id: 1, column_id: 10, position: 1, board_id: 100, project_id: 7 },
                { id: 2, column_id: 10, position: 2, board_id: 100, project_id: 7 }
            ])
            .mockResolvedValueOnce([]) // responsables actuales tarea 1
            .mockResolvedValueOnce([]); // responsables actuales tarea 2
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { assignee_ids: [8] } }, 3), res);

        expect(notificationService.notify).toHaveBeenCalledTimes(1);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 8, eventKey: 'task_assigned' }));
        expect((notificationService.notify as jest.Mock).mock.calls[0][0].message).toContain('2');
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.assigneesWrite.test.ts`
Expected: FAIL — `createTask`/`updateTask`/`batchUpdateTasks` todavía no aceptan `assignee_ids`.

- [ ] **Step 3: Implementar en `createTask` (líneas 309-404 actuales)**

Reemplazar el cuerpo de `createTask` por:

```typescript
  // POST /api/tasks - Create new task
  createTask = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const {
        board_id,
        column_id,
        title,
        description,
        task_type = 'task',
        priority = 'medium',
        assignee_id,
        assignee_ids,
        estimated_hours,
        story_points,
        due_date
      } = req.body;

      if (!board_id || !column_id || !title) {
        res.status(400).json({ error: 'Board ID, column ID, and title are required' });
        return;
      }

      // Check if user has access to board
      const board = await db.get(`
        SELECT tb.*, p.assigned_to, p.created_by
        FROM task_boards tb
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE tb.id = ? AND (p.assigned_to = ? OR p.created_by = ?)
      `, [board_id, userId, userId]);

      if (!board) {
        res.status(404).json({ error: 'Board not found or access denied' });
        return;
      }

      // Get next position in column
      const lastTask = await db.get(`
        SELECT MAX(position) as max_position 
        FROM tasks 
        WHERE column_id = ?
      `, [column_id]);

      const position = (lastTask?.max_position || 0) + 1;

      const resolvedAssigneeIds: number[] = Array.isArray(assignee_ids)
        ? assignee_ids
        : (assignee_id !== undefined && assignee_id !== null ? [assignee_id] : []);
      const principalAssigneeId = resolvedAssigneeIds[0] ?? null;

      // Create task
      const result = await db.run(`
        INSERT INTO tasks (
          board_id, column_id, title, description, task_type, priority,
          assignee_id, reporter_id, estimated_hours, story_points, 
          due_date, position, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        board_id, column_id, title, description, task_type, priority,
        principalAssigneeId, userId, estimated_hours, story_points, due_date, position
      ]);

      for (const uid of resolvedAssigneeIds) {
        await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [result.id, uid]);
      }

      // Get created task with related data
      const newTask = await db.get(`
        SELECT 
          t.*,
          tb.name as board_name,
          tc.name as column_name,
          u_assignee.full_name as assignee_name,
          u_assignee.avatar_url as assignee_avatar,
          u_reporter.full_name as reporter_name
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN task_columns tc ON t.column_id = tc.id
        LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
        LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
        WHERE t.id = ?
      `, [result.id]);

      await activityLogService.logActivity(
        userId, 'task', result.id!, 'created', null,
        { title, task_type, priority, column_id, board_id }
      );

      for (const uid of resolvedAssigneeIds) {
        if (uid !== userId) {
          await notificationService.notify({
            userId: uid,
            eventKey: 'task_assigned',
            title: 'Te asignaron una tarea',
            message: title,
            entityType: 'task',
            entityId: result.id!,
            senderId: userId,
            link: `/tasks?taskId=${result.id}`
          });
        }
      }

      res.status(201).json(newTask);
    } catch (error) {
      logger.error('Create task error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  };
```

- [ ] **Step 4: Implementar en `updateTask` (líneas 433-572 actuales)**

Agregar `assignee_ids` a la desestructuración del body (después de `assignee_id,` línea 443 actual):

```typescript
        assignee_id,
        assignee_ids,
```

Después del `UPDATE tasks ... SET assignee_id = COALESCE(?, assignee_id) ...` (líneas 493-510 actuales, sin cambios ahí salvo que `assignee_id` en el bind pasa a ser el primer elemento de `assignee_ids` cuando este viene informado — ver más abajo), agregar el reemplazo de `task_assignees` **antes** de calcular `updatedTask` (después de la línea 510 actual `]);`, antes de la línea 512 `// Get updated task`):

```typescript
      const resolvedAssigneeIds: number[] | undefined = Array.isArray(assignee_ids)
        ? assignee_ids
        : undefined;
      let newlyAddedAssigneeIds: number[] = [];

      if (resolvedAssigneeIds !== undefined) {
        const currentRows = await db.query(`SELECT user_id FROM task_assignees WHERE task_id = ?`, [id]);
        const currentIds: number[] = currentRows.map((r: any) => r.user_id);
        newlyAddedAssigneeIds = resolvedAssigneeIds.filter((uid) => !currentIds.includes(uid));

        await db.run(`DELETE FROM task_assignees WHERE task_id = ?`, [id]);
        for (const uid of resolvedAssigneeIds) {
          await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [id, uid]);
        }

        const principalAssigneeId = resolvedAssigneeIds[0] ?? null;
        await db.run(`UPDATE tasks SET assignee_id = ? WHERE id = ?`, [principalAssigneeId, id]);
      }
```

Y reemplazar el bloque de notificación de reasignación (líneas 541-552 actuales):

```typescript
      if (assignee_id !== undefined && assignee_id !== null && assignee_id !== task.assignee_id && assignee_id !== userId) {
        await notificationService.notify({
          userId: assignee_id,
          eventKey: 'task_assigned',
          title: 'Te asignaron una tarea',
          message: updatedTask.title,
          entityType: 'task',
          entityId: taskId,
          senderId: userId,
          link: taskLink
        });
      }
```

por:

```typescript
      for (const uid of newlyAddedAssigneeIds) {
        if (uid !== userId) {
          await notificationService.notify({
            userId: uid,
            eventKey: 'task_assigned',
            title: 'Te asignaron una tarea',
            message: updatedTask.title,
            entityType: 'task',
            entityId: taskId,
            senderId: userId,
            link: taskLink
          });
        }
      }
```

- [ ] **Step 5: Implementar en `batchUpdateTasks` (líneas 1536-1668 actuales)**

Agregar `assignee_ids` a la desestructuración de `updates` (línea 1553 actual):

```typescript
      const { priority, assignee_id, assignee_ids, column_id } = updates;
      const hasField = priority !== undefined || assignee_id !== undefined || assignee_ids !== undefined || column_id !== undefined;
```

Dentro de la transacción (después del bloque `if (targetColumnId !== undefined) { ... }`, línea 1631 actual, antes del `for (const [projectId, count] of projectCounts)` línea 1633 actual), agregar:

```typescript
        const usersNewlyAssigned: Map<number, number> = new Map(); // userId -> cuantas tareas nuevas

        if (Array.isArray(assignee_ids)) {
          for (const task of accessibleTasks) {
            const currentRows = await db.query(`SELECT user_id FROM task_assignees WHERE task_id = ?`, [task.id]);
            const currentIds: number[] = currentRows.map((r: any) => r.user_id);

            await db.run(`DELETE FROM task_assignees WHERE task_id = ?`, [task.id]);
            for (const uid of assignee_ids) {
              await db.run(`INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)`, [task.id, uid]);
              if (!currentIds.includes(uid)) {
                usersNewlyAssigned.set(uid, (usersNewlyAssigned.get(uid) || 0) + 1);
              }
            }

            const principalAssigneeId = assignee_ids[0] ?? null;
            await db.run(`UPDATE tasks SET assignee_id = ? WHERE id = ?`, [principalAssigneeId, task.id]);
          }
        }
```

Y después de cerrar la transacción (`await db.commit();`, después del bloque `catch (transactionError)`, línea 1645 actual), reemplazar el bloque de notificación existente (líneas 1647-1660 actuales, que solo notificaba a `assignee_id` único) por uno que también cubra `usersNewlyAssigned`:

```typescript
      if (assignee_id !== undefined && assignee_id !== null && assignee_id !== userId) {
        const reassignedCount = accessibleTasks.filter((t: any) => t.assignee_id !== assignee_id).length;
        if (reassignedCount > 0) {
          await notificationService.notify({
            userId: assignee_id,
            eventKey: 'task_assigned',
            title: 'Te asignaron tareas',
            message: `Se te asignaron ${reassignedCount} tarea(s)`,
            entityType: 'task',
            senderId: userId,
            link: '/tasks'
          });
        }
      }

      for (const [uid, count] of usersNewlyAssigned) {
        if (uid !== userId) {
          await notificationService.notify({
            userId: uid,
            eventKey: 'task_assigned',
            title: 'Te asignaron tareas',
            message: `Se te asignaron ${count} tarea(s)`,
            entityType: 'task',
            senderId: userId,
            link: '/tasks'
          });
        }
      }
```

Nota: la variable `usersNewlyAssigned` se declara dentro del bloque de la transacción (`try { ... }`) — moverla a una declaración `let usersNewlyAssigned: Map<number, number> = new Map();` justo antes de `await db.beginTransaction('IMMEDIATE');` (línea 1603 actual) para que siga visible después del `try/catch` de la transacción.

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.assigneesWrite.test.ts`
Expected: PASS (los 5 tests)

- [ ] **Step 7: Correr toda la suite de `taskController` para confirmar que nada existente se rompió**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 8: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/__tests__/controllers/taskController.assigneesWrite.test.ts
git commit -m "feat(fase5): createTask/updateTask/batchUpdateTasks aceptan assignee_ids[] y sincronizan task_assignees"
```

---

## Task 6: Métricas — carga del equipo, horas de efectividad, recordatorio de vencimiento

**Files:**
- Modify: `backend/src/controllers/pmoController.ts` (función que arma `teamWorkload`, línea 97-109 actual)
- Modify: `backend/src/services/timesheetService.ts` (`getEffectivenessMetrics`, líneas 428-431 actuales)
- Modify: `backend/src/services/notificationService.ts` (`checkLoginReminders`, líneas 121-127 actuales)
- Create: `backend/src/__tests__/controllers/pmoController.teamWorkload.multiAssignee.test.ts`
- Create: `backend/src/__tests__/services/timesheetService.effectiveness.multiAssignee.test.ts`
- Create: `backend/src/__tests__/services/notificationService.dueSoon.multiAssignee.test.ts`

**Interfaces:**
- Consumes: tabla `task_assignees` (Task 1).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/pmoController.teamWorkload.multiAssignee.test.ts` (verifica el SQL, no ejecuta contra BD real — mismo estilo que el resto de tests de controllers de este repo):

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { PMOController } from '../../controllers/pmoController';

function mockRes(): any {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('PMOController - teamWorkload cuenta cada responsable via task_assignees', () => {
    it('el JOIN de carga del equipo usa task_assignees, no assignee_id directo', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);
        const controller = new PMOController();
        const res = mockRes();

        await controller.getPMODashboard({ user: { id: 9 } } as any, res);

        const workloadCall = (db.query as jest.Mock).mock.calls.find((c: any) => c[0].includes('active_tasks'));
        expect(workloadCall[0]).toContain('JOIN task_assignees ta ON ta.task_id = t.id AND t.status');
        expect(workloadCall[0]).toContain('GROUP BY u.id, u.full_name, u.role');
    });
});
```

Crear `backend/src/__tests__/services/timesheetService.effectiveness.multiAssignee.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/financeService', () => ({
    financeService: { getMonthlyHours: jest.fn().mockResolvedValue(160) }
}));

import { db } from '../../database/database';
import { TimesheetService } from '../../services/timesheetService';

describe('TimesheetService - estimatedByPerson cuenta horas completas para cada co-responsable', () => {
    it('el query de horas estimadas por persona usa task_assignees, una tarea con 2 responsables aporta horas completas a cada uno', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([]) // realByPerson
            .mockResolvedValueOnce([
                { user_id: 5, estimated_hours: 8 },
                { user_id: 9, estimated_hours: 8 }
            ]); // estimatedByPerson (misma tarea de 8h, 2 responsables -> 8h para cada uno)

        const service = new TimesheetService();
        await service.getEffectivenessMetrics('2026-01-01', '2026-01-31');

        const estimatedCall = (db.query as jest.Mock).mock.calls[1];
        expect(estimatedCall[0]).toContain('FROM task_assignees ta');
        expect(estimatedCall[0]).toContain('JOIN tasks t ON t.id = ta.task_id');
        expect(estimatedCall[0]).toContain('GROUP BY ta.user_id');
    });
});
```

Crear `backend/src/__tests__/services/notificationService.dueSoon.multiAssignee.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { NotificationService } from '../../services/notificationService';

describe('NotificationService - task_due_soon llega a cualquier co-responsable via task_assignees', () => {
    it('checkLoginReminders busca tareas por pertenencia a task_assignees, no solo assignee_id', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const service = new NotificationService();

        await service.checkLoginReminders(9, 0);

        const [sql] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id AND ta.user_id = ?)');
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest teamWorkload.multiAssignee effectiveness.multiAssignee dueSoon.multiAssignee`
Expected: FAIL — los 3 queries todavía usan `assignee_id` directo.

- [ ] **Step 3: Cambiar `teamWorkload` en `pmoController.ts` (líneas 97-109 actuales)**

Reemplazar:

```typescript
            const teamWorkload = await db.query(`
                SELECT
                    u.id,
                    u.full_name,
                    u.role,
                    COUNT(t.id) as active_tasks
                FROM users u
                JOIN tasks t ON t.assignee_id = u.id AND t.status != 'done'
                WHERE u.is_active = 1
                GROUP BY u.id, u.full_name, u.role
                HAVING COUNT(t.id) > 0
                ORDER BY active_tasks DESC
            `);
```

por:

```typescript
            const teamWorkload = await db.query(`
                SELECT
                    u.id,
                    u.full_name,
                    u.role,
                    COUNT(t.id) as active_tasks
                FROM users u
                JOIN task_assignees ta ON ta.user_id = u.id
                JOIN tasks t ON t.id = ta.task_id AND t.status != 'done'
                WHERE u.is_active = 1
                GROUP BY u.id, u.full_name, u.role
                HAVING COUNT(t.id) > 0
                ORDER BY active_tasks DESC
            `);
```

(Nota: el test espera el fragmento `JOIN task_assignees ta ON ta.task_id = t.id AND t.status` — ajustar el orden de los `JOIN` arriba si hace falta para que el fragmento literal aparezca; lo esencial es que `t.status != 'done'` se siga filtrando y que la fuente de la relación usuario↔tarea pase a ser `task_assignees`.)

- [ ] **Step 4: Cambiar `estimatedByPerson` en `timesheetService.ts` (líneas 428-431 actuales)**

Reemplazar:

```typescript
        const estimatedByPerson = await db.query(
            `SELECT t.assignee_id as user_id, COALESCE(SUM(t.estimated_hours), 0) as estimated_hours
             FROM tasks t WHERE t.assignee_id IS NOT NULL GROUP BY t.assignee_id`
        );
```

por:

```typescript
        const estimatedByPerson = await db.query(
            `SELECT ta.user_id as user_id, COALESCE(SUM(t.estimated_hours), 0) as estimated_hours
             FROM task_assignees ta
             JOIN tasks t ON t.id = ta.task_id
             GROUP BY ta.user_id`
        );
```

- [ ] **Step 5: Cambiar `checkLoginReminders` en `notificationService.ts` (líneas 121-127 actuales)**

Reemplazar:

```typescript
            const tasks = await db.query(`
                SELECT id, title FROM tasks
                WHERE assignee_id = ?
                  AND status NOT IN ('done', 'blocked')
                  AND due_date IS NOT NULL
                  AND date(due_date) BETWEEN date('now') AND date('now', '+' || ? || ' days')
            `, [userId, NotificationService.TASK_DUE_SOON_DAYS]);
```

por:

```typescript
            const tasks = await db.query(`
                SELECT id, title FROM tasks
                WHERE EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id AND ta.user_id = ?)
                  AND status NOT IN ('done', 'blocked')
                  AND due_date IS NOT NULL
                  AND date(due_date) BETWEEN date('now') AND date('now', '+' || ? || ' days')
            `, [userId, NotificationService.TASK_DUE_SOON_DAYS]);
```

(Nota: la tabla `tasks` no tiene alias en esta query, así que el `EXISTS` referencia `tasks.id` directamente, no `t.id` como en `taskController.ts`.)

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest teamWorkload.multiAssignee effectiveness.multiAssignee dueSoon.multiAssignee`
Expected: PASS

- [ ] **Step 7: Correr las suites completas de `pmoController`, `timesheetService` y `notificationService` para confirmar que nada existente se rompió**

Run: `cd backend && npx jest pmoController timesheetService notificationService`
Expected: PASS

- [ ] **Step 8: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/pmoController.ts backend/src/services/timesheetService.ts backend/src/services/notificationService.ts backend/src/__tests__/controllers/pmoController.teamWorkload.multiAssignee.test.ts backend/src/__tests__/services/timesheetService.effectiveness.multiAssignee.test.ts backend/src/__tests__/services/notificationService.dueSoon.multiAssignee.test.ts
git commit -m "feat(fase5): carga del equipo, horas estimadas y recordatorio de vencimiento cuentan cada co-responsable"
```

---

## Task 7: Frontend `TasksPage.tsx` — multi-select de responsables

**Files:**
- Modify: `frontend/src/pages/tasks/TasksPage.tsx`
- Create: `frontend/src/__tests__/pages/TasksPage.multiAssignee.test.tsx`

**Interfaces:**
- Consumes: `assignee_ids`/`assignee_names` en cada `Task` devuelta por `GET /tasks/boards/:id` (Task 4); `assignee_ids: number[]` aceptado por `POST /tasks`, `PUT /tasks/:id` y `PATCH /tasks/batch` (Task 5).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `frontend/src/__tests__/pages/TasksPage.multiAssignee.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    getTaskSubtasks: vi.fn(),
    getTaskCollaborators: vi.fn(),
    getTaskTags: vi.fn(),
    batchUpdateTasks: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TasksPage } from '@/pages/tasks/TasksPage';

const board = {
  id: 2, project_id: 7, name: 'Board 1', board_type: 'kanban', project_name: 'AGROSUPER',
  columns: [
    { id: 1, board_id: 2, name: 'To Do', position: 0, color: '#000', is_done_column: false }
  ],
  tasks: [
    {
      id: 42, board_id: 2, column_id: 1, title: 'Tarea con 2 responsables', task_type: 'task',
      status: 'todo', priority: 'medium', position: 0, created_at: '', updated_at: '',
      assignee_id: 5, assignee_ids: '5||9', assignee_names: 'Ana||Beto'
    }
  ]
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <TasksPage />
    </MemoryRouter>
  );
}

describe('TasksPage - multi-asignado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([
        { id: 5, full_name: 'Ana' }, { id: 9, full_name: 'Beto' }, { id: 11, full_name: 'Carla' }
      ]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
    (apiService.getTaskCollaborators as any).mockResolvedValue([]);
    (apiService.getTaskTags as any).mockResolvedValue([]);
  });

  it('la tarjeta del Kanban muestra los 2 responsables como avatares/tags con tooltip', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tarea con 2 responsables')).toBeInTheDocument());

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('el formulario de edicion precarga assignee_ids con ambos responsables en un select multiple', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tarea con 2 responsables')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Tarea con 2 responsables'));

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeInTheDocument();
      expect(screen.getByText('Beto')).toBeInTheDocument();
    });
  });

  it('guardar la edicion envia assignee_ids como array de numeros', async () => {
    (apiService.put as any).mockResolvedValue({ ...board.tasks[0] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Tarea con 2 responsables')).toBeInTheDocument());
    await userEvent.click(screen.getByText('Tarea con 2 responsables'));
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /guardar|actualizar/i }));

    await waitFor(() => {
      expect(apiService.put).toHaveBeenCalledWith(
        '/tasks/42',
        expect.objectContaining({ assignee_ids: [5, 9] })
      );
    });
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.multiAssignee.test.tsx`
Expected: FAIL — el campo sigue siendo un `Select` simple con `assignee_id`, y la tarjeta no muestra "+2".

- [ ] **Step 3: Actualizar el tipo `Task` (líneas 70-96 actuales)**

Agregar después de `assignee_avatar?: string;` (línea 81 actual):

```typescript
  assignee_ids?: string | null;
  assignee_names?: string | null;
```

- [ ] **Step 4: Cambiar el campo del formulario a multi-select (líneas 1217-1225 actuales)**

Reemplazar:

```typescript
              <Form.Item name="assignee_id" label="Asignado a">
                <Select placeholder="Seleccionar usuario" allowClear>
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
```

por:

```typescript
              <Form.Item name="assignee_ids" label="Responsables">
                <Select mode="multiple" placeholder="Seleccionar responsables" allowClear optionFilterProp="children">
                  {users.map(user => (
                    <Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
```

- [ ] **Step 5: Precargar `assignee_ids` al editar (`openEditTaskModal`, líneas 564-580 actuales)**

Reemplazar:

```typescript
      assignee_id: task.assignee_id,
```

por:

```typescript
      assignee_ids: task.assignee_ids ? task.assignee_ids.split('||').map(Number) : (task.assignee_id ? [task.assignee_id] : []),
```

- [ ] **Step 6: Mostrar los responsables en la tarjeta del Kanban (líneas 649-654 actuales)**

Reemplazar:

```typescript
                  {task.assignee_name && (
                    <Tooltip title={task.assignee_name}>
                      <Avatar size="small" icon={<UserOutlined />} />
                    </Tooltip>
                  )}
```

por:

```typescript
                  {task.assignee_names && (() => {
                    const names = task.assignee_names!.split('||');
                    return (
                      <Tooltip title={names.join(', ')}>
                        <Tag>{names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0]}</Tag>
                      </Tooltip>
                    );
                  })()}
```

- [ ] **Step 7: Migrar el filtro por asignado (línea 776 actual) a comprobar pertenencia**

Reemplazar:

```typescript
      .filter(task => filterAssigneeId === undefined || task.assignee_id === filterAssigneeId);
```

por:

```typescript
      .filter(task => filterAssigneeId === undefined || (task.assignee_ids ?? '').split('||').map(Number).includes(filterAssigneeId));
```

- [ ] **Step 8: Migrar la edición masiva "Reasignar" (líneas 460-462 actuales) a mandar `assignee_ids`**

Reemplazar:

```typescript
    const updates: { priority?: string; assignee_id?: number; column_id?: number } = {};
    if (bulkPriority !== undefined) updates.priority = bulkPriority;
    if (bulkAssigneeId !== undefined) updates.assignee_id = bulkAssigneeId;
```

por:

```typescript
    const updates: { priority?: string; assignee_ids?: number[]; column_id?: number } = {};
    if (bulkPriority !== undefined) updates.priority = bulkPriority;
    if (bulkAssigneeId !== undefined) updates.assignee_ids = [bulkAssigneeId];
```

(El selector `bulkAssigneeId` de la barra de edición masiva sigue siendo de una sola persona — reemplaza la lista completa de responsables por esa única persona, mismo comportamiento que ya tenía "Reasignar" antes de este cambio, ahora expresado como lista de 1 elemento.)

- [ ] **Step 9: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.multiAssignee.test.tsx`
Expected: PASS (los 3 tests)

- [ ] **Step 10: Correr toda la suite de `TasksPage` para confirmar que nada existente se rompió**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx src/__tests__/pages/TasksPage.bulkEdit.test.tsx src/__tests__/pages/TasksPage.multiAssignee.test.tsx`
Expected: PASS

- [ ] **Step 11: Compilar**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 12: Commit**

```bash
git add frontend/src/pages/tasks/TasksPage.tsx frontend/src/__tests__/pages/TasksPage.multiAssignee.test.tsx
git commit -m "feat(fase5): TasksPage usa select multiple de responsables (assignee_ids)"
```

---

## Task 8: Frontend `PMODashboard.tsx` — los 2 formularios con campo de asignado pasan a multi-select

**Files:**
- Modify: `frontend/src/pages/pmo/PMODashboard.tsx` (líneas 3015-3022 y 3295-3302 actuales)
- Modify: `frontend/src/__tests__/pages/PMODashboard.test.tsx` (o el archivo de test existente que cubra estos formularios — buscar antes de escribir el nuevo test para no duplicar setup)

**Interfaces:**
- Consumes: `POST /tasks`/`PUT /tasks/:id` con `assignee_ids: number[]` (Task 5).

- [ ] **Step 1: Localizar el test existente de estos formularios**

Run: `cd frontend && grep -rl "assignee_id" src/__tests__/pages/PMODashboard*`

Si existe un test que ya cubre el formulario de creación/edición de tarea rápida en `PMODashboard`, agregar los casos nuevos ahí (mismo `describe` file); si no existe ninguno, crear `frontend/src/__tests__/pages/PMODashboard.multiAssignee.test.tsx` siguiendo el mismo molde de mocks que `TasksPage.multiAssignee.test.tsx` (Task 7, Step 1), adaptado a los componentes que `PMODashboard.tsx` importa.

- [ ] **Step 2: Escribir el test que falla**

Agregar (en el archivo elegido en el Step 1) un test que confirme que el `Form.Item` de asignado en ambos formularios es `mode="multiple"` y que el submit manda `assignee_ids` como array — mismo patrón de aserciones que `TasksPage.multiAssignee.test.tsx` Step 1 ("guardar la edicion envia assignee_ids como array de numeros"), apuntando al selector/formulario real de `PMODashboard.tsx` (buscar el texto del botón de submit de cada uno de los 2 formularios antes de escribir el `userEvent.click`).

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `cd frontend && npx vitest run <archivo elegido en Step 1>`
Expected: FAIL — los campos siguen siendo `Select` simple con `assignee_id`.

- [ ] **Step 4: Cambiar el primer formulario (líneas 3015-3022 actuales)**

Reemplazar:

```typescript
              <Form.Item name="assignee_id" label="Asignado a">
                <Select placeholder="Seleccionar usuario">
                  {users.map((user: any) => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Select.Option>
                  ))}
```

por:

```typescript
              <Form.Item name="assignee_ids" label="Responsables">
                <Select mode="multiple" placeholder="Seleccionar responsables">
                  {users.map((user: any) => (
                    <Select.Option key={user.id} value={user.id}>
                      {user.full_name}
                    </Select.Option>
                  ))}
```

- [ ] **Step 5: Cambiar el segundo formulario (líneas 3295-3302 actuales)**

Mismo reemplazo que el Step 4, aplicado al segundo bloque (`Form.Item name="assignee_id"` en la línea 3295 actual).

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `cd frontend && npx vitest run <archivo elegido en Step 1>`
Expected: PASS

- [ ] **Step 7: Correr toda la suite de `PMODashboard` para confirmar que nada existente se rompió**

Run: `cd frontend && npx vitest run src/__tests__/pages/PMODashboard*`
Expected: PASS

- [ ] **Step 8: Compilar**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/pmo/PMODashboard.tsx frontend/src/__tests__/pages/PMODashboard*
git commit -m "feat(fase5): PMODashboard usa select multiple de responsables en sus 2 formularios de tarea"
```

---

## Task 9: Revisión final de toda la rama

- [ ] **Step 1: Correr toda la suite de backend**

Run: `cd backend && npm test`
Expected: todos los tests en PASS (existentes + los agregados en Tasks 1-6)

- [ ] **Step 2: Correr toda la suite de frontend**

Run: `cd frontend && npx vitest run`
Expected: todos los tests en PASS (existentes + los agregados en Tasks 7-8)

- [ ] **Step 3: Compilar backend y frontend**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: sin errores en ninguno de los dos

- [ ] **Step 4: Verificación manual de que no quedó ningún criterio de acceso viejo**

Run: `grep -rn "OR t\.assignee_id = ?" backend/src/controllers/ ; grep -rn "t\.assignee_id = ? OR p\.assigned_to" backend/src/controllers/`
Expected: sin resultados (los tests estáticos de Tasks 2 y 3 ya lo cubren, esto es una doble verificación manual antes de cerrar). Cualquier resultado que aparezca debe explicarse uno por uno: ¿es un `LEFT JOIN` de lectura legítimo (se mantiene) o un chequeo de acceso que quedó sin migrar (se corrige antes de cerrar)?

- [ ] **Step 5: Revisión de todo el diff de la rama (desde el primer commit de Task 1 hasta el último de Task 8)**

Usar `superpowers:requesting-code-review` acotado a los commits de la rama `fase5-multiasignado`, igual que en los sub-proyectos anteriores de Fase 5. Foco específico pedido por este plan (ver "Review Focus" del header): ningún endpoint debe seguir siendo alcanzable solo por el criterio viejo de `assignee_id`, la notificación de reasignación no debe re-notificar a quien ya era responsable, y `teamWorkload`/`estimatedByPerson` deben contar la tarea completa para cada responsable, no repartirla.
