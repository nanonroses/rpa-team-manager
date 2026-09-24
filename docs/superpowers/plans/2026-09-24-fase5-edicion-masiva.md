# Edición Masiva de Tareas (Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar en masa, desde el Kanban de tareas, tres campos de varias tareas a la vez: prioridad, asignado y columna (columna = "estado" en este sistema, ya que `status` no se edita directo en la UI hoy). Sin migración nueva.

**Architecture:** Nuevo endpoint `PATCH /api/tasks/batch` en `taskController.ts`, con el mismo molde que los endpoints `POST /tasks/batch` (`batchCreateTasks`) y `DELETE /tasks/batch` (`batchDeleteTasks`) ya existentes en el mismo archivo: transacción `IMMEDIATE`, validación de `taskIds` con el helper ya existente, chequeo de acceso por tarea reusando el criterio SQL ya usado en `updateTask`, aplicación de los cambios solo a las tareas accesibles (las inaccesibles se listan en `skipped`, no rompen el resto del batch), reordenamiento de posiciones reusando `reorderColumnPositions` ya existente cuando hay cambio de columna, un log de actividad agregado por proyecto, y una notificación agrupada (no una por tarea) cuando cambia el asignado. En el frontend, `TasksPage.tsx` gana un modo de selección múltiple: checkbox por card del Kanban y una barra de acciones con los 3 campos + "Aplicar"/"Cancelar selección".

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend), React 18/TypeScript/Ant Design (frontend). Backend test runner: Jest. Frontend test runner: **Vitest** (`vi`, no `jest`) + `@testing-library/react` + `@testing-library/user-event` — confirmado en `frontend/src/__tests__/pages/TasksPage.test.tsx`. Sin dependencias nuevas, sin migración nueva.

**Spec:** Diseño aprobado en chat el 2026-09-24 (sub-proyecto "edición masiva de tareas" de Fase 5 de RPA Team Manager, clasificado como bounded — sin doc de spec separado, por convención de este repo). Decisiones clave tomadas ahí: (1) solo 3 campos editables en masa: `priority`, `assignee_id`, `column_id` — nada de título/descripción/fechas; (2) sin campo `status` separado porque la UI no lo edita directo hoy (se infiere de la columna, y `moveTask` tampoco lo toca); (3) una tarea sin acceso dentro de un batch se excluye silenciosamente (`skipped`), no rompe el resto; (4) reasignar varias tareas al mismo usuario nuevo dispara UNA sola notificación agrupada; (5) rama de trabajo `fase5-edicion-masiva`, creada desde `main`.

## Global Constraints

- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (nunca `db.all`). Firmas reales (`backend/src/database/database.ts`): `db.query(sql, params[]) => Promise<any[]>`, `db.run(sql, params[]) => Promise<{ id?: number; changes: number }>`, `db.get(sql, params[]) => Promise<any>`, `db.beginTransaction(mode?: 'IMMEDIATE'|'EXCLUSIVE') => Promise<void>`, `db.commit()`/`db.rollback() => Promise<void>`.
- Roles reales del sistema: `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'` — no relevante acá, el endpoint nuevo solo usa `authenticate`, igual que el resto de `taskController` (sin `authorize()` por rol).
- Autorización: reutilizar el mismo criterio de acceso a tareas que ya usa `updateTask`/`deleteTask`/`getTaskSubtasks` en `taskController.ts`: `WHERE t.id IN (...) AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)`, vía `LEFT JOIN task_boards tb ON t.board_id = tb.id LEFT JOIN projects p ON tb.project_id = p.id`. No existe ningún helper reutilizable para esto en el código real; está repetido inline en cada método, así se debe seguir haciendo.
- Reusar tal cual, sin modificar: `validateBatchDeletionInput` (valida arrays de IDs) y `reorderColumnPositions` (renumera 1..N por `id ASC` para un set de `column_id`), ambos en `backend/src/utils/batch-deletion.utils.ts`. No usar `handleBatchDeletionError`/`createBatchDeletionResponse` de ese mismo archivo — su vocabulario es específico de borrado ("Failed to complete batch deletion"), semánticamente incorrecto para una edición; el catch final de este endpoint es simple e inline, igual que `batchCreateTasks`.
- `priority` válida: `'critical' | 'high' | 'medium' | 'low'` (CHECK real de la tabla `tasks`, `backend/src/database/migrationList.ts` línea 66). Validar explícitamente antes de tocar la BD — no depender del CHECK de SQLite para traducir el error (ya hubo un bug de este tipo en el sub-proyecto de dependencias entre tareas: un CHECK constraint inválido se confundía con una violación de UNIQUE).
- Si `updates.column_id` viene en el body: la columna destino debe existir y pertenecer al **mismo board** que las tareas accesibles del batch — si no, 400 y no se aplica ningún cambio (ni siquiera a las tareas que sí tenían columna válida). Esto es una validación previa a la transacción, no una exclusión silenciosa como el resto de accesos.
- Cuando varias tareas del batch se mueven a la misma columna destino, cada una debe recibir una `position` secuencial distinta (igual patrón que `batchCreateTasks` con su `columnMap` local) — nunca reusar el mismo `MAX(position)` para más de una tarea.
- Notificación de reasignación: agrupada, **una sola llamada** a `notificationService.notify` por `assignee_id` nuevo, con el conteo de tareas reasignadas (no contar las que ya tenían ese mismo `assignee_id`). No notificar si `assignee_id` es `null`/`undefined` o si es el propio usuario que hace el cambio (mismo criterio que `updateTask` individual).
- `activityLogService.logActivity`/`notificationService.notify` nunca lanzan (ver comentarios en esos servicios) — no hace falta wrappear sus llamadas en try/catch adicional.
- Sin `validate()` con schema de Zod para este endpoint — `batchCreateTasks`/`batchDeleteTasks` tampoco lo usan, validan inline. Seguir el mismo patrón.
- Tests backend: mock manual de `db` vía `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() } }))` + `jest.clearAllMocks()` en `beforeEach`. Mockear también `activityLogService` y `notificationService` (el módulo los importa aunque un test puntual no los dispare). **No mockear** `batch-deletion.utils` — su implementación real debe correr contra el `db` mockeado, igual que ya hacen los tests existentes de `batchDeleteTasks`/`batchCreateTasks` en `taskController.logging.test.ts`.
- Tests frontend: **Vitest**, no Jest (`import { describe, it, expect, vi, beforeEach } from 'vitest'`, `vi.mock('@/services/api', ...)`). Ver `frontend/src/__tests__/pages/TasksPage.test.tsx` como plantilla exacta de mocking y fixtures de `board`.
- No mergear a `main` ni abrir PR sin preguntar — se sigue trabajando en la rama `fase5-edicion-masiva`.

## Review Focus

- Un `taskId` sin acceso mezclado con otros sí accesibles no debe romper el batch — debe aplicarse a los accesibles y devolver el resto en `skipped`, nunca un 500 — Task 1.
- Mover varias tareas al mismo `column_id` destino en un solo batch no debe pisar posiciones (todas con la misma `position`) — cada una debe tener una `position` secuencial distinta — Task 1.
- `column_id` destino de un board distinto al de las tareas seleccionadas debe rechazar la petición ENTERA con 400, no aplicarse parcialmente a las tareas cuyo board sí coincide — Task 1.
- Reasignar 3 tareas al mismo usuario nuevo debe generar UNA sola notificación agrupada, no 3 — Task 1.
- En el frontend, cancelar la selección (o aplicar con éxito) debe vaciar `selectedTaskIds` y ocultar la barra de acciones — de lo contrario, tras recargar el board (que puede reordenar/mover tarjetas), quedaría una selección "fantasma" sobre IDs que el usuario ya no ve marcados — Task 2.

---

## Task 1: Endpoint `PATCH /api/tasks/batch` — edición masiva en `taskController`/`taskRoutes`

