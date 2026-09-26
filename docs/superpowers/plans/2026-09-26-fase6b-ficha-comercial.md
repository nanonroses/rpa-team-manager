# Fase 6 · Sub-proyecto B — Ficha comercial del proyecto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el alta comercial completa de un proyecto: clientes con contactos múltiples, comerciales, una etapa comercial separada del estado operativo (En cotización → En ejecución → Perdido), cotizaciones con historial y aprobación, documentos tipificados, horas presupuestadas por persona en el equipo, y un nuevo formulario de alta de proyecto en pasos que reemplaza el modal actual de un solo paso.

**Architecture:** Todo nuevo, sin romper lo que dejó el sub-proyecto A. (1) Migración única v38 crea `client_contacts`, `sales_reps`, `project_quotes` y agrega `projects.sales_rep_id/commercial_stage/client_approved_at` + `project_assignments.budgeted_hours`, con backfill de `commercial_stage='approved'` para todo proyecto ya existente (ya está en ejecución, no pasó por el flujo de cotización). (2) Dos controllers nuevos (`clientController`, `salesRepController`) con CRUD simple + desactivación (nunca DELETE). (3) `ProjectController` gana métodos de cotizaciones (subir versión, aprobar versión) y de etapa comercial (OK del cliente, marcar perdido), reutilizando los helpers financieros ya creados en el sub-proyecto A (`upsertProjectFinancials`, `stripFinancialFields`). El precio/horas del proyecto se bloquean en `updateProject` una vez `commercial_stage='approved'`, salvo que se apruebe una nueva cotización. (4) El frontend reemplaza `CreateProjectModal` por un wizard de 5 pasos, agrega pantallas de Clientes/Comerciales, y suma secciones de Cotizaciones/Etapa/Documentos tipificados a `ProjectDetailPage` reutilizando `FileManager` tal cual (sin tocarlo) para los documentos tipificados, con una instancia por tipo.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend, Jest + ts-jest + supertest). React 18/TypeScript/Ant Design 5 (frontend, Vitest + Testing Library). Sin dependencias nuevas.

**Spec:** `C:\Users\nanon\.claude\plans\pasted-content-id-c56b-vamos-al-declarative-crane.md` — sección "Sub-proyecto B — Ficha comercial del proyecto (nuevo alta)"; y el diseño de 10 secciones acordado en la conversación de brainstorming de esta rama (clientes/contactos, comerciales, etapa comercial, cotizaciones con historial, documentos tipificados, equipo con horas, wizard de alta en 5 pasos).

## Global Constraints

- Rama nueva `fase6b-ficha-comercial` creada desde `main` (que ya tiene el sub-proyecto A mergeado). No mergear ni abrir PR sin preguntar al usuario.
- Acceso a BD siempre vía `db.query` / `db.get` / `db.run` (nunca `db.all`). Firmas reales (`backend/src/database/database.ts`): `query(sql, params[]) => Promise<any[]>`, `get(sql, params[]) => Promise<any>`, `run(sql, params[]) => Promise<{ id?: number; changes: number }>`, `beginTransaction()`, `commit()`, `rollback()`.
- Roles reales (CHECK de `users.role`, migración 1): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. No existe rol de comercial ni de facturación todavía (llega en el Sub-proyecto D).
- Última migración aplicada antes de esta rama: **v37**. Esta rama agrega **v38** en un solo archivo/tarea.
- `projects.status` (CHECK, migración 1) sigue siendo solo `'active' | 'on_hold' | 'completed' | 'cancelled'` — es el estado **operativo**, no se toca. La etapa **comercial** nueva (`commercial_stage`) es una columna aparte: `'quoting' | 'approved' | 'lost'`.
- Helpers financieros ya existentes en `ProjectController` (sub-proyecto A, no se reescriben, se reutilizan): `FINANCIAL_FIELD_MAP`, `TEAM_LEAD_ONLY_FINANCIAL_FIELDS`, `FINANCIAL_RESPONSE_FIELDS`, `financialInputFor(user, body)`, `upsertProjectFinancials(projectId, input)`, `stripFinancialFields(user, row)`.
- Datos financieros de una cotización (`amount`, `hourly_rate`) se ocultan a quien no sea `team_lead`, igual que `sale_price` hoy. `pricing_model`, `status`, `version`, `currency`, `file_id`, `notes`, fechas de una cotización SÍ son visibles a cualquier rol con acceso al proyecto.
- Clientes, contactos y comerciales: crear/editar solo `['team_lead', 'rpa_operations']`; cualquier rol autenticado puede listarlos (para elegir cliente/comercial al crear un proyecto). Se desactivan (`is_active = 0`), nunca se eliminan.
- Cotizaciones: `['team_lead', 'rpa_operations']` pueden subir versiones; solo `team_lead` aprueba una versión (y solo `team_lead` marca "OK del cliente" y "Perdido").
- Tests backend con mocks simples: `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))`. Tests con SQLite real (preferidos para todo lo que toque integridad relacional: migración, clientes+contactos, cotizaciones, etapa comercial): helper ya existente `backend/src/__tests__/helpers/realTestDb.ts` (`createRealTestDb`, `realDbHolder`, `realDbProxy`, `seedBasicUsers`).
- Tests frontend: Vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest'`), molde `frontend/src/__tests__/components/TeamCostsCard.test.tsx`.
- Textos visibles al usuario en español.
- Cada tarea termina con `npx tsc --noEmit` limpio en el paquete tocado y commit propio.

## Decisiones de negocio confirmadas en el brainstorming de esta rama (PREVALECEN sobre cualquier otra parte de este plan)

1. Clientes y comerciales los crean/editan `team_lead` y `rpa_operations` (mismo criterio que crear proyectos).
2. Cotizaciones: `team_lead` y `rpa_operations` pueden subir versiones; **solo `team_lead` aprueba** la versión que fija el precio final.
3. Tras el "OK del cliente" (paso a `commercial_stage='approved'`), precio y horas quedan **bloqueados**: cambiarlos exige subir y aprobar una nueva versión de cotización.
4. "Perdido": el `team_lead` lo marca **manualmente en cualquier momento** durante la cotización. Un proyecto perdido se saca del tablero de proyectos activos (`GET /api/projects` lo excluye por defecto) pero no se borra, para reportes futuros.
5. Moneda de las cotizaciones: **CLP, UF y USD** (las tres, ya que `exchange_rates`/`financeService.toCLP` ya soportan UF y USD).
6. Contacto principal de un cliente: **opcional**, no se exige al crear el cliente.

## Review Focus

- **Un proyecto creado antes de esta rama no debe quedar bloqueado en `commercial_stage='quoting'`** (perdería el acceso a hitos técnicos futuros y aparecería como "cotización pendiente" sin serlo): el backfill de la migración v38 debe dejarlo en `'approved'`. Test en Task 1.
- **Editar precio o horas de un proyecto ya en ejecución (`commercial_stage='approved'`) por la vía normal (`PUT /api/projects/:id`) debe rechazarse con 400**, no silenciarse ni aplicarse igual. Test en Task 6.
- **Aprobar una cotización debe reemplazar automáticamente las demás versiones `sent`** del mismo proyecto (nunca quedan dos "vigentes" a la vez, lo que rompería el resumen financiero). Test en Task 5.
- **Un `rpa_developer` no debe ver `amount` ni `hourly_rate` de ninguna cotización**, ni siquiera de una ya aprobada. Test en Task 4 y Task 5.
- **Desactivar un cliente o un contacto no debe romper los proyectos que ya lo referencian** (el proyecto conserva `client_id`, solo deja de aparecer en el selector de clientes activos al crear uno nuevo). Test en Task 2.

---

## Task 1: Migración v38 — clientes/contactos, comerciales, cotizaciones y etapa comercial

**Contexto verificado:** última migración aplicada es v37 (`Corrige monthly_hours/weekly_hours ... Fase 6a`, `backend/src/database/migrationList.ts:1636-1647`). `clients` ya existe (v26) pero sin tabla de contactos. `projects` ya tiene `client_id/area_id/pm_user_id/currency` (v27) pero no `sales_rep_id` ni etapa comercial. `project_assignments` (v18) no tiene columna de horas presupuestadas. SQLite en este proyecto ya soporta `ALTER TABLE ... ADD COLUMN` con `DEFAULT` + `CHECK` en la misma sentencia (precedente real: `project_milestones.responsibility` en la migración v19), así que `commercial_stage` se agrega así directamente, sin reparador aparte.

**Files:**
- Modify: `backend/src/database/migrationList.ts` (agregar migración `version: 38` al final del array)
- Test: `backend/src/__tests__/database/migration038.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Produces (tablas/columnas que consumen las Tasks 2-7): `client_contacts(id, client_id, name, position, email, phone, is_primary, is_active, created_at, updated_at)`, `sales_reps(id, name, email, is_active, created_by, created_at, updated_at)`, `project_quotes(id, project_id, version, pricing_model, amount, currency, hours, hourly_rate, status, file_id, notes, created_by, created_at, approved_by, approved_at)`, `projects.sales_rep_id`, `projects.commercial_stage` (`'quoting'|'approved'|'lost'`, default `'quoting'`), `projects.client_approved_at`, `project_assignments.budgeted_hours`.

- [ ] **Step 1: Test que falla**

Crear `backend/src/__tests__/database/migration038.test.ts`:

```typescript
import { createRealTestDb, RealTestDb } from '../helpers/realTestDb';

async function columnNames(db: RealTestDb, table: string): Promise<string[]> {
    return (await db.query(`PRAGMA table_info(${table})`)).map((c: any) => c.name);
}

describe('Migración v38 - ficha comercial (clientes, comerciales, cotizaciones, etapa comercial)', () => {
    let db: RealTestDb;

    beforeEach(async () => {
        db = await createRealTestDb();
    });

    afterEach(async () => {
        await db.close();
    });

    it('crea client_contacts, sales_reps y project_quotes con sus columnas', async () => {
        expect(await columnNames(db, 'client_contacts')).toEqual(
            expect.arrayContaining(['id', 'client_id', 'name', 'position', 'email', 'phone', 'is_primary', 'is_active'])
        );
        expect(await columnNames(db, 'sales_reps')).toEqual(
            expect.arrayContaining(['id', 'name', 'email', 'is_active', 'created_by'])
        );
        expect(await columnNames(db, 'project_quotes')).toEqual(
            expect.arrayContaining(['id', 'project_id', 'version', 'pricing_model', 'amount', 'currency', 'hours', 'hourly_rate', 'status', 'file_id', 'notes', 'approved_by', 'approved_at'])
        );
    });

    it('agrega sales_rep_id, commercial_stage y client_approved_at a projects', async () => {
        expect(await columnNames(db, 'projects')).toEqual(
            expect.arrayContaining(['sales_rep_id', 'commercial_stage', 'client_approved_at'])
        );
    });

    it('agrega budgeted_hours a project_assignments', async () => {
        expect(await columnNames(db, 'project_assignments')).toContain('budgeted_hours');
    });

    it('un proyecto nuevo nace con commercial_stage = quoting por defecto', async () => {
        const lead = await db.run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('l', 'l@x.cl', 'h', 'L', 'team_lead')`);
        const project = await db.run(`INSERT INTO projects (name, created_by) VALUES ('Nuevo', ?)`, [lead.id]);
        const row = await db.get('SELECT commercial_stage, client_approved_at FROM projects WHERE id = ?', [project.id]);
        expect(row).toEqual({ commercial_stage: 'quoting', client_approved_at: null });
    });

    it('rechaza un commercial_stage fuera de quoting/approved/lost', async () => {
        const lead = await db.run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('l2', 'l2@x.cl', 'h', 'L2', 'team_lead')`);
        await expect(
            db.run(`INSERT INTO projects (name, created_by, commercial_stage) VALUES ('X', ?, 'won')`, [lead.id])
        ).rejects.toThrow();
    });

    it('project_quotes rechaza una moneda o pricing_model fuera de catálogo', async () => {
        const lead = await db.run(`INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('l3', 'l3@x.cl', 'h', 'L3', 'team_lead')`);
        const project = await db.run(`INSERT INTO projects (name, created_by) VALUES ('P', ?)`, [lead.id]);
        await expect(db.run(
            `INSERT INTO project_quotes (project_id, version, pricing_model, amount, currency, created_by) VALUES (?, 1, 'fixed', 100, 'EUR', ?)`,
            [project.id, lead.id]
        )).rejects.toThrow();
        await expect(db.run(
            `INSERT INTO project_quotes (project_id, version, pricing_model, amount, currency, created_by) VALUES (?, 1, 'weird', 100, 'CLP', ?)`,
            [project.id, lead.id]
        )).rejects.toThrow();
    });
});
```

Run: `cd backend && npx jest src/__tests__/database/migration038.test.ts`
Expected: FAIL ("no such table: client_contacts" o similar).

- [ ] **Step 2: Agregar la migración v38**

Al final del array `migrations` en `backend/src/database/migrationList.ts` (después de la migración `version: 37`, que hoy cierra el array con `];`), agregar antes del `];` de cierre:

```typescript
  ,
  {
    version: 38,
    description: 'Fase 6b: ficha comercial (client_contacts, sales_reps, project_quotes, etapa comercial de projects, horas presupuestadas por asignación)',
    up: [
      `CREATE TABLE IF NOT EXISTS sales_reps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(200) NOT NULL,
        email VARCHAR(100),
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS client_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        name VARCHAR(200) NOT NULL,
        position VARCHAR(100),
        email VARCHAR(100),
        phone VARCHAR(50),
        is_primary BOOLEAN NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON client_contacts(client_id)`,

      `CREATE TABLE IF NOT EXISTS project_quotes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        pricing_model VARCHAR(10) NOT NULL CHECK (pricing_model IN ('fixed', 'hourly')),
        amount DECIMAL(14,2) NOT NULL,
        currency VARCHAR(3) NOT NULL CHECK (currency IN ('CLP', 'USD', 'UF')),
        hours DECIMAL(8,2),
        hourly_rate DECIMAL(10,2),
        status VARCHAR(10) NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'approved', 'rejected', 'replaced')),
        file_id INTEGER REFERENCES files(id),
        notes TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        approved_by INTEGER REFERENCES users(id),
        approved_at DATETIME,
        UNIQUE(project_id, version)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_project_quotes_project ON project_quotes(project_id)`,

      `ALTER TABLE projects ADD COLUMN sales_rep_id INTEGER REFERENCES sales_reps(id)`,
      `ALTER TABLE projects ADD COLUMN commercial_stage VARCHAR(20) NOT NULL DEFAULT 'quoting' CHECK (commercial_stage IN ('quoting', 'approved', 'lost'))`,
      `ALTER TABLE projects ADD COLUMN client_approved_at DATETIME`,

      // Backfill: todo proyecto que ya existe al aplicar esta migración ya está en ejecución
      // (nunca pasó por el flujo de cotización, que recién nace aquí) - no debe quedar
      // atascado en 'quoting' sin cotización que aprobar.
      `UPDATE projects SET commercial_stage = 'approved'`,

      `ALTER TABLE project_assignments ADD COLUMN budgeted_hours DECIMAL(6,2)`
    ]
  }
];
```

(Nota: reemplazar literalmente el `];` que hoy cierra el array después de la migración 37 por el bloque de arriba, que abre con `,` para encadenar con el objeto de la migración 37 y vuelve a cerrar con `];`.)

- [ ] **Step 3: Correr el test y verificar que pasa**

Run: `cd backend && npx jest src/__tests__/database/migration038.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 4: Verificar tipos y correr toda la suite de BD**

Run: `cd backend && npx tsc --noEmit && npx jest src/__tests__/database`
Expected: sin errores de tipos; todos los tests de `database/` en PASS (incluido `schemaRepair.test.ts` del sub-proyecto A).

- [ ] **Step 5: Commit**

```bash
git add backend/src/database/migrationList.ts backend/src/__tests__/database/migration038.test.ts
git commit -m "feat(fase6b): migracion v38 - clientes/contactos, comerciales, cotizaciones y etapa comercial del proyecto"
```

---

## Task 2: Clientes y contactos — CRUD backend

**Contexto verificado:** `clients` (v26) ya existe con `name, tax_id, contact_person, email, phone, address, notes, is_active, created_by`, pero no hay `clientController` ni `clientRoutes` (confirmado: no hay ninguna referencia a `clients` fuera de migraciones). `client_contacts` la crea la Task 1. No hay ningún otro controller de "recurso simple con contactos anidados" para imitar 1:1, así que se sigue el mismo patrón de permisos y de "desactivar en vez de borrar" que ya usa `project_assignments` (`removeProjectAssignment` hace `is_active = 0`, nunca `DELETE`).

**Files:**
- Create: `backend/src/controllers/clientController.ts`
- Create: `backend/src/routes/clientRoutes.ts`
- Modify: `backend/src/validation/schemas.ts` (agregar los 4 schemas de clientes/contactos al final)
- Modify: `backend/src/server.ts` (registrar la ruta)
- Test: `backend/src/__tests__/controllers/clientController.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Consumes: `createRealTestDb`, `realDbHolder`, `realDbProxy`, `seedBasicUsers` (`backend/src/__tests__/helpers/realTestDb.ts`, Task 1 de la Fase 6a).
- Produces: `GET /api/clients` (query `include_inactive?: 'true'`), `GET /api/clients/:id` → `{ ...client, contacts: ClientContact[] }`, `POST /api/clients`, `PUT /api/clients/:id`, `PATCH /api/clients/:id/deactivate`, `POST /api/clients/:id/contacts`, `PUT /api/clients/:id/contacts/:contactId`, `PATCH /api/clients/:id/contacts/:contactId/deactivate`. Body de contacto: `{ name: string; position?: string|null; email?: string|null; phone?: string|null; is_primary?: boolean }`.

- [ ] **Step 1: Schemas de validación**

Agregar al final de `backend/src/validation/schemas.ts`:

```typescript
// Clients & contacts (Fase 6b)
export const createClientSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio').max(200),
    tax_id: z.string().max(20).optional().nullable(),
    contact_person: z.string().max(100).optional().nullable(),
    email: z.string().email('Correo inválido').max(100).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable()
});

export const updateClientSchema = createClientSchema.partial();

export const createClientContactSchema = z.object({
    name: z.string().min(1, 'El nombre del contacto es obligatorio').max(200),
    position: z.string().max(100).optional().nullable(),
    email: z.string().email('Correo inválido').max(100).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    is_primary: z.boolean().optional()
});

export const updateClientContactSchema = createClientContactSchema.partial();
```

- [ ] **Step 2: Test que falla**

Crear `backend/src/__tests__/controllers/clientController.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ClientController } from '../../controllers/clientController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}, query: any = {}): AuthenticatedRequest {
    return { user, body, params, query } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

