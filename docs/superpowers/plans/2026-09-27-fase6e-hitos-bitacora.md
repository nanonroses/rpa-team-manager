# Fase 6E: Hitos técnicos + Bitácora del proyecto — Plan de Implementación

> **Para agentes ejecutores:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` para ejecutar este plan tarea por tarea. Los pasos usan sintaxis de checkbox (`- [ ]`) para seguimiento.

**Objetivo:** que los hitos técnicos (`project_milestones`, ya existentes) dejen huella automática en el historial de actividad del proyecto, y agregar una bitácora nueva e inmutable por proyecto (hitos técnicos/aprobaciones/decisiones/cambios de alcance/incidentes, con adjunto opcional), visible en una pestaña nueva "Hitos y bitácora" de la ficha del proyecto.

**Arquitectura:** Backend: (1) se instrumenta `pmoController.ts` (CRUD de hitos ya existente) para llamar a `activityLogService.logActivity` dos veces por operación — una específica (`entity_type='milestone'`) y una a nivel de proyecto (`entity_type='project'`) para que aparezca en el timeline ya existente, siguiendo el patrón real ya usado en `billingController`/`commercialController`; (2) tabla nueva `project_log_entries` (migración v42) + `projectLogService.ts` + 2 endpoints nuevos en `projectController.ts` (`GET`/`POST /api/projects/:id/log-entries`), reusando `hasProjectAccess` (lectura) y una función nueva `canWriteProjectLog` (escritura). Frontend: pestaña nueva en `ProjectDetailPage.tsx` con un componente `ProjectMilestonesAndLog.tsx` (resumen de hitos + formulario/lista de bitácora), y 4 labels nuevos en `ActivityTimeline.tsx`.

**Tech Stack:** Node/Express/TypeScript + SQLite (backend), React/TypeScript + Ant Design + Zustand (frontend), Jest (backend tests, mock manual de `db`), Vitest + Testing Library (frontend tests).

**Spec:** diseño aprobado por el usuario en el chat (sub-proyecto E, 4 secciones: huella de hitos técnicos, bitácora nueva inmutable, permisos, pestaña "Hitos y bitácora"). No hay doc de spec separado — este repo salta directo de diseño aprobado en chat a plan escrito (ver convención del proyecto).

## Global Constraints

- Roles válidos (CHECK real, `backend/src/database/migrationList.ts:15`): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`.
- Lectura de bitácora y de hitos: mismo criterio que hoy usan los comentarios de proyecto — `ProjectController.hasProjectAccess` (`team_lead`/`rpa_operations`/`it_support` siempre; `rpa_developer` solo si `assigned_to` o `created_by` es él).
- Escritura de bitácora: `team_lead` siempre + `assigned_to`/`created_by` de ESE proyecto puntual (regla nueva, más estricta que la de hitos técnicos).
- **No tocar** `pmoWriteRoles = authorize(['team_lead', 'rpa_operations'])` en `pmoRoutes.ts` — el permiso de escritura de hitos técnicos ya existente queda igual.
- Las entradas de bitácora son inmutables: solo `GET`/`POST`, nunca `PATCH`/`DELETE`.
- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (wrapper de `database.ts`), nunca `db.all` directo ni conexión SQLite cruda (salvo en tests de migración, que sí usan `sqlite3` real).
- Tests de service/controller: mock manual de `db` (`jest.mock('../../database/database', ...)`) + `jest.mock` de servicios dependientes, nunca DB real. Tests de migración sí usan SQLite real en un archivo temporal (patrón `migration35.test.ts`).
- Tests de frontend: Vitest + `@testing-library/react`, mock de `apiService` y `useAuthStore` vía `vi.mock`.
- Mensajes de error que llega a ver el usuario en la UI: en español. Nombres de campos/tablas/funciones: en inglés, como el resto del repo.
- Adjuntos: usar el mecanismo genérico ya existente (`files` + `file_associations`), con el mismo patrón de `commercialController.createQuote` (subir archivo suelto → `file_id` → insertar en `file_associations` con `entity_type='project'` para que `downloadFile` dé acceso a cualquiera con acceso al proyecto, no solo a quien subió el archivo).

## Review Focus

- Un `rpa_developer` sin pertenencia al proyecto pide `GET /api/projects/:id/log-entries` → debe dar 403, sin filtrar ni una fila. (Task 3)
- Un `rpa_developer` que SÍ es responsable/creador de un proyecto intenta escribir una entrada de bitácora en OTRO proyecto donde no lo es → 403, aunque el rol sea el mismo. (Task 3)
- Editar un hito técnico tocando solo `description`/`priority` (sin cambiar `status` ni `planned_date`) debe seguir guardando el cambio en la BD, pero **no** debe generar una entrada nueva en el timeline del proyecto (evitar ruido). (Task 4)
- Adjuntar un archivo a una entrada de bitácora y que un segundo usuario CON acceso al proyecto (no quien subió el archivo) pueda descargarlo — valida que se inserta en `file_associations`, no que alcanza con guardar `file_id` en la fila. (Task 3)
- `entry_type` inválido o `description` vacía en el `POST` de bitácora → 400 claro, sin insertar fila corrupta ni loguear actividad fantasma. (Task 3)

---

### Task 1: Migración v42 — tabla `project_log_entries`

**Files:**
- Modify: `backend/src/database/migrationList.ts` (agregar objeto de migración nuevo justo antes del `];` de cierre del array, después del bloque de la versión 41 que termina en la línea 1939)
- Test: `backend/src/__tests__/database/migration42.test.ts` (crear)

**Interfaces:**
- Produce: tabla `project_log_entries(id, project_id, entry_type, description, file_id, created_by, created_at)`, con `entry_type` restringido por `CHECK` a `'technical_milestone' | 'client_approval' | 'decision' | 'scope_change' | 'incident'`, `ON DELETE CASCADE` desde `projects`, `ON DELETE SET NULL` desde `files`. Migración número **42** (la última hoy es la 41).

- [ ] **Step 1: Escribir el test de la migración (debe fallar porque la tabla no existe todavía)**

Crear `backend/src/__tests__/database/migration42.test.ts`:

