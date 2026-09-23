# Notificaciones In-App (Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar vida a la tabla `notifications` (huérfana desde la migración v16) con un servicio de notificaciones in-app: asignación de tarea, cambio de estado de tarea, envío de timesheet a aprobación, y dos recordatorios (tarea por vencer, días sin registrar horas) chequeados al login. Entrega por polling simple (sin socket.io), consumida desde un dropdown nuevo en el ícono ya existente de `AppLayout.tsx`.

**Architecture:** Servicio explícito `notificationService` (mismo molde que `activityLogService`: clase + instancia singleton, nunca lanza), invocado con llamadas directas desde los puntos donde ocurre cada evento (`taskController`, `timesheetService.submitWeek`, `authService.login`) — sin bus de eventos ni enganche indirecto a `activity_log`. Endpoints REST nuevos bajo `/api/notifications`, siempre acotados a `req.user.id`. Frontend: un componente `NotificationBell` con badge + dropdown, más soporte mínimo de deep-link por query param en `TasksPage` y `TimeTrackingPage` para que el link de una notificación sirva de algo.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente), React 18/TypeScript/Vite/Ant Design 5.8.6 (frontend ya existente). Sin dependencias nuevas.

**Spec:** Diseño aprobado en chat el 2026-09-22 (sub-proyecto "notificaciones in-app" de Fase 5 de RPA Team Manager). Este proyecto no usa un archivo de spec separado — el diseño aprobado vive en la conversación que originó este plan; lo que sigue es su traducción a tareas ejecutables, con dos correcciones técnicas encontradas durante el reconocimiento de código (documentadas en cada tarea donde aplican):
- La migración a agregar es **v32**, no v17 — el repo ya tiene migraciones hasta la v31 (Fase 4), la memoria del proyecto tenía desactualizado el número.
- `notificationService.checkLoginReminders` NO llama a `timesheetService` internamente (crearía un import circular, porque `timesheetService.submitWeek` ya necesita llamar a `notificationService`). En cambio recibe el conteo de días faltantes como parámetro; quien orquesta ambas llamadas es `authService.login`.

## Global Constraints

- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (nunca `db.all`).
- Roles reales del sistema: `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'` — no usar los roles del plan maestro (`admin`, `pm`, etc.), no existen en el CHECK de `users.role`.
- Todo servicio de escritura de auditoría/notificación (`notify()`) nunca debe lanzar — envolver en try/catch propio y loguear con `logger.error`, igual que `activityLogService.logActivity`.
- Todo endpoint nuevo bajo `/api/notifications` se filtra siempre por `req.user.id` — nunca aceptar un id de usuario ajeno desde query/body/params.
- Tests backend: mock manual de `db` vía `jest.mock('../../database/database', ...)` + `jest.clearAllMocks()` en `beforeEach`, nunca DB real en tests de servicio/controller (excepto los tests de migración, que sí usan sqlite real en un archivo temporal — ver Task 1).
- Tests frontend: Vitest + Testing Library, mock de `@/services/api` vía `vi.mock`, componentes que usen hooks de `react-router-dom` se renderizan envueltos en `<MemoryRouter>`.
- No mergear a `main` ni abrir PR — se sigue trabajando en la rama `fase0-saneamiento-seguridad`.

## Review Focus

- Un `updateTask` que llega con `assignee_id: null` (quitar el asignado) no debe intentar notificar a un `userId` null/undefined — Task 6.
- `timesheetService.submitWeek` cuando no hay ningún `team_lead` activo en la BD no debe lanzar ni intentar notificar a nadie — Task 7.
- Un segundo login con la notificación de recordatorio (`task_due_soon`/`timesheet_missing_days`) todavía sin leer no debe duplicarla; si ya se leyó y la condición persiste, sí debe generarse una nueva — Task 3.
- `markRead`/`markAllRead`/listado de notificaciones sobre el id de otro usuario no debe filtrar información ni modificar datos ajenos (404, no 403, para no confirmar que el id existe) — Task 4.
- Un deep-link `?taskId=` a una tarea que ya no existe o a la que el usuario perdió acceso debe mostrar un error legible en `TasksPage`, no romper el render — Task 11.

---

## Task 1: Migración v32 — columnas nuevas en `notifications`

**Files:**
- Modify: `backend/src/database/migrationList.ts` (agregar al final del array `migrations`, después del cierre de `version: 31` en la línea 1548)
- Create: `backend/src/__tests__/database/migration32.test.ts`

**Interfaces:**
- Produces: columnas `notifications.link` (`VARCHAR(255)`, nullable), `notifications.sender_id` (`INTEGER`, nullable, FK `users.id`), `notifications.event_key` (`VARCHAR(40)`, nullable a nivel de esquema — se exige en la capa de aplicación, ver Task 2). Índice `idx_notifications_event` sobre `(user_id, event_key, entity_id)`.

- [ ] **Step 1: Escribir el test de migración (falla porque la migración no existe todavía)**

Crear `backend/src/__tests__/database/migration32.test.ts`:

```typescript
import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 32 - notificaciones in-app (link, sender_id, event_key)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration32-test-${Date.now()}.sqlite`);
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

    it('agrega link, sender_id y event_key a notifications', async () => {
        const cols = await columnNames('notifications');
        expect(cols).toEqual(expect.arrayContaining(['link', 'sender_id', 'event_key']));
    });

    it('permite insertar una notificación con las columnas nuevas', async () => {
        await new Promise<void>((resolve, reject) => {
            db.run(
                `INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`,
                (err) => err ? reject(err) : resolve()
            );
        });
        const insertError: Error | null = await new Promise((resolve) => {
            db.run(
                `INSERT INTO notifications (user_id, title, event_key, entity_type, entity_id, sender_id, link)
                 VALUES (1, 'Título', 'task_assigned', 'task', 5, 1, '/tasks?taskId=5')`,
                (err) => resolve(err)
            );
        });
        expect(insertError).toBeNull();
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest __tests__/database/migration32.test.ts`
Expected: FAIL — la columna `link`/`sender_id`/`event_key` no existe todavía en `notifications`.

- [ ] **Step 3: Agregar la migración 32**

En `backend/src/database/migrationList.ts`, reemplazar el cierre del array (líneas 1546-1549 actuales):

```typescript
      `ALTER TABLE project_milestones ADD COLUMN baseline_planned_date DATE`
    ]
  }
];
```

por:

```typescript
      `ALTER TABLE project_milestones ADD COLUMN baseline_planned_date DATE`
    ]
  },

  {
    version: 32,
    description: 'Notificaciones in-app: link, sender_id, event_key en notifications (Fase 5)',
    up: [
      `ALTER TABLE notifications ADD COLUMN link VARCHAR(255)`,
      `ALTER TABLE notifications ADD COLUMN sender_id INTEGER REFERENCES users(id)`,
      `ALTER TABLE notifications ADD COLUMN event_key VARCHAR(40)`,

      `CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(user_id, event_key, entity_id)`
    ]
  }
];
```

Nota: `event_key` se deja nullable a nivel SQL a propósito — SQLite exige un `DEFAULT` para agregar una columna `NOT NULL` vía `ALTER TABLE` sobre una tabla que puede tener filas, y no vale la pena inventar un default falso. `notificationService.notify()` (Task 2) la exige como campo obligatorio en TypeScript, que es donde importa.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest __tests__/database/migration32.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration32.test.ts
git commit -m "feat(fase5): migracion v32 - link, sender_id, event_key en notifications"
```