**Files:**
- Modify: `backend/src/controllers/taskController.ts` (agregar método `batchUpdateTasks`, después de `batchCreateTasks`, línea 1133 actual, antes del comentario de `getProjectTasks` en línea 1135)
- Modify: `backend/src/routes/taskRoutes.ts` (agregar ruta, línea 21 actual, antes de la sección de rutas parametrizadas)
- Create: `backend/src/__tests__/controllers/taskController.batchUpdate.test.ts`

**Interfaces:**
- Consumes: `db.query`/`db.get`/`db.run`/`db.beginTransaction`/`db.commit`/`db.rollback`, `validateBatchDeletionInput` y `reorderColumnPositions` (ambos ya importados en `taskController.ts` desde `../utils/batch-deletion.utils`), `activityLogService.logActivity`, `notificationService.notify` (ambos ya importados en `taskController.ts`).
- Produces (usado por el frontend en Task 2): `PATCH /api/tasks/batch`, body `{ taskIds: number[], updates: { priority?: 'critical'|'high'|'medium'|'low', assignee_id?: number|null, column_id?: number } }` → `200 { success: true, updated: number[], updatedCount: number, skipped: number[] }`. Errores: `400 { error, code?: 'INVALID_INPUT' }` (taskIds inválidos, sin campos en `updates`, `priority` inválida, `column_id` de otro board o inexistente), `500 { error }`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.batchUpdate.test.ts`:

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

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { notificationService } from '../../services/notificationService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function req(body: any, userId = 3): AuthenticatedRequest {
    return { body, user: { id: userId } } as unknown as AuthenticatedRequest;
}

describe('TaskController - batchUpdateTasks (edicion masiva)', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('devuelve 400 si taskIds esta vacio o invalido, sin tocar la BD', async () => {
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [], updates: { priority: 'high' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve 400 si updates no trae ningun campo reconocido', async () => {
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: {} }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve 400 si priority no es un valor valido', async () => {
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { priority: 'urgentisimo' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('excluye en skipped las tareas sin acceso, sin romper el resto del batch', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 999], updates: { priority: 'high' } }), res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true, updated: [1], updatedCount: 1, skipped: [999]
        }));
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET priority = ?'),
            expect.arrayContaining(['high', 1])
        );
    });

    it('devuelve success con updated/skipped vacios de mas si ninguna tarea es accesible, sin abrir transaccion', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [999], updates: { priority: 'high' } }), res);

        expect(res.json).toHaveBeenCalledWith({ success: true, updated: [], updatedCount: 0, skipped: [999] });
        expect(db.beginTransaction).not.toHaveBeenCalled();
    });

    it('devuelve 400 si la columna destino no existe', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce(undefined);
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { column_id: 999 } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.beginTransaction).not.toHaveBeenCalled();
    });

    it('devuelve 400 entero si la columna destino pertenece a otro board (no aplica nada parcialmente)', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 20, board_id: 200 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { column_id: 20 } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.beginTransaction).not.toHaveBeenCalled();
        expect(db.run).not.toHaveBeenCalled();
    });

    it('mueve varias tareas a la misma columna destino con positions secuenciales distintas', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 },
            { id: 2, column_id: 10, position: 2, assignee_id: 6, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 20, board_id: 100 })   // target column lookup
            .mockResolvedValueOnce({ max_position: 3 });         // max position en columna 20
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { column_id: 20 } }), res);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET column_id = ?, position = ?'),
            [20, 4, 1]
        );
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET column_id = ?, position = ?'),
            [20, 5, 2]
        );
        expect(db.commit).toHaveBeenCalled();
    });

    it('no mueve una tarea que ya esta en la columna destino (no-op de posicion)', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 20, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 20, board_id: 100 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { column_id: 20 } }), res);

        expect(db.run).not.toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET column_id = ?, position = ?'),
            expect.anything()
        );
    });

    it('agrupa el log de actividad por proyecto con action=tasks_batch_updated', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 },
            { id: 2, column_id: 10, position: 2, assignee_id: 6, board_id: 200, project_id: 9 }
        ]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { priority: 'critical' } }), res);

        expect(activityLogService.logActivity).toHaveBeenCalledTimes(2);
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'tasks_batch_updated', null, expect.objectContaining({ count: 1 })
        );
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 9, 'tasks_batch_updated', null, expect.objectContaining({ count: 1 })
        );
    });

    it('reasignar 3 tareas al mismo usuario nuevo dispara UNA sola notificacion agrupada', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 },
            { id: 2, column_id: 10, position: 2, assignee_id: 5, board_id: 100, project_id: 7 },
            { id: 3, column_id: 10, position: 3, assignee_id: 6, board_id: 100, project_id: 7 }
        ]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 3 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2, 3], updates: { assignee_id: 8 } }), res);

        expect(notificationService.notify).toHaveBeenCalledTimes(1);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 8, eventKey: 'task_assigned', senderId: 3
        }));
        expect((notificationService.notify as jest.Mock).mock.calls[0][0].message).toContain('3');
    });

    it('no notifica si el nuevo assignee_id es el mismo usuario que hace el cambio', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { assignee_id: 3 } }, 3), res);

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('no notifica si ninguna tarea cambia realmente de assignee_id', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 8, board_id: 100, project_id: 7 }
        ]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { assignee_id: 8 } }), res);

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('hace rollback si una escritura dentro de la transaccion falla', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.run as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { priority: 'high' } }), res);

        expect(db.rollback).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.batchUpdate.test.ts`