```ts
import sqlite3 from 'sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { MigrationManager } from '../../database/migrations';
import { migrations } from '../../database/migrationList';

describe('Migración 42 - project_log_entries (bitácora del proyecto)', () => {
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
        dbPath = path.join(os.tmpdir(), `migration42-log-test-${Date.now()}.sqlite`);
        const manager = new MigrationManager();
        await manager.init(dbPath);
        await manager.runMigrations(migrations);
        await manager.close();

        db = await new Promise((resolve, reject) => {
            const conn = new sqlite3.Database(dbPath, (err) => (err ? reject(err) : resolve(conn)));
        });

        await run('PRAGMA foreign_keys = ON');
        await run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('u1', 'u1@x.com', 'h', 'U1', 'team_lead')`);
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto X', 1)`);
        await run(`INSERT INTO files (filename, original_filename, file_path, file_size, mime_type, file_hash, uploaded_by) VALUES ('a.pdf', 'a.pdf', '/tmp/a.pdf', 100, 'application/pdf', 'hash1', 1)`);
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => db.close(() => resolve()));
        fs.unlinkSync(dbPath);
    });

    it('crea la tabla project_log_entries con las columnas esperadas', async () => {
        const cols = await columnNames('project_log_entries');
        expect(cols).toEqual(expect.arrayContaining(['id', 'project_id', 'entry_type', 'description', 'file_id', 'created_by', 'created_at']));
    });

    it('permite crear una entrada de bitácora con un tipo válido', async () => {
        const result = await run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, created_by) VALUES (1, 'decision', 'Se decidió posponer el go-live', 1)`
        );
        expect(result.changes).toBe(1);

        const rows = await all(`SELECT * FROM project_log_entries WHERE project_id = 1`);
        expect(rows).toHaveLength(1);
        expect(rows[0].entry_type).toBe('decision');
    });

    it('rechaza un entry_type fuera del catálogo permitido', async () => {
        await expect(
            run(`INSERT INTO project_log_entries (project_id, entry_type, description, created_by) VALUES (1, 'invalido', 'x', 1)`)
        ).rejects.toThrow();
    });

    it('permite asociar un archivo existente', async () => {
        const result = await run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, file_id, created_by) VALUES (1, 'incident', 'Falla en producción', 1, 1)`
        );
        const rows = await all(`SELECT * FROM project_log_entries WHERE id = ?`, [result.lastID]);
        expect(rows[0].file_id).toBe(1);
    });

    it('pone file_id en NULL si el archivo asociado se borra (no borra la entrada)', async () => {
        const entry = await run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, file_id, created_by) VALUES (1, 'incident', 'Con adjunto a borrar', 1, 1)`
        );
        await run(`DELETE FROM files WHERE id = 1`);
        const rows = await all(`SELECT * FROM project_log_entries WHERE id = ?`, [entry.lastID]);
        expect(rows).toHaveLength(1);
        expect(rows[0].file_id).toBeNull();
    });

    it('borra en cascada las entradas cuando se borra el proyecto', async () => {
        await run(`INSERT INTO projects (name, created_by) VALUES ('Proyecto a borrar', 1)`);
        const projectRow = await all(`SELECT id FROM projects WHERE name = 'Proyecto a borrar'`);
        const projectId = projectRow[0].id;
        await run(`INSERT INTO project_log_entries (project_id, entry_type, description, created_by) VALUES (?, 'decision', 'x', 1)`, [projectId]);

        await run(`DELETE FROM projects WHERE id = ?`, [projectId]);

        const remaining = await all(`SELECT * FROM project_log_entries WHERE project_id = ?`, [projectId]);
        expect(remaining).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd backend && npx jest migration42.test.ts -v`
Expected: FAIL — `SQLITE_ERROR: no such table: project_log_entries`

- [ ] **Step 3: Agregar la migración 42 en `migrationList.ts`**

Insertar, justo antes del `];` final del archivo (después del objeto de la versión 41, que cierra en la línea 1939 con `    }\n  }`), este objeto nuevo (recordar agregar la coma después del `}` de la versión 41):

```ts
  {
    version: 42,
    description: 'Bitácora inmutable del proyecto (hitos técnicos, aprobaciones, decisiones, cambios de alcance, incidentes) - Fase 6E',
    up: [
      `CREATE TABLE IF NOT EXISTS project_log_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('technical_milestone', 'client_approval', 'decision', 'scope_change', 'incident')),
        description TEXT NOT NULL,
        file_id INTEGER,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_project_log_entries_project ON project_log_entries(project_id)`
    ]
  }
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd backend && npx jest migration42.test.ts -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration42.test.ts
git commit -m "feat(fase6e): migracion v42 - tabla project_log_entries para la bitacora del proyecto"
```

---

### Task 2: `projectLogService.ts`

**Files:**
- Create: `backend/src/services/projectLogService.ts`
- Test: `backend/src/__tests__/services/projectLogService.test.ts`

**Interfaces:**
- Consumes: tabla `project_log_entries` de Task 1.
- Produce (para Task 3): `ProjectLogEntryRow` (`{id, project_id, entry_type, description, file_id, created_by, author_name, created_at}`), `ProjectLogEntryType` (unión de los 5 valores), y la clase `ProjectLogService` con:
  - `getForProject(projectId: number): Promise<ProjectLogEntryRow[]>`
  - `create(projectId: number, userId: number, entryType: ProjectLogEntryType, description: string, fileId: number | null): Promise<ProjectLogEntryRow>`
  - `findById(id: number): Promise<ProjectLogEntryRow | undefined>`
  - Export: `export const projectLogService = new ProjectLogService();`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/__tests__/services/projectLogService.test.ts`:

```ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { ProjectLogService } from '../../services/projectLogService';

describe('ProjectLogService.getForProject', () => {
    let service: ProjectLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectLogService();
    });

    it('devuelve las entradas del proyecto ordenadas de mas nueva a mas vieja', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { id: 2, project_id: 7, entry_type: 'decision', description: 'Segunda', file_id: null, created_by: 1, author_name: 'Ana', created_at: '2026-09-27' }
        ]);

        const result = await service.getForProject(7);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY l.created_at DESC, l.id DESC'),
            [7]
        );
        expect(result).toHaveLength(1);
    });
});