---

## Task 2: `notificationService` — núcleo (notify, getters, marcar leída)

**Files:**
- Create: `backend/src/services/notificationService.ts`
- Create: `backend/src/__tests__/services/notificationService.test.ts`

**Interfaces:**
- Consumes: `db.get/run/query` de `backend/src/database/database.ts`; `logger` de `backend/src/utils/logger.ts`.
- Produces (usado por Tasks 4, 6, 7, 8):
  - `export type NotificationEventKey = 'task_assigned' | 'task_status_changed' | 'task_due_soon' | 'timesheet_submitted' | 'timesheet_missing_days'`
  - `export interface NotifyParams { userId: number; eventKey: NotificationEventKey; title: string; message?: string; type?: 'info' | 'success' | 'warning' | 'error'; entityType?: string; entityId?: number; senderId?: number; link?: string; dedupe?: boolean; }`
  - `export interface NotificationRow { id: number; user_id: number; title: string; message: string | null; type: string; entity_type: string | null; entity_id: number | null; sender_id: number | null; sender_name: string | null; link: string | null; event_key: string; is_read: boolean; created_at: string; }`
  - `class NotificationService { notify(params: NotifyParams): Promise<void>; getForUser(userId: number, options: { limit: number; offset: number; unreadOnly?: boolean }): Promise<NotificationRow[]>; getUnreadCount(userId: number): Promise<number>; markRead(notificationId: number, userId: number): Promise<boolean>; markAllRead(userId: number): Promise<void>; }`
  - `export const notificationService: NotificationService`

- [ ] **Step 1: Escribir los tests que fallan (el servicio no existe todavía)**

Crear `backend/src/__tests__/services/notificationService.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

import { db } from '../../database/database';
import { NotificationService } from '../../services/notificationService';

describe('NotificationService.notify', () => {
    let service: NotificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    it('inserta la fila con los campos dados', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.notify({
            userId: 5, eventKey: 'task_assigned', title: 'Te asignaron una tarea',
            message: 'Tarea X', type: 'info', entityType: 'task', entityId: 10,
            senderId: 3, link: '/tasks?taskId=10'
        });

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO notifications'),
            [5, 'Te asignaron una tarea', 'Tarea X', 'info', 'task', 10, 3, '/tasks?taskId=10', 'task_assigned']
        );
    });

    it('usa type=info y valores null por defecto para los campos opcionales', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.notify({ userId: 5, eventKey: 'task_assigned', title: 'Título' });

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO notifications'),
            [5, 'Título', null, 'info', null, null, null, null, 'task_assigned']
        );
    });

    it('nunca lanza si el insert falla (error solo se loguea)', async () => {
        (db.run as jest.Mock).mockRejectedValue(new Error('disk full'));

        await expect(
            service.notify({ userId: 5, eventKey: 'task_assigned', title: 'Título' })
        ).resolves.toBeUndefined();
    });

    it('con dedupe=true, no inserta si ya existe una notificación no leída con mismo user_id+event_key+entity_id', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 99 });

        await service.notify({
            userId: 5, eventKey: 'task_due_soon', title: 'Título', entityId: 10, dedupe: true
        });

        expect(db.get).toHaveBeenCalledWith(
            expect.stringContaining('is_read = 0'),
            [5, 'task_due_soon', 10]
        );
        expect(db.run).not.toHaveBeenCalled();
    });

    it('con dedupe=true, sí inserta si no existe ninguna no leída con esa combinación', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.notify({
            userId: 5, eventKey: 'task_due_soon', title: 'Título', entityId: 10, dedupe: true
        });

        expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notifications'), expect.any(Array));
    });
});

describe('NotificationService.getForUser', () => {
    let service: NotificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    it('consulta las notificaciones del usuario, ordenadas por fecha descendente, con paginación', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { id: 2, user_id: 5, title: 'B', is_read: 0, created_at: '2026-09-20T10:00:00Z' }
        ]);

        const result = await service.getForUser(5, { limit: 10, offset: 0 });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY n.created_at DESC, n.id DESC'),
            [5, 10, 0]
        );
        expect(result).toHaveLength(1);
    });

    it('con unreadOnly=true agrega el filtro is_read=0', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);

        await service.getForUser(5, { limit: 10, offset: 0, unreadOnly: true });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('n.is_read = 0'),
            [5, 10, 0]
        );
    });
});

describe('NotificationService.getUnreadCount', () => {
    it('devuelve el conteo de la fila', async () => {
        (db.get as jest.Mock).mockResolvedValue({ count: 4 });
        const service = new NotificationService();

        await expect(service.getUnreadCount(5)).resolves.toBe(4);
    });

    it('devuelve 0 si la query no trae fila', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        const service = new NotificationService();

        await expect(service.getUnreadCount(5)).resolves.toBe(0);
    });
});

describe('NotificationService.markRead', () => {
    let service: NotificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    it('devuelve true y marca leída si la notificación pertenece al usuario', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

        await expect(service.markRead(7, 5)).resolves.toBe(true);
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notifications SET is_read = 1'),
            [7, 5]
        );
    });

    it('devuelve false si no existe o pertenece a otro usuario', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 0 });

        await expect(service.markRead(7, 5)).resolves.toBe(false);
    });
});

describe('NotificationService.markAllRead', () => {
    it('marca todas las no leídas del usuario', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 3 });
        const service = new NotificationService();

        await service.markAllRead(5);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notifications SET is_read = 1'),
            [5]
        );
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/services/notificationService.test.ts`
Expected: FAIL con "Cannot find module '../../services/notificationService'"

- [ ] **Step 3: Implementar `notificationService.ts`**

Crear `backend/src/services/notificationService.ts`:

```typescript
import { db } from '../database/database';
import { logger } from '../utils/logger';

export type NotificationEventKey =
    | 'task_assigned'
    | 'task_status_changed'
    | 'task_due_soon'
    | 'timesheet_submitted'
    | 'timesheet_missing_days';

export interface NotifyParams {
    userId: number;
    eventKey: NotificationEventKey;
    title: string;
    message?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    entityType?: string;
    entityId?: number;
    senderId?: number;
    link?: string;
    dedupe?: boolean;
}

export interface NotificationRow {
    id: number;
    user_id: number;
    title: string;
    message: string | null;
    type: string;
    entity_type: string | null;
    entity_id: number | null;
    sender_id: number | null;
    sender_name: string | null;
    link: string | null;
    event_key: string;
    is_read: boolean;
    created_at: string;
}

export interface NotificationQueryOptions {
    limit: number;
    offset: number;
    unreadOnly?: boolean;
}

/**
 * Única fuente de escritura/lectura de notifications (v16 + columnas de v32).
 * notify() nunca lanza: un fallo al notificar no debe romper la operación que lo dispara.
 */
export class NotificationService {
    async notify(params: NotifyParams): Promise<void> {
        try {
            if (params.dedupe) {
                const existing = await db.get(
                    `SELECT id FROM notifications WHERE user_id = ? AND event_key = ? AND entity_id = ? AND is_read = 0`,
                    [params.userId, params.eventKey, params.entityId ?? null]
                );
                if (existing) return;
            }

            await db.run(`
                INSERT INTO notifications (
                    user_id, title, message, type, entity_type, entity_id, sender_id, link, event_key
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                params.userId,
                params.title,
                params.message ?? null,
                params.type ?? 'info',
                params.entityType ?? null,
                params.entityId ?? null,
                params.senderId ?? null,
                params.link ?? null,
                params.eventKey
            ]);
        } catch (error) {
            logger.error('Failed to create notification:', error);
        }
    }

    async getForUser(userId: number, options: NotificationQueryOptions): Promise<NotificationRow[]> {
        const unreadClause = options.unreadOnly ? 'AND n.is_read = 0' : '';
        return db.query(`
            SELECT n.*, u.full_name as sender_name
            FROM notifications n
            LEFT JOIN users u ON n.sender_id = u.id
            WHERE n.user_id = ? ${unreadClause}
            ORDER BY n.created_at DESC, n.id DESC
            LIMIT ? OFFSET ?
        `, [userId, options.limit, options.offset]);
    }

    async getUnreadCount(userId: number): Promise<number> {
        const row = await db.get(
            `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
        return row?.count ?? 0;
    }

    async markRead(notificationId: number, userId: number): Promise<boolean> {
        const result = await db.run(
            `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
            [notificationId, userId]
        );
        return (result?.changes ?? 0) > 0;
    }

    async markAllRead(userId: number): Promise<void> {
        await db.run(
            `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`,
            [userId]
        );
    }
}