describe('ClientController (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ClientController;
    let lead: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new ClientController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('crea un cliente y lo lista solo entre los activos', async () => {
        const res = mockRes();
        await controller.createClient(makeReq(lead, { name: 'Cliente A' }), res);
        expect(res.status).toHaveBeenCalledWith(201);
        const created = jsonOf(res);
        expect(created).toMatchObject({ name: 'Cliente A', is_active: 1 });

        const list = mockRes();
        await controller.getClients(makeReq(dev, {}, {}, {}), list);
        expect(jsonOf(list).some((c: any) => c.id === created.id)).toBe(true);
    });

    it('agrega dos contactos, marca uno principal y el otro deja de serlo automáticamente', async () => {
        const created = jsonOf(await (async () => { const r = mockRes(); await controller.createClient(makeReq(lead, { name: 'Cliente B' }), r); return r; })());

        const c1Res = mockRes();
        await controller.addClientContact(makeReq(lead, { name: 'Ana', is_primary: true }, { id: String(created.id) }), c1Res);
        expect(c1Res.status).toHaveBeenCalledWith(201);
        const c1 = jsonOf(c1Res);

        const c2Res = mockRes();
        await controller.addClientContact(makeReq(lead, { name: 'Beto', is_primary: true }, { id: String(created.id) }), c2Res);
        const c2 = jsonOf(c2Res);

        const detail = mockRes();
        await controller.getClient(makeReq(dev, {}, { id: String(created.id) }), detail);
        const contacts = jsonOf(detail).contacts;
        expect(contacts.find((c: any) => c.id === c1.id).is_primary).toBe(0);
        expect(contacts.find((c: any) => c.id === c2.id).is_primary).toBe(1);
    });

    it('desactivar un cliente no lo borra: sigue existiendo pero no aparece en el listado por defecto', async () => {
        const created = jsonOf(await (async () => { const r = mockRes(); await controller.createClient(makeReq(lead, { name: 'Cliente C' }), r); return r; })());

        const deact = mockRes();
        await controller.deactivateClient(makeReq(lead, {}, { id: String(created.id) }), deact);
        expect(deact.status).not.toHaveBeenCalledWith(404);

        const list = mockRes();
        await controller.getClients(makeReq(dev, {}, {}, {}), list);
        expect(jsonOf(list).some((c: any) => c.id === created.id)).toBe(false);

        const listAll = mockRes();
        await controller.getClients(makeReq(dev, {}, {}, { include_inactive: 'true' }), listAll);
        expect(jsonOf(listAll).some((c: any) => c.id === created.id)).toBe(true);
    });

    it('desactivar un contacto no borra al cliente ni a sus otros contactos', async () => {
        const created = jsonOf(await (async () => { const r = mockRes(); await controller.createClient(makeReq(lead, { name: 'Cliente D' }), r); return r; })());
        const contact = jsonOf(await (async () => { const r = mockRes(); await controller.addClientContact(makeReq(lead, { name: 'Carla' }, { id: String(created.id) }), r); return r; })());

        const deact = mockRes();
        await controller.deactivateClientContact(makeReq(lead, {}, { id: String(created.id), contactId: String(contact.id) }), deact);
        expect(deact.status).not.toHaveBeenCalledWith(404);

        const detail = mockRes();
        await controller.getClient(makeReq(dev, {}, { id: String(created.id) }), detail);
        expect(jsonOf(detail).is_active).toBe(1);
        expect(jsonOf(detail).contacts.find((c: any) => c.id === contact.id).is_active).toBe(0);
    });

    it('crear cliente sin nombre responde 400 y no llega a la base', async () => {
        const res = mockRes();
        await controller.createClient(makeReq(lead, {}), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('devuelve 404 al operar sobre un cliente o contacto inexistente', async () => {
        const res1 = mockRes();
        await controller.getClient(makeReq(dev, {}, { id: '999999' }), res1);
        expect(res1.status).toHaveBeenCalledWith(404);

        const res2 = mockRes();
        await controller.updateClientContact(makeReq(lead, { name: 'X' }, { id: '999999', contactId: '1' }), res2);
        expect(res2.status).toHaveBeenCalledWith(404);
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/clientController.test.ts`
Expected: FAIL ("Cannot find module '../../controllers/clientController'").

- [ ] **Step 3: Implementar `ClientController`**

Crear `backend/src/controllers/clientController.ts`:

```typescript
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

export class ClientController {
    private static readonly CLIENT_FIELDS = ['name', 'tax_id', 'contact_person', 'email', 'phone', 'address', 'notes'];
    private static readonly CONTACT_FIELDS = ['name', 'position', 'email', 'phone', 'is_primary'];

    // GET /api/clients
    getClients = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const includeInactive = req.query.include_inactive === 'true';
            const clients = await db.query(
                `SELECT * FROM clients ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY name`
            );
            res.json(clients);
        } catch (error) {
            logger.error('Get clients error:', error);
            res.status(500).json({ error: 'Failed to get clients' });
        }
    };

    // GET /api/clients/:id
    getClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const client = await db.get('SELECT * FROM clients WHERE id = ?', [id]);
            if (!client) {
                res.status(404).json({ error: 'Client not found' });
                return;
            }
            const contacts = await db.query(
                'SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, name',
                [id]
            );
            res.json({ ...client, contacts });
        } catch (error) {
            logger.error('Get client error:', error);
            res.status(500).json({ error: 'Failed to get client' });
        }
    };

    // POST /api/clients
    createClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { name } = req.body;
            if (!name) {
                res.status(400).json({ error: 'El nombre del cliente es obligatorio' });
                return;
            }

            const fields = ClientController.CLIENT_FIELDS.filter((f) => req.body[f] !== undefined);
            const columns = ['name', 'created_by', ...fields.filter((f) => f !== 'name')];
            const values = [name, req.user?.id, ...fields.filter((f) => f !== 'name').map((f) => req.body[f])];

            const result = await db.run(
                `INSERT INTO clients (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
                values
            );

            const created = await db.get('SELECT * FROM clients WHERE id = ?', [result.id]);
            res.status(201).json(created);
        } catch (error) {
            logger.error('Create client error:', error);
            res.status(500).json({ error: 'Failed to create client' });
        }
    };

    // PUT /api/clients/:id
    updateClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get('SELECT id FROM clients WHERE id = ?', [id]);
            if (!existing) {
                res.status(404).json({ error: 'Client not found' });
                return;
            }

            const fields = ClientController.CLIENT_FIELDS.filter((f) => req.body[f] !== undefined);
            if (fields.length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }

            await db.run(
                `UPDATE clients SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
                [...fields.map((f) => req.body[f]), id]
            );

            const updated = await db.get('SELECT * FROM clients WHERE id = ?', [id]);
            res.json(updated);
        } catch (error) {
            logger.error('Update client error:', error);
            res.status(500).json({ error: 'Failed to update client' });
        }
    };

    // PATCH /api/clients/:id/deactivate
    deactivateClient = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get('SELECT id FROM clients WHERE id = ?', [id]);
            if (!existing) {
                res.status(404).json({ error: 'Client not found' });
                return;
            }
            await db.run(`UPDATE clients SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [id]);
            res.json({ message: 'Client deactivated' });
        } catch (error) {
            logger.error('Deactivate client error:', error);
            res.status(500).json({ error: 'Failed to deactivate client' });
        }
    };

    private async unsetOtherPrimaryContacts(clientId: string, contactId: number): Promise<void> {
        await db.run('UPDATE client_contacts SET is_primary = 0 WHERE client_id = ? AND id != ?', [clientId, contactId]);
    }

    // POST /api/clients/:id/contacts
    addClientContact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const client = await db.get('SELECT id FROM clients WHERE id = ?', [id]);
            if (!client) {
                res.status(404).json({ error: 'Client not found' });
                return;
            }

            const { name } = req.body;
            if (!name) {
                res.status(400).json({ error: 'El nombre del contacto es obligatorio' });
                return;
            }

            const isPrimary = req.body.is_primary ? 1 : 0;
            const result = await db.run(
                `INSERT INTO client_contacts (client_id, name, position, email, phone, is_primary)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, name, req.body.position ?? null, req.body.email ?? null, req.body.phone ?? null, isPrimary]
            );

            if (isPrimary) {
                await this.unsetOtherPrimaryContacts(id, result.id!);
            }

            const created = await db.get('SELECT * FROM client_contacts WHERE id = ?', [result.id]);
            res.status(201).json(created);
        } catch (error) {
            logger.error('Add client contact error:', error);
            res.status(500).json({ error: 'Failed to add client contact' });
        }
    };

    // PUT /api/clients/:id/contacts/:contactId
    updateClientContact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id, contactId } = req.params;
            const existing = await db.get('SELECT id FROM client_contacts WHERE id = ? AND client_id = ?', [contactId, id]);
            if (!existing) {
                res.status(404).json({ error: 'Contact not found' });
                return;
            }

            const fields = ClientController.CONTACT_FIELDS.filter((f) => req.body[f] !== undefined);
            if (fields.length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }

            const values = fields.map((f) => (f === 'is_primary' ? (req.body[f] ? 1 : 0) : req.body[f]));
            await db.run(
                `UPDATE client_contacts SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
                [...values, contactId]
            );

            if (fields.includes('is_primary') && req.body.is_primary) {
                await this.unsetOtherPrimaryContacts(id, Number(contactId));
            }

            const updated = await db.get('SELECT * FROM client_contacts WHERE id = ?', [contactId]);
            res.json(updated);
        } catch (error) {
            logger.error('Update client contact error:', error);
            res.status(500).json({ error: 'Failed to update client contact' });
        }
    };

    // PATCH /api/clients/:id/contacts/:contactId/deactivate
    deactivateClientContact = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id, contactId } = req.params;
            const existing = await db.get('SELECT id FROM client_contacts WHERE id = ? AND client_id = ?', [contactId, id]);
            if (!existing) {
                res.status(404).json({ error: 'Contact not found' });
                return;
            }
            await db.run(`UPDATE client_contacts SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [contactId]);
            res.json({ message: 'Contact deactivated' });
        } catch (error) {
            logger.error('Deactivate client contact error:', error);
            res.status(500).json({ error: 'Failed to deactivate client contact' });
        }
    };
}
```

- [ ] **Step 4: Rutas y registro en `server.ts`**

Crear `backend/src/routes/clientRoutes.ts`:

```typescript
import { Router } from 'express';
import { ClientController } from '../controllers/clientController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import {
    createClientSchema,
    updateClientSchema,
    createClientContactSchema,
    updateClientContactSchema
} from '../validation/schemas';

const router = Router();
const clientController = new ClientController();

router.use(authenticate);

router.get('/', clientController.getClients);
router.get('/:id', clientController.getClient);

router.post('/', authorize(['team_lead', 'rpa_operations']), validate({ body: createClientSchema }), clientController.createClient);
router.put('/:id', authorize(['team_lead', 'rpa_operations']), validate({ body: updateClientSchema }), clientController.updateClient);
router.patch('/:id/deactivate', authorize(['team_lead', 'rpa_operations']), clientController.deactivateClient);

router.post(
    '/:id/contacts',
    authorize(['team_lead', 'rpa_operations']),
    validate({ body: createClientContactSchema }),
    clientController.addClientContact
);
router.put(
    '/:id/contacts/:contactId',
    authorize(['team_lead', 'rpa_operations']),
    validate({ body: updateClientContactSchema }),
    clientController.updateClientContact
);
router.patch(
    '/:id/contacts/:contactId/deactivate',
    authorize(['team_lead', 'rpa_operations']),
    clientController.deactivateClientContact
);

export default router;
```

En `backend/src/server.ts`, agregar el import junto a los demás (`import clientRoutes from './routes/clientRoutes';`) y la línea de montaje junto a `this.app.use('/api/projects', ...)`:

```typescript
        this.app.use('/api/clients', clientRoutes);
```

- [ ] **Step 5: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/clientController.test.ts && npx tsc --noEmit`
Expected: PASS (7 tests); tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/clientController.ts backend/src/routes/clientRoutes.ts backend/src/validation/schemas.ts backend/src/server.ts backend/src/__tests__/controllers/clientController.test.ts
git commit -m "feat(fase6b): CRUD de clientes y contactos multiples"
```

---

## Task 3: Comerciales — CRUD backend

**Contexto verificado:** `sales_reps` la crea la Task 1 (`id, name, email, is_active, created_by`). No hay tabla ni controller previos para comerciales. Mismo patrón de permisos y desactivación que `clientController` (Task 2).

**Files:**
- Create: `backend/src/controllers/salesRepController.ts`
- Create: `backend/src/routes/salesRepRoutes.ts`
- Modify: `backend/src/validation/schemas.ts` (agregar 2 schemas al final)
- Modify: `backend/src/server.ts` (registrar la ruta)
- Test: `backend/src/__tests__/controllers/salesRepController.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Consumes: helper de SQLite real (Task 1 de la Fase 6a).
- Produces: `GET /api/sales-reps` (query `include_inactive?: 'true'`), `POST /api/sales-reps`, `PUT /api/sales-reps/:id`, `PATCH /api/sales-reps/:id/deactivate`.

- [ ] **Step 1: Schemas de validación**

Agregar al final de `backend/src/validation/schemas.ts`:

```typescript
// Sales reps (Fase 6b)
export const createSalesRepSchema = z.object({
    name: z.string().min(1, 'El nombre es obligatorio').max(200),
    email: z.string().email('Correo inválido').max(100).optional().nullable()
});

export const updateSalesRepSchema = createSalesRepSchema.partial();
```

- [ ] **Step 2: Test que falla**

Crear `backend/src/__tests__/controllers/salesRepController.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { SalesRepController } from '../../controllers/salesRepController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}, query: any = {}): AuthenticatedRequest {
    return { user, body, params, query } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

describe('SalesRepController (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: SalesRepController;
    let lead: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new SalesRepController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('crea un comercial y lo lista', async () => {
        const res = mockRes();
        await controller.createSalesRep(makeReq(lead, { name: 'Vendedor A', email: 'a@x.cl' }), res);
        expect(res.status).toHaveBeenCalledWith(201);
        const created = jsonOf(res);

        const list = mockRes();
        await controller.getSalesReps(makeReq(dev, {}, {}, {}), list);
        expect(jsonOf(list).some((s: any) => s.id === created.id)).toBe(true);
    });

    it('edita el correo de un comercial existente', async () => {
        const created = jsonOf(await (async () => { const r = mockRes(); await controller.createSalesRep(makeReq(lead, { name: 'Vendedor B' }), r); return r; })());

        const res = mockRes();
        await controller.updateSalesRep(makeReq(lead, { email: 'nuevo@x.cl' }, { id: String(created.id) }), res);
        expect(jsonOf(res).email).toBe('nuevo@x.cl');
    });

    it('desactivar un comercial lo saca del listado por defecto pero no lo borra', async () => {
        const created = jsonOf(await (async () => { const r = mockRes(); await controller.createSalesRep(makeReq(lead, { name: 'Vendedor C' }), r); return r; })());

        const deact = mockRes();
        await controller.deactivateSalesRep(makeReq(lead, {}, { id: String(created.id) }), deact);
        expect(deact.status).not.toHaveBeenCalledWith(404);

        const list = mockRes();
        await controller.getSalesReps(makeReq(dev, {}, {}, {}), list);
        expect(jsonOf(list).some((s: any) => s.id === created.id)).toBe(false);

        const listAll = mockRes();
        await controller.getSalesReps(makeReq(dev, {}, {}, { include_inactive: 'true' }), listAll);
        expect(jsonOf(listAll).some((s: any) => s.id === created.id)).toBe(true);
    });

    it('crear sin nombre responde 400; editar/desactivar un inexistente responde 404', async () => {
        const res = mockRes();
        await controller.createSalesRep(makeReq(lead, {}), res);
        expect(res.status).toHaveBeenCalledWith(400);

        const res2 = mockRes();
        await controller.updateSalesRep(makeReq(lead, { name: 'X' }, { id: '999999' }), res2);
        expect(res2.status).toHaveBeenCalledWith(404);

        const res3 = mockRes();
        await controller.deactivateSalesRep(makeReq(lead, {}, { id: '999999' }), res3);
        expect(res3.status).toHaveBeenCalledWith(404);
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/salesRepController.test.ts`
Expected: FAIL ("Cannot find module '../../controllers/salesRepController'").

- [ ] **Step 3: Implementar `SalesRepController`**

Crear `backend/src/controllers/salesRepController.ts`:

```typescript
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

export class SalesRepController {
    private static readonly FIELDS = ['name', 'email'];

    // GET /api/sales-reps
    getSalesReps = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const includeInactive = req.query.include_inactive === 'true';
            const reps = await db.query(
                `SELECT * FROM sales_reps ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY name`
            );
            res.json(reps);
        } catch (error) {
            logger.error('Get sales reps error:', error);
            res.status(500).json({ error: 'Failed to get sales reps' });
        }
    };

    // POST /api/sales-reps
    createSalesRep = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { name } = req.body;
            if (!name) {
                res.status(400).json({ error: 'El nombre del comercial es obligatorio' });
                return;
            }

            const result = await db.run(
                'INSERT INTO sales_reps (name, email, created_by) VALUES (?, ?, ?)',
                [name, req.body.email ?? null, req.user?.id]
            );

            const created = await db.get('SELECT * FROM sales_reps WHERE id = ?', [result.id]);
            res.status(201).json(created);
        } catch (error) {
            logger.error('Create sales rep error:', error);
            res.status(500).json({ error: 'Failed to create sales rep' });
        }
    };

    // PUT /api/sales-reps/:id
    updateSalesRep = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get('SELECT id FROM sales_reps WHERE id = ?', [id]);
            if (!existing) {
                res.status(404).json({ error: 'Sales rep not found' });
                return;
            }

            const fields = SalesRepController.FIELDS.filter((f) => req.body[f] !== undefined);
            if (fields.length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }

            await db.run(
                `UPDATE sales_reps SET ${fields.map((f) => `${f} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
                [...fields.map((f) => req.body[f]), id]
            );

            const updated = await db.get('SELECT * FROM sales_reps WHERE id = ?', [id]);
            res.json(updated);
        } catch (error) {
            logger.error('Update sales rep error:', error);
            res.status(500).json({ error: 'Failed to update sales rep' });
        }
    };

    // PATCH /api/sales-reps/:id/deactivate
    deactivateSalesRep = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get('SELECT id FROM sales_reps WHERE id = ?', [id]);
            if (!existing) {
                res.status(404).json({ error: 'Sales rep not found' });
                return;
            }
            await db.run(`UPDATE sales_reps SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [id]);
            res.json({ message: 'Sales rep deactivated' });
        } catch (error) {
            logger.error('Deactivate sales rep error:', error);
            res.status(500).json({ error: 'Failed to deactivate sales rep' });
        }
    };
}
```

- [ ] **Step 4: Rutas y registro en `server.ts`**

Crear `backend/src/routes/salesRepRoutes.ts`:

```typescript
import { Router } from 'express';
import { SalesRepController } from '../controllers/salesRepController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validation';
import { createSalesRepSchema, updateSalesRepSchema } from '../validation/schemas';

const router = Router();
const salesRepController = new SalesRepController();

router.use(authenticate);