describe('ProjectLogService.create', () => {
    let service: ProjectLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectLogService();
    });

    it('inserta la entrada, recorta el texto y devuelve la fila creada', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 10, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({
            id: 10, project_id: 7, entry_type: 'incident', description: 'Caída del servicio', file_id: null, created_by: 3, author_name: 'Ana', created_at: '2026-09-27'
        });

        const result = await service.create(7, 3, 'incident', '  Caída del servicio  ', null);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO project_log_entries'),
            [7, 'incident', 'Caída del servicio', null, 3]
        );
        expect(result.id).toBe(10);
    });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd backend && npx jest projectLogService.test.ts -v`
Expected: FAIL — `Cannot find module '../../services/projectLogService'`

- [ ] **Step 3: Implementar el servicio**

Crear `backend/src/services/projectLogService.ts`:

```ts
import { db } from '../database/database';

export type ProjectLogEntryType = 'technical_milestone' | 'client_approval' | 'decision' | 'scope_change' | 'incident';

export interface ProjectLogEntryRow {
    id: number;
    project_id: number;
    entry_type: ProjectLogEntryType;
    description: string;
    file_id: number | null;
    created_by: number;
    author_name: string;
    created_at: string;
}

const SELECT_FIELDS = `
    l.id, l.project_id, l.entry_type, l.description, l.file_id, l.created_by, u.full_name as author_name, l.created_at
`;

/**
 * Bitácora inmutable por proyecto (v42): solo alta y lectura, nunca update/delete.
 */
export class ProjectLogService {
    async getForProject(projectId: number): Promise<ProjectLogEntryRow[]> {
        return db.query(`
            SELECT ${SELECT_FIELDS}
            FROM project_log_entries l
            JOIN users u ON l.created_by = u.id
            WHERE l.project_id = ?
            ORDER BY l.created_at DESC, l.id DESC
        `, [projectId]);
    }

    async create(
        projectId: number,
        userId: number,
        entryType: ProjectLogEntryType,
        description: string,
        fileId: number | null
    ): Promise<ProjectLogEntryRow> {
        const result = await db.run(
            `INSERT INTO project_log_entries (project_id, entry_type, description, file_id, created_by) VALUES (?, ?, ?, ?, ?)`,
            [projectId, entryType, description.trim(), fileId, userId]
        );

        return this.findById(result.id as number) as Promise<ProjectLogEntryRow>;
    }

    async findById(id: number): Promise<ProjectLogEntryRow | undefined> {
        return db.get(`
            SELECT ${SELECT_FIELDS}
            FROM project_log_entries l
            JOIN users u ON l.created_by = u.id
            WHERE l.id = ?
        `, [id]);
    }
}

export const projectLogService = new ProjectLogService();
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd backend && npx jest projectLogService.test.ts -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/projectLogService.ts backend/src/__tests__/services/projectLogService.test.ts
git commit -m "feat(fase6e): projectLogService para la bitacora inmutable del proyecto"
```

---

### Task 3: Endpoints de bitácora en `projectController.ts` + rutas

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (agregar import de `projectLogService`, una constante estática con los 5 tipos válidos, el método privado `canWriteProjectLog`, y los métodos `getProjectLogEntries`/`createProjectLogEntry`, cerca de los métodos de comentarios existentes, después de `deleteProjectComment`/antes de `getProjectMentionableUsers` — o inmediatamente después, el orden exacto no importa mientras queden dentro de la clase)
- Modify: `backend/src/routes/projectRoutes.ts:92` (agregar las 2 rutas nuevas justo después de la línea `router.get('/:id/mentionable-users', ...)`)
- Test: `backend/src/__tests__/controllers/projectController.logEntries.test.ts` (crear)

**Interfaces:**
- Consumes: `projectLogService` (Task 2), `activityLogService.logActivity` (ya existente), `db.get`/`db.run` (mock en test), `this.hasProjectAccess` (ya existente en la clase, línea 668).
- Produce: `GET /api/projects/:id/log-entries` → `200` con `ProjectLogEntryRow[]`; `POST /api/projects/:id/log-entries` (body `{entry_type, description, file_id?}`) → `201` con la fila creada.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/projectController.logEntries.test.ts`:

```ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getProjectActivity: jest.fn(), logActivity: jest.fn() }
}));
jest.mock('../../services/commentService', () => ({
    commentService: {
        getForEntity: jest.fn(), create: jest.fn(), findById: jest.fn(), update: jest.fn(), delete: jest.fn(), getMentionableUsers: jest.fn()
    }
}));
jest.mock('../../services/projectLogService', () => ({
    projectLogService: { getForProject: jest.fn(), create: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { projectLogService } from '../../services/projectLogService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - bitácora del proyecto', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    describe('getProjectLogEntries', () => {
        it('devuelve las entradas si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (projectLogService.getForProject as jest.Mock).mockResolvedValue([{ id: 1, entry_type: 'decision' }]);
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectLogEntries(req, res);

            expect(projectLogService.getForProject).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, entry_type: 'decision' }]);
        });

        it('devuelve 403 si un rpa_developer sin pertenencia intenta leer la bitácora', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectLogEntries(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(projectLogService.getForProject).not.toHaveBeenCalled();
        });
    });

    describe('createProjectLogEntry', () => {
        it('team_lead puede escribir en la bitácora de cualquier proyecto', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            (projectLogService.create as jest.Mock).mockResolvedValue({ id: 5, entry_type: 'decision', description: 'Nueva' });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: 'Nueva' },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(projectLogService.create).toHaveBeenCalledWith(7, 1, 'decision', 'Nueva', null);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'log_entry', 5, 'created', null, expect.any(Object));
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'project', 7, 'log_entry_created', null, { log_entry_id: 5, entry_type: 'decision' });
        });

        it('el responsable del proyecto puede escribir en su propia bitácora', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 4, created_by: 3 });
            (projectLogService.create as jest.Mock).mockResolvedValue({ id: 6, entry_type: 'incident', description: 'Caída' });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'incident', description: 'Caída' },
                user: { id: 4, role: 'rpa_developer' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('un rpa_developer que no es responsable ni creador de ESE proyecto no puede escribir, aunque tenga acceso de lectura via project_lead global', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 4, created_by: 3 });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'incident', description: 'Caída' },
                user: { id: 9, role: 'rpa_operations' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });

        it('devuelve 400 si entry_type no es uno de los 5 tipos válidos', async () => {
            const req = {
                params: { id: '7' },
                body: { entry_type: 'invalido', description: 'x' },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });

        it('devuelve 400 si description viene vacía', async () => {
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: '   ' },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });

        it('si viene file_id, inserta la asociacion en file_associations para que cualquiera con acceso pueda descargarlo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            (projectLogService.create as jest.Mock).mockResolvedValue({ id: 5, entry_type: 'decision', description: 'Nueva', file_id: 99 });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: 'Nueva', file_id: 99 },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO file_associations'),
                [99, 7, 1, 99, 7]
            );
        });
    });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && npx jest projectController.logEntries.test.ts -v`