export const notificationService = new NotificationService();
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/services/notificationService.test.ts`
Expected: PASS (todos los `describe` de este archivo)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notificationService.ts backend/src/__tests__/services/notificationService.test.ts
git commit -m "feat(fase5): nucleo de notificationService (notify, getters, marcar leida)"
```

---

## Task 3: `notificationService.checkLoginReminders` (task_due_soon + timesheet_missing_days)

**Files:**
- Modify: `backend/src/services/notificationService.ts`
- Modify: `backend/src/__tests__/services/notificationService.test.ts`

**Interfaces:**
- Consumes: `NotifyParams`, `notify()` (de Task 2).
- Produces (usado por Task 8): `checkLoginReminders(userId: number, missingTimesheetDaysCount: number): Promise<void>` — **no** depende de `timesheetService` (evita el ciclo de imports; quien calcula `missingTimesheetDaysCount` es el llamador, ver Task 8).

- [ ] **Step 1: Agregar los tests que fallan**

Agregar al final de `backend/src/__tests__/services/notificationService.test.ts`:

```typescript
describe('NotificationService.checkLoginReminders', () => {
    let service: NotificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    it('notifica task_due_soon por cada tarea propia con due_date en los próximos días, con dedupe', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { id: 42, title: 'Tarea por vencer' }
        ]);
        (db.get as jest.Mock).mockResolvedValue(undefined); // sin duplicado previo
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.checkLoginReminders(5, 0);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('assignee_id = ?'), [5, 3]);
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO notifications'),
            expect.arrayContaining(['task_due_soon'])
        );
    });

    it('no notifica task_due_soon si no hay tareas próximas a vencer', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);

        await service.checkLoginReminders(5, 0);

        expect(db.run).not.toHaveBeenCalled();
    });

    it('notifica timesheet_missing_days cuando el conteo recibido es mayor a 0', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);
        (db.get as jest.Mock).mockResolvedValue(undefined);
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.checkLoginReminders(5, 3);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO notifications'),
            expect.arrayContaining(['timesheet_missing_days'])
        );
    });

    it('no notifica timesheet_missing_days cuando el conteo recibido es 0', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);

        await service.checkLoginReminders(5, 0);

        expect(db.run).not.toHaveBeenCalled();
    });

    it('nunca lanza aunque falle la consulta de tareas por vencer', async () => {
        (db.query as jest.Mock).mockRejectedValue(new Error('db down'));

        await expect(service.checkLoginReminders(5, 0)).resolves.toBeUndefined();
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/services/notificationService.test.ts -t "checkLoginReminders"`
Expected: FAIL — `checkLoginReminders` no existe en la clase.

- [ ] **Step 3: Implementar `checkLoginReminders`**

Agregar dentro de `class NotificationService` en `backend/src/services/notificationService.ts` (después de `markAllRead`):

```typescript
    private static readonly TASK_DUE_SOON_DAYS = 3;

    async checkLoginReminders(userId: number, missingTimesheetDaysCount: number): Promise<void> {
        try {
            const tasks = await db.query(`
                SELECT id, title FROM tasks
                WHERE assignee_id = ?
                  AND status NOT IN ('done', 'blocked')
                  AND due_date IS NOT NULL
                  AND date(due_date) BETWEEN date('now') AND date('now', '+' || ? || ' days')
            `, [userId, NotificationService.TASK_DUE_SOON_DAYS]);

            for (const task of tasks) {
                await this.notify({
                    userId,
                    eventKey: 'task_due_soon',
                    title: 'Una tarea tuya vence pronto',
                    message: task.title,
                    type: 'warning',
                    entityType: 'task',
                    entityId: task.id,
                    link: `/tasks?taskId=${task.id}`,
                    dedupe: true
                });
            }
        } catch (error) {
            logger.error('Failed to check task_due_soon reminders:', error);
        }

        if (missingTimesheetDaysCount > 0) {
            await this.notify({
                userId,
                eventKey: 'timesheet_missing_days',
                title: 'Tenés días sin registrar horas',
                message: `${missingTimesheetDaysCount} día(s) hábil(es) sin horas registradas en las últimas 2 semanas`,
                type: 'warning',
                entityType: 'timesheet_reminder',
                entityId: userId,
                link: '/time',
                dedupe: true
            });
        }
    }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/services/notificationService.test.ts`
