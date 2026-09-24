# Comentarios / @menciones (Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar comentarios con @menciones a tareas y proyectos existentes. Un usuario puede escribir un comentario (con autocompletado real de `@usuario` al tipear, estilo Slack/Jira) bajo una tarea o un proyecto; mencionar a alguien le dispara una notificación in-app. Cada comentario solo lo puede editar/borrar su propio autor.

**Architecture:** La tabla `comments` ya existe desde la migración v16 (`entity_type` CHECK `'task'|'project'|'issue'`, `entity_id`, `user_id`, `content`, `is_internal` sin usar, timestamps con trigger `update_comments_timestamp` que auto-actualiza `updated_at`) — **no se necesita migración nueva**. Un `commentService.ts` nuevo (mismo molde que `activityLogService`/`notificationService`, singleton) concentra el CRUD y la resolución de @menciones, y lo consumen dos controllers ya existentes (`taskController.ts`, `projectController.ts`) cada uno reusando su propio criterio de acceso a la entidad (join de pertenencia para tareas, `hasProjectAccess` para proyectos). Las menciones se resuelven parseando tokens `@username` (los `username` son alfanuméricos sin espacios) contra usuarios activos, y notifican vía `notificationService.notify()` con un `eventKey` nuevo (`comment_mention`), solo al crear el comentario, nunca al editarlo. En el frontend, un componente nuevo y autocontenido `CommentsThread` (mismo molde que `TaskSubtasksChecklist`) usa el componente `Mentions` de Ant Design (ya en el proyecto) para el autocompletado, y se monta en el modal de edición de tarea de `TasksPage.tsx` y en una pestaña nueva de `ProjectDetailPage.tsx`.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente), React 18/TypeScript/Vite/Ant Design 5.8.6 (frontend ya existente, incluye el componente `Mentions`). Sin dependencias nuevas.

**Spec:** Diseño aprobado en chat el 2026-09-23 (sub-proyecto "Comentarios / @menciones" de Fase 5 de RPA Team Manager). Este proyecto no usa un archivo de spec separado — el diseño aprobado vive en la conversación que originó este plan; lo que sigue es su traducción a tareas ejecutables.

## Global Constraints

- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (nunca `db.all`). `db.run(sql, params)` resuelve `{ id: number; changes: number }` (confirmado en `backend/src/database/database.ts:602`) — el campo es `id`, no `lastID`.
- Roles reales del sistema: `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. Sin `authorize()` por rol en ningún endpoint nuevo de comentarios — mismo criterio que subtareas/activity log (acceso por pertenencia, no por rol).
- **Acceso a tarea** (usado ya por subtareas y activity, reutilizar tal cual): `SELECT t.id FROM tasks t LEFT JOIN task_boards tb ON t.board_id = tb.id LEFT JOIN projects p ON tb.project_id = p.id WHERE t.id = ? AND (p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?)` — sin fila → 404 `{ error: 'Task not found or access denied' }`.
- **Acceso a proyecto** (usado ya por `getProjectActivity`, reutilizar tal cual): `db.get('SELECT id, assigned_to, created_by FROM projects WHERE id = ?', [projectId])` — sin fila → 404 `{ error: 'Project not found' }`; con fila, `this.hasProjectAccess(req.user, project)` (método privado ya existente en `projectController.ts:504-512`, solo restringe a `rpa_developer` sin pertenencia) — si `false` → 403 `{ error: 'Access denied' }`.
- **Autoría de comentario:** solo el autor puede editar/borrar el suyo, nadie más (ni `team_lead`). Si el comentario no existe para esa entidad → 404 `{ error: 'Comment not found' }`; si existe pero pertenece a otro usuario → 403 (`'You can only edit your own comments'` / `'You can only delete your own comments'`).
- **@menciones:** se resuelven contra `users.username` (alfanumérico + `_`, sin espacios, `NOT NULL UNIQUE`) filtrando `is_active = 1`. Se excluye siempre la auto-mención (el autor no se notifica a sí mismo) y se deduplican usuarios mencionados repetidos dentro del mismo comentario (una sola notificación por usuario por comentario). Solo se notifica al **crear** un comentario, nunca al editarlo. `eventKey` nuevo: `'comment_mention'`, agregado a la unión `NotificationEventKey` en `backend/src/services/notificationService.ts`.
- `comments.is_internal` queda sin usar (columna con `DEFAULT 0`, no se referencia en ningún INSERT/SELECT nuevo) — no hay concepto de vista de cliente en la app hoy.
- Comentarios **no** generan entrada en `activity_log` ni aparecen en `ActivityTimeline` — viven en su propia lista, por decisión explícita.
- Tests backend: mock manual de `db` vía `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))` + `jest.clearAllMocks()` en `beforeEach`. Cualquier test de `taskController` debe mockear también `activityLogService` y `notificationService` (los importa a nivel de módulo en `taskController.ts:11-12`, aunque el método bajo prueba no los use). Cualquier test de `projectController` debe mockear `activityLogService` (lo importa en `projectController.ts:8`). Los tests de controllers de comentarios además mockean `commentService` (igual que se mockea `activityLogService` hoy).
- Tests frontend: Vitest + Testing Library, mock de `@/services/api` vía `vi.mock`, mock de `@/store/authStore` vía `vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id, role, full_name } }) }))` (patrón exacto de `frontend/src/__tests__/components/ProjectHealthCard.test.tsx:11-13`).
- No mergear a `main` ni abrir PR sin preguntar al usuario al cerrar (rama nueva desde `main`, ya que `fase0-saneamiento-seguridad` no existe más).

## Review Focus

- Mencionar un `@usuario_que_no_existe` (typo) en un comentario no debe romper el guardado ni impedir que se notifique a otros usuarios válidos mencionados en el mismo texto — Task 1.
- Un usuario que intenta editar/borrar un comentario ajeno llamando directamente al endpoint (sin pasar por la UI) debe recibir 403, nunca lograrlo silenciosamente ni recibir un 500 — Tasks 2 y 3.
- Postear un comentario vacío o compuesto solo de espacios no debe crear una fila — Tasks 2 y 3.
- Mencionar dos veces al mismo usuario en un mismo comentario, o mencionarse a uno mismo, no debe generar notificaciones duplicadas ni auto-notificación — Task 1.
- La lista de comentarios vacía en el frontend debe mostrar el estado vacío ("Sin comentarios todavía"), no repetir el bug de `[]` siendo *truthy* en JS que ya pasó en la card de carga del equipo — Task 4.

---

## Task 1: `commentService.ts` (CRUD + resolución de @menciones)

**Files:**
- Create: `backend/src/services/commentService.ts`
- Create: `backend/src/__tests__/services/commentService.test.ts`
- Modify: `backend/src/services/notificationService.ts` (agregar `eventKey` nuevo)
- Modify: `backend/src/services/authService.ts` (agregar `username` a `getActiveUsers`/`getAllUsersForAdmin`)
- Modify: `backend/src/__tests__/services/authService.test.ts`

**Interfaces:**
- Produces (usado por Tasks 2 y 3): `commentService.getForEntity(entityType: 'task' | 'project', entityId: number): Promise<CommentRow[]>`, `commentService.create(entityType, entityId, userId, content): Promise<CommentRow>`, `commentService.findById(commentId: number): Promise<CommentRow | undefined>`, `commentService.update(commentId, content): Promise<CommentRow>`, `commentService.delete(commentId): Promise<void>`. `CommentRow = { id, entity_type, entity_id, user_id, author_name, content, created_at, updated_at }`.
- Produces (usado por Task 4, vía `GET /auth/users`): cada usuario devuelto por `getActiveUsers`/`getAllUsersForAdmin` ahora incluye `username: string`.

- [ ] **Step 1: Escribir los tests que fallan (commentService no existe todavía)**

Crear `backend/src/__tests__/services/commentService.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));