Expected: FAIL — `controller.batchUpdateTasks` no es una funcion todavia.

- [ ] **Step 3: Implementar `batchUpdateTasks` en `taskController.ts`**

En `backend/src/controllers/taskController.ts`, agregar el siguiente método inmediatamente después del cierre de `batchCreateTasks` (línea 1133 actual: `  };`), antes del comentario `// GET /api/tasks/project/:projectId - Get recent tasks for a specific project` (línea 1135 actual):

```typescript

  // PATCH /api/tasks/batch - Bulk update priority/assignee_id/column_id for multiple tasks
  batchUpdateTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { taskIds, updates } = req.body;

      const validation = validateBatchDeletionInput(taskIds);
      if (!validation.isValid) {
        res.status(400).json({ error: validation.error, code: 'INVALID_INPUT' });
        return;
      }
      const validTaskIds = validation.validIds;

      if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
        res.status(400).json({ error: 'updates object is required' });
        return;
      }

      const { priority, assignee_id, column_id } = updates;
      const hasField = priority !== undefined || assignee_id !== undefined || column_id !== undefined;
      if (!hasField) {
        res.status(400).json({ error: 'At least one field to update is required (priority, assignee_id, column_id)' });
        return;
      }

      const validPriorities = ['critical', 'high', 'medium', 'low'];
      if (priority !== undefined && !validPriorities.includes(priority)) {
        res.status(400).json({ error: 'Invalid priority value' });
        return;
      }

      const placeholders = validTaskIds.map(() => '?').join(', ');
      const accessibleTasks = await db.query(`
        SELECT t.id, t.column_id, t.position, t.assignee_id, tb.id as board_id, tb.project_id
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id IN (${placeholders}) AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [...validTaskIds, userId, userId, userId]);

      const accessibleIds = accessibleTasks.map((t: any) => t.id);
      const skipped = validTaskIds.filter((id: number) => !accessibleIds.includes(id));

      if (accessibleTasks.length === 0) {
        res.json({ success: true, updated: [], updatedCount: 0, skipped });
        return;
      }

      let targetColumnId: number | undefined;
      if (column_id !== undefined) {
        const targetColumn = await db.get(`SELECT id, board_id FROM task_columns WHERE id = ?`, [column_id]);
        if (!targetColumn) {
          res.status(400).json({ error: 'Target column not found' });
          return;
        }
        const boardIds = new Set(accessibleTasks.map((t: any) => t.board_id));
        if (boardIds.size > 1 || !boardIds.has(targetColumn.board_id)) {
          res.status(400).json({ error: 'Target column must belong to the same board as the selected tasks' });
          return;
        }
        targetColumnId = column_id;
      }

      const projectCounts: Map<number, number> = new Map();
      for (const task of accessibleTasks) {
        projectCounts.set(task.project_id, (projectCounts.get(task.project_id) || 0) + 1);
      }

      await db.beginTransaction('IMMEDIATE');

      try {
        if (priority !== undefined || assignee_id !== undefined) {
          const setClauses: string[] = [];
          const params: any[] = [];
          if (priority !== undefined) { setClauses.push('priority = ?'); params.push(priority); }
          if (assignee_id !== undefined) { setClauses.push('assignee_id = ?'); params.push(assignee_id); }
          setClauses.push('updated_at = CURRENT_TIMESTAMP');
          const idPlaceholders = accessibleIds.map(() => '?').join(', ');
          await db.run(
            `UPDATE tasks SET ${setClauses.join(', ')} WHERE id IN (${idPlaceholders})`,
            [...params, ...accessibleIds]
          );
        }

        if (targetColumnId !== undefined) {
          const columnsToReorder: Set<number> = new Set();
          const maxPosRow = await db.get(`SELECT MAX(position) as max_position FROM tasks WHERE column_id = ?`, [targetColumnId]);
          let nextPosition = maxPosRow?.max_position || 0;

          for (const task of accessibleTasks) {
            if (task.column_id === targetColumnId) continue;
            nextPosition += 1;
            await db.run(
              `UPDATE tasks SET column_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [targetColumnId, nextPosition, task.id]
            );
            columnsToReorder.add(task.column_id);
          }

          if (columnsToReorder.size > 0) {
            await reorderColumnPositions(db, columnsToReorder, 'tasks');
          }
        }

        for (const [projectId, count] of projectCounts) {
          await activityLogService.logActivity(
            userId, 'project', projectId, 'tasks_batch_updated', null,
            { count, fields: Object.keys(updates) }
          );
        }

        await db.commit();
      } catch (transactionError) {
        await db.rollback();
        logger.error('Batch update tasks transaction error:', transactionError);
        throw transactionError;
      }

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

      logger.info(`Batch update completed: ${accessibleIds.length} tasks updated by user ${userId}`);
      res.json({ success: true, updated: accessibleIds, updatedCount: accessibleIds.length, skipped });
    } catch (error) {
      logger.error('Batch update tasks error:', error);
      res.status(500).json({ error: 'Failed to update tasks in batch' });
    }
  };
```

- [ ] **Step 4: Registrar la ruta**

En `backend/src/routes/taskRoutes.ts`, reemplazar (líneas 19-21 actuales):

```typescript
// Specific routes MUST come before parameterized routes
router.post('/tasks/batch', authenticate, taskController.batchCreateTasks);
router.delete('/tasks/batch', authenticate, taskController.batchDeleteTasks);
```

por:

```typescript
// Specific routes MUST come before parameterized routes
router.post('/tasks/batch', authenticate, taskController.batchCreateTasks);
router.delete('/tasks/batch', authenticate, taskController.batchDeleteTasks);
router.patch('/tasks/batch', authenticate, taskController.batchUpdateTasks);
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.batchUpdate.test.ts`
Expected: PASS (los 13 tests)

- [ ] **Step 6: Correr toda la suite de `taskController` para confirmar que nada existente se rompió**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 7: Compilar para confirmar que todo tipa bien**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/routes/taskRoutes.ts backend/src/__tests__/controllers/taskController.batchUpdate.test.ts
git commit -m "feat(fase5): endpoint PATCH /tasks/batch para edicion masiva de tareas"
```

---

## Task 2: UI de selección múltiple y barra de edición masiva en `TasksPage`

**Files:**
- Modify: `frontend/src/services/api.ts` (nuevo método `batchUpdateTasks`, después de `batchDeleteTasks`, línea 577 actual)
- Modify: `frontend/src/pages/tasks/TasksPage.tsx`
- Create: `frontend/src/__tests__/pages/TasksPage.bulkEdit.test.tsx`

**Interfaces:**
- Consumes: `PATCH /api/tasks/batch` (Task 1) vía `apiService.batchUpdateTasks(taskIds, updates)`.
- Produces: nada consumido por otro componente — es la capa de UI final de este sub-proyecto.

- [ ] **Step 1: Agregar el método al api client**

En `frontend/src/services/api.ts`, agregar inmediatamente después del cierre de `batchDeleteTasks` (línea 577 actual: `  }`), antes de `moveTask` (línea 579 actual):

```typescript

  async batchUpdateTasks(taskIds: number[], updates: { priority?: string; assignee_id?: number | null; column_id?: number }): Promise<any> {
    const response = await this.api.patch('/tasks/batch', { taskIds, updates });
    return response.data;
  }
```

- [ ] **Step 2: Escribir los tests de frontend que fallan**

Crear `frontend/src/__tests__/pages/TasksPage.bulkEdit.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    getTaskById: vi.fn(),
    getTaskSubtasks: vi.fn(),
    createTaskSubtask: vi.fn(),
    batchUpdateTasks: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TasksPage } from '@/pages/tasks/TasksPage';

const board = {
  id: 2, project_id: 7, name: 'Board 1', board_type: 'kanban', project_name: 'AGROSUPER',
  columns: [
    { id: 1, board_id: 2, name: 'To Do', position: 0, color: '#000', is_done_column: false },
    { id: 2, board_id: 2, name: 'Done', position: 1, color: '#000', is_done_column: true }
  ],
  tasks: [
    { id: 42, board_id: 2, column_id: 1, title: 'Tarea A', task_type: 'task', status: 'todo', priority: 'medium', position: 0, created_at: '', updated_at: '' },
    { id: 43, board_id: 2, column_id: 1, title: 'Tarea B', task_type: 'task', status: 'todo', priority: 'medium', position: 1, created_at: '', updated_at: '' }
  ]
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <TasksPage />
    </MemoryRouter>
  );
}

async function selectBoard() {
  await waitFor(() => {
    expect(screen.getByText('Tarea A')).toBeInTheDocument();
  });
}

describe('TasksPage - edicion masiva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([{ id: 9, full_name: 'Ana Reasignada' }]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
  });

  it('activa el modo de seleccion, muestra la barra de acciones al tildar una tarea y la oculta al cancelar', async () => {
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('button', { name: /selección múltiple/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea a/i }));

    expect(await screen.findByText(/1 tarea\(s\) seleccionada/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancelar selección/i }));

    await waitFor(() => {
      expect(screen.queryByText(/tarea\(s\) seleccionada/i)).not.toBeInTheDocument();
    });
  });

  it('aplica un cambio de prioridad a las tareas seleccionadas y limpia la seleccion', async () => {
    (apiService.batchUpdateTasks as any).mockResolvedValue({ success: true, updated: [42, 43], updatedCount: 2, skipped: [] });
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('button', { name: /selección múltiple/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea a/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea b/i }));

    await userEvent.click(screen.getByRole('combobox', { name: /cambiar prioridad/i }));
    await userEvent.click(await screen.findByText('🔴 Crítica'));

    await userEvent.click(screen.getByRole('button', { name: /^aplicar$/i }));

    await waitFor(() => {
      expect(apiService.batchUpdateTasks).toHaveBeenCalledWith([42, 43], { priority: 'critical' });
    });
    await waitFor(() => {
      expect(screen.queryByText(/tarea\(s\) seleccionada/i)).not.toBeInTheDocument();
    });
  });

  it('no llama a la API si se cancela la seleccion sin aplicar', async () => {
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('button', { name: /selección múltiple/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea a/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancelar selección/i }));

    expect(apiService.batchUpdateTasks).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.bulkEdit.test.tsx`
Expected: FAIL — no existe el botón "Selección múltiple" ni los checkboxes todavía.

- [ ] **Step 4: Agregar el import de `Checkbox` y el estado de selección**

En `frontend/src/pages/tasks/TasksPage.tsx`, en el bloque de imports de `antd` (líneas 2-22 actuales), agregar `Checkbox` a la lista (después de `Tag,` en la línea 10):

```typescript
  Tag,
  Checkbox,
  Avatar,
```

Después de la declaración de `const [selectedColumn, setSelectedColumn] = useState<number | null>(null);` (línea 118 actual), agregar:

```typescript
  // Edición masiva
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [bulkPriority, setBulkPriority] = useState<string | undefined>(undefined);
  const [bulkAssigneeId, setBulkAssigneeId] = useState<number | undefined>(undefined);
  const [bulkColumnId, setBulkColumnId] = useState<number | undefined>(undefined);
```

- [ ] **Step 5: Agregar los handlers de selección y aplicación masiva**

En `frontend/src/pages/tasks/TasksPage.tsx`, agregar después del cierre de `handleDeleteTask` (línea 374 actual: `  };`), antes de `handleDragEnd` (línea 376 actual):

```typescript
  const toggleSelectionMode = () => {
    if (selectionMode) {
      exitSelectionMode();
    } else {
      setSelectionMode(true);
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedTaskIds([]);
    setBulkPriority(undefined);
    setBulkAssigneeId(undefined);
    setBulkColumnId(undefined);
  };

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleBulkApply = async () => {
    const updates: { priority?: string; assignee_id?: number; column_id?: number } = {};
    if (bulkPriority !== undefined) updates.priority = bulkPriority;
    if (bulkAssigneeId !== undefined) updates.assignee_id = bulkAssigneeId;
    if (bulkColumnId !== undefined) updates.column_id = bulkColumnId;

    if (Object.keys(updates).length === 0) {
      message.warning('Elegí al menos un cambio para aplicar');
      return;
    }

    try {
      await apiService.batchUpdateTasks(selectedTaskIds, updates);
      message.success('Tareas actualizadas exitosamente');
      exitSelectionMode();

      if (selectedBoard) {
        loadBoard(selectedBoard.id);
      }
    } catch (error: any) {
      console.error('Error en edición masiva:', error);
      message.error(error.response?.data?.error || 'Error al actualizar tareas');
    }
  };

```

- [ ] **Step 6: Agregar el botón de selección múltiple en la barra superior**

En `frontend/src/pages/tasks/TasksPage.tsx`, reemplazar (líneas 764-771 actuales):

```typescript
              <Button
                icon={<PlusOutlined />}
                onClick={() => openCreateTaskModal()}
                disabled={!selectedBoard}
              >
                Nueva Tarea
              </Button>
            </Space>
```

por:

```typescript
              <Button
                icon={<PlusOutlined />}
                onClick={() => openCreateTaskModal()}
                disabled={!selectedBoard}
              >
                Nueva Tarea
              </Button>

              <Button
                type={selectionMode ? 'primary' : 'default'}
                onClick={toggleSelectionMode}
                disabled={!selectedBoard}
              >
                {selectionMode ? 'Salir de selección' : 'Selección múltiple'}
              </Button>
            </Space>
```

- [ ] **Step 7: Agregar la barra de acciones masivas antes del Kanban**

En `frontend/src/pages/tasks/TasksPage.tsx`, agregar inmediatamente antes de `{/* Kanban Board */}` (línea 777 actual):

```typescript
      {selectionMode && selectedTaskIds.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, backgroundColor: '#e6f4ff' }}>
          <Row gutter={16} align="middle">
            <Col>
              <Text strong>{selectedTaskIds.length} tarea(s) seleccionada(s)</Text>
            </Col>
            <Col>
              <Select
                aria-label="Cambiar prioridad"
                placeholder="Prioridad"
                style={{ width: 160 }}
                value={bulkPriority}
                onChange={setBulkPriority}
                allowClear
              >
                <Option value="critical">🔴 Crítica</Option>
                <Option value="high">🟠 Alta</Option>
                <Option value="medium">🔵 Media</Option>
                <Option value="low">🟢 Baja</Option>
              </Select>
            </Col>
            <Col>
              <Select
                aria-label="Reasignar a"
                placeholder="Reasignar a"
                style={{ width: 180 }}
                value={bulkAssigneeId}
                onChange={setBulkAssigneeId}
                allowClear
              >
                {users.map((user) => (
                  <Option key={user.id} value={user.id}>{user.full_name}</Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Select
                aria-label="Mover a columna"
                placeholder="Mover a columna"
                style={{ width: 180 }}
                value={bulkColumnId}
                onChange={setBulkColumnId}
                allowClear
              >
                {selectedBoard?.columns.map((column) => (
                  <Option key={column.id} value={column.id}>{column.name}</Option>
                ))}
              </Select>
            </Col>
            <Col>
              <Button type="primary" onClick={handleBulkApply}>Aplicar</Button>
            </Col>
            <Col>
              <Button onClick={exitSelectionMode}>Cancelar selección</Button>
            </Col>
          </Row>
        </Card>
      )}

```

- [ ] **Step 8: Agregar el checkbox por card en `renderTaskCard`**

En `frontend/src/pages/tasks/TasksPage.tsx`, dentro de `renderTaskCard`, reemplazar la apertura del `<Card>` (líneas 491-499 actuales):

```typescript
            <Card
              size="small"
              style={{
                backgroundColor: snapshot.isDragging ? '#f0f0f0' : 'white',
                boxShadow: snapshot.isDragging ? '0 4px 8px rgba(0,0,0,0.2)' : undefined,
                cursor: snapshot.isDragging ? 'grabbing' : 'default',
                position: 'relative'
              }}
            >
```

por:

```typescript
            <Card
              size="small"
              style={{
                backgroundColor: snapshot.isDragging ? '#f0f0f0' : 'white',
                boxShadow: snapshot.isDragging ? '0 4px 8px rgba(0,0,0,0.2)' : undefined,
                cursor: snapshot.isDragging ? 'grabbing' : 'default',
                position: 'relative'
              }}
            >
              {selectionMode && (
                <Checkbox
                  aria-label={`Seleccionar tarea ${task.title}`}
                  checked={selectedTaskIds.includes(task.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleTaskSelection(task.id)}
                  style={{ position: 'absolute', top: 8, right: 8, zIndex: 20 }}
                />
              )}
```

- [ ] **Step 9: Correr los tests de frontend para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.bulkEdit.test.tsx`
Expected: PASS (los 3 tests)

- [ ] **Step 10: Correr toda la suite de `TasksPage` para confirmar que nada existente se rompió**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx src/__tests__/pages/TasksPage.bulkEdit.test.tsx`
Expected: PASS

- [ ] **Step 11: Compilar para confirmar que todo tipa bien**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 12: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/pages/tasks/TasksPage.tsx frontend/src/__tests__/pages/TasksPage.bulkEdit.test.tsx
git commit -m "feat(fase5): UI de seleccion multiple y edicion masiva en TasksPage"
```

---

## Task 3: Revisión final del sub-proyecto

- [ ] **Step 1: Correr toda la suite de backend**

Run: `cd backend && npm test`
Expected: todos los tests en PASS (los existentes + los agregados en Task 1)

- [ ] **Step 2: Correr toda la suite de frontend**

Run: `cd frontend && npx vitest run`
Expected: todos los tests en PASS (los existentes + los agregados en Task 2)

- [ ] **Step 3: Compilar backend y frontend**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: sin errores en ninguno de los dos

- [ ] **Step 4: Revisión de todo el diff del sub-proyecto (desde el primer commit de Task 1 hasta el último de Task 2), no de `main..HEAD` completo si `main` ya tuviera otros cambios**

Usar `superpowers:requesting-code-review` acotado a los commits de esta rama (`fase5-edicion-masiva`), igual que en los sub-proyectos anteriores de Fase 5.