Expected: FAIL — `controller.getProjectLogEntries is not a function`

- [ ] **Step 3: Agregar el import y la constante de tipos válidos**

En `backend/src/controllers/projectController.ts`, agregar el import junto a los demás (línea 9, después de `import { commentService } from '../services/commentService';`):

```ts
import { projectLogService, ProjectLogEntryType } from '../services/projectLogService';
```

Y agregar, junto a las demás constantes estáticas de la clase (después de `FINANCIAL_LOG_FIELDS`, línea 38):

```ts
    private static readonly LOG_ENTRY_TYPES: ProjectLogEntryType[] = [
        'technical_milestone', 'client_approval', 'decision', 'scope_change', 'incident'
    ];
```

- [ ] **Step 4: Agregar `canWriteProjectLog` y los 2 métodos nuevos**

Insertar después del método `hasProjectAccess` (línea 668-676), antes de `getProjectComments`:

```ts
    private canWriteProjectLog(
        user: AuthenticatedRequest['user'],
        project: { assigned_to: number | null; created_by: number }
    ): boolean {
        if (user?.role === 'team_lead') return true;
        return project.assigned_to === user?.id || project.created_by === user?.id;
    }

    // GET /api/projects/:id/log-entries - Bitácora inmutable del proyecto
    getProjectLogEntries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

            const entries = await projectLogService.getForProject(projectId);
            res.json(entries);
        } catch (error) {
            logger.error('Get project log entries error:', error);
            res.status(500).json({ error: 'Failed to get project log entries' });
        }
    };

    // POST /api/projects/:id/log-entries - Agregar entrada a la bitácora (inmutable, sin edición/borrado)
    createProjectLogEntry = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);
            const userId = req.user?.id as number;
            const { entry_type, description, file_id } = req.body;

            if (!ProjectController.LOG_ENTRY_TYPES.includes(entry_type)) {
                res.status(400).json({ error: 'Invalid entry_type' });
                return;
            }
            if (!description || typeof description !== 'string' || !description.trim()) {
                res.status(400).json({ error: 'Description is required' });
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
            if (!this.canWriteProjectLog(req.user, project)) {
                res.status(403).json({ error: 'Only the team lead or the project owner/responsible can write to the log' });
                return;
            }

            const entry = await projectLogService.create(projectId, userId, entry_type, description, file_id ?? null);

            if (file_id) {
                await db.run(`INSERT INTO file_associations (file_id, entity_type, entity_id, association_type, created_by)
                    SELECT ?, 'project', ?, 'log_entry', ? WHERE NOT EXISTS (
                        SELECT 1 FROM file_associations WHERE file_id = ? AND entity_type = 'project' AND entity_id = ? AND association_type = 'log_entry'
                    )`, [file_id, projectId, userId, file_id, projectId]);
            }

            await activityLogService.logActivity(userId, 'log_entry', entry.id, 'created', null, entry);
            await activityLogService.logActivity(userId, 'project', projectId, 'log_entry_created', null, { log_entry_id: entry.id, entry_type });

            res.status(201).json(entry);
        } catch (error) {
            logger.error('Create project log entry error:', error);
            res.status(500).json({ error: 'Failed to create project log entry' });
        }
    };
```

- [ ] **Step 5: Agregar las rutas**

En `backend/src/routes/projectRoutes.ts`, insertar después de la línea 92 (`router.get('/:id/mentionable-users', projectController.getProjectMentionableUsers);`):

```ts
// GET/POST /api/projects/:id/log-entries - Bitácora inmutable (hitos técnicos, aprobaciones, decisiones, cambios de alcance, incidentes)
router.get('/:id/log-entries', projectController.getProjectLogEntries);
router.post('/:id/log-entries', projectController.createProjectLogEntry);
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `cd backend && npx jest projectController.logEntries.test.ts -v`
Expected: PASS (8 tests)

- [ ] **Step 7: Correr toda la suite de backend para verificar que no se rompió nada**

Run: `cd backend && npm test`
Expected: todos los tests en verde (incluidos los ~350+ ya existentes)

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.logEntries.test.ts
git commit -m "feat(fase6e): endpoints GET/POST de bitacora del proyecto con permisos propios"
```

---

### Task 4: Huella de actividad en hitos técnicos (`pmoController.ts`)

**Files:**
- Modify: `backend/src/controllers/pmoController.ts` (import de `activityLogService`; instrumentar `createMilestone` línea 324-387, `updateMilestone` línea 390-451, `deleteMilestone` línea 454-537)
- Test: `backend/src/__tests__/controllers/pmoController.milestones.test.ts` (crear — hoy no existe ningún test de estos 3 métodos)

**Interfaces:**
- Consumes: `activityLogService.logActivity` (ya existente, Task previa de Fase 5).
- Produce: acciones nuevas en el timeline del proyecto: `milestone_created`, `milestone_updated` (solo si cambió `status` o `planned_date`), `milestone_deleted`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `backend/src/__tests__/controllers/pmoController.milestones.test.ts`:

```ts
jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn() }
}));

import { Response } from 'express';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { PMOController } from '../../controllers/pmoController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('PMOController - huella de actividad de hitos técnicos', () => {
    let controller: PMOController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new PMOController();
    });

    describe('createMilestone', () => {
        it('loguea la creacion a nivel de hito y a nivel de proyecto', async () => {
            (db.run as jest.Mock).mockResolvedValue({ id: 5, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({ id: 5, project_id: 3, name: 'Entrega v1', status: 'pending', planned_date: '2026-10-01' });
            const req = {
                body: { project_id: 3, name: 'Entrega v1', planned_date: '2026-10-01' },
                user: { id: 1, role: 'team_lead' }
            } as any;
            const res = mockRes();

            await controller.createMilestone(req, res);

            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'milestone', 5, 'created', null, expect.objectContaining({ id: 5 }));
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'project', 3, 'milestone_created', null, expect.objectContaining({ milestone_id: 5, name: 'Entrega v1' }));
        });
    });

    describe('updateMilestone', () => {
        it('devuelve 404 si el hito no existe', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { id: '999' }, body: { status: 'completed' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.updateMilestone(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('loguea a nivel de proyecto cuando cambia el status', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'pending', planned_date: '2026-10-01' })
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'completed', planned_date: '2026-10-01' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { id: '5' }, body: { status: 'completed' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.updateMilestone(req, res);

            expect(activityLogService.logActivity).toHaveBeenCalledWith(
                1, 'project', 3, 'milestone_updated',
                { status: 'pending', planned_date: '2026-10-01' },
                { status: 'completed', planned_date: '2026-10-01' }
            );
        });

        it('NO loguea a nivel de proyecto si solo cambia un campo distinto de status/planned_date', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'pending', planned_date: '2026-10-01', priority: 'medium' })
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'pending', planned_date: '2026-10-01', priority: 'high' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { id: '5' }, body: { priority: 'high' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.updateMilestone(req, res);

            const projectLevelCalls = (activityLogService.logActivity as jest.Mock).mock.calls.filter((call) => call[1] === 'project');
            expect(projectLevelCalls).toHaveLength(0);
            // El log especifico del hito si se sigue registrando (auditoria completa del hito, aunque no cambie status/fecha)
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'milestone', 5, 'updated', expect.any(Object), expect.any(Object));
        });
    });

    describe('deleteMilestone', () => {
        it('loguea el borrado a nivel de hito y de proyecto', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 5, name: 'Entrega v1', project_id: 3, status: 'pending', planned_date: '2026-10-01' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { id: '5' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.deleteMilestone(req, res);

            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'milestone', 5, 'deleted', expect.objectContaining({ id: 5 }), null);
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'project', 3, 'milestone_deleted', expect.objectContaining({ milestone_id: '5', name: 'Entrega v1' }), null);
        });
    });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `cd backend && npx jest pmoController.milestones.test.ts -v`
Expected: FAIL (no se llama a `activityLogService.logActivity`, y `updateMilestone` no devuelve 404 hoy)

- [ ] **Step 3: Agregar el import**

En `backend/src/controllers/pmoController.ts`, línea 3 (después de `import { logger } from '../utils/logger';`):

```ts
import { activityLogService } from '../services/activityLogService';
```

- [ ] **Step 4: Instrumentar `createMilestone`**

Reemplazar el bloque final de `createMilestone` (líneas 373-382):

```ts
            const newMilestone = await db.get(`
                SELECT m.*, u.full_name as responsible_name, p.name as project_name
                FROM project_milestones m
                LEFT JOIN users u ON m.responsible_user_id = u.id
                LEFT JOIN projects p ON m.project_id = p.id
                WHERE m.id = ?
            `, [result.id]);

            logger.info(`Milestone created: ${name} for project ${project_id}`);
            res.status(201).json(newMilestone);
```

por:

```ts
            const newMilestone = await db.get(`
                SELECT m.*, u.full_name as responsible_name, p.name as project_name
                FROM project_milestones m
                LEFT JOIN users u ON m.responsible_user_id = u.id
                LEFT JOIN projects p ON m.project_id = p.id
                WHERE m.id = ?
            `, [result.id]);

            await activityLogService.logActivity(req.user?.id, 'milestone', Number(result.id), 'created', null, newMilestone);
            await activityLogService.logActivity(req.user?.id, 'project', Number(project_id), 'milestone_created', null, {
                milestone_id: result.id,
                name,
                planned_date,
                status: newMilestone.status
            });

            logger.info(`Milestone created: ${name} for project ${project_id}`);
            res.status(201).json(newMilestone);
```

- [ ] **Step 5: Instrumentar `updateMilestone` (agregar 404 real + antes/después de status y fecha)**

Reemplazar el inicio del método (líneas 390-399):

```ts
    updateMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated directly
            delete updates.id;
            delete updates.created_by;
            delete updates.created_at;
```

por:

```ts
    updateMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updates = req.body;

            const existing = await db.get(`SELECT * FROM project_milestones WHERE id = ?`, [id]);
            if (!existing) {
                res.status(404).json({ error: 'Milestone not found' });
                return;
            }

            // Remove fields that shouldn't be updated directly
            delete updates.id;
            delete updates.created_by;
            delete updates.created_at;
```

Y reemplazar el final del método (líneas 437-446):

```ts
            const updatedMilestone = await db.get(`
                SELECT m.*, u.full_name as responsible_name, p.name as project_name
                FROM project_milestones m
                LEFT JOIN users u ON m.responsible_user_id = u.id
                LEFT JOIN projects p ON m.project_id = p.id
                WHERE m.id = ?
            `, [id]);

            logger.info(`Milestone updated: ${id}`);
            res.json(updatedMilestone);
```

por:

```ts
            const updatedMilestone = await db.get(`
                SELECT m.*, u.full_name as responsible_name, p.name as project_name
                FROM project_milestones m
                LEFT JOIN users u ON m.responsible_user_id = u.id
                LEFT JOIN projects p ON m.project_id = p.id
                WHERE m.id = ?
            `, [id]);

            await activityLogService.logActivity(req.user?.id, 'milestone', Number(id), 'updated', existing, updatedMilestone);

            const statusChanged = existing.status !== updatedMilestone.status;
            const dateChanged = existing.planned_date !== updatedMilestone.planned_date;
            if (statusChanged || dateChanged) {
                await activityLogService.logActivity(req.user?.id, 'project', existing.project_id, 'milestone_updated', {
                    status: existing.status,
                    planned_date: existing.planned_date
                }, {
                    status: updatedMilestone.status,
                    planned_date: updatedMilestone.planned_date
                });
            }

            logger.info(`Milestone updated: ${id}`);
            res.json(updatedMilestone);
```

- [ ] **Step 6: Instrumentar `deleteMilestone` (ampliar el `existsCheck` y loguear tras el commit)**

Reemplazar (línea 464-466):

```ts
                const existsCheck = await db.get(`
                    SELECT id, name FROM project_milestones WHERE id = ?
                `, [id]);
```

por:

```ts
                const existsCheck = await db.get(`
                    SELECT id, name, project_id, status, planned_date FROM project_milestones WHERE id = ?
                `, [id]);
```

Y reemplazar (líneas 495-502):

```ts
                await db.commit();
                
                logger.info(`Milestone deleted successfully: ${id} (${milestoneName}) by user ${userId}`);
                res.json({ 
                    success: true, 
                    message: 'Milestone deleted successfully',
                    deletedId: id
                });