import { db } from '../../database/database';
import { notificationService } from '../../services/notificationService';
import { CommentService } from '../../services/commentService';

describe('CommentService.getForEntity', () => {
    let service: CommentService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new CommentService();
    });

    it('devuelve los comentarios de la entidad ordenados por fecha ascendente', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola', created_at: '2026-09-20', updated_at: '2026-09-20' }
        ]);

        const result = await service.getForEntity('task', 55);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY c.created_at ASC, c.id ASC'),
            ['task', 55]
        );
        expect(result).toHaveLength(1);
    });
});

describe('CommentService.create', () => {
    let service: CommentService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new CommentService();
    });

    it('inserta el comentario y devuelve la fila creada', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 10, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({
            id: 10, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola equipo', created_at: '2026-09-23', updated_at: '2026-09-23'
        });

        const result = await service.create('task', 55, 3, 'Hola equipo');

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO comments'),
            ['task', 55, 3, 'Hola equipo']
        );
        expect(result.id).toBe(10);
    });

    it('recorta espacios del contenido antes de insertar', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 11, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 11, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola', created_at: '2026-09-23', updated_at: '2026-09-23' });

        await service.create('task', 55, 3, '  Hola  ');

        expect(db.run).toHaveBeenCalledWith(expect.any(String), ['task', 55, 3, 'Hola']);
    });

    it('notifica a un usuario mencionado activo, excluyendo al autor', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 12, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 12, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola @dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
        (db.query as jest.Mock).mockResolvedValue([{ id: 9 }]);

        await service.create('task', 55, 3, 'Hola @dev1');

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('username IN (?)'),
            ['dev1']
        );
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 9, eventKey: 'comment_mention', entityType: 'task', entityId: 55, senderId: 3,
            link: '/tasks?taskId=55'
        }));
    });

    it('no se auto-notifica si el autor se menciona a sí mismo', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 13, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 13, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@ana nota para mi', created_at: '2026-09-23', updated_at: '2026-09-23' });
        (db.query as jest.Mock).mockResolvedValue([{ id: 3 }]);

        await service.create('task', 55, 3, '@ana nota para mi');

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('menciona al mismo usuario dos veces en el mismo comentario y solo notifica una vez', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 14, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 14, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@dev1 y de nuevo @dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
        (db.query as jest.Mock).mockResolvedValue([{ id: 9 }]);

        await service.create('task', 55, 3, '@dev1 y de nuevo @dev1');

        expect(db.query).toHaveBeenCalledWith(expect.any(String), ['dev1']);
        expect(notificationService.notify).toHaveBeenCalledTimes(1);
    });

    it('un @usuario que no existe no rompe el guardado ni bloquea notificar a otros mencionados válidos', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 15, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 15, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@noexiste y @dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
        (db.query as jest.Mock).mockResolvedValue([{ id: 9 }]); // solo dev1 resuelve

        const result = await service.create('task', 55, 3, '@noexiste y @dev1');

        expect(result.id).toBe(15);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, eventKey: 'comment_mention' }));
    });

    it('un comentario sin @menciones no consulta usuarios ni notifica', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 16, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 16, entity_type: 'project', entity_id: 7, user_id: 3, author_name: 'Ana', content: 'Sin menciones', created_at: '2026-09-23', updated_at: '2026-09-23' });

        await service.create('project', 7, 3, 'Sin menciones');

        expect(db.query).not.toHaveBeenCalled();
        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('usa el link de proyecto cuando entityType es project', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 17, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 17, entity_type: 'project', entity_id: 7, user_id: 3, author_name: 'Ana', content: '@dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
        (db.query as jest.Mock).mockResolvedValue([{ id: 9 }]);

        await service.create('project', 7, 3, '@dev1');

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ link: '/projects/7' }));
    });

    it('nunca lanza si falla la resolución/notificación de menciones (el comentario ya se guardó)', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 18, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 18, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
        (db.query as jest.Mock).mockRejectedValue(new Error('db down'));

        await expect(service.create('task', 55, 3, '@dev1')).resolves.toMatchObject({ id: 18 });
    });
});

describe('CommentService.findById', () => {
    it('devuelve la fila con author_name', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola', created_at: 'x', updated_at: 'x' });
        const service = new CommentService();

        const result = await service.findById(1);

        expect(result?.author_name).toBe('Ana');
    });

    it('devuelve undefined si no existe', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        const service = new CommentService();

        await expect(service.findById(999)).resolves.toBeUndefined();
    });
});

describe('CommentService.update', () => {
    it('actualiza el contenido (recortado) y devuelve la fila actualizada', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Editado', created_at: 'x', updated_at: 'y' });
        const service = new CommentService();

        const result = await service.update(1, '  Editado  ');

        expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE comments SET content = ?'), ['Editado', 1]);
        expect(result.content).toBe('Editado');
    });
});