Expected: PASS (los 5 tests nuevos + todos los anteriores de Task 2)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/notificationService.ts backend/src/__tests__/services/notificationService.test.ts
git commit -m "feat(fase5): checkLoginReminders (task_due_soon + timesheet_missing_days)"
```

---

## Task 4: Endpoints REST de notificaciones

**Files:**
- Create: `backend/src/controllers/notificationController.ts`
- Create: `backend/src/__tests__/controllers/notificationController.test.ts`
- Create: `backend/src/routes/notificationRoutes.ts`
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `notificationService` (Task 2/3), `AuthenticatedRequest` de `backend/src/middleware/auth.ts`.
- Produces: `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all` (usados por el frontend en Task 9).

- [ ] **Step 1: Escribir los tests del controller (fallan porque no existe)**

Crear `backend/src/__tests__/controllers/notificationController.test.ts`:

```typescript
jest.mock('../../services/notificationService', () => ({
    notificationService: {
        getForUser: jest.fn(),
        getUnreadCount: jest.fn(),
        markRead: jest.fn(),
        markAllRead: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { notificationService } from '../../services/notificationService';
import { NotificationController } from '../../controllers/notificationController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('NotificationController', () => {
    let controller: NotificationController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new NotificationController();
    });

    it('GET /notifications lista las notificaciones de req.user.id, nunca de un id externo', async () => {
        (notificationService.getForUser as jest.Mock).mockResolvedValue([{ id: 1 }]);
        const req = { user: { id: 5 }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.list(req, res);

        expect(notificationService.getForUser).toHaveBeenCalledWith(5, { limit: 20, offset: 0, unreadOnly: false });
        expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('GET /notifications respeta ?unread=true y los query params de paginación', async () => {
        (notificationService.getForUser as jest.Mock).mockResolvedValue([]);
        const req = { user: { id: 5 }, query: { unread: 'true', limit: '5', offset: '10' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.list(req, res);

        expect(notificationService.getForUser).toHaveBeenCalledWith(5, { limit: 5, offset: 10, unreadOnly: true });
    });

    it('GET /notifications/unread-count devuelve { count }', async () => {
        (notificationService.getUnreadCount as jest.Mock).mockResolvedValue(4);
        const req = { user: { id: 5 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.unreadCount(req, res);

        expect(res.json).toHaveBeenCalledWith({ count: 4 });
    });

    it('PATCH /notifications/:id/read marca leída y responde 204', async () => {
        (notificationService.markRead as jest.Mock).mockResolvedValue(true);
        const req = { user: { id: 5 }, params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.markRead(req, res);

        expect(notificationService.markRead).toHaveBeenCalledWith(7, 5);
        expect(res.status).toHaveBeenCalledWith(204);
    });

    it('PATCH /notifications/:id/read devuelve 404 si no pertenece al usuario', async () => {
        (notificationService.markRead as jest.Mock).mockResolvedValue(false);
        const req = { user: { id: 5 }, params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.markRead(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('PATCH /notifications/read-all marca todas leídas de req.user.id y responde 204', async () => {
        (notificationService.markAllRead as jest.Mock).mockResolvedValue(undefined);
        const req = { user: { id: 5 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.markAllRead(req, res);

        expect(notificationService.markAllRead).toHaveBeenCalledWith(5);
        expect(res.status).toHaveBeenCalledWith(204);
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/notificationController.test.ts`
Expected: FAIL — "Cannot find module '../../controllers/notificationController'"

- [ ] **Step 3: Implementar el controller**

Crear `backend/src/controllers/notificationController.ts`:

```typescript
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

export class NotificationController {
    list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
            const unreadOnly = req.query.unread === 'true';

            const notifications = await notificationService.getForUser(userId, { limit, offset, unreadOnly });
            res.json(notifications);
        } catch (error) {
            logger.error('List notifications error:', error);
            res.status(500).json({ error: 'Failed to list notifications' });
        }
    };

    unreadCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const count = await notificationService.getUnreadCount(req.user!.id);
            res.json({ count });
        } catch (error) {
            logger.error('Unread count error:', error);
            res.status(500).json({ error: 'Failed to get unread count' });
        }
    };

    markRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const notificationId = parseInt(req.params.id, 10);
            const found = await notificationService.markRead(notificationId, req.user!.id);
            if (!found) {
                res.status(404).json({ error: 'Notification not found' });
                return;
            }
            res.status(204).send();
        } catch (error) {
            logger.error('Mark notification read error:', error);
            res.status(500).json({ error: 'Failed to mark notification as read' });
        }
    };

    markAllRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            await notificationService.markAllRead(req.user!.id);
            res.status(204).send();
        } catch (error) {
            logger.error('Mark all notifications read error:', error);
            res.status(500).json({ error: 'Failed to mark notifications as read' });
        }
    };
}
```

- [ ] **Step 4: Crear las rutas**

Crear `backend/src/routes/notificationRoutes.ts`:

```typescript
import express from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = express.Router();
const notificationController = new NotificationController();

router.get('/', authenticate, notificationController.list);
router.get('/unread-count', authenticate, notificationController.unreadCount);
router.patch('/:id/read', authenticate, notificationController.markRead);
router.patch('/read-all', authenticate, notificationController.markAllRead);

export default router;
```

- [ ] **Step 5: Montar las rutas en `server.ts`**

En `backend/src/server.ts`, agregar el import después de la línea 29 (`import adminRoutes from './routes/adminRoutes';`):

```typescript
import notificationRoutes from './routes/notificationRoutes';
```

Y agregar el `use` después de la línea 155 (`this.app.use('/api/admin', commonEndpointsLimiter, adminRoutes);`):

```typescript
        this.app.use('/api/notifications', notificationRoutes);
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/notificationController.test.ts`
Expected: PASS

- [ ] **Step 7: Compilar para confirmar que server.ts sigue tipando bien**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/notificationController.ts backend/src/__tests__/controllers/notificationController.test.ts backend/src/routes/notificationRoutes.ts backend/src/server.ts
git commit -m "feat(fase5): endpoints REST de notificaciones (list, unread-count, markRead, markAllRead)"
```

---

## Task 5: `GET /api/tasks/:id` (necesario para el deep-link del frontend)

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/routes/taskRoutes.ts`
- Create: `backend/src/__tests__/controllers/taskController.getById.test.ts`

**Interfaces:**
- Produces (usado por Task 11): `GET /api/tasks/:id` → `200` con la fila de `tasks` más `project_id` (vía join a `task_boards`), o `404` si no existe o el usuario no tiene acceso (mismo criterio de acceso que `updateTask`: `p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?`).

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/__tests__/controllers/taskController.getById.test.ts`:

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

describe('TaskController.getTaskById', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('devuelve la tarea con project_id si el usuario tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 55, board_id: 2, project_id: 7, title: 'Tarea' });
        const req = { params: { id: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskById(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 55, project_id: 7 }));
    });

    it('devuelve 404 si no existe o el usuario no tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        const req = { params: { id: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest __tests__/controllers/taskController.getById.test.ts`
Expected: FAIL — `controller.getTaskById` no es una función.

- [ ] **Step 3: Implementar `getTaskById` en `taskController.ts`**

Agregar en `backend/src/controllers/taskController.ts`, justo antes de `updateTask = async (...)` (línea 355 actual):

```typescript
  // GET /api/tasks/:id - Get a single task (usado por el deep-link de notificaciones)
  getTaskById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const task = await db.get(`
        SELECT t.*, tb.project_id
        FROM tasks t
        LEFT JOIN task_boards tb ON t.board_id = tb.id
        LEFT JOIN projects p ON tb.project_id = p.id
        WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)
      `, [id, userId, userId, userId]);

      if (!task) {
        res.status(404).json({ error: 'Task not found or access denied' });
        return;
      }

      res.json(task);
    } catch (error) {
      logger.error('Get task by id error:', error);
      res.status(500).json({ error: 'Failed to get task' });
    }
  };

```

- [ ] **Step 4: Registrar la ruta**

En `backend/src/routes/taskRoutes.ts`, agregar después de la línea 31 (`router.get('/tasks/project/:projectId', ...)`) y antes del `export`:

```typescript
// IMPORTANTE: va después de /tasks/my-tasks y /tasks/project/:projectId (rutas literales de un
// segmento bajo /tasks/) para que Express no las capture como si "my-tasks" fuera un :id.
router.get('/tasks/:id', authenticate, taskController.getTaskById);
```

- [ ] **Step 5: Correr el test para verificar que pasa**

Run: `cd backend && npx jest __tests__/controllers/taskController.getById.test.ts`
Expected: PASS

- [ ] **Step 6: Correr toda la suite de taskController para verificar que no rompió nada existente**

Run: `cd backend && npx jest taskController`
Expected: PASS (todos los archivos `taskController.*.test.ts` existentes + el nuevo)

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/routes/taskRoutes.ts backend/src/__tests__/controllers/taskController.getById.test.ts
git commit -m "feat(fase5): GET /api/tasks/:id para deep-link de notificaciones"
```

---

## Task 6: Notificar en `taskController` (asignación y cambio de estado)

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Create: `backend/src/__tests__/controllers/taskController.notifications.test.ts`

**Interfaces:**
- Consumes: `notificationService.notify` (Task 2).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.notifications.test.ts`:

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
import { notificationService } from '../../services/notificationService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - notificaciones', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('createTask notifica task_assigned si viene assignee_id distinto del creador', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva', assignee_id: 9 },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.createTask(req, mockRes());

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 9, eventKey: 'task_assigned', entityType: 'task', entityId: 55, senderId: 3
        }));
    });

    it('createTask no notifica si el creador se autoasigna', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva', assignee_id: 3 },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.createTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('createTask no notifica si no viene assignee_id', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva' },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.createTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask notifica task_assigned si assignee_id cambió a otro usuario', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: 9 }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 9, eventKey: 'task_assigned', entityType: 'task', entityId: 55, senderId: 3
        }));
    });

    it('updateTask no notifica task_assigned si assignee_id no cambió', async () => {
        const previousTask = { id: 55, assignee_id: 9, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: 9 }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask no notifica task_assigned si assignee_id viene null (quitar asignado)', async () => {
        const previousTask = { id: 55, assignee_id: 9, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: null }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask notifica task_status_changed al reporter cuando cambia status', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { status: 'done' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 8, eventKey: 'task_status_changed', entityType: 'task', entityId: 55, senderId: 3
        }));
    });

    it('updateTask no notifica task_status_changed si quien cambia el status es el propio reporter', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 3, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { status: 'done' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.notifications.test.ts`
Expected: FAIL — `notificationService.notify` no se llama todavía (el controller aún no lo invoca).

- [ ] **Step 3: Instrumentar `createTask` y `updateTask`**

En `backend/src/controllers/taskController.ts`, agregar el import (después de la línea 11, `import { activityLogService } from '../services/activityLogService';`):

```typescript
import { notificationService } from '../services/notificationService';
```

En `createTask`, reemplazar (líneas 342-347 actuales):

```typescript
      await activityLogService.logActivity(
        userId, 'task', result.id!, 'created', null,
        { title, task_type, priority, column_id, board_id }
      );

      res.status(201).json(newTask);
```

por:

```typescript
      await activityLogService.logActivity(
        userId, 'task', result.id!, 'created', null,
        { title, task_type, priority, column_id, board_id }
      );

      if (assignee_id !== undefined && assignee_id !== null && assignee_id !== userId) {
        await notificationService.notify({
          userId: assignee_id,
          eventKey: 'task_assigned',
          title: 'Te asignaron una tarea',
          message: title,
          entityType: 'task',
          entityId: result.id!,
          senderId: userId,
          link: `/tasks?taskId=${result.id}`
        });
      }

      res.status(201).json(newTask);
```

En `updateTask`, reemplazar (líneas 451-458 actuales):

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

por:

```typescript
      const updatePayload = {
        title, description, task_type, status, priority,
        assignee_id, estimated_hours, story_points, start_date, due_date, column_id, position
      };
      const hasChanges = Object.values(updatePayload).some((value) => value !== undefined);
      if (hasChanges) {
        await activityLogService.logActivity(userId, 'task', parseInt(id), 'updated', task, updatePayload);
      }

      const taskId = parseInt(id);
      const taskLink = `/tasks?taskId=${id}`;

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

      if (status !== undefined && status !== task.status && task.reporter_id && task.reporter_id !== userId) {
        await notificationService.notify({
          userId: task.reporter_id,
          eventKey: 'task_status_changed',
          title: 'Cambió el estado de una tarea',
          message: `${updatedTask.title}: ${task.status} → ${status}`,
          entityType: 'task',
          entityId: taskId,
          senderId: userId,
          link: taskLink
        });
      }

      res.json(updatedTask);
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.notifications.test.ts`
Expected: PASS

- [ ] **Step 5: Correr toda la suite de taskController (logging + activity + getById + notifications) para confirmar que nada se rompió**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/__tests__/controllers/taskController.notifications.test.ts
git commit -m "feat(fase5): notificar task_assigned y task_status_changed desde taskController"
```

---

## Task 7: Notificar a los `team_lead` cuando se envía un timesheet

**Files:**
- Modify: `backend/src/services/timesheetService.ts`
- Modify: `backend/src/__tests__/services/timesheetService.test.ts`

**Interfaces:**
- Consumes: `notificationService.notify` (Task 2).

- [ ] **Step 1: Escribir los tests que fallan**

Agregar dentro del `describe('submitWeek', ...)` existente en `backend/src/__tests__/services/timesheetService.test.ts` (después del último `it(...)` de ese bloque, antes del `});` que lo cierra), y agregar el mock de `notificationService` al inicio del archivo:

Modificar el bloque de mocks al comienzo del archivo (línea 1-10 actual) para agregar:

```typescript
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));
```

(se agrega como un `jest.mock(...)` adicional, antes del `import { db } from '../../database/database';` existente).

Y agregar el import correspondiente junto a los demás imports:

```typescript
import { notificationService } from '../../services/notificationService';
```

Agregar estos tests dentro de `describe('submitWeek', ...)`:

```typescript
        it('notifica timesheet_submitted a cada team_lead activo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1 }, { id: 2 }
            ]);

            await timesheetService.submitWeek(1, '2026-09-14');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("role = 'team_lead'"),
                []
            );
            expect(notificationService.notify).toHaveBeenCalledTimes(2);
            expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
                userId: 1, eventKey: 'timesheet_submitted', entityType: 'timesheet_period', entityId: 10, senderId: 1
            }));
            expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
                userId: 2, eventKey: 'timesheet_submitted', entityType: 'timesheet_period', entityId: 10, senderId: 1
            }));
        });

        it('no notifica a nadie ni lanza si no hay ningún team_lead activo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            (db.query as jest.Mock).mockResolvedValue([]);

            await expect(timesheetService.submitWeek(1, '2026-09-14')).resolves.toEqual(
                expect.objectContaining({ status: 'submitted' })
            );
            expect(notificationService.notify).not.toHaveBeenCalled();
        });
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/services/timesheetService.test.ts -t "submitWeek"`
Expected: FAIL — `db.query` no se llama todavía dentro de `submitWeek`, `notificationService.notify` tampoco.

- [ ] **Step 3: Instrumentar `submitWeek`**

En `backend/src/services/timesheetService.ts`, agregar el import (después de la línea 4, `import { financeService, Currency } from './financeService';`):

```typescript
import { notificationService } from './notificationService';
```

Reemplazar el cuerpo de `submitWeek` (líneas 274-284 actuales):

```typescript
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
```

por:

```typescript
        await db.run(
            `UPDATE timesheet_periods SET status = 'submitted', submitted_at = datetime('now'), rejection_reason = NULL WHERE id = ?`,
            [period.id]
        );
        await db.run(
            `UPDATE time_entries SET approval_status = 'submitted' WHERE timesheet_period_id = ?`,
            [period.id]
        );

        const teamLeads = await db.query(`SELECT id FROM users WHERE role = 'team_lead' AND is_active = 1`, []);
        for (const teamLead of teamLeads) {
            await notificationService.notify({
                userId: teamLead.id,
                eventKey: 'timesheet_submitted',
                title: 'Un timesheet fue enviado para aprobación',
                message: `Semana del ${monday}`,
                entityType: 'timesheet_period',
                entityId: period.id,
                senderId: userId,
                link: '/time?tab=approvals'
            });
        }

        logger.info(`Timesheet: usuario ${userId} envió la semana del ${monday} para aprobación`);
        return { ...period, status: 'submitted' };
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/services/timesheetService.test.ts`
Expected: PASS (toda la suite de `timesheetService`, incluidos los tests preexistentes de `submitWeek`)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/timesheetService.ts backend/src/__tests__/services/timesheetService.test.ts
git commit -m "feat(fase5): notificar timesheet_submitted a los team_lead activos"
```

---

## Task 8: Disparar `checkLoginReminders` desde `authService.login`

**Files:**
- Modify: `backend/src/services/authService.ts`
- Create: `backend/src/__tests__/services/authService.test.ts`

**Interfaces:**
- Consumes: `notificationService.checkLoginReminders(userId, missingTimesheetDaysCount)` (Task 3), `timesheetService.getPendingReminders(userId)` (ya existente).

- [ ] **Step 1: Escribir los tests que fallan (login no tiene tests hoy)**

Crear `backend/src/__tests__/services/authService.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('../../services/notificationService', () => ({
    notificationService: { checkLoginReminders: jest.fn() }
}));
jest.mock('../../services/timesheetService', () => ({
    timesheetService: { getPendingReminders: jest.fn() }
}));

import bcrypt from 'bcryptjs';
import { db } from '../../database/database';
import { notificationService } from '../../services/notificationService';
import { timesheetService } from '../../services/timesheetService';
import { AuthService } from '../../services/authService';

describe('AuthService.login', () => {
    let authService: AuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        authService = new AuthService();
        (db.get as jest.Mock).mockResolvedValue({
            id: 5, email: 'ana@x.com', password_hash: 'hash', is_active: 1, role: 'rpa_developer', full_name: 'Ana'
        });
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        (timesheetService.getPendingReminders as jest.Mock).mockResolvedValue({ missing_dates: [], open_period: null });
    });

    it('llama a checkLoginReminders con el conteo de días faltantes tras un login exitoso', async () => {
        (timesheetService.getPendingReminders as jest.Mock).mockResolvedValue({
            missing_dates: ['2026-09-15', '2026-09-16'], open_period: null
        });

        await authService.login({ email: 'ana@x.com', password: 'secret' });

        expect(notificationService.checkLoginReminders).toHaveBeenCalledWith(5, 2);
    });

    it('el login sigue devolviendo el resultado aunque checkLoginReminders falle', async () => {
        (notificationService.checkLoginReminders as jest.Mock).mockRejectedValue(new Error('boom'));

        const result = await authService.login({ email: 'ana@x.com', password: 'secret' });

        expect(result.user.email).toBe('ana@x.com');
    });

    it('no llama a checkLoginReminders si las credenciales son inválidas', async () => {
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(authService.login({ email: 'ana@x.com', password: 'mala' })).rejects.toThrow('Invalid credentials');
        expect(notificationService.checkLoginReminders).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/services/authService.test.ts`
Expected: FAIL — `notificationService.checkLoginReminders` no se llama todavía desde `login`.

- [ ] **Step 3: Instrumentar `authService.login`**

En `backend/src/services/authService.ts`, agregar los imports (después de la línea 6, `import { logger } from '../utils/logger';`):

```typescript
import { notificationService } from './notificationService';
import { timesheetService } from './timesheetService';
```

Reemplazar (líneas 67-68 actuales):

```typescript
        // Update last login
        await this.updateLastLogin(user.id);
```

por:

```typescript
        // Update last login
        await this.updateLastLogin(user.id);

        // Fase 5: recordatorios in-app, nunca deben bloquear ni romper el login
        try {
            const { missing_dates } = await timesheetService.getPendingReminders(user.id);
            await notificationService.checkLoginReminders(user.id, missing_dates.length);
        } catch (error) {
            logger.error('Failed to generate login reminders:', error);
        }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/services/authService.test.ts`
Expected: PASS

- [ ] **Step 5: Correr la suite completa de backend para descartar regresiones**

Run: `cd backend && npm test`
Expected: PASS (todos los tests, incluidos `auth.test.ts` legacy y `timesheetController.test.ts`)

- [ ] **Step 6: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/authService.ts backend/src/__tests__/services/authService.test.ts
git commit -m "feat(fase5): disparar checkLoginReminders desde authService.login"
```

---

## Task 9: Cliente API y tipos de frontend para notificaciones

**Files:**
- Create: `frontend/src/types/notification.ts`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Produces (usado por Tasks 10, 11): `NotificationItem` (tipo), `apiService.getNotifications(params)`, `apiService.getUnreadNotificationCount()`, `apiService.markNotificationRead(id)`, `apiService.markAllNotificationsRead()`, `apiService.getTaskById(taskId)`.

Este task no tiene lógica de negocio propia que testear con TDD (son wrappers finos de axios, igual que `getProjectActivity`/`getTaskActivity` no tienen test unitario propio — se validan indirectamente en Tasks 10 y 11 vía los componentes que los consumen). Se implementa directo y se verifica con `tsc`.

- [ ] **Step 1: Crear el tipo `NotificationItem`**

Crear `frontend/src/types/notification.ts`:

```typescript
export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string | null;
  type: 'info' | 'success' | 'warning' | 'error';
  entity_type: string | null;
  entity_id: number | null;
  sender_id: number | null;
  sender_name: string | null;
  link: string | null;
  event_key: string;
  is_read: boolean;
  created_at: string;
}
```

- [ ] **Step 2: Agregar los métodos al cliente API**

En `frontend/src/services/api.ts`, agregar el import (después de la línea 5, `import { ActivityLogEntry } from '../types/activity';`):

```typescript
import { NotificationItem } from '../types/notification';
```

Agregar los métodos después de `getTaskActivity` (después de la línea 390 actual, `}` que cierra ese método):

```typescript

  async getNotifications(params?: { limit?: number; offset?: number; unread?: boolean }): Promise<NotificationItem[]> {
    const response = await this.api.get('/notifications', { params });
    return response.data;
  }

  async getUnreadNotificationCount(): Promise<{ count: number }> {
    const response = await this.api.get('/notifications/unread-count');
    return response.data;
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    await this.api.patch(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.api.patch('/notifications/read-all');
  }

  async getTaskById(taskId: number): Promise<any> {
    const response = await this.api.get(`/tasks/${taskId}`);
    return response.data;
  }
```

- [ ] **Step 3: Compilar para verificar que tipa bien**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/notification.ts frontend/src/services/api.ts
git commit -m "feat(fase5): cliente API y tipos de frontend para notificaciones"
```

---

## Task 10: Componente `NotificationBell` + integración en `AppLayout`

**Files:**
- Create: `frontend/src/components/common/NotificationBell.tsx`
- Create: `frontend/src/__tests__/components/NotificationBell.test.tsx`
- Modify: `frontend/src/components/common/AppLayout.tsx`

**Interfaces:**
- Consumes: `apiService.getNotifications/getUnreadNotificationCount/markNotificationRead/markAllNotificationsRead` (Task 9), `NotificationItem` (Task 9), `useNavigate` de `react-router-dom` (ya importado en `AppLayout.tsx`).
- Produces: `<NotificationBell />` — componente autocontenido sin props, reemplaza el bloque decorativo de `AppLayout.tsx:249-256`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `frontend/src/__tests__/components/NotificationBell.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getUnreadNotificationCount: vi.fn(),
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { NotificationBell } from '@/components/common/NotificationBell';

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getUnreadNotificationCount as any).mockResolvedValue({ count: 0 });
    (apiService.getNotifications as any).mockResolvedValue([]);
  });

  it('muestra el conteo de no leídas en el badge', async () => {
    (apiService.getUnreadNotificationCount as any).mockResolvedValue({ count: 3 });

    renderBell();

    await waitFor(() => {
      expect(apiService.getUnreadNotificationCount).toHaveBeenCalled();
    });
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('al abrir el dropdown carga y muestra las notificaciones', async () => {
    (apiService.getNotifications as any).mockResolvedValue([
      { id: 1, title: 'Te asignaron una tarea', message: 'Tarea X', is_read: false, link: '/tasks?taskId=1', created_at: '2026-09-22T10:00:00Z' }
    ]);

    renderBell();
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('Te asignaron una tarea')).toBeInTheDocument();
  });

  it('muestra un estado vacío si no hay notificaciones', async () => {
    renderBell();
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/sin notificaciones/i)).toBeInTheDocument();
  });

  it('marcar todas leídas llama al endpoint y pone el badge en 0', async () => {
    (apiService.getUnreadNotificationCount as any).mockResolvedValue({ count: 2 });
    (apiService.getNotifications as any).mockResolvedValue([
      { id: 1, title: 'A', message: null, is_read: false, link: null, created_at: '2026-09-22T10:00:00Z' }
    ]);
    (apiService.markAllNotificationsRead as any).mockResolvedValue(undefined);

    renderBell();
    await screen.findByText('2');
    await userEvent.click(screen.getByRole('button'));
    await screen.findByText('A');
    await userEvent.click(screen.getByText(/marcar todas leídas/i));

    expect(apiService.markAllNotificationsRead).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/components/NotificationBell.test.tsx`
Expected: FAIL — el módulo `@/components/common/NotificationBell` no existe.

- [ ] **Step 3: Implementar `NotificationBell.tsx`**

Crear `frontend/src/components/common/NotificationBell.tsx`:

```tsx
import React, { useState, useEffect, useCallback } from 'react';
import { Badge, Button, Dropdown, List, Typography, Empty, Spin } from 'antd';
import { NotificationOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import { NotificationItem } from '@/types/notification';

const { Text } = Typography;

const POLL_INTERVAL_MS = 60000;

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { count } = await apiService.getUnreadNotificationCount();
      setUnreadCount(count);
    } catch {
      // silencioso: el badge simplemente no se actualiza en este ciclo de polling
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  const loadList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getNotifications({ limit: 10, offset: 0 });
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      loadList();
    }
  };

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await apiService.markNotificationRead(item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  const handleMarkAllRead = async () => {
    await apiService.markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      open={open}
      onOpenChange={handleOpenChange}
      dropdownRender={() => (
        <div style={{ width: 340, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
          <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
            <Text strong>Notificaciones</Text>
            <Button type="link" size="small" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
              Marcar todas leídas
            </Button>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center' }}><Spin size="small" /></div>
          ) : items.length === 0 ? (
            <div style={{ padding: 24 }}><Empty description="Sin notificaciones" image={Empty.PRESENTED_IMAGE_SIMPLE} /></div>
          ) : (
            <List
              size="small"
              dataSource={items}
              style={{ maxHeight: 400, overflowY: 'auto' }}
              renderItem={(item) => (
                <List.Item
                  onClick={() => handleItemClick(item)}
                  style={{ padding: '8px 16px', cursor: 'pointer', background: item.is_read ? 'transparent' : '#e6f4ff' }}
                >
                  <div>
                    <Text strong={!item.is_read}>{item.title}</Text>
                    {item.message && (
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{item.message}</Text></div>
                    )}
                    <div><Text type="secondary" style={{ fontSize: 11 }}>{new Date(item.created_at).toLocaleString('es-CL')}</Text></div>
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>
      )}
    >
      <Badge count={unreadCount} size="small">
        <Button type="text" icon={<NotificationOutlined />} style={{ fontSize: '16px' }} />
      </Badge>
    </Dropdown>
  );
};
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/components/NotificationBell.test.tsx`
Expected: PASS

- [ ] **Step 5: Integrar en `AppLayout.tsx`**

En `frontend/src/components/common/AppLayout.tsx`, agregar el import (después de la línea 23, `import { useAuthStore } from '@/store/authStore';`):

```typescript
import { NotificationBell } from './NotificationBell';
```

Reemplazar el bloque decorativo (líneas 249-256 actuales):

```tsx
          <Space align="center">
            <Badge count={0} size="small">
              <Button 
                type="text" 
                icon={<NotificationOutlined />}
                style={{ fontSize: '16px' }}
              />
            </Badge>
```

por:

```tsx
          <Space align="center">
            <NotificationBell />
```

Y quitar `NotificationOutlined` y `Badge` de los imports de `AppLayout.tsx` si quedan sin uso tras el reemplazo (verificar con `tsc`/lint en el Step 6 — si `Badge` se sigue usando en otro lugar del archivo, dejarlo).

- [ ] **Step 6: Compilar y lintear**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores (si `Badge`/`NotificationOutlined` quedaron sin uso, quitar el import correspondiente y volver a correr)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/common/NotificationBell.tsx frontend/src/__tests__/components/NotificationBell.test.tsx frontend/src/components/common/AppLayout.tsx
git commit -m "feat(fase5): componente NotificationBell integrado en AppLayout"
```

---

## Task 11: Deep-link `?taskId=` en `TasksPage`

**Files:**
- Modify: `frontend/src/pages/tasks/TasksPage.tsx`
- Create: `frontend/src/__tests__/pages/TasksPage.test.tsx`

**Interfaces:**
- Consumes: `apiService.getTaskById` (Task 9), `openEditTaskModal(task: Task)` (ya existente en `TasksPage.tsx:392`), `setSelectedProject`, `loadBoard(boardId)`, `boards`, `selectedBoard` (state ya existente en `TasksPage.tsx`).

Este es el primer archivo de test para `TasksPage` (la página no tenía cobertura previa) — se acota deliberadamente a la conducta nueva del deep-link, no a una cobertura integral de la página completa (fuera de alcance de este sub-proyecto).

- [ ] **Step 1: Escribir los tests que fallan**

Crear `frontend/src/__tests__/pages/TasksPage.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    getTaskById: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TasksPage } from '@/pages/tasks/TasksPage';

const board = {
  id: 2, project_id: 7, name: 'Board 1', board_type: 'kanban', project_name: 'AGROSUPER',
  columns: [{ id: 1, board_id: 2, name: 'To Do', position: 0, color: '#000', is_done_column: false }],
  tasks: [{ id: 42, board_id: 2, column_id: 1, title: 'Tarea deep-link', task_type: 'task', status: 'todo', priority: 'medium', position: 0, created_at: '', updated_at: '' }]
};

function renderWithTaskId(taskId: string) {
  return render(
    <MemoryRouter initialEntries={[`/tasks?taskId=${taskId}`]}>
      <TasksPage />
    </MemoryRouter>
  );
}

describe('TasksPage - deep link ?taskId=', () => {
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

  it('abre el modal de edición de la tarea indicada por ?taskId=', async () => {
    (apiService.getTaskById as any).mockResolvedValue({ ...board.tasks[0], project_id: 7 });

    renderWithTaskId('42');

    await waitFor(() => {
      expect(apiService.getTaskById).toHaveBeenCalledWith(42);
    });
    expect(await screen.findByDisplayValue('Tarea deep-link')).toBeInTheDocument();
  });

  it('muestra un error legible si la tarea no existe o no hay acceso, sin romper el render', async () => {
    (apiService.getTaskById as any).mockRejectedValue({ response: { status: 404 } });

    renderWithTaskId('999');

    await waitFor(() => {
      expect(apiService.getTaskById).toHaveBeenCalledWith(999);
    });
    expect(await screen.findByText(/no se pudo abrir la tarea/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx`
Expected: FAIL — hoy `TasksPage` no lee `?taskId=` ni llama a `apiService.getTaskById`.

- [ ] **Step 3: Implementar el deep-link en `TasksPage.tsx`**

Agregar el import de `useSearchParams` (reemplazar la línea 31 actual, `import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';`, agregando debajo):

```typescript
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { useSearchParams } from 'react-router-dom';
```

Dentro del componente, después de la línea 101 (`const [selectedProject, setSelectedProject] = useState<number | null>(null);`), agregar:

```typescript
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingBoardId, setPendingBoardId] = useState<number | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null);
```

Después del bloque de `useEffect` existente en las líneas 118-122 (`if (selectedProject) { loadBoards(); }`), agregar dos nuevos `useEffect`:

```typescript
  useEffect(() => {
    const taskIdParam = searchParams.get('taskId');
    if (!taskIdParam) return;
    const taskId = parseInt(taskIdParam, 10);
    if (isNaN(taskId)) return;

    (async () => {
      try {
        const task = await apiService.getTaskById(taskId);
        setSelectedProject(task.project_id);
        setPendingBoardId(task.board_id);
        setPendingTaskId(taskId);
      } catch (error) {
        console.error('🔴 TasksPage: No se pudo cargar la tarea del link de notificación:', error);
        message.error('No se pudo abrir la tarea indicada');
      }
    })();
    // Deep-link se consume una sola vez al montar; no reaccionar a cambios posteriores de searchParams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pendingBoardId !== null && boards.some((b) => b.id === pendingBoardId)) {
      loadBoard(pendingBoardId);
      setPendingBoardId(null);
    }
  }, [pendingBoardId, boards]);

  useEffect(() => {
    if (pendingTaskId !== null && selectedBoard) {
      const task = selectedBoard.tasks.find((t) => t.id === pendingTaskId);
      if (task) {
        openEditTaskModal(task);
        setPendingTaskId(null);
        searchParams.delete('taskId');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [pendingTaskId, selectedBoard]);
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Compilar**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/tasks/TasksPage.tsx frontend/src/__tests__/pages/TasksPage.test.tsx
git commit -m "feat(fase5): deep-link ?taskId= en TasksPage para notificaciones de tareas"
```

---

## Task 12: Deep-link `?tab=approvals` en `TimeTrackingPage`

**Files:**
- Modify: `frontend/src/pages/time/TimeTrackingPage.tsx`
- Modify: `frontend/src/__tests__/pages/TimeTrackingPage.test.tsx`

**Interfaces:**
- Consumes: `useSearchParams` de `react-router-dom`.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `frontend/src/__tests__/pages/TimeTrackingPage.test.tsx`, envolviendo el render existente en `MemoryRouter` (necesario porque el componente pasará a usar `useSearchParams`) y agregando un test nuevo.

Reemplazar el import de testing-library (línea 1 actual):

```typescript
import { render, screen, waitFor } from '@testing-library/react';
```

por:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
```

Reemplazar los tres `render(<TimeTrackingPage />)` existentes (líneas 54, 71) por:

```typescript
    render(<MemoryRouter><TimeTrackingPage /></MemoryRouter>);
```

Y agregar, junto al mock de `useAuthStore` (después de la línea 31), un mock de rol `team_lead` para poder ver el tab "Aprobaciones" en el test nuevo — mantener el mock existente (`rpa_developer`) para los dos tests actuales, y agregar este test nuevo con su propio mock local vía `vi.mocked`:

```typescript
  it('abre directo en la tab "Aprobaciones" cuando la URL trae ?tab=approvals', async () => {
    const { useAuthStore } = await import('@/store/authStore');
    (useAuthStore as any).mockReturnValue({ user: { id: 1, role: 'team_lead', full_name: 'Lead Uno' } });

    render(
      <MemoryRouter initialEntries={['/time?tab=approvals']}>
        <TimeTrackingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiService.getPendingTimesheetApprovals).toHaveBeenCalled();
    });
  });
```

Nota: si `vi.mock('@/store/authStore', ...)` ya está fijado como una función simple (no `vi.fn()`) en el archivo actual, cambiar esa línea (línea 29-31 actual) para que sea mockeable por test:

```typescript
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: { id: 1, role: 'rpa_developer', full_name: 'Dev Uno' } }))
}));
```

y en el `beforeEach` existente restablecer el valor por defecto:

```typescript
    const { useAuthStore } = await import('@/store/authStore');
    (useAuthStore as any).mockReturnValue({ user: { id: 1, role: 'rpa_developer', full_name: 'Dev Uno' } });