```

por:

```ts
                await db.commit();

                await activityLogService.logActivity(userId, 'milestone', Number(id), 'deleted', existsCheck, null);
                await activityLogService.logActivity(userId, 'project', existsCheck.project_id, 'milestone_deleted', {
                    milestone_id: id,
                    name: milestoneName,
                    status: existsCheck.status,
                    planned_date: existsCheck.planned_date
                }, null);

                logger.info(`Milestone deleted successfully: ${id} (${milestoneName}) by user ${userId}`);
                res.json({ 
                    success: true, 
                    message: 'Milestone deleted successfully',
                    deletedId: id
                });
```

- [ ] **Step 7: Correr los tests y verificar que pasan**

Run: `cd backend && npx jest pmoController.milestones.test.ts -v`
Expected: PASS (6 tests)

- [ ] **Step 8: Correr toda la suite de backend**

Run: `cd backend && npm test`
Expected: todos los tests en verde (verificar en particular que `pmoController.gantt.test.ts`/`teamWorkload.test.ts` siguen pasando, ya que tocamos el mismo archivo)

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/pmoController.ts backend/src/__tests__/controllers/pmoController.milestones.test.ts
git commit -m "feat(fase6e): huella de actividad al crear/editar/borrar hitos tecnicos"
```

---

### Task 5: Frontend — `api.ts` + labels nuevos en `ActivityTimeline.tsx`

**Files:**
- Modify: `frontend/src/services/api.ts` (agregar 2 métodos nuevos, cerca de `getProjectActivity` línea 389-392)
- Modify: `frontend/src/components/activity/ActivityTimeline.tsx` (agregar 4 entradas a `ACTION_LABEL` y `SELF_CONTAINED_ACTIONS`)
- Test: `frontend/src/__tests__/components/ActivityTimeline.test.tsx` (si no existe, crear uno mínimo; si existe, extenderlo — verificar primero con `find frontend/src/__tests__ -iname "ActivityTimeline*"`)

**Interfaces:**
- Produce (para Task 6): `apiService.getProjectLogEntries(projectId: number): Promise<any[]>`, `apiService.createProjectLogEntry(projectId: number, payload: {entry_type: string; description: string; file_id?: number | null}): Promise<any>`.

- [ ] **Step 1: Verificar si ya existe un test de `ActivityTimeline`**

Run: `find "frontend/src/__tests__" -iname "ActivityTimeline*" 2>/dev/null || true`

Si no existe ninguno, escribir uno nuevo mínimo en `frontend/src/__tests__/components/ActivityTimeline.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectActivity: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';

describe('ActivityTimeline - eventos de hitos y bitácora', () => {
  it('muestra un label legible para milestone_created (self-contained, sin sufijo de entidad)', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([
      { id: 1, user_id: 1, user_name: 'Ana', entity_type: 'project', entity_id: 3, action: 'milestone_created', old_values: null, new_values: { name: 'Entrega v1' }, created_at: '2026-09-27T10:00:00Z' }
    ]);

    render(<ActivityTimeline projectId={3} />);

    expect(await screen.findByText('agregó un hito técnico nuevo')).toBeInTheDocument();
  });

  it('muestra un label legible para log_entry_created', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([
      { id: 2, user_id: 1, user_name: 'Ana', entity_type: 'project', entity_id: 3, action: 'log_entry_created', old_values: null, new_values: { entry_type: 'decision' }, created_at: '2026-09-27T10:00:00Z' }
    ]);

    render(<ActivityTimeline projectId={3} />);

    expect(await screen.findByText('agregó una entrada a la bitácora del proyecto')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd frontend && npx vitest run ActivityTimeline.test.tsx`
Expected: FAIL — el texto esperado no aparece (se renderiza el `action` crudo)

- [ ] **Step 3: Agregar los labels nuevos**

En `frontend/src/components/activity/ActivityTimeline.tsx`, reemplazar (líneas 8-18):

```ts
const ACTION_LABEL: Record<string, string> = {
  created: 'creó',
  updated: 'actualizó',
  deleted: 'eliminó',
  moved: 'movió',
  board_created: 'creó un tablero nuevo',
  tasks_batch_created: 'creó varias tareas en lote',
  tasks_batch_deleted: 'eliminó varias tareas en lote',
  task_deleted: 'eliminó una tarea de',
  created_from_quote: 'creó desde cotización'
};

// Acciones cuyo label es autocontenido (no se les debe anexar el sufijo de entidad).
const SELF_CONTAINED_ACTIONS = new Set(['board_created', 'tasks_batch_created', 'tasks_batch_deleted']);
```

por:

```ts
const ACTION_LABEL: Record<string, string> = {
  created: 'creó',
  updated: 'actualizó',
  deleted: 'eliminó',
  moved: 'movió',
  board_created: 'creó un tablero nuevo',
  tasks_batch_created: 'creó varias tareas en lote',
  tasks_batch_deleted: 'eliminó varias tareas en lote',
  task_deleted: 'eliminó una tarea de',
  created_from_quote: 'creó desde cotización',
  milestone_created: 'agregó un hito técnico nuevo',
  milestone_updated: 'cambió el estado o la fecha de un hito técnico',
  milestone_deleted: 'eliminó un hito técnico',
  log_entry_created: 'agregó una entrada a la bitácora del proyecto'
};

// Acciones cuyo label es autocontenido (no se les debe anexar el sufijo de entidad).
const SELF_CONTAINED_ACTIONS = new Set([
  'board_created', 'tasks_batch_created', 'tasks_batch_deleted',
  'milestone_created', 'milestone_updated', 'milestone_deleted', 'log_entry_created'
]);
```

- [ ] **Step 4: Agregar los métodos a `api.ts`**

En `frontend/src/services/api.ts`, después de `getProjectActivity` (línea 389-392):