describe('CommentService.delete', () => {
    it('borra el comentario por id', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const service = new CommentService();

        await service.delete(1);

        expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM comments WHERE id = ?'), [1]);
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/services/commentService.test.ts`
Expected: FAIL — el módulo `../../services/commentService` no existe todavía.

- [ ] **Step 3: Agregar el `eventKey` nuevo en `notificationService.ts`**

En `backend/src/services/notificationService.ts`, reemplazar (líneas 4-9 actuales):

```typescript
export type NotificationEventKey =
    | 'task_assigned'
    | 'task_status_changed'
    | 'task_due_soon'
    | 'timesheet_submitted'
    | 'timesheet_missing_days';
```

por:

```typescript
export type NotificationEventKey =
    | 'task_assigned'
    | 'task_status_changed'
    | 'task_due_soon'
    | 'timesheet_submitted'
    | 'timesheet_missing_days'
    | 'comment_mention';
```

- [ ] **Step 4: Agregar `username` a las queries de usuarios en `authService.ts`**

En `backend/src/services/authService.ts`, reemplazar (líneas 313-319 actuales):

```typescript
    async getActiveUsers(): Promise<{ id: number; full_name: string; email: string; role: string }[]> {
        const users = await db.query(
            'SELECT id, full_name, email, role FROM users WHERE is_active = 1 ORDER BY full_name',
            []
        );
        return users;
    }
```

por:

```typescript
    async getActiveUsers(): Promise<{ id: number; username: string; full_name: string; email: string; role: string }[]> {
        const users = await db.query(
            'SELECT id, username, full_name, email, role FROM users WHERE is_active = 1 ORDER BY full_name',
            []
        );
        return users;
    }
```

Y reemplazar (líneas 322-328 actuales):

```typescript
    async getAllUsersForAdmin(): Promise<{ id: number; full_name: string; email: string; role: string; is_active: boolean }[]> {
        const users = await db.query(
            'SELECT id, full_name, email, role, is_active FROM users ORDER BY full_name',
            []
        );
        return users;
    }
```

por:

```typescript
    async getAllUsersForAdmin(): Promise<{ id: number; username: string; full_name: string; email: string; role: string; is_active: boolean }[]> {
        const users = await db.query(
            'SELECT id, username, full_name, email, role, is_active FROM users ORDER BY full_name',
            []
        );
        return users;
    }
```

Agregar al final de `backend/src/__tests__/services/authService.test.ts` (después del último `describe` existente):

```typescript
describe('AuthService.getActiveUsers / getAllUsersForAdmin', () => {
    it('getActiveUsers incluye username en el SELECT', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);
        const authService = new AuthService();

        await authService.getActiveUsers();

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, username, full_name'), []);
    });

    it('getAllUsersForAdmin incluye username en el SELECT', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);
        const authService = new AuthService();

        await authService.getAllUsersForAdmin();

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('SELECT id, username, full_name'), []);
    });
});
```

- [ ] **Step 5: Implementar `commentService.ts`**

Crear `backend/src/services/commentService.ts`:

```typescript
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { notificationService } from './notificationService';

export type CommentEntityType = 'task' | 'project';

export interface CommentRow {
    id: number;
    entity_type: CommentEntityType;
    entity_id: number;
    user_id: number;
    author_name: string;
    content: string;
    created_at: string;
    updated_at: string;
}

const SELECT_COMMENT_FIELDS = `
    c.id, c.entity_type, c.entity_id, c.user_id, u.full_name as author_name, c.content, c.created_at, c.updated_at
`;

/**
 * Única fuente de CRUD de comments (v16) y de resolución de @menciones.
 * La notificación de menciones nunca lanza: un fallo al notificar no debe impedir
 * que el comentario ya guardado se devuelva con éxito.
 */
export class CommentService {
    async getForEntity(entityType: CommentEntityType, entityId: number): Promise<CommentRow[]> {
        return db.query(`
            SELECT ${SELECT_COMMENT_FIELDS}
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.entity_type = ? AND c.entity_id = ?
            ORDER BY c.created_at ASC, c.id ASC
        `, [entityType, entityId]);
    }

    async create(entityType: CommentEntityType, entityId: number, userId: number, content: string): Promise<CommentRow> {
        const trimmed = content.trim();
        const result = await db.run(
            `INSERT INTO comments (entity_type, entity_id, user_id, content) VALUES (?, ?, ?, ?)`,
            [entityType, entityId, userId, trimmed]
        );

        const comment = await this.findById(result.id as number) as CommentRow;

        await this.notifyMentions(entityType, entityId, userId, trimmed);

        return comment;
    }