router.get('/', salesRepController.getSalesReps);
router.post(
    '/',
    authorize(['team_lead', 'rpa_operations']),
    validate({ body: createSalesRepSchema }),
    salesRepController.createSalesRep
);
router.put(
    '/:id',
    authorize(['team_lead', 'rpa_operations']),
    validate({ body: updateSalesRepSchema }),
    salesRepController.updateSalesRep
);
router.patch('/:id/deactivate', authorize(['team_lead', 'rpa_operations']), salesRepController.deactivateSalesRep);

export default router;
```

En `backend/src/server.ts`, agregar el import (`import salesRepRoutes from './routes/salesRepRoutes';`) y montar junto a `/api/clients`:

```typescript
        this.app.use('/api/sales-reps', salesRepRoutes);
```

- [ ] **Step 5: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/salesRepController.test.ts && npx tsc --noEmit`
Expected: PASS (4 tests); tsc limpio.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/salesRepController.ts backend/src/routes/salesRepRoutes.ts backend/src/validation/schemas.ts backend/src/server.ts backend/src/__tests__/controllers/salesRepController.test.ts
git commit -m "feat(fase6b): CRUD de comerciales"
```

---

## Task 4: Cotizaciones — subir versión

**Contexto verificado:** `project_quotes` la crea la Task 1. `projectRoutes.ts:10-48` ya configura un multer `upload` (carpeta `uploads/quotes`, límite 10MB, solo PDF/DOCX) usado hoy por `POST /projects/upload-quote` (`authorize(['team_lead'])`, `projectController.ts:996-1076`) — ese endpoint solo lee el PDF con IA (`LLMService.extractQuoteDataFromDocument`) y **borra el archivo subido** al terminar (`documentParserService.cleanupFile`, línea 1053); nunca persiste el archivo. Por eso, para que una versión de cotización quede con su PDF adjunto de verdad, el frontend debe volver a enviar el mismo archivo al endpoint nuevo de esta tarea, que sí lo persiste (Task 11 lo hace así). `fileController.createFileAssociation` (línea 606-618) usa `INSERT OR IGNORE INTO file_associations (file_id, entity_type, entity_id, association_type, created_by)` — se reutiliza el mismo patrón mínimo aquí en vez de instanciar `FileController` completo (que hace deduplicación por hash, versionado, etc., innecesario para un archivo de cotización que siempre es nuevo).

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (agregar `stripQuoteFinancials`, `listProjectQuotes`, `attachQuoteFile`, `createProjectQuote` tras `createProjectFromQuote`)
- Modify: `backend/src/routes/projectRoutes.ts` (nuevas rutas + ampliar rol de `/upload-quote`)
- Test: `backend/src/__tests__/controllers/projectController.quotes.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Consumes: helper de SQLite real (Task 1 de la Fase 6a).
- Produces: `GET /api/projects/:id/quotes` → `ProjectQuote[]` (sin `amount`/`hourly_rate` para quien no sea `team_lead`). `POST /api/projects/:id/quotes` (multipart, campo de archivo `file` opcional) con body `{ pricing_model: 'fixed'|'hourly'; amount: number; currency: 'CLP'|'USD'|'UF'; hours?: number; hourly_rate?: number; notes?: string }` → 201 con la cotización creada (`version` autoincremental por proyecto, `status: 'sent'`).

- [ ] **Step 1: Test que falla**

Crear `backend/src/__tests__/controllers/projectController.quotes.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import fs from 'fs';
import os from 'os';
import path from 'path';
import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}, file?: any): AuthenticatedRequest {
    return { user, body, params, file } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

function fakeUploadedFile(content = 'PDF-CONTENT'): any {
    const filePath = path.join(os.tmpdir(), `quote-test-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(filePath, content);
    return { path: filePath, filename: path.basename(filePath), originalname: 'cotizacion.pdf', size: content.length, mimetype: 'application/pdf' };
}