```ts
  async getProjectLogEntries(projectId: number): Promise<any[]> {
    const response = await this.api.get(`/projects/${projectId}/log-entries`);
    return response.data;
  }

  async createProjectLogEntry(projectId: number, payload: { entry_type: string; description: string; file_id?: number | null }): Promise<any> {
    const response = await this.api.post(`/projects/${projectId}/log-entries`, payload);
    return response.data;
  }
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `cd frontend && npx vitest run ActivityTimeline.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/components/activity/ActivityTimeline.tsx frontend/src/__tests__/components/ActivityTimeline.test.tsx
git commit -m "feat(fase6e): labels de timeline y metodos de api para hitos/bitacora"
```

---

### Task 6: Frontend — componente `ProjectMilestonesAndLog.tsx`

**Files:**
- Create: `frontend/src/components/projects/ProjectMilestonesAndLog.tsx`
- Test: `frontend/src/__tests__/components/ProjectMilestonesAndLog.test.tsx`

**Interfaces:**
- Consumes: `apiService.getProjectPMOMetrics(projectId)` (ya existente, usado hoy por `ProjectPMOView.tsx:109`, devuelve `{project, milestones: {list: Milestone[]}, ...}`), `apiService.getProjectLogEntries`/`createProjectLogEntry` (Task 5), `fileService.uploadFiles` (ya existente).
- Props: `{ projectId: number; canWriteLog: boolean }` (el cálculo de `canWriteLog` se hace en `ProjectDetailPage.tsx`, Task 7, con la misma info de proyecto que ya tiene cargada — no se vuelve a resolver el permiso client-side de forma redundante en otro lado).

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/src/__tests__/components/ProjectMilestonesAndLog.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectPMOMetrics: vi.fn(),
    getProjectLogEntries: vi.fn(),
    createProjectLogEntry: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { ProjectMilestonesAndLog } from '@/components/projects/ProjectMilestonesAndLog';

describe('ProjectMilestonesAndLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjectPMOMetrics as any).mockResolvedValue({
      milestones: { list: [{ id: 1, name: 'Entrega v1', status: 'pending', planned_date: '2026-10-01' }] }
    });
  });

  it('muestra el resumen de hitos y las entradas de bitácora existentes', async () => {
    (apiService.getProjectLogEntries as any).mockResolvedValue([
      { id: 1, entry_type: 'decision', description: 'Se decidió posponer', author_name: 'Ana', created_at: '2026-09-27T10:00:00Z', file_id: null }
    ]);

    render(<ProjectMilestonesAndLog projectId={7} canWriteLog={false} />);

    expect(await screen.findByText('Entrega v1')).toBeInTheDocument();
    expect(await screen.findByText('Se decidió posponer')).toBeInTheDocument();
  });

  it('no muestra el formulario de alta si canWriteLog es false', async () => {
    (apiService.getProjectLogEntries as any).mockResolvedValue([]);

    render(<ProjectMilestonesAndLog projectId={7} canWriteLog={false} />);

    await waitFor(() => expect(apiService.getProjectLogEntries).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /agregar entrada/i })).not.toBeInTheDocument();
  });

  it('permite crear una entrada de bitácora si canWriteLog es true', async () => {
    (apiService.getProjectLogEntries as any).mockResolvedValue([]);
    (apiService.createProjectLogEntry as any).mockResolvedValue({
      id: 2, entry_type: 'incident', description: 'Caída del servicio', author_name: 'Ana', created_at: '2026-09-27T11:00:00Z', file_id: null
    });

    render(<ProjectMilestonesAndLog projectId={7} canWriteLog={true} />);
    await waitFor(() => expect(apiService.getProjectLogEntries).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText(/descripción/i), 'Caída del servicio');
    await userEvent.click(screen.getByRole('button', { name: /agregar entrada/i }));

    await waitFor(() => expect(apiService.createProjectLogEntry).toHaveBeenCalledWith(7, { entry_type: 'technical_milestone', description: 'Caída del servicio', file_id: null }));
    expect(await screen.findByText('Caída del servicio')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `cd frontend && npx vitest run ProjectMilestonesAndLog.test.tsx`
Expected: FAIL — `Cannot find module '@/components/projects/ProjectMilestonesAndLog'`

- [ ] **Step 3: Implementar el componente**

Crear `frontend/src/components/projects/ProjectMilestonesAndLog.tsx`:

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Timeline, Typography, Button, Select, Input, List, Empty, message, Space, Tag } from 'antd';
import { FundOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { fileService } from '@/services/fileService';
import dayjs from 'dayjs';

const { Text } = Typography;
const { TextArea } = Input;

interface MilestoneSummary {
  id: number;
  name: string;
  status: string;
  planned_date: string;
}

interface LogEntry {
  id: number;
  entry_type: string;
  description: string;
  author_name: string;
  created_at: string;
  file_id: number | null;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  technical_milestone: 'Hito técnico',
  client_approval: 'Aprobación del cliente',
  decision: 'Decisión',
  scope_change: 'Cambio de alcance',
  incident: 'Incidente'
};

const ENTRY_TYPE_OPTIONS = Object.entries(ENTRY_TYPE_LABELS).map(([value, label]) => ({ value, label }));

interface ProjectMilestonesAndLogProps {
  projectId: number;
  canWriteLog: boolean;
}

export const ProjectMilestonesAndLog: React.FC<ProjectMilestonesAndLogProps> = ({ projectId, canWriteLog }) => {
  const navigate = useNavigate();
  const [milestones, setMilestones] = useState<MilestoneSummary[]>([]);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entryType, setEntryType] = useState<string>('technical_milestone');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [pmoData, logEntries] = await Promise.all([
        apiService.getProjectPMOMetrics(projectId).catch(() => null),
        apiService.getProjectLogEntries(projectId)
      ]);
      setMilestones(pmoData?.milestones?.list ?? []);
      setEntries(logEntries);
    } catch (error) {
      message.error('No se pudo cargar la información de hitos y bitácora');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateEntry = async () => {
    const trimmed = description.trim();
    if (!trimmed) return;

    try {
      setPosting(true);
      let fileId: number | null = null;
      if (file) {
        const uploadResult = await fileService.uploadFiles([file]);
        fileId = uploadResult.files[0]?.id ?? null;
      }

      const created = await apiService.createProjectLogEntry(projectId, {
        entry_type: entryType,
        description: trimmed,
        file_id: fileId
      });
      setEntries((prev) => [created, ...prev]);
      setDescription('');
      setFile(null);
    } catch (error) {
      message.error('No se pudo agregar la entrada a la bitácora');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return <Card loading title="Hitos y bitácora" />;
  }

  return (
    <div>
      <Card
        size="small"
        title={
          <span>
            <FundOutlined /> Hitos técnicos
          </span>
        }
        extra={<Button size="small" onClick={() => navigate(`/pmo/gantt/${projectId}`)}>Ver cronograma completo</Button>}
        style={{ marginBottom: 16 }}
      >
        {milestones.length > 0 ? (
          <Timeline
            items={milestones.slice(0, 5).map((milestone) => ({
              key: milestone.id,
              children: (
                <div>
                  <Text strong>{milestone.name}</Text>{' '}
                  <Tag>{milestone.status}</Tag>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {milestone.planned_date ? dayjs(milestone.planned_date).format('DD/MM/YYYY') : 'Sin fecha'}
                  </Text>
                </div>
              )
            }))}
          />
        ) : (
          <Empty description="Sin hitos definidos" />
        )}
      </Card>

      <Card size="small" title="Bitácora del proyecto">
        {canWriteLog && (
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Select
              value={entryType}
              onChange={setEntryType}
              options={ENTRY_TYPE_OPTIONS}
              style={{ width: 240 }}
            />
            <TextArea
              placeholder="Descripción de la entrada"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoSize={{ minRows: 2 }}
            />
            <input
              type="file"
              aria-label="Adjuntar archivo"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button type="primary" onClick={handleCreateEntry} loading={posting}>
              Agregar entrada
            </Button>
          </Space>
        )}

        <List
          size="small"
          dataSource={entries}
          locale={{ emptyText: 'Sin entradas en la bitácora todavía' }}
          renderItem={(entry) => (
            <List.Item>
              <List.Item.Meta
                title={
                  <Space>
                    <Tag>{ENTRY_TYPE_LABELS[entry.entry_type] || entry.entry_type}</Tag>
                    <Text type="secondary" style={{ fontWeight: 'normal', fontSize: 12 }}>
                      {entry.author_name} · {dayjs(entry.created_at).format('DD/MM/YYYY HH:mm')}
                    </Text>
                  </Space>
                }
                description={
                  <div>
                    <Text>{entry.description}</Text>
                    {entry.file_id && (
                      <div>
                        <a href={fileService.getDownloadUrl(entry.file_id)} target="_blank" rel="noreferrer">
                          Descargar adjunto
                        </a>
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `cd frontend && npx vitest run ProjectMilestonesAndLog.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: `tsc --noEmit` del frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/projects/ProjectMilestonesAndLog.tsx frontend/src/__tests__/components/ProjectMilestonesAndLog.test.tsx
git commit -m "feat(fase6e): componente de resumen de hitos y bitacora del proyecto"
```

---

### Task 7: Frontend — pestaña "Hitos y bitácora" en `ProjectDetailPage.tsx`

**Files:**
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx` (import del componente, agregar `'milestones-log'` a `projectTabOrder`, agregar el objeto de la pestaña nueva)