```

- [ ] **Step 2: Correr los tests para verificar que el nuevo falla**

Run: `cd frontend && npx vitest run src/__tests__/pages/TimeTrackingPage.test.tsx`
Expected: el test nuevo FALLA (la tab activa por defecto sigue siendo "Mi semana"); los dos tests existentes deben seguir en PASS tras envolver en `MemoryRouter`.

- [ ] **Step 3: Implementar el tab controlado por query param**

En `frontend/src/pages/time/TimeTrackingPage.tsx`, agregar el import de `useSearchParams` junto a los imports existentes (buscar la línea de imports de antd/react y agregar):

```typescript
import { useSearchParams } from 'react-router-dom';
```

Dentro del componente, antes del `const tabItems = [...]` (línea 385 actual), agregar:

```typescript
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'week');
```

Reemplazar `<Tabs items={tabItems} />` (línea ~463 actual) por:

```tsx
          <Tabs
            items={tabItems}
            activeKey={activeTab}
            onChange={(key) => {
              setActiveTab(key);
              setSearchParams(key === 'week' ? {} : { tab: key }, { replace: true });
            }}
          />
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TimeTrackingPage.test.tsx`
Expected: PASS (los 3 tests del archivo)

- [ ] **Step 5: Compilar**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores

- [ ] **Step 6: Correr toda la suite de frontend para descartar regresiones**

Run: `cd frontend && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/time/TimeTrackingPage.tsx frontend/src/__tests__/pages/TimeTrackingPage.test.tsx
git commit -m "feat(fase5): deep-link ?tab=approvals en TimeTrackingPage para notificaciones de timesheet"
```

---

## Cierre de sub-proyecto

Tras el Task 12: correr `cd backend && npm test && npx tsc --noEmit` y `cd frontend && npm test && npx tsc --noEmit` una vez más de punta a punta, y luego pedir la revisión final del diff completo de este sub-proyecto (desde el primer commit de Task 1 hasta el último de Task 12) vía `superpowers:requesting-code-review`, acotada a ese rango — no a todo `main..HEAD`, porque el sub-proyecto de activity_log/timeline ya tuvo su propia revisión final. No mergear a `main` sin preguntar primero.