describe('ProjectController - cotizaciones, subir version (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let projectId: number;
    let lead: { id: number; role: string };
    let ops: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        ops = { id: users.ops, role: 'rpa_operations' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new ProjectController();
        const project = await testDb.run(`INSERT INTO projects (name, created_by, assigned_to) VALUES ('P', ?, ?)`, [users.lead, users.dev]);
        projectId = project.id!;
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('rpa_operations sube la version 1 sin archivo, por horas', async () => {
        const res = mockRes();
        await controller.createProjectQuote(makeReq(ops, {
            pricing_model: 'hourly', amount: '5000000', currency: 'CLP', hours: '200', hourly_rate: '25000'
        }, { id: String(projectId) }), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const created = jsonOf(res);
        expect(created).toMatchObject({ version: 1, pricing_model: 'hourly', currency: 'CLP', status: 'sent' });

        const row = await testDb.get('SELECT amount, hours, hourly_rate, file_id FROM project_quotes WHERE id = ?', [created.id]);
        expect(row).toEqual({ amount: 5000000, hours: 200, hourly_rate: 25000, file_id: null });
    });

    it('team_lead sube la version 2 con archivo adjunto, precio cerrado', async () => {
        const file = fakeUploadedFile();
        const res = mockRes();
        await controller.createProjectQuote(makeReq(lead, {
            pricing_model: 'fixed', amount: '12000000', currency: 'UF'
        }, { id: String(projectId) }, file), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const created = jsonOf(res);
        expect(created.version).toBe(2);

        const association = await testDb.get(
            `SELECT association_type FROM file_associations WHERE entity_type = 'project' AND entity_id = ? AND association_type = 'quote'`,
            [projectId]
        );
        expect(association).toBeTruthy();
    });

    it('rechaza con 400 un modelo por horas sin horas ni tarifa', async () => {
        const res = mockRes();
        await controller.createProjectQuote(makeReq(lead, {
            pricing_model: 'hourly', amount: '1000000', currency: 'CLP'
        }, { id: String(projectId) }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('rechaza con 400 una moneda o modelo de precio invalidos', async () => {
        const res1 = mockRes();
        await controller.createProjectQuote(makeReq(lead, { pricing_model: 'fixed', amount: '1000', currency: 'EUR' }, { id: String(projectId) }), res1);
        expect(res1.status).toHaveBeenCalledWith(400);

        const res2 = mockRes();
        await controller.createProjectQuote(makeReq(lead, { pricing_model: 'weird', amount: '1000', currency: 'CLP' }, { id: String(projectId) }), res2);
        expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('un rpa_developer ve las cotizaciones sin amount ni hourly_rate; team_lead los ve completos', async () => {
        const resDev = mockRes();
        await controller.listProjectQuotes(makeReq(dev, {}, { id: String(projectId) }), resDev);
        const devList = jsonOf(resDev);
        expect(devList.length).toBeGreaterThanOrEqual(2);
        for (const q of devList) {
            expect(q).not.toHaveProperty('amount');
            expect(q).not.toHaveProperty('hourly_rate');
            expect(q).toHaveProperty('status');
        }

        const resLead = mockRes();
        await controller.listProjectQuotes(makeReq(lead, {}, { id: String(projectId) }), resLead);
        expect(jsonOf(resLead)[0]).toHaveProperty('amount');
    });

    it('responde 404 al subir una cotizacion a un proyecto inexistente', async () => {
        const res = mockRes();
        await controller.createProjectQuote(makeReq(lead, { pricing_model: 'fixed', amount: '1000', currency: 'CLP' }, { id: '999999' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/projectController.quotes.test.ts`
Expected: FAIL (`controller.createProjectQuote is not a function`).

- [ ] **Step 2: Implementar en `ProjectController`**

En `backend/src/controllers/projectController.ts`, agregar el import de `crypto` junto a los existentes (`import * as crypto from 'crypto';`), y al final de la clase (después de `createProjectFromQuote`, antes del `}` que cierra la clase), agregar:

```typescript
    // === PROJECT QUOTES (Fase 6b) ===

    private static readonly QUOTE_FINANCIAL_FIELDS = ['amount', 'hourly_rate'];
    private static readonly QUOTE_PRICING_MODELS = ['fixed', 'hourly'];
    private static readonly QUOTE_CURRENCIES = ['CLP', 'USD', 'UF'];

    private stripQuoteFinancials<T extends Record<string, any>>(user: AuthenticatedRequest['user'], quote: T): T {
        if (user?.role === 'team_lead') return quote;
        const copy: Record<string, any> = { ...quote };
        for (const field of ProjectController.QUOTE_FINANCIAL_FIELDS) delete copy[field];
        return copy as T;
    }

    // GET /api/projects/:id/quotes
    listProjectQuotes = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const project = await db.get('SELECT id, assigned_to, created_by FROM projects WHERE id = ?', [id]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            if (!this.hasProjectAccess(req.user, project)) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const quotes = await db.query('SELECT * FROM project_quotes WHERE project_id = ? ORDER BY version DESC', [id]);
            res.json(quotes.map((q) => this.stripQuoteFinancials(req.user, q)));
        } catch (error) {
            logger.error('List project quotes error:', error);
            res.status(500).json({ error: 'Failed to list project quotes' });
        }
    };

    // Inserción mínima en `files`/`file_associations`: a diferencia de FileController.uploadFiles,
    // una cotización siempre es un archivo nuevo (no dedupe por hash, no versiones).
    private async attachQuoteFile(file: Express.Multer.File, projectId: string, userId: number): Promise<number> {
        const fileBuffer = await fs.promises.readFile(file.path);
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const fileExtension = path.extname(file.originalname).replace('.', '').toLowerCase();

        const result = await db.run(`
            INSERT INTO files (
                filename, original_filename, file_path, file_size, mime_type,
                file_extension, file_hash, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [file.filename, file.originalname, file.path, file.size, file.mimetype, fileExtension, fileHash, userId]);

        await db.run(
            `INSERT OR IGNORE INTO file_associations (file_id, entity_type, entity_id, association_type, created_by)
             VALUES (?, 'project', ?, 'quote', ?)`,
            [result.id, projectId, userId]
        );

        return result.id!;
    }

    // POST /api/projects/:id/quotes
    createProjectQuote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const project = await db.get('SELECT id FROM projects WHERE id = ?', [id]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            const pricingModel = req.body.pricing_model;
            const amount = Number(req.body.amount);
            const currency = req.body.currency;
            const hours = req.body.hours !== undefined && req.body.hours !== '' ? Number(req.body.hours) : null;
            const hourlyRate = req.body.hourly_rate !== undefined && req.body.hourly_rate !== '' ? Number(req.body.hourly_rate) : null;
            const notes = req.body.notes || null;

            if (!ProjectController.QUOTE_PRICING_MODELS.includes(pricingModel)) {
                res.status(400).json({ error: "pricing_model debe ser 'fixed' u 'hourly'" });
                return;
            }
            if (!Number.isFinite(amount) || amount <= 0) {
                res.status(400).json({ error: 'amount debe ser un numero mayor a 0' });
                return;
            }
            if (!ProjectController.QUOTE_CURRENCIES.includes(currency)) {
                res.status(400).json({ error: 'Moneda invalida' });
                return;
            }
            if (pricingModel === 'hourly' && (!hours || hours <= 0 || !hourlyRate || hourlyRate <= 0)) {
                res.status(400).json({ error: 'El modelo por horas requiere hours y hourly_rate mayores a 0' });
                return;
            }

            let fileId: number | null = null;
            if (req.file) {
                fileId = await this.attachQuoteFile(req.file, id, req.user!.id);
            }

            const last = await db.get('SELECT MAX(version) as maxVersion FROM project_quotes WHERE project_id = ?', [id]);
            const version = (last?.maxVersion || 0) + 1;

            const result = await db.run(`
                INSERT INTO project_quotes (
                    project_id, version, pricing_model, amount, currency, hours, hourly_rate, file_id, notes, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [id, version, pricingModel, amount, currency, hours, hourlyRate, fileId, notes, req.user!.id]);

            await activityLogService.logActivity(req.user?.id, 'project', parseInt(id), 'quote_uploaded', null, { version, pricing_model: pricingModel });

            const created = await db.get('SELECT * FROM project_quotes WHERE id = ?', [result.id]);
            res.status(201).json(this.stripQuoteFinancials(req.user, created));
        } catch (error) {
            logger.error('Create project quote error:', error);
            res.status(500).json({ error: 'Failed to create project quote' });
        }
    };
```

- [ ] **Step 3: Rutas**

En `backend/src/routes/projectRoutes.ts`, cambiar la ruta de `/upload-quote` (Operaciones también sube y precarga cotizaciones ahora):

```typescript
// POST /api/projects/upload-quote - Upload and process quote document (team_lead y rpa_operations)
router.post('/upload-quote',
    authorize(['team_lead', 'rpa_operations']),
    upload.single('file'),
    projectController.uploadQuote
);
```

Y agregar, antes de `export default router;`:

```typescript
// === PROJECT QUOTES ROUTES (Fase 6b) ===

// GET /api/projects/:id/quotes - List quote versions (financials hidden for non team_lead)
router.get('/:id/quotes', projectController.listProjectQuotes);

// POST /api/projects/:id/quotes - Upload a new quote version (team_lead y rpa_operations)
router.post('/:id/quotes',
    authorize(['team_lead', 'rpa_operations']),
    upload.single('file'),
    projectController.createProjectQuote
);
```

- [ ] **Step 4: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/projectController && npx tsc --noEmit`
Expected: PASS (incluye los tests nuevos y los ya existentes de `projectController.*.test.ts`); tsc limpio.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.quotes.test.ts
git commit -m "feat(fase6b): subir versiones de cotizacion por proyecto; operaciones tambien puede precargar con IA"
```

---

## Task 5: Cotizaciones — aprobar versión

**Contexto verificado:** `upsertProjectFinancials(projectId, input)` (sub-proyecto A, `projectController.ts:47-65`) ya hace el UPSERT parcial contra `project_financials` mapeando `sale_price`, `sale_price_currency`, `hours_budgeted`; se puede llamar directo con un objeto armado a mano, sin pasar por `financialInputFor` (esa función solo filtra campos que vienen del body de un usuario no-`team_lead`, y aquí el endpoint completo es exclusivo de `team_lead`).

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (agregar `approveProjectQuote` después de `createProjectQuote`)
- Modify: `backend/src/routes/projectRoutes.ts` (nueva ruta)
- Test: `backend/src/__tests__/controllers/projectController.quotes.approve.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Consumes: `stripQuoteFinancials`, `attachQuoteFile` (Task 4); `upsertProjectFinancials` (sub-proyecto A).
- Produces: `PATCH /api/projects/:id/quotes/:quoteId/approve` (solo `team_lead`) → 200 con la cotización aprobada. Copia `amount → sale_price`, `currency → sale_price_currency` siempre; copia además `hours → hours_budgeted` solo si `pricing_model === 'hourly'` (en precio cerrado las horas presupuestadas del equipo se cargan aparte, en la Task 7, y no tienen por qué coincidir con ninguna hora de la cotización).

- [ ] **Step 1: Test que falla**

Crear `backend/src/__tests__/controllers/projectController.quotes.approve.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user, body, params } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

describe('ProjectController - aprobar cotizacion (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let projectId: number;
    let lead: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new ProjectController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    async function newProjectWithTwoQuotes(): Promise<{ projectId: number; q1: number; q2: number }> {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P', ?)`, [users.lead]);
        const q1 = await testDb.run(
            `INSERT INTO project_quotes (project_id, version, pricing_model, amount, currency, hours, hourly_rate, created_by) VALUES (?, 1, 'hourly', 4000000, 'CLP', 150, 26666, ?)`,
            [project.id, users.lead]
        );
        const q2 = await testDb.run(
            `INSERT INTO project_quotes (project_id, version, pricing_model, amount, currency, created_by) VALUES (?, 2, 'fixed', 5000000, 'UF', ?)`,
            [project.id, users.lead]
        );
        return { projectId: project.id!, q1: q1.id!, q2: q2.id! };
    }

    it('aprobar la version por horas copia amount, currency y hours a project_financials, y la deja approved', async () => {
        const { projectId: pid, q1 } = await newProjectWithTwoQuotes();

        const res = mockRes();
        await controller.approveProjectQuote(makeReq(lead, {}, { id: String(pid), quoteId: String(q1) }), res);

        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(jsonOf(res).status).toBe('approved');

        const fin = await testDb.get('SELECT sale_price, sale_price_currency, budgeted_hours FROM project_financials WHERE project_id = ?', [pid]);
        expect(fin).toEqual({ sale_price: 4000000, sale_price_currency: 'CLP', budgeted_hours: 150 });

        const other = await testDb.get('SELECT status FROM project_quotes WHERE project_id = ? AND version = 2', [pid]);
        expect(other.status).toBe('replaced');
    });

    it('aprobar una version de precio cerrado copia amount/currency pero no toca hours_budgeted', async () => {
        const { projectId: pid, q2 } = await newProjectWithTwoQuotes();
        await testDb.run(`UPDATE project_financials SET budgeted_hours = 999 WHERE project_id = ?`, [pid]).catch(() => {});
        await testDb.run(`INSERT OR IGNORE INTO project_financials (project_id, budgeted_hours) VALUES (?, 999)`, [pid]);

        const res = mockRes();
        await controller.approveProjectQuote(makeReq(lead, {}, { id: String(pid), quoteId: String(q2) }), res);

        const fin = await testDb.get('SELECT sale_price, sale_price_currency, budgeted_hours FROM project_financials WHERE project_id = ?', [pid]);
        expect(fin).toEqual({ sale_price: 5000000, sale_price_currency: 'UF', budgeted_hours: 999 });
    });

    it('no se puede aprobar dos veces la misma version', async () => {
        const { projectId: pid, q1 } = await newProjectWithTwoQuotes();
        await controller.approveProjectQuote(makeReq(lead, {}, { id: String(pid), quoteId: String(q1) }), mockRes());

        const res = mockRes();
        await controller.approveProjectQuote(makeReq(lead, {}, { id: String(pid), quoteId: String(q1) }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('un rpa_developer no puede aprobar (403) y no ve amount ni hourly_rate en la respuesta de error nunca llega a construirse', async () => {
        const { projectId: pid, q1 } = await newProjectWithTwoQuotes();
        const res = mockRes();
        await controller.approveProjectQuote(makeReq(dev, {}, { id: String(pid), quoteId: String(q1) }), res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('responde 404 si la cotizacion no existe en ese proyecto', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('Solo', ?)`, [users.lead]);
        const res = mockRes();
        await controller.approveProjectQuote(makeReq(lead, {}, { id: String(project.id), quoteId: '999999' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/projectController.quotes.approve.test.ts`
Expected: FAIL (`controller.approveProjectQuote is not a function`).

- [ ] **Step 2: Implementar `approveProjectQuote`**

En `backend/src/controllers/projectController.ts`, agregar después de `createProjectQuote`:

```typescript
    // PATCH /api/projects/:id/quotes/:quoteId/approve
    approveProjectQuote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can approve quotes' });
                return;
            }

            const { id, quoteId } = req.params;
            const quote = await db.get('SELECT * FROM project_quotes WHERE id = ? AND project_id = ?', [quoteId, id]);
            if (!quote) {
                res.status(404).json({ error: 'Quote not found' });
                return;
            }
            if (quote.status !== 'sent') {
                res.status(400).json({ error: `No se puede aprobar una cotizacion en estado '${quote.status}'` });
                return;
            }

            await db.beginTransaction();
            try {
                await db.run(
                    `UPDATE project_quotes SET status = 'replaced' WHERE project_id = ? AND status = 'sent' AND id != ?`,
                    [id, quoteId]
                );
                await db.run(
                    `UPDATE project_quotes SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?`,
                    [req.user?.id, quoteId]
                );

                const financialInput: Record<string, any> = {
                    sale_price: quote.amount,
                    sale_price_currency: quote.currency
                };
                if (quote.pricing_model === 'hourly' && quote.hours) {
                    financialInput.hours_budgeted = quote.hours;
                }
                await this.upsertProjectFinancials(parseInt(id), financialInput);

                await db.commit();
            } catch (error) {
                await db.rollback();
                throw error;
            }

            await activityLogService.logActivity(
                req.user?.id, 'project', parseInt(id), 'quote_approved', null,
                { quote_id: Number(quoteId), version: quote.version }
            );

            const updated = await db.get('SELECT * FROM project_quotes WHERE id = ?', [quoteId]);
            res.json(this.stripQuoteFinancials(req.user, updated));
        } catch (error) {
            logger.error('Approve project quote error:', error);
            res.status(500).json({ error: 'Failed to approve project quote' });
        }
    };
```

- [ ] **Step 3: Ruta**

En `backend/src/routes/projectRoutes.ts`, agregar junto a las demás rutas de cotizaciones:

```typescript
// PATCH /api/projects/:id/quotes/:quoteId/approve - Approve a quote version (team_lead only)
router.patch('/:id/quotes/:quoteId/approve', authorize(['team_lead']), projectController.approveProjectQuote);
```

- [ ] **Step 4: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/projectController && npx tsc --noEmit`
Expected: PASS; tsc limpio.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.quotes.approve.test.ts
git commit -m "feat(fase6b): aprobar version de cotizacion fija el precio de venta del proyecto"
```

---

## Task 6: Etapa comercial — OK del cliente, marcar perdido, bloqueo de precio y filtro del tablero

**Contexto verificado:** `updateProject` (`projectController.ts:334-426`) ya arma `financialInput` con `this.financialInputFor(req.user, updates)` antes de llamar `this.upsertProjectFinancials(...)`; el guardia de bloqueo se agrega justo antes de esa llamada. `getProjects` (`projectController.ts:100-143`) hoy solo agrega un `WHERE` cuando el rol es `rpa_developer`; hay que generalizarlo a una lista de condiciones para sumar el filtro de `commercial_stage`.

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (`updateProject`, `getProjects`, agregar `clientApproval` y `markProjectLost` después de `approveProjectQuote`)
- Modify: `backend/src/routes/projectRoutes.ts` (2 rutas nuevas)
- Test: `backend/src/__tests__/controllers/projectController.commercialStage.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Produces: `PATCH /api/projects/:id/client-approval` (solo `team_lead`) → exige una `project_quotes` en estado `approved`; pasa `commercial_stage` a `'approved'` y fija `client_approved_at`. `PATCH /api/projects/:id/mark-lost` (solo `team_lead`) → solo permitido si `commercial_stage === 'quoting'`; lo pasa a `'lost'`. `GET /api/projects?include_lost=true` incluye los proyectos perdidos (por defecto se excluyen). `PUT /api/projects/:id` responde 400 si intenta cambiar `sale_price`/`sale_price_currency`/`hours_budgeted` con el proyecto ya `commercial_stage='approved'`.

- [ ] **Step 1: Test que falla**

Crear `backend/src/__tests__/controllers/projectController.commercialStage.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}, query: any = {}): AuthenticatedRequest {
    return { user, body, params, query } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

describe('ProjectController - etapa comercial (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let lead: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new ProjectController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('client-approval rechaza con 400 si no hay ninguna cotizacion aprobada', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P1', ?)`, [users.lead]);
        const res = mockRes();
        await controller.clientApproval(makeReq(lead, {}, { id: String(project.id) }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('client-approval pasa el proyecto a approved cuando hay una cotizacion aprobada', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P2', ?)`, [users.lead]);
        await testDb.run(
            `INSERT INTO project_quotes (project_id, version, pricing_model, amount, currency, status, created_by) VALUES (?, 1, 'fixed', 1000000, 'CLP', 'approved', ?)`,
            [project.id, users.lead]
        );

        const res = mockRes();
        await controller.clientApproval(makeReq(lead, {}, { id: String(project.id) }), res);

        expect(res.status).not.toHaveBeenCalledWith(400);
        const updated = jsonOf(res);
        expect(updated.commercial_stage).toBe('approved');
        expect(updated.client_approved_at).toBeTruthy();
    });

    it('client-approval no se puede repetir ni aplicar a un proyecto perdido', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by, commercial_stage) VALUES ('P3', ?, 'approved')`, [users.lead]);
        const res = mockRes();
        await controller.clientApproval(makeReq(lead, {}, { id: String(project.id) }), res);
        expect(res.status).toHaveBeenCalledWith(400);

        const lostProject = await testDb.run(`INSERT INTO projects (name, created_by, commercial_stage) VALUES ('P4', ?, 'lost')`, [users.lead]);
        const res2 = mockRes();
        await controller.clientApproval(makeReq(lead, {}, { id: String(lostProject.id) }), res2);
        expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('un rpa_developer no puede dar el OK del cliente ni marcar perdido (403)', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P5', ?)`, [users.lead]);
        const res1 = mockRes();
        await controller.clientApproval(makeReq(dev, {}, { id: String(project.id) }), res1);
        expect(res1.status).toHaveBeenCalledWith(403);

        const res2 = mockRes();
        await controller.markProjectLost(makeReq(dev, {}, { id: String(project.id) }), res2);
        expect(res2.status).toHaveBeenCalledWith(403);
    });

    it('mark-lost solo funciona mientras el proyecto esta quoting', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P6', ?)`, [users.lead]);
        const res = mockRes();
        await controller.markProjectLost(makeReq(lead, {}, { id: String(project.id) }), res);
        expect(jsonOf(res).commercial_stage).toBe('lost');

        const res2 = mockRes();
        await controller.markProjectLost(makeReq(lead, {}, { id: String(project.id) }), res2);
        expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('getProjects excluye los perdidos por defecto y los incluye con include_lost=true', async () => {
        const lost = await testDb.run(`INSERT INTO projects (name, created_by, commercial_stage) VALUES ('Perdido X', ?, 'lost')`, [users.lead]);

        const res = mockRes();
        await controller.getProjects(makeReq(lead, {}, {}, {}), res);
        expect(jsonOf(res).some((p: any) => p.id === lost.id)).toBe(false);

        const resAll = mockRes();
        await controller.getProjects(makeReq(lead, {}, {}, { include_lost: 'true' }), resAll);
        expect(jsonOf(resAll).some((p: any) => p.id === lost.id)).toBe(true);
    });

    it('updateProject rechaza cambiar sale_price/hours_budgeted si el proyecto ya esta approved', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by, commercial_stage) VALUES ('P7', ?, 'approved')`, [users.lead]);

        const res = mockRes();
        await controller.updateProject(makeReq(lead, { sale_price: 999 }, { id: String(project.id) }), res);
        expect(res.status).toHaveBeenCalledWith(400);

        const res2 = mockRes();
        await controller.updateProject(makeReq(lead, { hours_budgeted: 50 }, { id: String(project.id) }), res2);
        expect(res2.status).toHaveBeenCalledWith(400);
    });

    it('updateProject sigue permitiendo cambiar sale_price mientras el proyecto esta quoting, y otros campos aunque este approved', async () => {
        const quoting = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P8', ?)`, [users.lead]);
        const res = mockRes();
        await controller.updateProject(makeReq(lead, { sale_price: 500 }, { id: String(quoting.id) }), res);
        expect(res.status).not.toHaveBeenCalledWith(400);

        const approved = await testDb.run(`INSERT INTO projects (name, created_by, commercial_stage) VALUES ('P9', ?, 'approved')`, [users.lead]);
        const res2 = mockRes();
        await controller.updateProject(makeReq(lead, { description: 'nueva' }, { id: String(approved.id) }), res2);
        expect(res2.status).not.toHaveBeenCalledWith(400);
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/projectController.commercialStage.test.ts`
Expected: FAIL (`controller.clientApproval is not a function`, y `updateProject` deja cambiar `sale_price` de un proyecto `approved`).

- [ ] **Step 2: Guardia de bloqueo en `updateProject`**

En `backend/src/controllers/projectController.ts`, agregar junto a los demás arreglos `static readonly` (después de `TEAM_LEAD_ONLY_FINANCIAL_FIELDS`):

```typescript
    // Una vez el proyecto pasa a 'approved' (OK del cliente), estos campos se bloquean por la via
    // normal de edicion: cambiarlos exige subir y aprobar una nueva version de cotizacion.
    private static readonly LOCKED_AFTER_APPROVAL_FIELDS = ['sale_price', 'sale_price_currency', 'hours_budgeted'];
```

En `updateProject`, justo antes de `await this.upsertProjectFinancials(parseInt(id), financialInput);`, agregar:

```typescript
            if (
                currentProject.commercial_stage === 'approved' &&
                ProjectController.LOCKED_AFTER_APPROVAL_FIELDS.some((field) => financialInput[field] !== undefined)
            ) {
                res.status(400).json({
                    error: 'El proyecto ya esta en ejecucion; para cambiar precio u horas sube y aprueba una nueva cotizacion'
                });
                return;
            }

```

- [ ] **Step 3: Filtro de `commercial_stage` en `getProjects`**

En `backend/src/controllers/projectController.ts`, reemplazar el bloque de `getProjects` que arma el `WHERE` (desde `const params: any[] = [];` hasta `query += ' ORDER BY p.created_at DESC';`) por:

```typescript
            const params: any[] = [];
            const conditions: string[] = [];

            // Filter based on user role
            if (req.user?.role === 'rpa_developer') {
                conditions.push('(p.assigned_to = ? OR p.created_by = ?)');
                params.push(req.user.id, req.user.id);
            }

            // Un proyecto "Perdido" se saca del tablero de proyectos activos por defecto;
            // ?include_lost=true lo trae de vuelta (reportes de pipeline, Sub-proyecto G).
            if (req.query.include_lost !== 'true') {
                conditions.push("p.commercial_stage != 'lost'");
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY p.created_at DESC';
```

- [ ] **Step 4: `clientApproval` y `markProjectLost`**

Después de `approveProjectQuote` (Task 5), agregar:

```typescript
    // PATCH /api/projects/:id/client-approval
    clientApproval = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can approve client sign-off' });
                return;
            }

            const { id } = req.params;
            const project = await db.get('SELECT id, commercial_stage FROM projects WHERE id = ?', [id]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            if (project.commercial_stage !== 'quoting') {
                res.status(400).json({ error: `No se puede dar el OK del cliente desde la etapa '${project.commercial_stage}'` });
                return;
            }

            const approvedQuote = await db.get(`SELECT id FROM project_quotes WHERE project_id = ? AND status = 'approved'`, [id]);
            if (!approvedQuote) {
                res.status(400).json({ error: 'Se necesita una cotizacion aprobada antes de dar el OK del cliente' });
                return;
            }

            await db.run(
                `UPDATE projects SET commercial_stage = 'approved', client_approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
                [id]
            );

            await activityLogService.logActivity(
                req.user?.id, 'project', parseInt(id), 'client_approved',
                { commercial_stage: 'quoting' }, { commercial_stage: 'approved' }
            );

            const updated = await db.get('SELECT id, commercial_stage, client_approved_at FROM projects WHERE id = ?', [id]);
            res.json(updated);
        } catch (error) {
            logger.error('Client approval error:', error);
            res.status(500).json({ error: 'Failed to approve client sign-off' });
        }
    };

    // PATCH /api/projects/:id/mark-lost
    markProjectLost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can mark a project as lost' });
                return;
            }

            const { id } = req.params;
            const project = await db.get('SELECT id, commercial_stage FROM projects WHERE id = ?', [id]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            if (project.commercial_stage !== 'quoting') {
                res.status(400).json({ error: `No se puede marcar como perdido un proyecto en etapa '${project.commercial_stage}'` });
                return;
            }

            await db.run(`UPDATE projects SET commercial_stage = 'lost', updated_at = datetime('now') WHERE id = ?`, [id]);

            await activityLogService.logActivity(
                req.user?.id, 'project', parseInt(id), 'marked_lost',
                { commercial_stage: 'quoting' }, { commercial_stage: 'lost' }
            );

            const updated = await db.get('SELECT id, commercial_stage FROM projects WHERE id = ?', [id]);
            res.json(updated);
        } catch (error) {
            logger.error('Mark project lost error:', error);
            res.status(500).json({ error: 'Failed to mark project as lost' });
        }
    };
```

- [ ] **Step 5: Rutas**

En `backend/src/routes/projectRoutes.ts`, agregar junto a las demás rutas de etapa comercial:

```typescript
// PATCH /api/projects/:id/client-approval - OK del cliente (team_lead only)
router.patch('/:id/client-approval', authorize(['team_lead']), projectController.clientApproval);

// PATCH /api/projects/:id/mark-lost - Marcar como perdido (team_lead only)
router.patch('/:id/mark-lost', authorize(['team_lead']), projectController.markProjectLost);
```

- [ ] **Step 6: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/projectController && npx tsc --noEmit`
Expected: PASS (incluye los tests ya existentes de `getProjects`/`updateProject` del sub-proyecto A); tsc limpio.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.commercialStage.test.ts
git commit -m "feat(fase6b): OK del cliente, marcar perdido, bloqueo de precio tras aprobacion y filtro de perdidos en el tablero"
```

---

## Task 7: Horas presupuestadas por persona en `project_assignments`

**Contexto verificado:** `addProjectAssignments` (sub-proyecto A, `projectController.ts:863-953`) valida todo antes de borrar (`normalized` array) e inserta con columnas fijas; no hay `budgeted_hours` ni en la validacion ni en el INSERT. `getProjectAssignments` hace `SELECT pa.*, ...`, así que en cuanto la columna exista en `project_assignments` (Task 1) aparece sola en la respuesta para cualquier rol — a diferencia de `monthly_cost`/`hourly_rate`, que sí se enmascaran ahí mismo, `budgeted_hours` no es un dato secreto (ya es así con `hours_budgeted` a nivel de proyecto) y no requiere ningún cambio en `getProjectAssignments`.

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (`addProjectAssignments`)
- Test: `backend/src/__tests__/controllers/projectController.assignments.budgetedHours.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Produces: `POST /api/projects/:id/assignments` — cada elemento de `user_assignments` acepta ahora `budgeted_hours?: number | null` (≥ 0). Se guarda en `project_assignments.budgeted_hours` y aparece en la respuesta y en `GET /api/projects/:id/assignments` para cualquier rol.

- [ ] **Step 1: Test que falla**

Crear `backend/src/__tests__/controllers/projectController.assignments.budgetedHours.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user, body, params } as unknown as AuthenticatedRequest;
}

describe('ProjectController - horas presupuestadas por asignacion (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let projectId: number;
    let lead: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new ProjectController();
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P', ?)`, [users.lead]);
        projectId = project.id!;
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('guarda budgeted_hours por persona y lo devuelve tanto en la respuesta como al releer', async () => {
        const res = mockRes();
        await controller.addProjectAssignments(makeReq(lead, {
            user_assignments: [{ user_id: users.dev, allocation_percentage: 50, budgeted_hours: 120 }]
        }, { id: String(projectId) }), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const row = await testDb.get(
            'SELECT budgeted_hours FROM project_assignments WHERE project_id = ? AND user_id = ? AND is_active = 1',
            [projectId, users.dev]
        );
        expect(row.budgeted_hours).toBe(120);
    });

    it('budgeted_hours es opcional: sin indicarlo queda null y no falla', async () => {
        const res = mockRes();
        await controller.addProjectAssignments(makeReq(lead, {
            user_assignments: [{ user_id: users.ops }]
        }, { id: String(projectId) }), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const row = await testDb.get(
            'SELECT budgeted_hours FROM project_assignments WHERE project_id = ? AND user_id = ? AND is_active = 1',
            [projectId, users.ops]
        );
        expect(row.budgeted_hours).toBeNull();
    });

    it('rechaza con 400 un budgeted_hours negativo o no numerico y no toca el equipo actual', async () => {
        const before = await testDb.query('SELECT user_id FROM project_assignments WHERE project_id = ? AND is_active = 1', [projectId]);

        const res = mockRes();
        await controller.addProjectAssignments(makeReq(lead, {
            user_assignments: [{ user_id: users.dev, budgeted_hours: -5 }]
        }, { id: String(projectId) }), res);
        expect(res.status).toHaveBeenCalledWith(400);

        const res2 = mockRes();
        await controller.addProjectAssignments(makeReq(lead, {
            user_assignments: [{ user_id: users.dev, budgeted_hours: '120' as any }]
        }, { id: String(projectId) }), res2);
        expect(res2.status).toHaveBeenCalledWith(400);

        const after = await testDb.query('SELECT user_id FROM project_assignments WHERE project_id = ? AND is_active = 1', [projectId]);
        expect(after).toEqual(before);
    });

    it('un rpa_developer ve budgeted_hours en GET /assignments (no es un dato financiero secreto)', async () => {
        await controller.addProjectAssignments(makeReq(lead, {
            user_assignments: [{ user_id: users.dev, budgeted_hours: 80 }]
        }, { id: String(projectId) }), mockRes());

        const res = mockRes();
        await controller.getProjectAssignments(makeReq(dev, {}, { id: String(projectId) }), res);
        const rows = (res.json as jest.Mock).mock.calls[0][0];
        expect(rows[0]).toHaveProperty('budgeted_hours', 80);
        expect(rows[0]).not.toHaveProperty('monthly_cost');
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/projectController.assignments.budgetedHours.test.ts`
Expected: FAIL (`budgeted_hours` sale `undefined` en la fila insertada; el payload inválido con horas negativas no se rechaza).

- [ ] **Step 2: Agregar `budgeted_hours` a `addProjectAssignments`**

En `backend/src/controllers/projectController.ts`, reemplazar el bloque de validación y el tipo de `normalized` en `addProjectAssignments` (dentro del `for (const assignment of user_assignments)`):

```typescript
            const normalized: Array<{
                user_id: number; role: string; allocation_percentage: number;
                start_date: string | null; end_date: string | null; budgeted_hours: number | null;
            }> = [];

            for (const assignment of user_assignments) {
                const {
                    user_id, allocation_percentage = 100, role = 'contributor',
                    start_date = null, end_date = null, budgeted_hours = null
                } = assignment || {};

                if (!Number.isInteger(user_id) || user_id <= 0) {
                    res.status(400).json({ error: 'Cada asignación requiere un user_id válido' });
                    return;
                }
                if (seen.has(user_id)) {
                    res.status(400).json({ error: `El usuario ${user_id} está repetido en la asignación` });
                    return;
                }
                if (!ProjectController.ASSIGNMENT_ROLES.includes(role)) {
                    res.status(400).json({ error: `Rol de asignación inválido: ${role}` });
                    return;
                }
                if (!Number.isInteger(allocation_percentage) || allocation_percentage < 0 || allocation_percentage > 100) {
                    res.status(400).json({ error: 'La dedicación debe ser un entero entre 0 y 100' });
                    return;
                }
                if ((start_date !== null && !datePattern.test(start_date)) || (end_date !== null && !datePattern.test(end_date))) {
                    res.status(400).json({ error: 'Las fechas deben tener formato YYYY-MM-DD' });
                    return;
                }
                if (budgeted_hours !== null && (typeof budgeted_hours !== 'number' || !Number.isFinite(budgeted_hours) || budgeted_hours < 0)) {
                    res.status(400).json({ error: 'budgeted_hours debe ser un numero mayor o igual a 0' });
                    return;
                }
                const userExists = await db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', [user_id]);
                if (!userExists) {
                    res.status(400).json({ error: `El usuario ${user_id} no existe o está inactivo` });
                    return;
                }

                seen.add(user_id);
                normalized.push({ user_id, role, allocation_percentage, start_date, end_date, budgeted_hours });
            }
```

Y el `INSERT` dentro de la transacción:

```typescript
                for (const a of normalized) {
                    const result = await db.run(`
                        INSERT INTO project_assignments (
                            project_id, user_id, role, allocation_percentage, start_date, end_date, budgeted_hours, assigned_by, is_active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                    `, [id, a.user_id, a.role, a.allocation_percentage, a.start_date, a.end_date, a.budgeted_hours, userId]);

                    newAssignments.push({ id: result.id, project_id: Number(id), ...a, assigned_by: userId, is_active: 1 });
                }
```

- [ ] **Step 3: Correr tests y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/projectController && npx tsc --noEmit`
Expected: PASS (incluye `projectController.assignments.test.ts` del sub-proyecto A, que no manda `budgeted_hours` y debe seguir guardando `null` sin romperse); tsc limpio.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/__tests__/controllers/projectController.assignments.budgetedHours.test.ts
git commit -m "feat(fase6b): horas presupuestadas por persona al asignar equipo"
```

---

## Task 8: Frontend — pantalla de Clientes y Comerciales

**Contexto verificado:** no existe ningún tipo, método de `apiService` ni página para clientes/comerciales en el frontend (confirmado por el recon inicial). `apiService` (`frontend/src/services/api.ts:24-`) expone `get/post/put/delete` genéricos (líneas 686-704) pero **no** un `patch` genérico — hay que agregarlo, ya que `deactivateClient`/`deactivateSalesRep` y las rutas de etapa comercial (Task 11) son `PATCH`. El patrón de ruteo con guardia de rol está en `frontend/src/App.tsx:118-123` (`<ProtectedRoute requiredRoles={[...]}>`), y el de menú en `frontend/src/components/common/AppLayout.tsx:109-122` (`if (user?.role === 'team_lead' || user?.role === 'rpa_operations') { baseItems.push(...) }`).

**Files:**
- Create: `frontend/src/types/client.ts`
- Create: `frontend/src/types/salesRep.ts`
- Modify: `frontend/src/services/api.ts` (agregar `patch` genérico + métodos de clientes/comerciales)
- Create: `frontend/src/pages/clients/ClientsPage.tsx`
- Modify: `frontend/src/App.tsx` (nueva ruta `clients`)
- Modify: `frontend/src/components/common/AppLayout.tsx` (nuevo ítem de menú + `getPageTitle`)
- Test: `frontend/src/__tests__/pages/ClientsPage.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `GET/POST/PUT/PATCH /api/clients*`, `/api/sales-reps*` (Tasks 2 y 3).
- Produces: `apiService.patch<T>(url, data?, config?)`, `apiService.getClients/getClient/createClient/updateClient/deactivateClient/addClientContact/updateClientContact/deactivateClientContact`, `apiService.getSalesReps/createSalesRep/updateSalesRep/deactivateSalesRep`. Componente `<ClientsPage />` sin props, montado en la ruta `/clients`.

- [ ] **Step 1: Tipos**

Crear `frontend/src/types/client.ts`:

```typescript
export interface ClientContact {
  id: number;
  client_id: number;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: number;
  is_active: number;
}

export interface Client {
  id: number;
  name: string;
  tax_id: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface ClientDetail extends Client {
  contacts: ClientContact[];
}
```

Crear `frontend/src/types/salesRep.ts`:

```typescript
export interface SalesRep {
  id: number;
  name: string;
  email: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Test de `ClientsPage` que falla**

Crear `frontend/src/__tests__/pages/ClientsPage.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getClients: vi.fn(),
    getSalesReps: vi.fn(),
    createClient: vi.fn(),
    getClient: vi.fn(),
    addClientContact: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import ClientsPage from '@/pages/clients/ClientsPage';

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getClients as any).mockResolvedValue([
      { id: 1, name: 'Cliente A', tax_id: null, email: null, phone: null, is_active: 1 }
    ]);
    (apiService.getSalesReps as any).mockResolvedValue([]);
  });

  it('lista los clientes activos', async () => {
    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeInTheDocument());
  });

  it('crea un cliente nuevo desde el modal', async () => {
    (apiService.createClient as any).mockResolvedValue({ id: 2, name: 'Cliente B' });
    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /nuevo cliente/i }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Cliente B' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

    await waitFor(() =>
      expect(apiService.createClient).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cliente B' }))
    );
  });

  it('abre los contactos de un cliente y agrega uno nuevo, marcado como principal', async () => {
    (apiService.getClient as any).mockResolvedValue({ id: 1, name: 'Cliente A', contacts: [] });
    (apiService.addClientContact as any).mockResolvedValue({ id: 10, name: 'Ana' });
    render(<ClientsPage />);
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /contactos/i }));
    await waitFor(() => expect(apiService.getClient).toHaveBeenCalledWith(1));

    fireEvent.change(screen.getByPlaceholderText('Nombre'), { target: { value: 'Ana' } });
    fireEvent.click(screen.getByRole('button', { name: /agregar contacto/i }));

    await waitFor(() =>
      expect(apiService.addClientContact).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Ana' }))
    );
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/pages/ClientsPage.test.tsx`
Expected: FAIL ("Failed to resolve import").

- [ ] **Step 3: `patch` genérico y métodos de API**

En `frontend/src/services/api.ts`, agregar el import de tipos junto a los demás (`import { Client, ClientDetail } from '@/types/client';` y `import { SalesRep } from '@/types/salesRep';`), el método genérico justo después de `delete` (línea ~704):

```typescript
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.api.patch(url, data, config);
    return response.data;
  }
```

Y, junto a los demás métodos de proyecto, agregar:

```typescript
  // Clients & contacts (Fase 6b)
  async getClients(includeInactive = false): Promise<Client[]> {
    const response = await this.api.get('/clients', { params: includeInactive ? { include_inactive: 'true' } : undefined });
    return response.data;
  }

  async getClient(id: number): Promise<ClientDetail> {
    const response = await this.api.get(`/clients/${id}`);
    return response.data;
  }

  async createClient(data: Partial<Client>): Promise<Client> {
    const response = await this.api.post('/clients', data);
    return response.data;
  }

  async updateClient(id: number, data: Partial<Client>): Promise<Client> {
    const response = await this.api.put(`/clients/${id}`, data);
    return response.data;
  }

  async deactivateClient(id: number): Promise<void> {
    await this.api.patch(`/clients/${id}/deactivate`);
  }

  async addClientContact(clientId: number, data: Partial<ClientDetail['contacts'][number]>): Promise<ClientDetail['contacts'][number]> {
    const response = await this.api.post(`/clients/${clientId}/contacts`, data);
    return response.data;
  }

  async updateClientContact(
    clientId: number,
    contactId: number,
    data: Partial<ClientDetail['contacts'][number]>
  ): Promise<ClientDetail['contacts'][number]> {
    const response = await this.api.put(`/clients/${clientId}/contacts/${contactId}`, data);
    return response.data;
  }

  async deactivateClientContact(clientId: number, contactId: number): Promise<void> {
    await this.api.patch(`/clients/${clientId}/contacts/${contactId}/deactivate`);
  }

  // Sales reps (Fase 6b)
  async getSalesReps(includeInactive = false): Promise<SalesRep[]> {
    const response = await this.api.get('/sales-reps', { params: includeInactive ? { include_inactive: 'true' } : undefined });
    return response.data;
  }

  async createSalesRep(data: Partial<SalesRep>): Promise<SalesRep> {
    const response = await this.api.post('/sales-reps', data);
    return response.data;
  }

  async updateSalesRep(id: number, data: Partial<SalesRep>): Promise<SalesRep> {
    const response = await this.api.put(`/sales-reps/${id}`, data);
    return response.data;
  }

  async deactivateSalesRep(id: number): Promise<void> {
    await this.api.patch(`/sales-reps/${id}/deactivate`);
  }
```

- [ ] **Step 4: Implementar `ClientsPage`**

Crear `frontend/src/pages/clients/ClientsPage.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Card, Tabs, Table, Button, Modal, Form, Input, Switch, Space, Popconfirm, message, Typography } from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import { apiService } from '@/services/api';
import { Client, ClientDetail, ClientContact } from '@/types/client';
import { SalesRep } from '@/types/salesRep';

const { Text } = Typography;

const ClientsTab: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form] = Form.useForm();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [contactForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setClients(await apiService.getClients());
    } catch (error) {
      console.error('Error loading clients:', error);
      message.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditing(client);
    form.setFieldsValue(client);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await apiService.updateClient(editing.id, values);
        message.success('Cliente actualizado');
      } else {
        await apiService.createClient(values);
        message.success('Cliente creado');
      }
      setModalOpen(false);
      await load();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al guardar el cliente');
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await apiService.deactivateClient(id);
      message.success('Cliente desactivado');
      await load();
    } catch (error) {
      message.error('Error al desactivar el cliente');
    }
  };

  const openDetail = async (client: Client) => {
    try {
      setDetail(await apiService.getClient(client.id));
      setEditingContact(null);
      contactForm.resetFields();
      setDetailOpen(true);
    } catch (error) {
      message.error('Error al cargar los contactos');
    }
  };

  const reloadDetail = async () => {
    if (detail) setDetail(await apiService.getClient(detail.id));
  };

  const handleContactSubmit = async (values: any) => {
    if (!detail) return;
    try {
      if (editingContact) {
        await apiService.updateClientContact(detail.id, editingContact.id, values);
      } else {
        await apiService.addClientContact(detail.id, values);
      }
      contactForm.resetFields();
      setEditingContact(null);
      await reloadDetail();
    } catch (error) {
      message.error('Error al guardar el contacto');
    }
  };

  const handleDeactivateContact = async (contactId: number) => {
    if (!detail) return;
    await apiService.deactivateClientContact(detail.id, contactId);
    await reloadDetail();
  };

  return (
    <>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nuevo cliente
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={clients}
        columns={[
          { title: 'Nombre', dataIndex: 'name', key: 'name' },
          { title: 'RUT', dataIndex: 'tax_id', key: 'tax_id' },
          { title: 'Correo', dataIndex: 'email', key: 'email' },
          { title: 'Teléfono', dataIndex: 'phone', key: 'phone' },
          {
            title: 'Acciones',
            key: 'actions',
            render: (_: unknown, client: Client) => (
              <Space>
                <Button size="small" onClick={() => openDetail(client)}>Contactos</Button>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(client)} />
                <Popconfirm title="¿Desactivar este cliente?" onConfirm={() => handleDeactivate(client.id)}>
                  <Button size="small" danger icon={<StopOutlined />} />
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'El nombre es obligatorio' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="tax_id" label="RUT">
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Correo">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="Teléfono">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="Dirección">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="Notas">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Contactos de ${detail?.name ?? ''}`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={700}
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          style={{ marginBottom: 16 }}
          dataSource={detail?.contacts ?? []}
          columns={[
            { title: 'Nombre', dataIndex: 'name', key: 'name' },
            { title: 'Cargo', dataIndex: 'position', key: 'position' },
            { title: 'Correo', dataIndex: 'email', key: 'email' },
            { title: 'Teléfono', dataIndex: 'phone', key: 'phone' },
            {
              title: 'Principal',
              dataIndex: 'is_primary',
              key: 'is_primary',
              render: (value: number) => (value ? <Text strong>Principal</Text> : '—')
            },
            {
              title: '',
              key: 'actions',
              render: (_: unknown, contact: ClientContact) => (
                <Space>
                  <Button size="small" onClick={() => { setEditingContact(contact); contactForm.setFieldsValue(contact); }}>
                    Editar
                  </Button>
                  {contact.is_active === 1 && (
                    <Popconfirm title="¿Desactivar este contacto?" onConfirm={() => handleDeactivateContact(contact.id)}>
                      <Button size="small" danger>Desactivar</Button>
                    </Popconfirm>
                  )}
                </Space>
              )
            }
          ]}
        />

        <Form form={contactForm} layout="inline" onFinish={handleContactSubmit}>
          <Form.Item name="name" rules={[{ required: true, message: 'Nombre requerido' }]}>
            <Input placeholder="Nombre" />
          </Form.Item>
          <Form.Item name="position">
            <Input placeholder="Cargo" />
          </Form.Item>
          <Form.Item name="email">
            <Input placeholder="Correo" />
          </Form.Item>
          <Form.Item name="phone">
            <Input placeholder="Teléfono" />
          </Form.Item>
          <Form.Item name="is_primary" valuePropName="checked">
            <Switch checkedChildren="Principal" unCheckedChildren="Principal" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              {editingContact ? 'Guardar' : 'Agregar contacto'}
            </Button>
          </Form.Item>
          {editingContact && (
            <Form.Item>
              <Button onClick={() => { setEditingContact(null); contactForm.resetFields(); }}>Cancelar</Button>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
};

const SalesRepsTab: React.FC = () => {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalesRep | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      setReps(await apiService.getSalesReps());
    } catch (error) {
      message.error('Error al cargar comerciales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (rep: SalesRep) => {
    setEditing(rep);
    form.setFieldsValue(rep);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editing) {
        await apiService.updateSalesRep(editing.id, values);
      } else {
        await apiService.createSalesRep(values);
      }
      setModalOpen(false);
      await load();
    } catch (error) {
      message.error('Error al guardar el comercial');
    }
  };

  const handleDeactivate = async (id: number) => {
    await apiService.deactivateSalesRep(id);
    await load();
  };

  return (
    <>
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Nuevo comercial
        </Button>
      </div>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={reps}
        columns={[
          { title: 'Nombre', dataIndex: 'name', key: 'name' },
          { title: 'Correo', dataIndex: 'email', key: 'email' },
          {
            title: 'Acciones',
            key: 'actions',
            render: (_: unknown, rep: SalesRep) => (
              <Space>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(rep)} />
                <Popconfirm title="¿Desactivar este comercial?" onConfirm={() => handleDeactivate(rep.id)}>
                  <Button size="small" danger icon={<StopOutlined />} />
                </Popconfirm>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title={editing ? 'Editar comercial' : 'Nuevo comercial'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="Nombre" rules={[{ required: true, message: 'El nombre es obligatorio' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Correo">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

const ClientsPage: React.FC = () => (
  <Card>
    <Tabs
      items={[
        { key: 'clients', label: 'Clientes', children: <ClientsTab /> },
        { key: 'salesReps', label: 'Comerciales', children: <SalesRepsTab /> }
      ]}
    />
  </Card>
);

export default ClientsPage;
```

- [ ] **Step 5: Ruta y menú**

En `frontend/src/App.tsx`, agregar el import (`import ClientsPage from '@/pages/clients/ClientsPage';`) y, junto a la ruta `billing`:

```typescript
              {/* Clientes y Comerciales */}
              <Route path="clients" element={
                <ProtectedRoute requiredRoles={['team_lead', 'rpa_operations']}>
                  <ClientsPage />
                </ProtectedRoute>
              } />
```

En `frontend/src/components/common/AppLayout.tsx`, dentro del `if (user?.role === 'team_lead' || user?.role === 'rpa_operations')` (junto al ítem de `/billing`), agregar:

```typescript
      baseItems.push({
        key: '/clients',
        icon: <ContactsOutlined />,
        label: 'Clientes'
      });
```

(agregar `ContactsOutlined` al import de `@ant-design/icons` en ese archivo). Y en `getPageTitle`, junto al `case '/billing':`:

```typescript
      case '/clients':
        return 'Clientes';
```

- [ ] **Step 6: Correr tests, tipos y lint**

Run: `cd frontend && npx vitest run src/__tests__/pages/ClientsPage.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS (3 tests); tsc limpio; lint sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/client.ts frontend/src/types/salesRep.ts frontend/src/services/api.ts frontend/src/pages/clients/ClientsPage.tsx frontend/src/App.tsx frontend/src/components/common/AppLayout.tsx frontend/src/__tests__/pages/ClientsPage.test.tsx
git commit -m "feat(fase6b): pantalla de clientes con contactos y comerciales"
```

---

## Task 9: Frontend — wizard de alta de proyecto (pasos 1-2: Datos básicos y Cotización)

**Contexto verificado:** `CreateProjectModal.tsx` es hoy single-step y se usa tanto para crear como para editar (`ProjectsPage.tsx:75-83`, `handleCreateProject`/`handleEditProject` comparten el mismo modal vía `editingProject`). **Decisión de alcance de esta tarea:** en vez de reescribir ese modal (que debe seguir funcionando para *editar*, incluido el guardia de bloqueo de precio de la Task 6), se crea un componente nuevo `CreateProjectWizard.tsx` exclusivo para *crear*, y `ProjectsPage.tsx` cambia el botón "New Project" para abrir el wizard en vez del modal; el botón "Editar" de cada proyecto sigue abriendo `CreateProjectModal` sin cambios. `projects` no tiene columna para "contacto elegido por proyecto" (el plan original lo daba a entender pero no se pidió explícitamente esa columna) — se resuelve mostrando los contactos del cliente elegido como referencia de solo lectura en el paso 1, sin persistir una selección aparte; si más adelante se necesita, se agrega una columna dedicada. No existe ningún endpoint para listar `business_areas` (tabla sembrada con 2 filas desde la Fase 1, sin controller): se agrega uno mínimo, de solo lectura.

Esta tarea deja funcionando los pasos 1 y 2 del wizard (cada paso hace su propia llamada a la API al presionar "Siguiente": el proyecto ya existe en la BD desde el paso 1, en etapa `quoting`). Los pasos 3-5 y el cierre del wizard los agrega la Task 10.

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (agregar `getBusinessAreas`)
- Modify: `backend/src/routes/projectRoutes.ts` (ruta `GET /business-areas`, **antes** de `GET /:id`)
- Modify: `frontend/src/types/project.ts` (agregar campos de la Fase 6a/6b a `Project`)
- Modify: `frontend/src/services/api.ts` (agregar `getBusinessAreas`)
- Create: `frontend/src/components/projects/CreateProjectWizard.tsx`
- Test: `frontend/src/__tests__/components/CreateProjectWizard.test.tsx` (nuevo)
- Test: `backend/src/__tests__/controllers/projectController.businessAreas.test.ts` (nuevo, mocks simples)

**Interfaces:**
- Produces: `GET /api/projects/business-areas` → `{ id: number; name: string; code: string }[]`. `apiService.getBusinessAreas(): Promise<{id:number;name:string;code:string}[]>`. Componente `<CreateProjectWizard visible onCancel onSuccess={(project: Project) => void} />` (misma forma de props que `CreateProjectModal`, sin `editProject`).

- [ ] **Step 1: Test backend que falla**

Crear `backend/src/__tests__/controllers/projectController.businessAreas.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: { query: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - getBusinessAreas', () => {
    it('devuelve las areas activas', async () => {
        (db.query as jest.Mock).mockResolvedValue([{ id: 1, name: 'RPA/IA', code: 'RPA_IA' }]);
        const controller = new ProjectController();
        const res = mockRes();

        await controller.getBusinessAreas({ user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest, res);

        expect(res.json).toHaveBeenCalledWith([{ id: 1, name: 'RPA/IA', code: 'RPA_IA' }]);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('WHERE is_active = 1'));
    });
});
```

Run: `cd backend && npx jest src/__tests__/controllers/projectController.businessAreas.test.ts`
Expected: FAIL (`controller.getBusinessAreas is not a function`).

- [ ] **Step 2: Implementar `getBusinessAreas` y su ruta**

En `backend/src/controllers/projectController.ts`, agregar (por ejemplo junto a `getProjects`):

```typescript
    // GET /api/projects/business-areas - Lookup para el wizard de alta (Fase 6b)
    getBusinessAreas = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const areas = await db.query('SELECT id, name, code FROM business_areas WHERE is_active = 1 ORDER BY name');
            res.json(areas);
        } catch (error) {
            logger.error('Get business areas error:', error);
            res.status(500).json({ error: 'Failed to get business areas' });
        }
    };
```

En `backend/src/routes/projectRoutes.ts`, agregar **antes** de `router.get('/:id', projectController.getProject);` (si no, `/:id` la interceptaría):

```typescript
// GET /api/projects/business-areas - Lookup for the project wizard (Fase 6b)
router.get('/business-areas', projectController.getBusinessAreas);
```

- [ ] **Step 3: Correr tests backend y tipos**

Run: `cd backend && npx jest src/__tests__/controllers/projectController.businessAreas.test.ts && npx tsc --noEmit`
Expected: PASS; tsc limpio.

- [ ] **Step 4: Ampliar el tipo `Project` y agregar `getBusinessAreas` a `apiService`**

En `frontend/src/types/project.ts`, agregar a la interfaz `Project` (junto a `sale_price?: number;`):

```typescript
  client_id?: number | null;
  area_id?: number | null;
  pm_user_id?: number | null;
  sales_rep_id?: number | null;
  project_type?: 'internal' | 'commercial';
  currency?: string;
  commercial_stage?: 'quoting' | 'approved' | 'lost';
  client_approved_at?: string | null;
```

En `frontend/src/services/api.ts`, agregar junto a los demás métodos de proyecto:

```typescript
  async getBusinessAreas(): Promise<{ id: number; name: string; code: string }[]> {
    const response = await this.api.get('/projects/business-areas');
    return response.data;
  }
```

- [ ] **Step 5: Test de `CreateProjectWizard` que falla**

Crear `frontend/src/__tests__/components/CreateProjectWizard.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getClients: vi.fn(),
    getSalesReps: vi.fn(),
    getBusinessAreas: vi.fn(),
    getClient: vi.fn(),
    createProject: vi.fn(),
    post: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { CreateProjectWizard } from '@/components/projects/CreateProjectWizard';

describe('CreateProjectWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getClients as any).mockResolvedValue([{ id: 1, name: 'Cliente A' }]);
    (apiService.getSalesReps as any).mockResolvedValue([{ id: 5, name: 'Vendedor X' }]);
    (apiService.getBusinessAreas as any).mockResolvedValue([{ id: 2, name: 'RPA/IA', code: 'RPA_IA' }]);
  });

  it('paso 1: crea el proyecto y avanza al paso 2', async () => {
    (apiService.createProject as any).mockResolvedValue({ id: 42, name: 'Proyecto Nuevo', commercial_stage: 'quoting' });

    render(<CreateProjectWizard visible onCancel={() => {}} onSuccess={() => {}} />);
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), { target: { value: 'Proyecto Nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() =>
      expect(apiService.createProject).toHaveBeenCalledWith(expect.objectContaining({ name: 'Proyecto Nuevo' }))
    );
    await waitFor(() => expect(screen.getByText(/modelo de precio/i)).toBeInTheDocument());
  });

  it('paso 2: sube una cotizacion por horas y notifica el exito', async () => {
    (apiService.createProject as any).mockResolvedValue({ id: 42, name: 'Proyecto Nuevo', commercial_stage: 'quoting' });
    (apiService.post as any).mockResolvedValue({ id: 1, version: 1, status: 'sent' });
    const onSuccess = vi.fn();

    render(<CreateProjectWizard visible onCancel={() => {}} onSuccess={onSuccess} />);
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), { target: { value: 'Proyecto Nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByText(/modelo de precio/i)).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText(/por horas/i));
    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: '5000000' } });
    fireEvent.change(screen.getByLabelText(/^horas/i), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText(/tarifa por hora/i), { target: { value: '25000' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/projects/42/quotes', expect.any(FormData)));
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx`
Expected: FAIL ("Failed to resolve import").

- [ ] **Step 6: Implementar `CreateProjectWizard` (pasos 1-2)**

Crear `frontend/src/components/projects/CreateProjectWizard.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Modal, Steps, Form, Input, DatePicker, Select, Radio, InputNumber, Upload, Button, message, Typography } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { apiService } from '@/services/api';
import { Project } from '@/types/project';
import { Client, ClientDetail } from '@/types/client';
import { SalesRep } from '@/types/salesRep';

const { TextArea } = Input;
const { Text } = Typography;

interface CreateProjectWizardProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (project: Project) => void;
}

export const CreateProjectWizard: React.FC<CreateProjectWizardProps> = ({ visible, onCancel, onSuccess }) => {
  const [current, setCurrent] = useState(0);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [areas, setAreas] = useState<{ id: number; name: string; code: string }[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientDetail | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [quoteFile, setQuoteFile] = useState<UploadFile | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [basicsForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const pricingModel = Form.useWatch('pricing_model', quoteForm);

  useEffect(() => {
    if (!visible) return;
    setCurrent(0);
    setProject(null);
    setSelectedClient(null);
    setQuoteFile(null);
    basicsForm.resetFields();
    quoteForm.resetFields();
    quoteForm.setFieldsValue({ pricing_model: 'fixed', currency: 'CLP' });

    (async () => {
      try {
        const [clientsData, repsData, areasData] = await Promise.all([
          apiService.getClients(),
          apiService.getSalesReps(),
          apiService.getBusinessAreas()
        ]);
        setClients(clientsData);
        setSalesReps(repsData);
        setAreas(areasData);
      } catch (error) {
        console.error('Error loading wizard lookups:', error);
        message.error('Error al cargar clientes/comerciales/áreas');
      }
    })();
  }, [visible]);

  const handleClientChange = async (clientId: number) => {
    try {
      setSelectedClient(await apiService.getClient(clientId));
    } catch (error) {
      setSelectedClient(null);
    }
  };

  const handleBasicsNext = async () => {
    const values = await basicsForm.validateFields();
    setSaving(true);
    try {
      const created = await apiService.createProject({
        name: values.name,
        description: values.description,
        start_date: values.dates?.[0]?.format('YYYY-MM-DD'),
        end_date: values.dates?.[1]?.format('YYYY-MM-DD'),
        client_id: values.client_id,
        sales_rep_id: values.sales_rep_id,
        area_id: values.area_id
      });
      setProject(created);
      message.success('Proyecto creado en etapa "En cotización"');
      setCurrent(1);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al crear el proyecto');
    } finally {
      setSaving(false);
    }
  };

  const handleReadWithAI = async () => {
    if (!quoteFile) {
      message.error('Selecciona primero un archivo');
      return;
    }
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', (quoteFile.originFileObj || quoteFile) as File);
      const response = await apiService.post<{ quote_data: { expected_revenue?: number } }>(
        '/projects/upload-quote',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }
      );
      if (response.quote_data?.expected_revenue) {
        quoteForm.setFieldsValue({ amount: response.quote_data.expected_revenue });
        message.success('Datos precargados desde el documento');
      } else {
        message.info('No se encontró un monto en el documento; completa los datos manualmente');
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al leer el documento con IA');
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuoteNext = async () => {
    if (!project) return;
    const values = await quoteForm.validateFields();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('pricing_model', values.pricing_model);
      formData.append('amount', String(values.amount));
      formData.append('currency', values.currency);
      if (values.pricing_model === 'hourly') {
        formData.append('hours', String(values.hours));
        formData.append('hourly_rate', String(values.hourly_rate));
      }
      if (values.notes) formData.append('notes', values.notes);
      if (quoteFile) formData.append('file', (quoteFile.originFileObj || quoteFile) as File);

      await apiService.post(`/projects/${project.id}/quotes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Cotización v1 registrada');
      onSuccess(project);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al registrar la cotización');
    } finally {
      setSaving(false);
    }
  };

  const renderStep = () => {
    if (current === 0) {
      return (
        <Form form={basicsForm} layout="vertical">
          <Form.Item name="name" label="Nombre del proyecto" rules={[{ required: true, message: 'El nombre es obligatorio' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Descripción">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item name="dates" label="Fechas estimadas">
            <DatePicker.RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>
          <Form.Item name="client_id" label="Cliente">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={clients.map((c) => ({ label: c.name, value: c.id }))}
              onChange={handleClientChange}
            />
          </Form.Item>
          {selectedClient && selectedClient.contacts.length > 0 && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Contactos de {selectedClient.name}:{' '}
              {selectedClient.contacts.map((c) => `${c.name}${c.is_primary ? ' (principal)' : ''}`).join(', ')}
            </Text>
          )}
          <Form.Item name="sales_rep_id" label="Comercial">
            <Select allowClear options={salesReps.map((r) => ({ label: r.name, value: r.id }))} />
          </Form.Item>
          <Form.Item name="area_id" label="Área">
            <Select allowClear options={areas.map((a) => ({ label: a.name, value: a.id }))} />
          </Form.Item>
        </Form>
      );
    }

    return (
      <Form form={quoteForm} layout="vertical">
        <Form.Item name="pricing_model" label="Modelo de precio" rules={[{ required: true }]}>
          <Radio.Group>
            <Radio.Button value="fixed">Precio cerrado</Radio.Button>
            <Radio.Button value="hourly">Por horas</Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item name="amount" label="Monto" rules={[{ required: true, message: 'El monto es obligatorio' }]}>
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
        <Form.Item name="currency" label="Moneda" rules={[{ required: true }]}>
          <Select options={[{ label: 'CLP', value: 'CLP' }, { label: 'USD', value: 'USD' }, { label: 'UF', value: 'UF' }]} />
        </Form.Item>
        {pricingModel === 'hourly' && (
          <>
            <Form.Item name="hours" label="Horas" rules={[{ required: true, message: 'Las horas son obligatorias' }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="hourly_rate" label="Tarifa por hora" rules={[{ required: true, message: 'La tarifa es obligatoria' }]}>
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </>
        )}
        <Form.Item name="notes" label="Notas">
          <TextArea rows={2} />
        </Form.Item>
        <Upload.Dragger
          fileList={quoteFile ? [quoteFile] : []}
          beforeUpload={(file) => {
            setQuoteFile(file as unknown as UploadFile);
            return false;
          }}
          onRemove={() => setQuoteFile(null)}
          maxCount={1}
          accept=".pdf,.docx"
        >
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Adjuntar PDF/DOCX de la cotización (opcional)</p>
        </Upload.Dragger>
        <Button onClick={handleReadWithAI} loading={aiLoading} disabled={!quoteFile} style={{ marginTop: 12 }}>
          Leer con IA
        </Button>
      </Form>
    );
  };

  return (
    <Modal
      title="Nuevo proyecto"
      open={visible}
      onCancel={onCancel}
      width={700}
      destroyOnHidden
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          {current > 0 && <Button onClick={() => setCurrent(current - 1)}>Atrás</Button>}
          <Button
            type="primary"
            loading={saving}
            onClick={current === 0 ? handleBasicsNext : handleQuoteNext}
          >
            Siguiente
          </Button>
        </>
      }
    >
      <Steps
        current={current}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: 'Datos básicos' },
          { title: 'Cotización' },
          { title: 'Equipo' },
          { title: 'Resumen financiero' },
          { title: 'Hitos de pago' }
        ]}
      />
      {renderStep()}
    </Modal>
  );
};
```

- [ ] **Step 7: Correr tests y tipos**

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx && npx tsc --noEmit`
Expected: PASS (2 tests); tsc limpio (`onFinish`/`footer` sin usar todavía las validaciones de pasos 3-5, que llegan en la Task 10).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.businessAreas.test.ts frontend/src/types/project.ts frontend/src/services/api.ts frontend/src/components/projects/CreateProjectWizard.tsx frontend/src/__tests__/components/CreateProjectWizard.test.tsx
git commit -m "feat(fase6b): wizard de alta de proyecto, pasos Datos basicos y Cotizacion"
```

---

## Task 10: Frontend — wizard de alta (pasos 3-5: Equipo, Resumen financiero, Hitos de pago) y reemplazo del botón "New Project"

**Contexto verificado:** `POST /api/projects/:id/assignments` es `authorize(['team_lead'])` (ya así desde el sub-proyecto A) — un `rpa_operations` recibiría 403 si el wizard intentara llamarlo, por eso el paso "Equipo" se oculta para ese rol (igual que ya hace `CreateProjectModal.tsx:319-320` con el texto "Quedarás asignado a este proyecto"). El "aviso de sobrecarga si un dev ya tiene 3+ proyectos" que menciona el plan maestro depende del cálculo de FTE del **Sub-proyecto F** (`project_assignments` + `monthly_hours`), que todavía no existe como endpoint reusable (lo único parecido, `pmoController.getPMOAnalytics`, es código muerto que agrupa por un rol `'project_manager'` que no existe en la BD) — se deja fuera de esta tarea a propósito, documentado en "Fuera de alcance". `apiService.createPaymentMilestone(data)` y `getProjectROI(projectId)` ya existen (`api.ts:374-377`, y el método de hitos usado por `BillingPage.tsx`) y se reutilizan tal cual.

**Files:**
- Modify: `frontend/src/components/projects/CreateProjectWizard.tsx` (agregar pasos 2-4, cambiar el final de `handleQuoteNext`)
- Modify: `frontend/src/pages/projects/ProjectsPage.tsx` (el botón "New Project" abre el wizard; "Editar" sigue abriendo `CreateProjectModal`)
- Modify: `frontend/src/__tests__/components/CreateProjectWizard.test.tsx` (agregar los casos de los pasos nuevos)
- Test: `frontend/src/__tests__/pages/ProjectsPage.wizard.test.tsx` (nuevo, cubre solo el cableado del botón)

**Interfaces:**
- Consumes: `apiService.getUsers`, `apiService.post` (assignments), `apiService.getProjectROI`, `apiService.createPaymentMilestone` (todos ya existentes).
- Produces: `<CreateProjectWizard>` completo (5 pasos) montado desde `ProjectsPage` en el botón "New Project"; `<CreateProjectModal>` sigue existiendo sin cambios, usado solo para editar.

- [ ] **Step 1: Ampliar el test de `CreateProjectWizard`**

En `frontend/src/__tests__/components/CreateProjectWizard.test.tsx`, agregar al mock de `@/services/api` los métodos que faltan y los casos de los pasos 3-5:

```tsx
vi.mock('@/services/api', () => ({
  apiService: {
    getClients: vi.fn(),
    getSalesReps: vi.fn(),
    getBusinessAreas: vi.fn(),
    getClient: vi.fn(),
    getUsers: vi.fn(),
    getProjectROI: vi.fn(),
    createProject: vi.fn(),
    createPaymentMilestone: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'team_lead', full_name: 'Lead' } })
}));
```

Y agregar, dentro del mismo `describe('CreateProjectWizard', ...)`, después del test del paso 2:

```tsx
  async function goToTeamStep() {
    (apiService.createProject as any).mockResolvedValue({ id: 42, name: 'Proyecto Nuevo', commercial_stage: 'quoting' });
    (apiService.post as any).mockResolvedValue({ id: 1, version: 1, status: 'sent' });
    (apiService.getUsers as any).mockResolvedValue([{ id: 7, full_name: 'Dev Uno', email: 'd@x.cl', role: 'rpa_developer' }]);

    render(<CreateProjectWizard visible onCancel={() => {}} onSuccess={onSuccessSpy} />);
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), { target: { value: 'Proyecto Nuevo' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByText(/modelo de precio/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: '1000000' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByText(/persona/i)).toBeInTheDocument());
  }

  let onSuccessSpy: any;
  beforeEach(() => {
    onSuccessSpy = vi.fn();
  });

  it('paso 3: asigna una persona con horas y dedicacion, y avanza al resumen financiero', async () => {
    (apiService.post as any).mockImplementation((url: string) =>
      url.includes('/assignments') ? Promise.resolve({ message: 'ok' }) : Promise.resolve({ id: 1, version: 1, status: 'sent' })
    );
    (apiService.getProjectROI as any).mockResolvedValue({
      sale_price: 1000000, planned_cost: 400000, planned_profit: 600000, planned_roi: 150
    });

    await goToTeamStep();
    fireEvent.change(screen.getByLabelText(/persona 1/i), { target: { value: 7 } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() =>
      expect(apiService.post).toHaveBeenCalledWith('/projects/42/assignments', {
        user_assignments: [{ user_id: 7, allocation_percentage: 100, budgeted_hours: null, role: 'lead' }]
      })
    );
    await waitFor(() => expect(screen.getByText(/resumen financiero/i)).toBeInTheDocument());
  });

  it('paso 5: agrega un hito de pago y finaliza el wizard', async () => {
    (apiService.post as any).mockImplementation((url: string) =>
      url.includes('/assignments') ? Promise.resolve({ message: 'ok' }) : Promise.resolve({ id: 1, version: 1, status: 'sent' })
    );
    (apiService.getProjectROI as any).mockResolvedValue({
      sale_price: 1000000, planned_cost: 400000, planned_profit: 600000, planned_roi: 150
    });
    (apiService.createPaymentMilestone as any).mockResolvedValue({ id: 1 });

    await goToTeamStep();
    fireEvent.change(screen.getByLabelText(/persona 1/i), { target: { value: 7 } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByText(/resumen financiero/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByText(/hitos de pago/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /agregar hito/i }));
    fireEvent.change(screen.getByLabelText(/nombre del hito/i), { target: { value: 'Anticipo' } });
    fireEvent.change(screen.getByLabelText(/monto del hito/i), { target: { value: '300000' } });
    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }));

    await waitFor(() =>
      expect(apiService.createPaymentMilestone).toHaveBeenCalledWith(
        expect.objectContaining({ project_id: 42, name: 'Anticipo', amount: 300000, trigger_type: 'date' })
      )
    );
    await waitFor(() => expect(onSuccessSpy).toHaveBeenCalled());
  });

  it('rpa_operations no ve el paso de Equipo ni el resumen financiero completo', async () => {
    vi.doMock('@/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 2, role: 'rpa_operations', full_name: 'Ops' } }) }));
    (apiService.createProject as any).mockResolvedValue({ id: 43, name: 'P Ops', commercial_stage: 'quoting' });
    (apiService.post as any).mockResolvedValue({ id: 1, version: 1, status: 'sent' });

    render(<CreateProjectWizard visible onCancel={() => {}} onSuccess={() => {}} />);
    await waitFor(() => expect(screen.getByText('Cliente A')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/nombre del proyecto/i), { target: { value: 'P Ops' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByText(/modelo de precio/i)).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^monto/i), { target: { value: '1000000' } });
    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    await waitFor(() => expect(screen.getByText(/quedarás asignado/i)).toBeInTheDocument());
  });
```

(Nota: el último test usa `vi.doMock` para simular otro rol solo en ese caso; si el runner no permite cambiar el mock de módulo a mitad de archivo, moverlo a un `describe` separado con su propio `vi.mock` a nivel de archivo es una alternativa equivalente — cualquiera de las dos formas cumple el mismo caso.)

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx`
Expected: FAIL (los pasos 3-5 todavía no existen en el componente).

- [ ] **Step 2: Agregar los pasos 3-5 y el auth store**

En `frontend/src/components/projects/CreateProjectWizard.tsx`:

Agregar los imports que faltan:

```typescript
import { Descriptions, Space, Alert } from 'antd';
import { useAuthStore } from '@/store/authStore';
```

Agregar estado y formularios nuevos (junto a los ya existentes):

```typescript
  const { user } = useAuthStore();
  const isOperations = user?.role === 'rpa_operations';
  const [teamMembers, setTeamMembers] = useState<{ id: number; full_name: string }[]>([]);
  const [roi, setRoi] = useState<any | null>(null);
  const [teamForm] = Form.useForm();
  const [milestonesForm] = Form.useForm();
```

En el `useEffect` que carga `clients/salesReps/areas` al abrir el wizard, sumar la carga de usuarios:

```typescript
        const [clientsData, repsData, areasData, usersData] = await Promise.all([
          apiService.getClients(),
          apiService.getSalesReps(),
          apiService.getBusinessAreas(),
          apiService.getUsers()
        ]);
        setClients(clientsData);
        setSalesReps(repsData);
        setAreas(areasData);
        setTeamMembers(usersData);
```

Y en el mismo `useEffect`, resetear también los formularios nuevos:

```typescript
    teamForm.resetFields();
    milestonesForm.resetFields();
    setRoi(null);
```

Cambiar el final de `handleQuoteNext` (donde hoy llama `onSuccess(project)`) para que en cambio avance de paso:

```typescript
      await apiService.post(`/projects/${project.id}/quotes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Cotización v1 registrada');
      if (isOperations) {
        onSuccess(project);
      } else {
        setCurrent(2);
      }
```

(Un `rpa_operations` no puede llamar a `/assignments` ni ver el resumen financiero, así que para ese rol el wizard termina aquí, igual que hoy termina el modal de un solo paso para ese rol.)

Agregar los manejadores de los pasos 3-5:

```typescript
  const handleTeamNext = async () => {
    if (!project) return;
    if (isOperations) {
      setCurrent(3);
      return;
    }
    const values = await teamForm.validateFields();
    setSaving(true);
    try {
      const members = (values.members || []).filter((m: any) => m?.user_id);
      const user_assignments = members.map((m: any, index: number) => ({
        user_id: m.user_id,
        allocation_percentage: m.allocation_percentage ?? 100,
        budgeted_hours: m.budgeted_hours ?? null,
        role: index === 0 ? 'lead' : 'contributor'
      }));
      if (user_assignments.length > 0) {
        await apiService.post(`/projects/${project.id}/assignments`, { user_assignments });
      }
      if (!isOperations) {
        setRoi(await apiService.getProjectROI(project.id));
      }
      setCurrent(3);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al guardar el equipo');
    } finally {
      setSaving(false);
    }
  };

  const handleFinancialsNext = () => {
    setCurrent(4);
  };

  const handleFinish = async () => {
    if (!project) return;
    const values = await milestonesForm.validateFields().catch(() => ({ milestones: [] }));
    setSaving(true);
    try {
      const milestones = (values.milestones || []).filter((m: any) => m?.name && m?.amount);
      for (const milestone of milestones) {
        await apiService.createPaymentMilestone({
          project_id: project.id,
          name: milestone.name,
          amount: milestone.amount,
          currency: milestone.currency || 'CLP',
          trigger_type: 'date',
          planned_date: milestone.planned_date
        });
      }
      message.success('Proyecto creado exitosamente');
      onSuccess(project);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al guardar los hitos de pago');
    } finally {
      setSaving(false);
    }
  };
```

Agregar los 3 pasos al `renderStep` (reemplazar el `return (<Form form={quoteForm} ...>)` del paso de cotización para que, en vez de ser el único `else`, quede como `if (current === 1)`, y sumar los pasos 2-4 a continuación):

```typescript
    if (current === 2) {
      if (isOperations) {
        return <Alert type="info" showIcon message="Quedarás asignado automáticamente a este proyecto" />;
      }
      return (
        <Form form={teamForm} layout="vertical" initialValues={{ members: [{ allocation_percentage: 100 }] }}>
          <Form.List name="members">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item
                      {...field}
                      name={[field.name, 'user_id']}
                      rules={[{ required: true, message: 'Selecciona una persona' }]}
                    >
                      <Select
                        aria-label={`Persona ${index + 1}`}
                        style={{ width: 200 }}
                        placeholder="Persona"
                        options={teamMembers.map((m) => ({ label: m.full_name, value: m.id }))}
                      />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'allocation_percentage']}>
                      <InputNumber aria-label={`Dedicación ${index + 1}`} min={0} max={100} addonAfter="%" />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'budgeted_hours']}>
                      <InputNumber aria-label={`Horas presupuestadas ${index + 1}`} min={0} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button danger onClick={() => remove(field.name)}>Quitar</Button>
                    )}
                  </Space>
                ))}
                <Button onClick={() => add({ allocation_percentage: 100 })}>Agregar persona</Button>
              </>
            )}
          </Form.List>
        </Form>
      );
    }

    if (current === 3) {
      if (isOperations || !roi) {
        return <Alert type="info" showIcon message="Los datos financieros solo son visibles para Team Lead" />;
      }
      return (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="Precio de venta">{roi.sale_price?.toLocaleString('es-CL')}</Descriptions.Item>
          <Descriptions.Item label="Costo planificado">{roi.planned_cost?.toLocaleString('es-CL')}</Descriptions.Item>
          <Descriptions.Item label="Utilidad planificada">{roi.planned_profit?.toLocaleString('es-CL')}</Descriptions.Item>
          <Descriptions.Item label="ROI planificado">{roi.planned_roi}%</Descriptions.Item>
        </Descriptions>
      );
    }

    return (
      <Form form={milestonesForm} layout="vertical" initialValues={{ milestones: [] }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          Opcional: se pueden cargar hitos de pago ahora o después del OK del cliente.
        </Text>
        <Form.List name="milestones">
          {(fields, { add, remove }) => (
            <>
              {fields.map((field, index) => (
                <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item {...field} name={[field.name, 'name']} rules={[{ required: true, message: 'Nombre requerido' }]}>
                    <Input aria-label={`Nombre del hito ${index + 1}`} placeholder="Nombre del hito" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'amount']} rules={[{ required: true, message: 'Monto requerido' }]}>
                    <InputNumber aria-label={`Monto del hito ${index + 1}`} min={0} placeholder="Monto" />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'currency']} initialValue="CLP">
                    <Select
                      style={{ width: 90 }}
                      options={[{ label: 'CLP', value: 'CLP' }, { label: 'USD', value: 'USD' }, { label: 'UF', value: 'UF' }]}
                    />
                  </Form.Item>
                  <Form.Item {...field} name={[field.name, 'planned_date']}>
                    <DatePicker format="YYYY-MM-DD" placeholder="Fecha" />
                  </Form.Item>
                  <Button danger onClick={() => remove(field.name)}>Quitar</Button>
                </Space>
              ))}
              <Button onClick={() => add()}>Agregar hito</Button>
            </>
          )}
        </Form.List>
      </Form>
    );
```

Y actualizar el `footer` del `Modal` para que el botón final diga "Finalizar" y llame al manejador correcto según el paso:

```typescript
      footer={
        <>
          <Button onClick={onCancel}>Cancelar</Button>
          {current > 0 && <Button onClick={() => setCurrent(current - 1)}>Atrás</Button>}
          <Button
            type="primary"
            loading={saving}
            onClick={
              current === 0 ? handleBasicsNext :
              current === 1 ? handleQuoteNext :
              current === 2 ? handleTeamNext :
              current === 3 ? handleFinancialsNext :
              handleFinish
            }
          >
            {current === 4 ? 'Finalizar' : 'Siguiente'}
          </Button>
        </>
      }
```

- [ ] **Step 3: Correr tests y tipos del wizard**

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx && npx tsc --noEmit`
Expected: PASS (5 tests); tsc limpio.

- [ ] **Step 4: Test de cableado en `ProjectsPage`**

Crear `frontend/src/__tests__/pages/ProjectsPage.wizard.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/projects/CreateProjectWizard', () => ({
  CreateProjectWizard: ({ visible }: { visible: boolean }) =>
    visible ? <div data-testid="wizard-open">Wizard abierto</div> : null
}));

vi.mock('@/components/projects/CreateProjectModal', () => ({
  CreateProjectModal: () => null
}));

vi.mock('@/components/projects/QuoteUploadModal', () => ({
  QuoteUploadModal: () => null
}));

vi.mock('@/store/projectStore', () => ({
  useProjectStore: () => ({
    projects: [], loading: false, error: null,
    fetchProjects: vi.fn(), deleteProject: vi.fn(), clearError: vi.fn()
  })
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'team_lead', full_name: 'Lead' } })
}));

import ProjectsPage from '@/pages/projects/ProjectsPage';

describe('ProjectsPage - boton New Project abre el wizard', () => {
  it('abre CreateProjectWizard al hacer click en New Project', async () => {
    render(<MemoryRouter><ProjectsPage /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /new project/i }));

    await waitFor(() => expect(screen.getByTestId('wizard-open')).toBeInTheDocument());
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/pages/ProjectsPage.wizard.test.tsx`
Expected: FAIL (el botón sigue abriendo `CreateProjectModal`, no existe `wizard-open`).

- [ ] **Step 5: Cablear el botón en `ProjectsPage`**

En `frontend/src/pages/projects/ProjectsPage.tsx`:
- Agregar el import: `import { CreateProjectWizard } from '@/components/projects/CreateProjectWizard';`.
- Agregar el estado: `const [wizardVisible, setWizardVisible] = useState(false);`.
- Reemplazar `handleCreateProject` (líneas 75-78) por:

```typescript
  const handleCreateProject = () => {
    setWizardVisible(true);
  };
```

(`handleEditProject` no cambia — sigue usando `setCreateModalVisible(true)` con `editingProject` seteado.)

- Junto al `<CreateProjectModal ... />` existente (línea ~323), agregar:

```tsx
      <CreateProjectWizard
        visible={wizardVisible}
        onCancel={() => setWizardVisible(false)}
        onSuccess={(project) => {
          setWizardVisible(false);
          fetchProjects();
          navigate(`/projects/${project.id}`);
        }}
      />
```

- [ ] **Step 6: Correr tests, tipos y lint del frontend**

Run: `cd frontend && npx vitest run src/__tests__/pages/ProjectsPage.wizard.test.tsx src/__tests__/components/CreateProjectWizard.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS; tsc limpio; lint sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/projects/CreateProjectWizard.tsx frontend/src/pages/projects/ProjectsPage.tsx frontend/src/__tests__/components/CreateProjectWizard.test.tsx frontend/src/__tests__/pages/ProjectsPage.wizard.test.tsx
git commit -m "feat(fase6b): completa el wizard de alta (equipo, resumen financiero, hitos de pago) y lo cablea en Proyectos"
```

---

## Task 11: Frontend — pestaña "Cotizaciones" con etapa comercial en `ProjectDetailPage`

**Contexto verificado:** `ProjectDetailPage.tsx` arma sus pestañas con un array `items={[...]}` dentro de `<Tabs>` (línea 275-279); el ítem `'files'` (línea 546-567) usa `<FileManager entity_type="project" entity_id={project.id} ... />` como plantilla de cómo se agrega una pestaña nueva. `loadProjectData()` (línea 79) es la función que recarga `project` desde el store — se reutiliza como callback tras cualquier cambio de etapa o cotización.

**Files:**
- Modify: `frontend/src/services/api.ts` (agregar `getProjectQuotes`, `approveProjectQuote`, `clientApproval`, `markProjectLost`)
- Create: `frontend/src/components/projects/ProjectQuotesSection.tsx`
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx` (nuevo ítem de pestaña "Cotizaciones")
- Test: `frontend/src/__tests__/components/ProjectQuotesSection.test.tsx` (nuevo)

**Interfaces:**
- Produces: `apiService.getProjectQuotes(projectId)`, `apiService.approveProjectQuote(projectId, quoteId)`, `apiService.clientApproval(projectId)`, `apiService.markProjectLost(projectId)`. Componente `<ProjectQuotesSection projectId commercialStage onStageChange={() => void} />`.

- [ ] **Step 1: Métodos de API**

En `frontend/src/services/api.ts`, agregar junto a los demás métodos de proyecto:

```typescript
  // Project quotes & commercial stage (Fase 6b)
  async getProjectQuotes(projectId: number): Promise<any[]> {
    const response = await this.api.get(`/projects/${projectId}/quotes`);
    return response.data;
  }

  async approveProjectQuote(projectId: number, quoteId: number): Promise<any> {
    const response = await this.api.patch(`/projects/${projectId}/quotes/${quoteId}/approve`);
    return response.data;
  }

  async clientApproval(projectId: number): Promise<Project> {
    const response = await this.api.patch(`/projects/${projectId}/client-approval`);
    return response.data;
  }

  async markProjectLost(projectId: number): Promise<Project> {
    const response = await this.api.patch(`/projects/${projectId}/mark-lost`);
    return response.data;
  }
```

- [ ] **Step 2: Test que falla**

Crear `frontend/src/__tests__/components/ProjectQuotesSection.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectQuotes: vi.fn(),
    approveProjectQuote: vi.fn(),
    clientApproval: vi.fn(),
    markProjectLost: vi.fn(),
    post: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'team_lead', full_name: 'Lead' } })
}));

import { apiService } from '@/services/api';
import { ProjectQuotesSection } from '@/components/projects/ProjectQuotesSection';

describe('ProjectQuotesSection', () => {
  const onStageChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra la etapa En cotización y deshabilita OK del cliente sin cotizacion aprobada', async () => {
    (apiService.getProjectQuotes as any).mockResolvedValue([{ id: 1, version: 1, pricing_model: 'fixed', amount: 1000, currency: 'CLP', status: 'sent' }]);
    render(<ProjectQuotesSection projectId={7} commercialStage="quoting" onStageChange={onStageChange} />);

    await waitFor(() => expect(screen.getByText('Enviada')).toBeInTheDocument());
    expect(screen.getByText('En cotización')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ok del cliente/i })).toBeDisabled();
  });

  it('habilita OK del cliente cuando hay una cotizacion aprobada y lo ejecuta', async () => {
    (apiService.getProjectQuotes as any).mockResolvedValue([{ id: 1, version: 1, pricing_model: 'fixed', amount: 1000, currency: 'CLP', status: 'approved' }]);
    (apiService.clientApproval as any).mockResolvedValue({ commercial_stage: 'approved' });
    render(<ProjectQuotesSection projectId={7} commercialStage="quoting" onStageChange={onStageChange} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /ok del cliente/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /ok del cliente/i }));

    await waitFor(() => expect(apiService.clientApproval).toHaveBeenCalledWith(7));
    await waitFor(() => expect(onStageChange).toHaveBeenCalled());
  });

  it('aprueba una version enviada', async () => {
    (apiService.getProjectQuotes as any).mockResolvedValue([{ id: 5, version: 1, pricing_model: 'fixed', amount: 1000, currency: 'CLP', status: 'sent' }]);
    (apiService.approveProjectQuote as any).mockResolvedValue({ status: 'approved' });
    render(<ProjectQuotesSection projectId={7} commercialStage="quoting" onStageChange={onStageChange} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /aprobar/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /aprobar/i }));
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }));

    await waitFor(() => expect(apiService.approveProjectQuote).toHaveBeenCalledWith(7, 5));
  });

  it('marca el proyecto como perdido', async () => {
    (apiService.getProjectQuotes as any).mockResolvedValue([]);
    (apiService.markProjectLost as any).mockResolvedValue({ commercial_stage: 'lost' });
    render(<ProjectQuotesSection projectId={7} commercialStage="quoting" onStageChange={onStageChange} />);

    await waitFor(() => expect(screen.getByRole('button', { name: /marcar como perdido/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /marcar como perdido/i }));
    fireEvent.click(screen.getByRole('button', { name: /^yes$/i }));

    await waitFor(() => expect(apiService.markProjectLost).toHaveBeenCalledWith(7));
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectQuotesSection.test.tsx`
Expected: FAIL ("Failed to resolve import").

- [ ] **Step 3: Implementar `ProjectQuotesSection`**

Crear `frontend/src/components/projects/ProjectQuotesSection.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import {
  Card, Tag, Button, Table, Modal, Form, Input, Select, InputNumber, Upload, Radio, message, Space, Popconfirm
} from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const { TextArea } = Input;

const STAGE_LABELS: Record<string, { label: string; color: string }> = {
  quoting: { label: 'En cotización', color: 'gold' },
  approved: { label: 'En ejecución', color: 'green' },
  lost: { label: 'Perdido', color: 'red' }
};

const STATUS_LABELS: Record<string, string> = {
  sent: 'Enviada',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  replaced: 'Reemplazada'
};

interface ProjectQuotesSectionProps {
  projectId: number;
  commercialStage: 'quoting' | 'approved' | 'lost';
  onStageChange: () => void;
}

export const ProjectQuotesSection: React.FC<ProjectQuotesSectionProps> = ({ projectId, commercialStage, onStageChange }) => {
  const { user } = useAuthStore();
  const isTeamLead = user?.role === 'team_lead';
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState<UploadFile | null>(null);
  const [form] = Form.useForm();
  const pricingModel = Form.useWatch('pricing_model', form);

  const load = async () => {
    setLoading(true);
    try {
      setQuotes(await apiService.getProjectQuotes(projectId));
    } catch (error) {
      message.error('Error al cargar las cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const hasApprovedQuote = quotes.some((q) => q.status === 'approved');

  const openUpload = () => {
    form.resetFields();
    form.setFieldsValue({ pricing_model: 'fixed', currency: 'CLP' });
    setFile(null);
    setModalOpen(true);
  };

  const handleUpload = async (values: any) => {
    try {
      const formData = new FormData();
      formData.append('pricing_model', values.pricing_model);
      formData.append('amount', String(values.amount));
      formData.append('currency', values.currency);
      if (values.pricing_model === 'hourly') {
        formData.append('hours', String(values.hours));
        formData.append('hourly_rate', String(values.hourly_rate));
      }
      if (values.notes) formData.append('notes', values.notes);
      if (file) formData.append('file', (file.originFileObj || file) as File);

      await apiService.post(`/projects/${projectId}/quotes`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success('Cotización subida');
      setModalOpen(false);
      await load();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al subir la cotización');
    }
  };

  const handleApprove = async (quoteId: number) => {
    try {
      await apiService.approveProjectQuote(projectId, quoteId);
      message.success('Cotización aprobada');
      await load();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al aprobar la cotización');
    }
  };

  const handleClientApproval = async () => {
    try {
      await apiService.clientApproval(projectId);
      message.success('Proyecto pasado a ejecución');
      onStageChange();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al dar el OK del cliente');
    }
  };

  const handleMarkLost = async () => {
    try {
      await apiService.markProjectLost(projectId);
      message.success('Proyecto marcado como perdido');
      onStageChange();
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Error al marcar el proyecto como perdido');
    }
  };

  const stage = STAGE_LABELS[commercialStage] || STAGE_LABELS.quoting;

  return (
    <Card
      title="Cotizaciones"
      extra={
        <Space>
          <Tag color={stage.color}>{stage.label}</Tag>
          {isTeamLead && commercialStage === 'quoting' && (
            <>
              <Popconfirm title="¿Marcar este proyecto como perdido?" onConfirm={handleMarkLost}>
                <Button danger size="small">Marcar como perdido</Button>
              </Popconfirm>
              <Button type="primary" size="small" disabled={!hasApprovedQuote} onClick={handleClientApproval}>
                OK del cliente
              </Button>
            </>
          )}
          <Button size="small" onClick={openUpload}>Subir nueva versión</Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={quotes}
        pagination={false}
        columns={[
          { title: 'Versión', dataIndex: 'version', key: 'version' },
          { title: 'Modelo', dataIndex: 'pricing_model', key: 'pricing_model' },
          ...(isTeamLead
            ? [{ title: 'Monto', key: 'amount', render: (_: unknown, q: any) => `${q.amount?.toLocaleString('es-CL')} ${q.currency}` }]
            : []),
          { title: 'Estado', dataIndex: 'status', key: 'status', render: (value: string) => STATUS_LABELS[value] || value },
          {
            title: '',
            key: 'actions',
            render: (_: unknown, q: any) =>
              isTeamLead && q.status === 'sent' ? (
                <Popconfirm title="¿Aprobar esta cotización?" onConfirm={() => handleApprove(q.id)}>
                  <Button size="small" type="link">Aprobar</Button>
                </Popconfirm>
              ) : null
          }
        ]}
      />

      <Modal
        title="Subir nueva versión de cotización"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Guardar"
        cancelText="Cancelar"
      >
        <Form form={form} layout="vertical" onFinish={handleUpload}>
          <Form.Item name="pricing_model" label="Modelo de precio" rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="fixed">Precio cerrado</Radio.Button>
              <Radio.Button value="hourly">Por horas</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="amount" label="Monto" rules={[{ required: true, message: 'El monto es obligatorio' }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="currency" label="Moneda" rules={[{ required: true }]}>
            <Select options={[{ label: 'CLP', value: 'CLP' }, { label: 'USD', value: 'USD' }, { label: 'UF', value: 'UF' }]} />
          </Form.Item>
          {pricingModel === 'hourly' && (
            <>
              <Form.Item name="hours" label="Horas" rules={[{ required: true, message: 'Las horas son obligatorias' }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
              <Form.Item name="hourly_rate" label="Tarifa por hora" rules={[{ required: true, message: 'La tarifa es obligatoria' }]}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </>
          )}
          <Form.Item name="notes" label="Notas">
            <TextArea rows={2} />
          </Form.Item>
          <Upload.Dragger
            fileList={file ? [file] : []}
            beforeUpload={(f) => { setFile(f as unknown as UploadFile); return false; }}
            onRemove={() => setFile(null)}
            maxCount={1}
            accept=".pdf,.docx"
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Adjuntar PDF/DOCX (opcional)</p>
          </Upload.Dragger>
        </Form>
      </Modal>
    </Card>
  );
};
```

- [ ] **Step 4: Correr el test del componente**

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectQuotesSection.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Agregar la pestaña en `ProjectDetailPage`**

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, agregar el import (`import { ProjectQuotesSection } from '@/components/projects/ProjectQuotesSection';`) y, dentro del array `items` del `<Tabs>`, agregar un ítem nuevo justo antes del ítem `'files'` (línea ~546):

```typescript
            {
              key: 'quotes',
              label: (
                <span>
                  <FileTextOutlined />
                  Cotizaciones
                </span>
              ),
              children: (
                <ProjectQuotesSection
                  projectId={project.id}
                  commercialStage={project.commercial_stage || 'quoting'}
                  onStageChange={loadProjectData}
                />
              )
            },
```

(`FileTextOutlined` ya está importado en este archivo, usado por otro botón existente.)

- [ ] **Step 6: Correr tests, tipos y lint**

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectQuotesSection.test.tsx src/__tests__/pages/ProjectDetailPage.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS (sin romper los tests ya existentes de `ProjectDetailPage`); tsc limpio; lint sin errores nuevos. Si no existe `ProjectDetailPage.test.tsx`, correr solo el primero.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/services/api.ts frontend/src/components/projects/ProjectQuotesSection.tsx frontend/src/pages/projects/ProjectDetailPage.tsx frontend/src/__tests__/components/ProjectQuotesSection.test.tsx
git commit -m "feat(fase6b): pestana de cotizaciones, etapa comercial y OK del cliente / marcar perdido en el detalle del proyecto"
```

---

## Task 12: Frontend — pestaña "Documentos" tipificados

**Contexto verificado:** `file_associations.association_type` ya es texto libre sin `CHECK` (migración v11) y **ya está en uso** con los valores `'attachment'` (`FileManager.tsx:48`, `FilesPage.tsx:27`) y `'evidence'` (`EvidenceGallery.tsx:71,96`, y la pestaña "Files & Evidence" de `ProjectDetailPage.tsx:556-565`). Por eso esta tarea **no** agrega ningún `CHECK` ni validación nueva en el backend (rompería esos flujos existentes): solo define, en el frontend, 5 valores de negocio nuevos (`pdd`, `technical_doc`, `quote`, `contract`, `other`) y reutiliza `FileManager` **tal cual**, una instancia por tipo, cada una con su propio `association_type` fijo — el mismo patrón que ya usa la pestaña "Files & Evidence" con `association_type="evidence"`. Los archivos que suba la Task 4/11 al crear una versión de cotización ya se asocian con `association_type='quote'`, así que aparecen solos en la pestaña "Cotización" de aquí.

**Files:**
- Create: `frontend/src/components/projects/ProjectDocumentsTab.tsx`
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx` (nuevo ítem de pestaña "Documentos")
- Test: `frontend/src/__tests__/components/ProjectDocumentsTab.test.tsx` (nuevo)

**Interfaces:**
- Produces: `<ProjectDocumentsTab projectId={number} />`, sin llamadas a API propias (delega todo en `FileManager`).

- [ ] **Step 1: Test que falla**

Crear `frontend/src/__tests__/components/ProjectDocumentsTab.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const fileManagerSpy = vi.fn();
vi.mock('@/components/files', () => ({
  FileManager: (props: any) => {
    fileManagerSpy(props);
    return <div data-testid="file-manager">{props.association_type}</div>;
  }
}));

import { ProjectDocumentsTab } from '@/components/projects/ProjectDocumentsTab';

describe('ProjectDocumentsTab', () => {
  it('muestra las 5 pestañas de tipo de documento', () => {
    render(<ProjectDocumentsTab projectId={7} />);
    expect(screen.getByText('PDD')).toBeInTheDocument();
    expect(screen.getByText('Documentación técnica')).toBeInTheDocument();
    expect(screen.getByText('Cotización')).toBeInTheDocument();
    expect(screen.getByText('Contrato/OC')).toBeInTheDocument();
    expect(screen.getByText('Otro')).toBeInTheDocument();
  });

  it('cada pestaña pasa el association_type correcto y showUploadTab a FileManager', () => {
    render(<ProjectDocumentsTab projectId={7} />);
    fireEvent.click(screen.getByText('Contrato/OC'));

    expect(fileManagerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ entity_type: 'project', entity_id: 7, association_type: 'contract', showUploadTab: true })
    );
  });
});
```

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectDocumentsTab.test.tsx`
Expected: FAIL ("Failed to resolve import").

- [ ] **Step 2: Implementar `ProjectDocumentsTab`**

Crear `frontend/src/components/projects/ProjectDocumentsTab.tsx`:

```tsx
import React from 'react';
import { Tabs } from 'antd';
import { FileManager } from '@/components/files';

const DOCUMENT_TYPES: Array<{ key: string; label: string }> = [
  { key: 'pdd', label: 'PDD' },
  { key: 'technical_doc', label: 'Documentación técnica' },
  { key: 'quote', label: 'Cotización' },
  { key: 'contract', label: 'Contrato/OC' },
  { key: 'other', label: 'Otro' }
];

interface ProjectDocumentsTabProps {
  projectId: number;
}

export const ProjectDocumentsTab: React.FC<ProjectDocumentsTabProps> = ({ projectId }) => (
  <Tabs
    size="small"
    items={DOCUMENT_TYPES.map((type) => ({
      key: type.key,
      label: type.label,
      children: (
        <FileManager
          entity_type="project"
          entity_id={projectId}
          title={type.label}
          association_type={type.key}
          showUploadTab
        />
      )
    }))}
  />
);
```

- [ ] **Step 3: Correr el test**

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectDocumentsTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 4: Agregar la pestaña en `ProjectDetailPage`**

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, agregar el import (`import { ProjectDocumentsTab } from '@/components/projects/ProjectDocumentsTab';`) y, dentro del array `items` del `<Tabs>`, un ítem nuevo justo antes del ítem `'files'` (junto al de `'quotes'` agregado en la Task 11):

```typescript
            {
              key: 'documents',
              label: (
                <span>
                  <FolderOutlined />
                  Documentos
                </span>
              ),
              children: <ProjectDocumentsTab projectId={project.id} />
            },
```

(`FolderOutlined` ya está importado en este archivo, lo usa el ítem `'files'`.)

- [ ] **Step 5: Correr tests, tipos y lint**

Run: `cd frontend && npx vitest run src/__tests__/components/ProjectDocumentsTab.test.tsx && npx tsc --noEmit && npm run lint`
Expected: PASS; tsc limpio; lint sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/projects/ProjectDocumentsTab.tsx frontend/src/pages/projects/ProjectDetailPage.tsx frontend/src/__tests__/components/ProjectDocumentsTab.test.tsx
git commit -m "feat(fase6b): pestana de documentos tipificados (PDD, tecnico, cotizacion, contrato, otro) en el detalle del proyecto"
```

---

## Task 13: Verificación de punta a punta

**Files:** ninguno nuevo. Si esta verificación encuentra un fallo, se arregla en un commit propio que explique la causa.

- [ ] **Step 1: Suites completas, tipos y lint**

Run:
```bash
cd backend && npx tsc --noEmit && npm test && npm run lint
cd ../frontend && npx tsc --noEmit && npm test && npm run lint
```
Expected: todo en verde y lint sin errores nuevos.

- [ ] **Step 2: Recorrido en navegador (golden path + permisos) con Playwright**

Con backend (5001) y frontend (3000) corriendo, sobre la BD limpia:

1. Login `admin@rpa.com` / `admin123` (team_lead). Ir a **Clientes**: crear "Cliente Demo" con 2 contactos (uno marcado Principal). Crear un comercial "Vendedor Demo".
2. **Proyectos** → "New Project": paso 1 (nombre, cliente "Cliente Demo", comercial "Vendedor Demo", área RPA/IA) → el proyecto se crea y queda en etapa "En cotización". Paso 2: modelo "Por horas", monto, 200 horas, tarifa; se puede adjuntar un PDF y usar "Leer con IA" antes de continuar. Paso 3: asignar 1-2 personas con horas y % de dedicación. Paso 4: ver el resumen financiero (costo/utilidad/ROI planificados). Paso 5: agregar un hito de pago y "Finalizar" — navega al detalle del proyecto.
3. En el detalle: pestaña **Cotizaciones** muestra la v1 en estado "Enviada"; subir una v2 y **Aprobar** la v2 (la v1 pasa a "Reemplazada", y el precio de venta del proyecto refleja la v2). Botón **OK del cliente** habilitado; al presionarlo, la etiqueta pasa a "En ejecución" y desaparece "Marcar como perdido".
4. Editar el proyecto e intentar cambiar el precio de venta desde el modal de edición: debe rechazarse (la etapa ya es "En ejecución").
5. Pestaña **Documentos**: subir un PDF en "PDD" y otro en "Contrato/OC"; confirmar que cada uno aparece solo en su propia pestaña, y que el PDF de la cotización v2 aparece automáticamente en la pestaña "Cotización".
6. Crear un segundo proyecto de prueba, no dar el OK del cliente, y usar **Marcar como perdido**: desaparece del tablero de **Proyectos** (`/projects`), pero sigue existiendo (`GET /api/projects?include_lost=true` lo trae de vuelta, verificable desde la consola del navegador).
7. Login `dev1@rpa.com` (rpa_developer): en la pestaña Cotizaciones de un proyecto asignado, la tabla no muestra la columna "Monto"; `GET /api/projects/:id/quotes` no trae `amount` ni `hourly_rate` en las herramientas de red del navegador.
8. Login como un usuario `rpa_operations`: crear un proyecto nuevo con el wizard — el paso "Equipo" muestra el aviso de autoasignación (sin selector de personas) y el paso "Resumen financiero" no muestra montos.

- [ ] **Step 3: Registrar cierre**

No mergear. Reportar al usuario (en lenguaje llano, sin código) qué quedó construido y preguntar con el menú de `superpowers:finishing-a-development-branch`.

---

## Fuera de alcance (a propósito)

- El "aviso de sobrecarga si un dev ya tiene 3+ proyectos" en el paso "Equipo" del wizard: depende del cálculo de FTE del **Sub-proyecto F**, que todavía no existe de forma reutilizable (lo único parecido es código muerto en `pmoController`). Se agrega cuando F se construya.
- Revertir un proyecto "Perdido" de vuelta a "En cotización": no se pidió, y no hay caso de negocio claro todavía.
- Rechazar explícitamente una cotización (estado `rejected`): la tabla lo soporta (`CHECK` incluye `'rejected'`), pero no hay endpoint ni botón para setearlo en esta fase — hoy una cotización solo pasa a `sent → approved` o `sent → replaced` (al aprobarse otra). Si se necesita marcar una cotización como rechazada por el cliente sin subir una nueva versión, se agrega un endpoint pequeño más adelante.
- El rol "Facturación", los avisos automáticos de hitos de pago y el correo: Sub-proyecto D.
- Margen proyectado, desvíos en tiempo real y alertas de ROI evaluadas durante la ejecución: Sub-proyecto C.
- Bitácora técnica del proyecto: Sub-proyecto E.
- Dashboard de portafolio y pipeline de cotizaciones: Sub-proyecto G.
- No se auditó exhaustivamente cada endpoint que hace `SELECT p.*` (dashboards, búsqueda global, reportes) en busca de fuga de `commercial_stage`/cotizaciones — esos datos no son tan sensibles como `sale_price` y no se tocaron fuera de `getProjects`/`getProject`/`ProjectQuotesSection`.
- `CreateProjectModal.tsx` conserva su rama de "creación" sin usar (ver Task 9): no se eliminó por ser el mínimo cambio de riesgo; se puede limpiar en una pasada de deuda técnica futura si se confirma que nunca se vuelve a invocar sin `editProject`.

## Self-Review

- **Cobertura del diseño (10 secciones acordadas en el brainstorming):**
  - Clientes + contactos múltiples, con contacto principal opcional: Task 2 (backend), Task 8 (frontend).
  - Comerciales: Task 3 (backend), Task 8 (frontend).
  - Etapa comercial (quoting/approved/lost), OK del cliente, marcar perdido, bloqueo de precio: Task 1 (columnas), Task 6 (backend), Task 11 (frontend).
  - Cotizaciones con historial, aprobación, financieros ocultos a no-`team_lead`: Task 1 (tabla), Task 4 y 5 (backend), Task 9/10 (alta) y Task 11 (detalle del proyecto).
  - Documentos tipificados: Task 12.
  - Equipo con horas presupuestadas por persona: Task 7 (backend), Task 10 (frontend).
  - Wizard de alta en 5 pasos, con Operaciones viendo un flujo reducido: Tasks 9 y 10.
- **Agregados necesarios, no listados explícitamente en el diseño original:**
  - `GET /api/projects/business-areas` (Task 9): sin él, el paso 1 del wizard no podría ofrecer un selector de área — la tabla existe desde la Fase 1 pero nunca tuvo API.
  - `?include_lost=true` en `getProjects` (Task 6): necesario para que "Perdido" no sea un callejón sin salida de datos (se pidió que quedara disponible para reportes futuros).
  - Rol de `rpa_operations` ampliado en `POST /upload-quote` (Task 4): coherente con la decisión de que Operaciones también sube cotizaciones.
- **Placeholders:** no hay TBD. Todos los pasos con código lo traen completo. Las dos referencias a "Sub-proyecto F/D/C/E/G" son límites de alcance explícitos, no trabajo pendiente de esta rama.
- **Consistencia de tipos/nombres:** `stripQuoteFinancials`/`QUOTE_FINANCIAL_FIELDS` (Task 4) se reutilizan sin cambios en Task 5 y Task 6. `commercial_stage`/`client_approved_at` (Task 1) se leen y escriben con el mismo nombre en Tasks 6, 9, 10 y 11. `budgeted_hours` de `project_assignments` (Task 7) es el mismo campo que llena el wizard en Task 10. `Client`/`ClientDetail`/`ClientContact` (Task 8) son los mismos tipos que usa `CreateProjectWizard` (Task 9) para mostrar los contactos del cliente elegido.
- **Review Focus:**
  - Backfill de `commercial_stage='approved'` en proyectos preexistentes: Task 1.
  - Bloqueo de precio/horas tras `approved` en `updateProject`: Task 6.
  - Aprobar una cotización reemplaza las demás `sent`: Task 5.
  - Un `rpa_developer` no ve `amount`/`hourly_rate` de ninguna cotización: Tasks 4 y 5.
  - Desactivar cliente/contacto no rompe proyectos que ya los referencian: Task 2 (los `id` no se tocan, solo `is_active`; ningún `DELETE` en todo el plan sobre `clients`/`client_contacts`/`sales_reps`).