**Interfaces:**
- Consumes: `ProjectMilestonesAndLog` (Task 6), `project` y `user` ya disponibles en el estado del componente (`project.assigned_to`, `project.created_by`, `user.id`, `user.role`).

- [ ] **Step 1: Agregar el import**

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, después de la línea 45 (`import { ProjectPMOView } from '@/components/projects/ProjectPMOView';`):

```ts
import { ProjectMilestonesAndLog } from '@/components/projects/ProjectMilestonesAndLog';
```

- [ ] **Step 2: Agregar la clave nueva a `projectTabOrder`**

Reemplazar (línea 61):

```ts
const projectTabOrder = ['overview', 'commercial', 'billing', 'pmo', 'lifecycle', 'files', 'evidence', 'comments', 'ai-analytics'];
```

por:

```ts
const projectTabOrder = ['overview', 'commercial', 'billing', 'pmo', 'milestones-log', 'lifecycle', 'files', 'evidence', 'comments', 'ai-analytics'];
```

- [ ] **Step 3: Agregar el objeto de la pestaña nueva**

Insertar, dentro del array de `items` del `Tabs`, justo después del bloque de la pestaña `'pmo'` (que cierra en la línea 609 con `}`, antes de la coma que abre el bloque de `'lifecycle'` en la línea 610):

```ts
            {
              key: 'milestones-log',
              label: (
                <span>
                  <FundOutlined />
                  Hitos y bitácora
                </span>
              ),
              children: (
                <ProjectMilestonesAndLog
                  projectId={project.id}
                  canWriteLog={
                    user?.role === 'team_lead' ||
                    project.assigned_to === user?.id ||
                    project.created_by === user?.id
                  }
                />
              )
            },
```

- [ ] **Step 4: `tsc --noEmit` del frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores nuevos

- [ ] **Step 5: Correr toda la suite de frontend**

Run: `cd frontend && npm test`
Expected: todos los tests en verde

- [ ] **Step 6: Verificación manual en navegador**

Levantar `cd backend && npm run dev` y `cd frontend && npm run dev`, entrar a un proyecto existente, confirmar: (a) aparece la pestaña "Hitos y bitácora" entre "Hitos y PMO" y "Ciclo de vida"; (b) el resumen de hitos se ve igual que en "Hitos y PMO"; (c) como `team_lead` se puede agregar una entrada de bitácora con y sin adjunto; (d) la entrada aparece también en la pestaña "Comentarios"... no, en la pestaña de Actividad/timeline de arriba de la ficha del proyecto con el label correcto; (e) con un usuario `rpa_developer` sin pertenencia al proyecto, la pestaña de comentarios/bitácora da 403 (no se ve contenido).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/projects/ProjectDetailPage.tsx
git commit -m "feat(fase6e): pestana Hitos y bitacora en la ficha del proyecto"
```

---

## Revisión final de toda la rama

Al terminar las 7 tareas, correr una revisión final de todo el diff de `fase6e-bitacora-tecnica` contra `main` (primer commit de esta fase en adelante, no `main..HEAD` completo si hubiera commits de otras fases mezclados — verificar con `git log main..HEAD` que solo aparecen los 7 commits de este plan). Puntos a verificar explícitamente en esa revisión, además de lo genérico:
- Que `updateMilestone` ahora devuelve 404 real no rompa a ningún consumidor existente del frontend que dependa del comportamiento silencioso anterior (buscar usos de `updateMilestone`/`PUT /api/pmo/milestones/:id` en el frontend).
- Que el doble log (`entity_type='milestone'` + `entity_type='project'`) no duplique visualmente la entrada en el timeline (el timeline de proyecto solo lee `entity_type='project'`, así que no debería, pero confirmarlo).
- Que ningún test nuevo dependa de orden de ejecución entre `describe` blocks de forma frágil.