    async findById(commentId: number): Promise<CommentRow | undefined> {
        return db.get(`
            SELECT ${SELECT_COMMENT_FIELDS}
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [commentId]);
    }

    async update(commentId: number, content: string): Promise<CommentRow> {
        await db.run(`UPDATE comments SET content = ? WHERE id = ?`, [content.trim(), commentId]);
        return this.findById(commentId) as Promise<CommentRow>;
    }

    async delete(commentId: number): Promise<void> {
        await db.run(`DELETE FROM comments WHERE id = ?`, [commentId]);
    }

    private async notifyMentions(entityType: CommentEntityType, entityId: number, authorId: number, content: string): Promise<void> {
        try {
            const usernames = this.extractMentionedUsernames(content);
            if (usernames.length === 0) return;

            const placeholders = usernames.map(() => '?').join(', ');
            const mentioned = await db.query(
                `SELECT id FROM users WHERE is_active = 1 AND username IN (${placeholders})`,
                usernames
            );

            const uniqueUserIds = [...new Set(mentioned.map((row: { id: number }) => row.id))]
                .filter((id) => id !== authorId);

            for (const userId of uniqueUserIds) {
                await notificationService.notify({
                    userId,
                    eventKey: 'comment_mention',
                    title: 'Te mencionaron en un comentario',
                    message: content.length > 140 ? `${content.slice(0, 140)}...` : content,
                    type: 'info',
                    entityType,
                    entityId,
                    senderId: authorId,
                    link: entityType === 'task' ? `/tasks?taskId=${entityId}` : `/projects/${entityId}`
                });
            }
        } catch (error) {
            logger.error('Failed to resolve/notify comment mentions:', error);
        }
    }

    private extractMentionedUsernames(content: string): string[] {
        const matches = content.match(/@([a-zA-Z0-9_]+)/g) || [];
        return [...new Set(matches.map((token) => token.slice(1)))];
    }
}

export const commentService = new CommentService();
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/services/commentService.test.ts __tests__/services/authService.test.ts`
Expected: PASS (todos los tests, incluidos los 2 nuevos de `authService.test.ts`)

- [ ] **Step 7: Compilar para confirmar que todo tipa bien**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/commentService.ts backend/src/services/notificationService.ts backend/src/services/authService.ts backend/src/__tests__/services/commentService.test.ts backend/src/__tests__/services/authService.test.ts
git commit -m "feat(fase5): commentService con CRUD y resolucion de @menciones"
```

---

## Task 2: Endpoints de comentarios en `taskController`

**Files:**
- Modify: `backend/src/controllers/taskController.ts`
- Modify: `backend/src/routes/taskRoutes.ts`
- Create: `backend/src/__tests__/controllers/taskController.comments.test.ts`

**Interfaces:**
- Consumes: `commentService.getForEntity`, `commentService.create`, `commentService.findById`, `commentService.update`, `commentService.delete` (Task 1).
- Produces (usado por Task 4): `GET /api/tasks/:taskId/comments`, `POST /api/tasks/:taskId/comments` (`{ content }`), `PATCH /api/tasks/:taskId/comments/:commentId` (`{ content }`), `DELETE /api/tasks/:taskId/comments/:commentId`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/taskController.comments.test.ts`:

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
jest.mock('../../services/commentService', () => ({
    commentService: {
        getForEntity: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { commentService } from '../../services/commentService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - comentarios', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskComments', () => {
        it('devuelve los comentarios si el usuario tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.getForEntity as jest.Mock).mockResolvedValue([{ id: 1, content: 'Hola' }]);
            const req = { params: { taskId: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskComments(req, res);

            expect(commentService.getForEntity).toHaveBeenCalledWith('task', 55);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, content: 'Hola' }]);
        });

        it('devuelve 404 si la tarea no existe o el usuario no tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskComments(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.getForEntity).not.toHaveBeenCalled();
        });
    });

    describe('createTaskComment', () => {
        it('crea el comentario y devuelve la fila creada', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.create as jest.Mock).mockResolvedValue({ id: 7, content: 'Nuevo comentario' });
            const req = { params: { taskId: '55' }, body: { content: 'Nuevo comentario' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskComment(req, res);

            expect(commentService.create).toHaveBeenCalledWith('task', 55, 3, 'Nuevo comentario');
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 7, content: 'Nuevo comentario' });
        });

        it('devuelve 400 si el contenido viene vacio o solo con espacios', async () => {
            const req = { params: { taskId: '55' }, body: { content: '   ' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, body: { content: 'X' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.create).not.toHaveBeenCalled();
        });
    });

    describe('updateTaskComment', () => {
        it('actualiza el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 3 });
            (commentService.update as jest.Mock).mockResolvedValue({ id: 7, content: 'Editado' });
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(commentService.update).toHaveBeenCalledWith(7, 'Editado');
            expect(res.json).toHaveBeenCalledWith({ id: 7, content: 'Editado' });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 9 });
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.update).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el comentario no existe o pertenece a otra tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 999, user_id: 3 });
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 400 si el contenido viene vacio', async () => {
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: '' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.findById).not.toHaveBeenCalled();
        });
    });

    describe('deleteTaskComment', () => {
        it('borra el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 3 });
            const req = { params: { taskId: '55', commentId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskComment(req, res);

            expect(commentService.delete).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: 7 });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 9 });
            const req = { params: { taskId: '55', commentId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.delete).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', commentId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.delete).not.toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/taskController.comments.test.ts`
Expected: FAIL — `controller.getTaskComments`/`createTaskComment`/`updateTaskComment`/`deleteTaskComment` no son funciones todavía.

- [ ] **Step 3: Importar `commentService` en `taskController.ts`**

En `backend/src/controllers/taskController.ts`, reemplazar (línea 12 actual):

```typescript
import { notificationService } from '../services/notificationService';
```

por:

```typescript
import { notificationService } from '../services/notificationService';
import { commentService } from '../services/commentService';
```

- [ ] **Step 4: Implementar los 4 métodos en `taskController.ts`**

Agregar en `backend/src/controllers/taskController.ts`, justo antes del cierre de la clase (después de `getTaskActivity`, que termina en la línea 1209 actual con `  };`, y antes del `}` de cierre de clase en la línea 1210):

```typescript
  // GET /api/tasks/:taskId/comments - List comments for a task
  getTaskComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const comments = await commentService.getForEntity('task', parseInt(taskId));
      res.json(comments);
    } catch (error) {
      logger.error('Get task comments error:', error);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  };

  // POST /api/tasks/:taskId/comments - Create a comment on a task
  createTaskComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const userId = req.user?.id as number;
      const { content } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ error: 'Content is required' });
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

      const comment = await commentService.create('task', parseInt(taskId), userId, content);
      res.status(201).json(comment);
    } catch (error) {
      logger.error('Create task comment error:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  };

  // PATCH /api/tasks/:taskId/comments/:commentId - Update own comment on a task
  updateTaskComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId, commentId } = req.params;
      const userId = req.user?.id;
      const { content } = req.body;

      if (!content || !content.trim()) {
        res.status(400).json({ error: 'Content is required' });
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

      const comment = await commentService.findById(parseInt(commentId));
      if (!comment || comment.entity_type !== 'task' || comment.entity_id !== parseInt(taskId)) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }
      if (comment.user_id !== userId) {
        res.status(403).json({ error: 'You can only edit your own comments' });
        return;
      }

      const updated = await commentService.update(parseInt(commentId), content);
      res.json(updated);
    } catch (error) {
      logger.error('Update task comment error:', error);
      res.status(500).json({ error: 'Failed to update comment' });
    }
  };

  // DELETE /api/tasks/:taskId/comments/:commentId - Delete own comment on a task
  deleteTaskComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { taskId, commentId } = req.params;
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

      const comment = await commentService.findById(parseInt(commentId));
      if (!comment || comment.entity_type !== 'task' || comment.entity_id !== parseInt(taskId)) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }
      if (comment.user_id !== userId) {
        res.status(403).json({ error: 'You can only delete your own comments' });
        return;
      }

      await commentService.delete(parseInt(commentId));
      res.json({ success: true, deletedId: parseInt(commentId) });
    } catch (error) {
      logger.error('Delete task comment error:', error);
      res.status(500).json({ error: 'Failed to delete comment' });
    }
  };

```

- [ ] **Step 5: Registrar las rutas**

En `backend/src/routes/taskRoutes.ts`, agregar después de la línea 35 (`router.delete('/tasks/:taskId/subtasks/:subtaskId', authenticate, taskController.deleteTaskSubtask);`) y antes de la línea 37 (`router.get('/tasks/my-tasks', ...)`):

```typescript

// Comentarios con @menciones - path de 3 segmentos, no colisiona con /tasks/:id
router.get('/tasks/:taskId/comments', authenticate, taskController.getTaskComments);
router.post('/tasks/:taskId/comments', authenticate, taskController.createTaskComment);
router.patch('/tasks/:taskId/comments/:commentId', authenticate, taskController.updateTaskComment);
router.delete('/tasks/:taskId/comments/:commentId', authenticate, taskController.deleteTaskComment);
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/taskController.comments.test.ts`
Expected: PASS (los 14 tests)

- [ ] **Step 7: Correr toda la suite de taskController para confirmar que nada existente se rompió**

Run: `cd backend && npx jest taskController`
Expected: PASS

- [ ] **Step 8: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/taskController.ts backend/src/routes/taskRoutes.ts backend/src/__tests__/controllers/taskController.comments.test.ts
git commit -m "feat(fase5): endpoints de comentarios en tareas"
```

---

## Task 3: Endpoints de comentarios en `projectController`

**Files:**
- Modify: `backend/src/controllers/projectController.ts`
- Modify: `backend/src/routes/projectRoutes.ts`
- Create: `backend/src/__tests__/controllers/projectController.comments.test.ts`

**Interfaces:**
- Consumes: `commentService.*` (Task 1), `this.hasProjectAccess` (método privado ya existente en `projectController.ts:504-512`).
- Produces (usado por Task 6): `GET /api/projects/:id/comments`, `POST /api/projects/:id/comments` (`{ content }`), `PATCH /api/projects/:id/comments/:commentId` (`{ content }`), `DELETE /api/projects/:id/comments/:commentId`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/projectController.comments.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getProjectActivity: jest.fn(), logActivity: jest.fn() }
}));
jest.mock('../../services/commentService', () => ({
    commentService: {
        getForEntity: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { commentService } from '../../services/commentService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - comentarios', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    describe('getProjectComments', () => {
        it('devuelve los comentarios si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.getForEntity as jest.Mock).mockResolvedValue([{ id: 1, content: 'Hola' }]);
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectComments(req, res);

            expect(commentService.getForEntity).toHaveBeenCalledWith('project', 7);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, content: 'Hola' }]);
        });

        it('devuelve 404 si el proyecto no existe', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { id: '999' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectComments(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 403 si un rpa_developer sin pertenencia intenta ver los comentarios', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectComments(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.getForEntity).not.toHaveBeenCalled();
        });
    });

    describe('createProjectComment', () => {
        it('crea el comentario y devuelve la fila creada', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.create as jest.Mock).mockResolvedValue({ id: 5, content: 'Nuevo' });
            const req = { params: { id: '7' }, body: { content: 'Nuevo' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectComment(req, res);

            expect(commentService.create).toHaveBeenCalledWith('project', 7, 1, 'Nuevo');
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('devuelve 400 si el contenido viene vacio', async () => {
            const req = { params: { id: '7' }, body: { content: '   ' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 403 si un rpa_developer sin pertenencia intenta comentar', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, body: { content: 'X' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.create).not.toHaveBeenCalled();
        });
    });

    describe('updateProjectComment', () => {
        it('actualiza el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 1 });
            (commentService.update as jest.Mock).mockResolvedValue({ id: 5, content: 'Editado' });
            const req = { params: { id: '7', commentId: '5' }, body: { content: 'Editado' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateProjectComment(req, res);

            expect(commentService.update).toHaveBeenCalledWith(5, 'Editado');
            expect(res.json).toHaveBeenCalledWith({ id: 5, content: 'Editado' });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario, aunque sea team_lead', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 9 });
            const req = { params: { id: '7', commentId: '5' }, body: { content: 'Editado' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.update).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el comentario no existe para ese proyecto', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 999, user_id: 1 });
            const req = { params: { id: '7', commentId: '5' }, body: { content: 'Editado' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });
    });

    describe('deleteProjectComment', () => {
        it('borra el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 1 });
            const req = { params: { id: '7', commentId: '5' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteProjectComment(req, res);

            expect(commentService.delete).toHaveBeenCalledWith(5);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: 5 });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 9 });
            const req = { params: { id: '7', commentId: '5' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.delete).not.toHaveBeenCalled();
        });
    });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd backend && npx jest __tests__/controllers/projectController.comments.test.ts`
Expected: FAIL — los métodos nuevos no existen todavía.

- [ ] **Step 3: Importar `commentService` en `projectController.ts`**

En `backend/src/controllers/projectController.ts`, reemplazar (línea 8 actual):

```typescript
import { activityLogService } from '../services/activityLogService';
```

por:

```typescript
import { activityLogService } from '../services/activityLogService';
import { commentService } from '../services/commentService';
```

- [ ] **Step 4: Implementar los 4 métodos en `projectController.ts`**

Agregar en `backend/src/controllers/projectController.ts`, justo después del método privado `hasProjectAccess` (que termina en la línea 512 actual con `    }`), y antes del comentario `// DEBUG: Temporary endpoint...` (línea 514 actual):

```typescript

    // GET /api/projects/:id/comments
    getProjectComments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const project = await db.get('SELECT id, assigned_to, created_by FROM projects WHERE id = ?', [projectId]);

            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            if (!this.hasProjectAccess(req.user, project)) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const comments = await commentService.getForEntity('project', projectId);
            res.json(comments);
        } catch (error) {
            logger.error('Get project comments error:', error);
            res.status(500).json({ error: 'Failed to get comments' });
        }
    };

    // POST /api/projects/:id/comments
    createProjectComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const userId = req.user?.id as number;
            const { content } = req.body;

            if (!content || !content.trim()) {
                res.status(400).json({ error: 'Content is required' });
                return;
            }

            const project = await db.get('SELECT id, assigned_to, created_by FROM projects WHERE id = ?', [projectId]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            if (!this.hasProjectAccess(req.user, project)) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const comment = await commentService.create('project', projectId, userId, content);
            res.status(201).json(comment);
        } catch (error) {
            logger.error('Create project comment error:', error);
            res.status(500).json({ error: 'Failed to create comment' });
        }
    };

    // PATCH /api/projects/:id/comments/:commentId
    updateProjectComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const commentId = parseInt(req.params.commentId);
            const userId = req.user?.id;
            const { content } = req.body;

            if (!content || !content.trim()) {
                res.status(400).json({ error: 'Content is required' });
                return;
            }

            const project = await db.get('SELECT id, assigned_to, created_by FROM projects WHERE id = ?', [projectId]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            if (!this.hasProjectAccess(req.user, project)) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const comment = await commentService.findById(commentId);
            if (!comment || comment.entity_type !== 'project' || comment.entity_id !== projectId) {
                res.status(404).json({ error: 'Comment not found' });
                return;
            }
            if (comment.user_id !== userId) {
                res.status(403).json({ error: 'You can only edit your own comments' });
                return;
            }

            const updated = await commentService.update(commentId, content);
            res.json(updated);
        } catch (error) {
            logger.error('Update project comment error:', error);
            res.status(500).json({ error: 'Failed to update comment' });
        }
    };

    // DELETE /api/projects/:id/comments/:commentId
    deleteProjectComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const commentId = parseInt(req.params.commentId);
            const userId = req.user?.id;

            const project = await db.get('SELECT id, assigned_to, created_by FROM projects WHERE id = ?', [projectId]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            if (!this.hasProjectAccess(req.user, project)) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const comment = await commentService.findById(commentId);
            if (!comment || comment.entity_type !== 'project' || comment.entity_id !== projectId) {
                res.status(404).json({ error: 'Comment not found' });
                return;
            }
            if (comment.user_id !== userId) {
                res.status(403).json({ error: 'You can only delete your own comments' });
                return;
            }

            await commentService.delete(commentId);
            res.json({ success: true, deletedId: commentId });
        } catch (error) {
            logger.error('Delete project comment error:', error);
            res.status(500).json({ error: 'Failed to delete comment' });
        }
    };
```

- [ ] **Step 5: Registrar las rutas**

En `backend/src/routes/projectRoutes.ts`, agregar después de la línea 85 (`router.get('/:id/activity', projectController.getProjectActivity);`) y antes de la línea 87 (`// POST /api/projects/:id/baseline...`):

```typescript

// GET/POST/PATCH/DELETE /api/projects/:id/comments - Comments with @mentions
router.get('/:id/comments', projectController.getProjectComments);
router.post('/:id/comments', projectController.createProjectComment);
router.patch('/:id/comments/:commentId', projectController.updateProjectComment);
router.delete('/:id/comments/:commentId', projectController.deleteProjectComment);
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd backend && npx jest __tests__/controllers/projectController.comments.test.ts`
Expected: PASS (los 12 tests)

- [ ] **Step 7: Correr toda la suite de projectController**

Run: `cd backend && npx jest projectController`
Expected: PASS

- [ ] **Step 8: Compilar**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.comments.test.ts
git commit -m "feat(fase5): endpoints de comentarios en proyectos"
```

---

## Task 4: Componente frontend `CommentsThread` + métodos de API

**Files:**
- Create: `frontend/src/components/comments/CommentsThread.tsx`
- Create: `frontend/src/__tests__/components/CommentsThread.test.tsx`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Consumes: `apiService.getComments`, `apiService.createComment`, `apiService.updateComment`, `apiService.deleteComment` (agregados en este task); `useAuthStore` (`@/store/authStore`, ya existente) para el usuario autenticado.
- Produces (usado por Tasks 5 y 6): `export const CommentsThread: React.FC<{ entityType: 'task' | 'project'; entityId: number; users: { id: number; full_name: string; username?: string }[] }>`.

- [ ] **Step 1: Agregar los métodos de API que fallan (no existen todavía)**

En `frontend/src/services/api.ts`, agregar después de `deleteTaskSubtask` (línea 607 actual, antes de `getProjectGantt`):

```typescript

  async getComments(entityType: 'task' | 'project', entityId: number): Promise<any[]> {
    const response = await this.api.get(`/${entityType}s/${entityId}/comments`);
    return response.data;
  }

  async createComment(entityType: 'task' | 'project', entityId: number, content: string): Promise<any> {
    const response = await this.api.post(`/${entityType}s/${entityId}/comments`, { content });
    return response.data;
  }

  async updateComment(entityType: 'task' | 'project', entityId: number, commentId: number, content: string): Promise<any> {
    const response = await this.api.patch(`/${entityType}s/${entityId}/comments/${commentId}`, { content });
    return response.data;
  }

  async deleteComment(entityType: 'task' | 'project', entityId: number, commentId: number): Promise<any> {
    const response = await this.api.delete(`/${entityType}s/${entityId}/comments/${commentId}`);
    return response.data;
  }
```

(Sin test dedicado propio, igual que los métodos de subtareas — capa fina de wrappers de axios, verificada indirectamente vía los tests del componente que los usa.)

- [ ] **Step 2: Escribir los tests del componente (fallan porque no existe)**

Crear `frontend/src/__tests__/components/CommentsThread.test.tsx`:

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 3, role: 'rpa_developer', full_name: 'Ana' } })
}));

import { apiService } from '@/services/api';
import { CommentsThread } from '@/components/comments/CommentsThread';

const users = [
  { id: 3, full_name: 'Ana', username: 'ana' },
  { id: 9, full_name: 'Dev Uno', username: 'dev1' }
];

describe('CommentsThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra los comentarios existentes', async () => {
    (apiService.getComments as any).mockResolvedValue([
      { id: 1, entity_type: 'task', entity_id: 55, user_id: 9, author_name: 'Dev Uno', content: 'Hola equipo', created_at: '2026-09-23T10:00:00Z', updated_at: '2026-09-23T10:00:00Z' }
    ]);

    render(<CommentsThread entityType="task" entityId={55} users={users} />);

    expect(await screen.findByText('Hola equipo')).toBeInTheDocument();
    expect(screen.getByText('Dev Uno')).toBeInTheDocument();
  });

  it('muestra el estado vacio cuando no hay comentarios', async () => {
    (apiService.getComments as any).mockResolvedValue([]);

    render(<CommentsThread entityType="task" entityId={55} users={users} />);

    expect(await screen.findByText('Sin comentarios todavía')).toBeInTheDocument();
  });

  it('publica un comentario nuevo al escribir y hacer click en Comentar', async () => {
    (apiService.getComments as any).mockResolvedValue([]);
    (apiService.createComment as any).mockResolvedValue({
      id: 2, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Nuevo comentario', created_at: '2026-09-23T10:00:00Z', updated_at: '2026-09-23T10:00:00Z'
    });

    render(<CommentsThread entityType="task" entityId={55} users={users} />);
    await waitFor(() => expect(apiService.getComments).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/escribí un comentario/i);
    await userEvent.type(input, 'Nuevo comentario');
    await userEvent.click(screen.getByRole('button', { name: /comentar/i }));

    expect(apiService.createComment).toHaveBeenCalledWith('task', 55, 'Nuevo comentario');
    expect(await screen.findByText('Nuevo comentario')).toBeInTheDocument();
  });

  it('solo muestra los botones de editar/borrar en los comentarios propios', async () => {
    (apiService.getComments as any).mockResolvedValue([
      { id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Mio', created_at: 'x', updated_at: 'x' },
      { id: 2, entity_type: 'task', entity_id: 55, user_id: 9, author_name: 'Dev Uno', content: 'Ajeno', created_at: 'x', updated_at: 'x' }
    ]);

    render(<CommentsThread entityType="task" entityId={55} users={users} />);
    await screen.findByText('Mio');
    await screen.findByText('Ajeno');

    expect(screen.getAllByRole('button', { name: /editar comentario/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /eliminar comentario/i })).toHaveLength(1);
  });

  it('elimina un comentario propio al confirmar', async () => {
    (apiService.getComments as any).mockResolvedValue([
      { id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Mio', created_at: 'x', updated_at: 'x' }
    ]);
    (apiService.deleteComment as any).mockResolvedValue({ success: true });

    render(<CommentsThread entityType="task" entityId={55} users={users} />);
    await screen.findByText('Mio');

    await userEvent.click(screen.getByRole('button', { name: /eliminar comentario/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(apiService.deleteComment).toHaveBeenCalledWith('task', 55, 1));
  });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/components/CommentsThread.test.tsx`
Expected: FAIL — "Cannot find module '@/components/comments/CommentsThread'"

- [ ] **Step 4: Implementar el componente**

Crear `frontend/src/components/comments/CommentsThread.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { List, Avatar, Typography, Button, Mentions, message, Popconfirm } from 'antd';
import { DeleteOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text } = Typography;

export interface CommentThreadUser {
  id: number;
  full_name: string;
  username?: string;
}

export interface CommentRow {
  id: number;
  entity_type: 'task' | 'project';
  entity_id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface CommentsThreadProps {
  entityType: 'task' | 'project';
  entityId: number;
  users: CommentThreadUser[];
}

export function renderContentWithMentions(content: string): React.ReactNode {
  const parts = content.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, index) =>
    /^@[a-zA-Z0-9_]+$/.test(part)
      ? <Text key={index} strong style={{ color: '#1677ff' }}>{part}</Text>
      : <React.Fragment key={index}>{part}</React.Fragment>
  );
}

export const CommentsThread: React.FC<CommentsThreadProps> = ({ entityType, entityId, users }) => {
  const { user: currentUser } = useAuthStore();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiService.getComments(entityType, entityId)
      .then((data) => { if (!cancelled) setComments(data); })
      .catch(() => { if (!cancelled) message.error('Error al cargar comentarios'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [entityType, entityId]);

  const mentionOptions = users
    .filter((u) => !!u.username)
    .map((u) => ({ value: u.username as string, label: u.full_name }));

  const handlePost = async () => {
    const content = newContent.trim();
    if (!content) return;

    try {
      setPosting(true);
      const created = await apiService.createComment(entityType, entityId, content);
      setComments((prev) => [...prev, created]);
      setNewContent('');
    } catch (error) {
      message.error('Error al publicar el comentario');
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (comment: CommentRow) => {
    setEditingId(comment.id);
    setEditingContent(comment.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingContent('');
  };

  const handleSaveEdit = async (commentId: number) => {
    const content = editingContent.trim();
    if (!content) return;

    try {
      const updated = await apiService.updateComment(entityType, entityId, commentId, content);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      cancelEdit();
    } catch (error) {
      message.error('Error al editar el comentario');
    }
  };

  const handleDelete = async (commentId: number) => {
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    try {
      await apiService.deleteComment(entityType, entityId, commentId);
    } catch (error) {
      message.error('Error al eliminar el comentario');
      setComments(previous);
    }
  };

  return (
    <div>
      <Text strong>
        Comentarios{comments.length > 0 ? ` (${comments.length})` : ''}
      </Text>
      <List
        size="small"
        loading={loading}
        dataSource={comments}
        locale={{ emptyText: 'Sin comentarios todavía' }}
        style={{ margin: '8px 0' }}
        renderItem={(comment) => (
          <List.Item
            actions={
              comment.user_id === currentUser?.id
                ? [
                    <Button
                      key="edit"
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      aria-label="Editar comentario"
                      onClick={() => startEdit(comment)}
                    />,
                    <Popconfirm
                      key="delete"
                      title="¿Eliminar este comentario?"
                      okText="Eliminar"
                      cancelText="Cancelar"
                      onConfirm={() => handleDelete(comment.id)}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        aria-label="Eliminar comentario"
                      />
                    </Popconfirm>
                  ]
                : []
            }
          >
            <List.Item.Meta
              avatar={<Avatar size="small" icon={<UserOutlined />} />}
              title={
                <Text>
                  {comment.author_name}{' '}
                  <Text type="secondary" style={{ fontWeight: 'normal' }}>
                    {dayjs(comment.created_at).fromNow()}
                  </Text>
                </Text>
              }
              description={
                editingId === comment.id ? (
                  <div>
                    <Mentions
                      value={editingContent}
                      options={mentionOptions}
                      onChange={setEditingContent}
                      autoSize
                    />
                    <div style={{ marginTop: 4 }}>
                      <Button size="small" type="primary" onClick={() => handleSaveEdit(comment.id)}>
                        Guardar
                      </Button>{' '}
                      <Button size="small" onClick={cancelEdit}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Text>{renderContentWithMentions(comment.content)}</Text>
                )
              }
            />
          </List.Item>
        )}
      />
      <Mentions
        placeholder="Escribí un comentario... usá @ para mencionar"
        value={newContent}
        options={mentionOptions}
        onChange={setNewContent}
        autoSize
      />
      <Button type="primary" onClick={handlePost} loading={posting} style={{ marginTop: 8 }}>
        Comentar
      </Button>
    </div>
  );
};
```

- [ ] **Step 5: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/components/CommentsThread.test.tsx`
Expected: PASS (los 5 tests)

- [ ] **Step 6: Compilar**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/comments/CommentsThread.tsx frontend/src/__tests__/components/CommentsThread.test.tsx frontend/src/services/api.ts
git commit -m "feat(fase5): componente CommentsThread + metodos de API de comentarios"
```

---

## Task 5: Wirear `CommentsThread` en `TasksPage`

**Files:**
- Modify: `frontend/src/pages/tasks/TasksPage.tsx`
- Modify: `frontend/src/__tests__/pages/TasksPage.test.tsx`

**Interfaces:**
- Consumes: `CommentsThread` (Task 4), array `users` ya cargado en `TasksPage.tsx` (interface `User` en líneas 49-53, ahora necesita `username?: string` porque lo devuelve `/auth/users` desde Task 1).

- [ ] **Step 1: Leer el estado actual de `frontend/src/__tests__/pages/TasksPage.test.tsx` y agregar el mock de `getComments`**

Este archivo puede haber cambiado desde el último plan (confirmar leyéndolo antes de editar). Agregar `getComments: vi.fn()` al mock de `apiService` (junto a `getTaskSubtasks` y los demás métodos ya mockeados), y en el `beforeEach` compartido agregar:

```typescript
    (apiService.getComments as any).mockResolvedValue([]);
```

junto a la línea que ya mockea `getTaskSubtasks` con `[]`, para que cualquier test que abra el modal de edición (y por lo tanto monte `CommentsThread`) tenga una respuesta por defecto.

- [ ] **Step 2: Agregar el test que falla (el hilo de comentarios todavía no está montado)**

Agregar al `describe` de deep-link o al bloque de tests del modal de edición existente:

```typescript
  it('muestra el hilo de comentarios en el modal de edicion de tarea', async () => {
    renderWithTaskId('42');

    expect(await screen.findByText(/^Comentarios/)).toBeInTheDocument();
    expect(apiService.getComments).toHaveBeenCalledWith('task', 42);
  });

  it('no muestra el hilo de comentarios en el modal de "Nueva Tarea" (crear, no editar)', async () => {
    render(
      <MemoryRouter initialEntries={['/tasks']}>
        <TasksPage />
      </MemoryRouter>
    );

    const newTaskButton = await screen.findByRole('button', { name: /nueva tarea/i });
    await waitFor(() => expect(newTaskButton).not.toBeDisabled());
    await userEvent.click(newTaskButton);

    expect(await screen.findByText('Título')).toBeInTheDocument();
    expect(screen.queryByText(/^Comentarios/)).not.toBeInTheDocument();
    expect(apiService.getComments).not.toHaveBeenCalled();
  });
```

(Usar el `renderWithTaskId` / helpers ya existentes en el archivo para abrir el modal de edición con `taskId=42`, siguiendo el mismo patrón usado por el test de subtareas y por el deep-link `?taskId=`.)

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx`
Expected: FAIL — no existe texto "Comentarios" en el modal todavía.

- [ ] **Step 4: Agregar `username` a la interface `User` y el import del componente nuevo**

En `frontend/src/pages/tasks/TasksPage.tsx`, reemplazar (líneas 49-53 actuales):

```typescript
interface User {
  id: number;
  full_name: string;
  avatar_url?: string;
}
```

por:

```typescript
interface User {
  id: number;
  full_name: string;
  avatar_url?: string;
  username?: string;
}
```

Agregar el import, después de la línea `import { TaskSubtasksChecklist } from '@/components/tasks/TaskSubtasksChecklist';` (línea 36 actual):

```typescript
import { CommentsThread } from '@/components/comments/CommentsThread';
```

- [ ] **Step 5: Montar `CommentsThread` en el modal de edición**

En `frontend/src/pages/tasks/TasksPage.tsx`, reemplazar (líneas 970-978 actuales):

```typescript
          {editingTask && (
            <>
              <Divider />
              <TaskSubtasksChecklist
                taskId={editingTask.id}
                onChange={() => selectedBoard && loadBoard(selectedBoard.id)}
              />
            </>
          )}
```

por:

```typescript
          {editingTask && (
            <>
              <Divider />
              <TaskSubtasksChecklist
                taskId={editingTask.id}
                onChange={() => selectedBoard && loadBoard(selectedBoard.id)}
              />
              <Divider />
              <CommentsThread
                entityType="task"
                entityId={editingTask.id}
                users={users}
              />
            </>
          )}
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `cd frontend && npx vitest run src/__tests__/pages/TasksPage.test.tsx`
Expected: PASS (todos los tests del archivo, incluidos los 2 nuevos)

- [ ] **Step 7: Correr toda la suite de frontend y compilar**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: PASS / sin errores nuevos

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/tasks/TasksPage.tsx frontend/src/__tests__/pages/TasksPage.test.tsx
git commit -m "feat(fase5): hilo de comentarios en el modal de edicion de TasksPage"
```

---

## Task 6: Wirear `CommentsThread` en `ProjectDetailPage` (pestaña nueva)

**Files:**
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx`

**Interfaces:**
- Consumes: `CommentsThread` (Task 4).

No existe hoy ningún archivo de test para `ProjectDetailPage.tsx` (confirmado — la página no tiene test propio y montarlo por primera vez implicaría mockear todas sus dependencias de carga: proyecto, ROI, health, activity, files, etc.). Siguiendo la misma filosofía que `TaskSubtasksChecklist` (componente reutilizable ya probado de forma aislada en Task 4), este task solo conecta el componente ya testeado — no se agrega un test de página nuevo para no incurrir en ese costo de setup fuera de alcance.

- [ ] **Step 1: Agregar el ícono nuevo a los imports**

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, reemplazar (líneas 24-41 actuales):

```typescript
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
  HomeOutlined,
  FolderOutlined,
  PictureOutlined,
  FundOutlined,
  RobotOutlined,
  RocketOutlined
} from '@ant-design/icons';
```

por:

```typescript
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ProjectOutlined,
  HomeOutlined,
  FolderOutlined,
  PictureOutlined,
  FundOutlined,
  RobotOutlined,
  RocketOutlined,
  MessageOutlined
} from '@ant-design/icons';
```

Y agregar el import del componente nuevo, después de la línea `import { ActivityTimeline } from '@/components/activity/ActivityTimeline';` (línea 44 actual):

```typescript
import { CommentsThread } from '@/components/comments/CommentsThread';
```

- [ ] **Step 2: Cargar la lista de usuarios activos para el autocompletado de @menciones**

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, reemplazar (líneas 63-64 actuales):

```typescript
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
```

por:

```typescript
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<{ id: number; full_name: string; username?: string }[]>([]);
```

Y en el `useEffect` existente (líneas 71-75 actuales):

```typescript
  useEffect(() => {
    if (id) {
      loadProjectData();
    }
  }, [id]);
```

por:

```typescript
  useEffect(() => {
    if (id) {
      loadProjectData();
    }
    apiService.get('/auth/users').then(setUsers).catch(() => setUsers([]));
  }, [id]);
```

- [ ] **Step 3: Agregar la pestaña "Comentarios"**

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, reemplazar (líneas 617-628 actuales, el item `'lifecycle'` — último del array):

```typescript
            {
              key: 'lifecycle',
              label: (
                <span>
                  <RocketOutlined />
                  Lifecycle & Real ROI
                </span>
              ),
              children: (
                <ProjectLifecyclePage />
              )
            }
          ]}
```

por:

```typescript
            {
              key: 'lifecycle',
              label: (
                <span>
                  <RocketOutlined />
                  Lifecycle & Real ROI
                </span>
              ),
              children: (
                <ProjectLifecyclePage />
              )
            },
            {
              key: 'comments',
              label: (
                <span>
                  <MessageOutlined />
                  Comentarios
                </span>
              ),
              children: (
                <div style={{ padding: '8px 0', maxWidth: '720px' }}>
                  <CommentsThread
                    entityType="project"
                    entityId={project.id}
                    users={users}
                  />
                </div>
              )
            }
          ]}
```

- [ ] **Step 4: Compilar para confirmar que todo tipa bien**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 5: Levantar el frontend y verificar manualmente en el navegador**

Run: `cd frontend && npm run dev` (y `cd backend && npm run dev` si no está corriendo)
Verificar en `http://localhost:3000`: abrir un proyecto, ir a la pestaña "Comentarios", publicar un comentario mencionando a otro usuario con `@` (debe aparecer el autocompletado), confirmar que aparece en la lista, y que el usuario mencionado recibe la notificación (campana de `NotificationBell`).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat(fase5): pestana de comentarios en ProjectDetailPage"
```

---

## Task 7: Revisión final del sub-proyecto

- [ ] **Step 1: Correr toda la suite de backend**

Run: `cd backend && npm test`
Expected: todos los tests en PASS (los existentes + los agregados en Tasks 1-3)

- [ ] **Step 2: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests en PASS (los existentes + los agregados en Tasks 4-5)

- [ ] **Step 3: Compilar ambos proyectos**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: sin errores en ninguno de los dos

- [ ] **Step 4: Revisión de todo el diff del sub-proyecto (desde el primer commit de Task 1 hasta el último de Task 6), no de `main..HEAD` completo**

Usar `superpowers:requesting-code-review` acotado a los commits de este sub-proyecto (igual que se hizo al cerrar los sub-proyectos anteriores de Fase 5).
