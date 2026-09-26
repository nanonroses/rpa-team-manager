# Fase 6 · Sub-proyecto B — Pendientes reales de la ficha comercial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar lo que un rediseño UX/UI paralelo dejó pendiente de la ficha comercial: permisos de rutas comerciales alineados con la decisión de negocio ya tomada, selector de área de negocio, persistencia del PDF de cotización leído por IA, rechazo explícito de una cotización, el wizard de alta de proyecto en 5 pasos, una pestaña "Documentos" con las 5 categorías acordadas, y cobertura de tests para todo el módulo comercial nuevo (clientes, comerciales, cotizaciones) que hoy no tiene ninguna.

**Architecture:** No se toca el modelo de datos de clientes/comerciales/cotizaciones/etapa comercial — ya existe y funciona (migraciones v38-v41, `clientController.ts`, `commercialController.ts`). (1) Se corrigen 8 rutas en `commercialRoutes.ts` que hoy restringen a `team_lead` en el middleware `authorize()` aunque el controller ya implementa una regla más permisiva (`canManage` = `team_lead`+`rpa_operations`) — alineación pura de permisos, sin tocar lógica de negocio. (2) Un endpoint mínimo de solo lectura para `business_areas` (tabla ya existe desde Fase 1, sin API) y su selector en el formulario de alta. (3) `projectController.uploadQuote` deja de borrar siempre el archivo temporal: lo registra en la tabla `files` (deduplicado por hash) y devuelve su `file_id` en la respuesta; el llamador (el wizard) pasa ese `file_id` directo al crear la cotización (`commercialController.createQuote` ya acepta un `file_id` explícito en el body, sin pasar por `file_associations`). (4) Nuevo endpoint `rejectQuote` en `commercialController.ts`, mismo patrón que `approveQuote` pero seteando `status='rejected'`. (5) `CreateProjectModal.tsx` (hoy un único formulario de 437 líneas con todos los campos comerciales ya aplanados) se mantiene sin cambios y sigue siendo el único camino para **editar** un proyecto existente; un componente nuevo, `CreateProjectWizard.tsx`, atiende solo la **creación** con un flujo de 5 pasos (Ant Design `Steps`): el proyecto, la cotización y las asignaciones se crean recién al terminar el paso "Equipo", para que el paso "Resumen financiero" (solo `team_lead`) pueda consultar el costo estimado de un proyecto que ya existe. (6) La pestaña "Documentos" de `ProjectDetailPage.tsx` (hoy `FileManager` con `association_type="evidence"` fijo, un cajón sin tipos) pasa a tener 4 sub-pestañas con sus propios `association_type` (`doc_pdd`, `doc_technical`, `doc_contract`, `doc_other`); la 5ª categoría acordada ("Cotización") no se duplica ahí — se resuelve mostrando el archivo de cada versión directamente en la tabla de cotizaciones de `ProjectCommercialSection.tsx`. Esto no toca `project_commercial_documents` (esa tabla sigue siendo el mecanismo de negocio para PDD/propuesta/OC/HES/aprobación del cliente que condiciona `startExecution`/`acceptDelivery` — no es lo mismo que "un archivo con una etiqueta", y mezclar ambos rompería esas reglas). (7) Tests nuevos con SQLite real (`backend/src/__tests__/helpers/realTestDb.ts`) para clientes/comerciales/cotizaciones, seguidos del mismo patrón que `projectController.financials.test.ts`.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend, Jest + ts-jest + supertest). React 18/TypeScript/Ant Design 5 (frontend, Vitest + Testing Library). Sin dependencias nuevas.

**Spec:** Diseño de 10 secciones acordado en el brainstorming del sub-proyecto B (ver plan superseded `docs/superpowers/plans/2026-09-26-fase6b-ficha-comercial.md` para el contexto histórico) + diagnóstico de brechas verificado contra el código real tras el rediseño UX/UI paralelo (ver memoria de sesión `fase6b_estado_real_vs_plan.md`).

## Global Constraints

- Rama de trabajo: `codex/redisenio-ux-ui-pmo` (tiene el checkpoint del rediseño + avance parcial de Fase 6b ya commiteado en `2705301`). No crear rama nueva. No mergear ni pushear a `origin` sin preguntar al usuario.
- Roles reales (CHECK de `users.role`): `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`.
- Acceso a BD siempre vía `db.query` / `db.get` / `db.run` (nunca `db.all`). Mismas firmas que en fases anteriores (`backend/src/database/database.ts`).
- Patrón de permisos ya usado en `commercialController.ts`: `canManage(role)` = `team_lead` o `rpa_operations` (gestión operativa: crear/subir/editar), `canSeeFinancials(role)` = solo `team_lead` (montos, tarifas, márgenes). Acciones que cierran una etapa de negocio (`approveQuote`, `approveClient`, `markLost`, `closeFinancials`, `estimateQuoteCost`) son y siguen siendo solo `team_lead` — no relajar esas.
- Cada endpoint comercial que lea/escriba datos de un proyecto usa `checkProjectAccess`/`respondAccess` (ya definidos como métodos privados en `CommercialController`) para que un `rpa_developer` solo vea proyectos donde está asignado, creado o es responsable.
- Rutas comerciales montadas en `backend/src/server.ts:161-162`: `commercialRoutes` bajo `/api/commercial`, `clientRoutes` bajo `/api` directo (`/api/clients`, `/api/sales-reps`).
- Tests backend con SQLite real: helper ya existente `backend/src/__tests__/helpers/realTestDb.ts` (`createRealTestDb`, `realDbHolder`, `realDbProxy`, `seedBasicUsers`). Molde de test de controller real: `backend/src/__tests__/controllers/projectController.financials.test.ts`.
- Tests frontend: Vitest (`import { describe, it, expect, vi, beforeEach } from 'vitest'`).
- Convención visual del rediseño: usar `frontend/src/components/common/designTokens.ts` y `FeedbackStates.tsx`, y los patrones ya usados en `ClientsPage.tsx`/`ProjectCommercialSection.tsx` (Ant Design, `Tabs` anidados, `Card` + `Table` + `Empty`) — no reinventar estilos nuevos.
- Textos visibles al usuario en español.
- Cada tarea termina con `npx tsc --noEmit` limpio en el paquete tocado y commit propio (en la rama actual, sin crear una nueva).

## Decisiones ya tomadas que este plan respeta (no volver a preguntar)

- `rpa_operations` puede subir/gestionar cotizaciones y documentos comerciales de sus propios proyectos; **solo `team_lead` aprueba, rechaza, da el OK del cliente o marca perdido/cierra finanzas**.
- Moneda de cotizaciones: CLP, UF y USD.
- Contacto principal de cliente: opcional.
- Documentos tipificados: PDD, Documentación técnica, Cotización, Contrato/OC, Otro (los 5 acordados en el brainstorming original).
- El precio/horas del proyecto viven solo en `project_financials` y se actualizan únicamente vía `approveQuote` — no existe ni se agrega un guard de "precio bloqueado" en `updateProject` porque el proyecto nunca recibe el precio por esa vía.

## Review Focus

- **Relajar `authorize(['team_lead'])` a rutas donde el controller ya permite `rpa_operations` no debe abrir esas rutas a `rpa_developer`/`it_support`**: el propio controller (`canManage`) sigue rechazando esos roles con 403. Test en Task 1.
- **Un `rpa_developer` asignado a un proyecto ahora puede LEER `GET /api/commercial/projects/:id/quotes` (antes 403 total), pero nunca debe ver `amount`/`hourly_rate`/`estimated_cost`/`margin_percent`** en esa respuesta. Test en Task 1.
- **Subir el PDF de una cotización con "Leer con IA" debe persistirlo de forma segura y deduplicada** (un archivo con el mismo contenido reutiliza la fila existente en `files` en vez de acumular copias) — el archivo persiste aunque el usuario luego no confirme ninguna cotización con él; no se recorta ese caso porque no rompe nada (queda una fila en `files` sin asociación, igual que cualquier archivo subido y no usado en el resto del sistema). Test en Task 3.
- **Rechazar una cotización que no está en estado `sent` debe rechazarse con 409**, igual que ya hace `approveQuote`. Test en Task 4.
- **El wizard nuevo para `rpa_operations` no debe mostrarle el paso "Resumen financiero"; el paso "Equipo" le muestra solo el aviso de autoasignación, sin selector de personas** (mismo comportamiento que el modal actual). Test en Task 6.
- **La versión de cotización aprobada debe quedar identificable con su archivo adjunto** en la tabla de versiones (columna "Archivo"), sin necesidad de subirlo de nuevo en otro lado. Test en Task 7.
- **Ningún test nuevo de clientes/comerciales/cotizaciones debe usar mocks manuales de `db`** para lo que toque integridad relacional (versiones, reemplazo automático, FKs) — usar SQLite real. Verificado en el self-review de Task 8.

---

## Task 1: Alinear los permisos de `commercialRoutes.ts` con lo que ya implementan los controllers

**Contexto verificado:** `commercialRoutes.ts` (líneas 9, 10, 13, 15, 16, 17, 18, 20) pone `authorize(['team_lead'])` delante de 8 endpoints cuyo controller ya implementa una regla más permisiva con `canManage(role)` (`team_lead` o `rpa_operations`, definida en `commercialController.ts:8`): `getQuotes`, `createQuote`, `startExecution`, `updateRequirements`, `getDocuments`, `addDocument`, `acceptDelivery`, `getCapacity`. Hoy un `rpa_operations` recibe 403 antes de llegar al controller, aunque la decisión de negocio confirmada en el brainstorming dice que también debe poder subir/gestionar cotizaciones y documentos de sus propios proyectos. Las rutas que sí deben seguir siendo solo `team_lead` (`approveQuote`, `approveClient`, `markLost`, `closeFinancials`, `estimateQuoteCost`) ya coinciden entre ruta y controller — no se tocan. El molde de test real para esto es `backend/src/__tests__/routes/financialRoutes.auth.test.ts` (mockea `authenticate` para inyectar `req.user` desde un header de test, monta el router real con `supertest`).

**Files:**
- Modify: `backend/src/routes/commercialRoutes.ts`
- Test: `backend/src/__tests__/routes/commercialRoutes.auth.test.ts` (nuevo, SQLite real + supertest)

**Interfaces:**
- Consumes: `createRealTestDb`, `realDbHolder`, `realDbProxy`, `seedBasicUsers` (`backend/src/__tests__/helpers/realTestDb.ts`, ya existente).
- Produces: sin cambios de firma pública; solo cambia qué roles pasan el middleware de cada ruta.

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/src/__tests__/routes/commercialRoutes.auth.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: require('../helpers/realTestDb').realDbProxy
}));

jest.mock('../../middleware/auth', () => {
    const actual = jest.requireActual('../../middleware/auth');
    return {
        ...actual,
        authenticate: (req: any, _res: any, next: any) => {
            req.user = { id: Number(req.headers['x-test-user-id']), role: req.headers['x-test-role'] };
            next();
        }
    };
});

import express from 'express';
import request from 'supertest';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';
import commercialRoutes from '../../routes/commercialRoutes';

const app = express();
app.use(express.json());
app.use('/api/commercial', commercialRoutes);

function headers(role: string, userId: number) {
    return { 'x-test-role': role, 'x-test-user-id': String(userId) };
}

describe('commercialRoutes - permisos alineados con canManage (team_lead + rpa_operations)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let unassignedDevId: number;
    let projectId: number;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        const unassignedDev = await testDb.run(
            `INSERT INTO users (username, email, password_hash, full_name, role) VALUES ('dev2', 'dev2@x.cl', 'h', 'Dev Dos', 'rpa_developer')`
        );
        unassignedDevId = unassignedDev.id!;
        const project = await testDb.run(`INSERT INTO projects (name, created_by, assigned_to) VALUES ('P', ?, ?)`, [users.lead, users.ops]);
        projectId = project.id!;
        await testDb.run(
            `INSERT INTO project_assignments (project_id, user_id, role, allocation_percentage, is_active, assigned_by) VALUES (?, ?, 'contributor', 100, 1, ?)`,
            [projectId, users.dev, users.lead]
        );
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('rpa_operations ya no recibe 403 de la ruta en los 8 endpoints relajados', async () => {
        const calls: Array<['get' | 'post' | 'patch', string, any]> = [
            ['get', `/api/commercial/projects/${projectId}/quotes`, undefined],
            ['post', `/api/commercial/projects/${projectId}/quotes`, { amount: 100, currency: 'CLP' }],
            ['get', `/api/commercial/projects/${projectId}/documents`, undefined],
            ['post', `/api/commercial/projects/${projectId}/documents`, { document_type: 'pdd', reference_number: 'R1' }],
            ['patch', `/api/commercial/projects/${projectId}/requirements`, { require_purchase_order: true }],
            ['get', `/api/commercial/projects/${projectId}/capacity`, undefined],
            ['post', `/api/commercial/projects/${projectId}/start-execution`, {}],
            ['post', `/api/commercial/projects/${projectId}/delivery-acceptance`, {}]
        ];
        for (const [method, url, body] of calls) {
            const res = await request(app)[method](url).set(headers('rpa_operations', users.ops)).send(body ?? {});
            expect({ url, status: res.status }).not.toEqual({ url, status: 403 });
        }
    });

    it('rpa_developer y it_support siguen sin poder gestionar (403 del controller, no de la ruta)', async () => {
        const manageOnly: Array<['get' | 'post' | 'patch', string, any]> = [
            ['post', `/api/commercial/projects/${projectId}/quotes`, { amount: 100, currency: 'CLP' }],
            ['post', `/api/commercial/projects/${projectId}/documents`, { document_type: 'pdd', reference_number: 'R1' }],
            ['patch', `/api/commercial/projects/${projectId}/requirements`, { require_purchase_order: true }],
            ['get', `/api/commercial/projects/${projectId}/capacity`, undefined],
            ['post', `/api/commercial/projects/${projectId}/start-execution`, {}],
            ['post', `/api/commercial/projects/${projectId}/delivery-acceptance`, {}]
        ];
        for (const role of ['rpa_developer', 'it_support']) {
            for (const [method, url, body] of manageOnly) {
                const res = await request(app)[method](url).set(headers(role, users.dev)).send(body ?? {});
                expect({ role, url, status: res.status }).toEqual({ role, url, status: 403 });
            }
        }
    });

    it('un rpa_developer asignado puede leer las cotizaciones sin ver montos; uno no asignado recibe 403', async () => {
        const assigned = await request(app).get(`/api/commercial/projects/${projectId}/quotes`).set(headers('rpa_developer', users.dev));
        expect(assigned.status).toBe(200);
        for (const quote of assigned.body.data) {
            expect(quote).not.toHaveProperty('amount');
            expect(quote).not.toHaveProperty('hourly_rate');
            expect(quote).not.toHaveProperty('estimated_cost');
            expect(quote).not.toHaveProperty('margin_percent');
        }

        const notAssigned = await request(app).get(`/api/commercial/projects/${projectId}/quotes`).set(headers('rpa_developer', unassignedDevId));
        expect(notAssigned.status).toBe(403);
    });

    it('team_lead sigue viendo los montos completos de las cotizaciones', async () => {
        const res = await request(app).get(`/api/commercial/projects/${projectId}/quotes`).set(headers('team_lead', users.lead));
        expect(res.status).toBe(200);
        expect(res.body.data.some((q: any) => q.amount === 100)).toBe(true);
    });

    it('las rutas que siguen siendo solo team_lead (aprobar, OK cliente, perdido, cierre financiero, estimar costo) rechazan a rpa_operations con 403', async () => {
        const teamLeadOnly: Array<['get' | 'post', string, any]> = [
            ['post', `/api/commercial/projects/${projectId}/client-approval`, {}],
            ['post', `/api/commercial/projects/${projectId}/lost`, { reason: 'x' }],
            ['post', `/api/commercial/projects/${projectId}/financial-close`, {}],
            ['get', `/api/commercial/projects/${projectId}/quote-cost-estimate?hours=1&currency=CLP`, undefined]
        ];
        for (const [method, url, body] of teamLeadOnly) {
            const res = await request(app)[method](url).set(headers('rpa_operations', users.ops)).send(body ?? {});
            expect({ url, status: res.status }).toEqual({ url, status: 403 });
        }
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/routes/commercialRoutes.auth.test.ts`
Expected: FAIL. Los casos de `rpa_operations` en el primer `it` reciben 403 (bloqueados por la ruta antes de llegar al controller).

- [ ] **Step 3: Relajar las 8 rutas**

En `backend/src/routes/commercialRoutes.ts`, quitar `authorize(['team_lead']), ` de las líneas de `getQuotes`, `createQuote`, `startExecution`, `updateRequirements`, `getDocuments`, `addDocument`, `acceptDelivery` y `getCapacity`. El archivo completo queda:

```typescript
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { commercialController } from '../controllers/commercialController';

const router = Router();
router.use(authenticate);
router.get('/projects/:projectId/meetings', commercialController.getMeetings);
router.post('/projects/:projectId/meetings', commercialController.createMeeting);
router.get('/projects/:projectId/quotes', commercialController.getQuotes);
router.post('/projects/:projectId/quotes', commercialController.createQuote);
router.post('/quotes/:quoteId/approve', authorize(['team_lead']), commercialController.approveQuote);
router.post('/projects/:projectId/client-approval', authorize(['team_lead']), commercialController.approveClient);
router.post('/projects/:projectId/start-execution', commercialController.startExecution);
router.post('/projects/:projectId/lost', authorize(['team_lead']), commercialController.markLost);
router.patch('/projects/:projectId/requirements', commercialController.updateRequirements);
router.get('/projects/:projectId/documents', commercialController.getDocuments);
router.post('/projects/:projectId/documents', commercialController.addDocument);
router.post('/projects/:projectId/delivery-acceptance', commercialController.acceptDelivery);
router.post('/projects/:projectId/financial-close', authorize(['team_lead']), commercialController.closeFinancials);
router.get('/projects/:projectId/capacity', commercialController.getCapacity);
router.get('/projects/:projectId/quote-cost-estimate', authorize(['team_lead']), commercialController.estimateQuoteCost);

export default router;
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd backend && npx jest src/__tests__/routes/commercialRoutes.auth.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Verificar tipos y commit**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores.

```bash
git add backend/src/routes/commercialRoutes.ts backend/src/__tests__/routes/commercialRoutes.auth.test.ts
git commit -m "fix(fase6b): alinea permisos de rutas comerciales con canManage (rpa_operations gestiona, solo team_lead aprueba/cierra)"
```

---

## Task 2: Selector de área de negocio en el alta de proyecto

**Contexto verificado:** `business_areas(id, name, code, is_active)` existe desde la migración 25 (`backend/src/database/migrationList.ts:1258-1265`) con dos filas sembradas (`RPA/IA`, `SAP`). `projects.area_id` existe desde la migración 27 pero **no hay ningún endpoint GET que liste `business_areas`** (confirmado: solo aparece en `migrationList.ts` y en un test de financieros que la siembra directamente). `CreateProjectModal.tsx` ya carga clientes y comerciales en `loadCommercialDirectories` (líneas 99-110) y ya postea `client_id`/`client_contact_id`/`sales_rep_id` (líneas 167-169), pero nunca `area_id`. El selector de cliente/contacto/comercial solo se muestra al crear (`{!isEdit && <>...</>}`, líneas 265-275) — el área sigue el mismo patrón por consistencia (no se edita después de creado, igual que cliente/comercial hoy).

**Files:**
- Modify: `backend/src/controllers/clientController.ts` (agregar `listBusinessAreas`)
- Modify: `backend/src/routes/clientRoutes.ts` (agregar `GET /business-areas`)
- Test: `backend/src/__tests__/controllers/clientController.businessAreas.test.ts` (nuevo, SQLite real)
- Modify: `frontend/src/components/projects/CreateProjectModal.tsx` (`loadCommercialDirectories` y el bloque `{!isEdit && ...}`)
- Modify: `frontend/src/components/projects/CreateProjectModal.tsx` (`handleSubmit`, agregar `area_id` a `projectData`)

**Interfaces:**
- Produces: `GET /api/business-areas` → `{ data: Array<{ id: number; name: string; code: string }> }` (solo activas, cualquier rol autenticado).

- [ ] **Step 1: Test backend que falla**

Crear `backend/src/__tests__/controllers/clientController.businessAreas.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { clientController } from '../../controllers/clientController';
import { createRealTestDb, realDbHolder, RealTestDb } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(role: string): AuthenticatedRequest {
    return { user: { id: 1, role } } as unknown as AuthenticatedRequest;
}

describe('clientController.listBusinessAreas', () => {
    let testDb: RealTestDb;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('devuelve las areas activas sembradas por la migracion 25, sin exigir un rol especifico', async () => {
        const res = mockRes();
        await clientController.listBusinessAreas(makeReq('rpa_developer'), res);
        const body = (res.json as jest.Mock).mock.calls[0][0];
        expect(body.data.map((a: any) => a.code).sort()).toEqual(['RPA_IA', 'SAP']);
    });

    it('no devuelve areas desactivadas', async () => {
        await testDb.run(`UPDATE business_areas SET is_active = 0 WHERE code = 'SAP'`);
        const res = mockRes();
        await clientController.listBusinessAreas(makeReq('team_lead'), res);
        const body = (res.json as jest.Mock).mock.calls[0][0];
        expect(body.data.map((a: any) => a.code)).toEqual(['RPA_IA']);
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/controllers/clientController.businessAreas.test.ts`
Expected: FAIL con `clientController.listBusinessAreas is not a function`.

- [ ] **Step 3: Implementar el endpoint**

En `backend/src/controllers/clientController.ts`, agregar al final de la clase (antes del `}` de cierre, línea 87):

```typescript
  listBusinessAreas = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const areas = await db.query(`SELECT id, name, code FROM business_areas WHERE is_active = 1 ORDER BY name`);
    res.json({ data: areas });
  };
```

En `backend/src/routes/clientRoutes.ts`, agregar tras la línea `router.use(authenticate);`:

```typescript
router.get('/business-areas', clientController.listBusinessAreas);
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd backend && npx jest src/__tests__/controllers/clientController.businessAreas.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Selector en el frontend**

En `frontend/src/components/projects/CreateProjectModal.tsx`, agregar el estado y la carga junto a `clients`/`salesReps` (líneas 30-31, 99-110):

```typescript
  const [businessAreas, setBusinessAreas] = useState<any[]>([]);
```

```typescript
  const loadCommercialDirectories = async () => {
    try {
      const [clientResponse, salesResponse, areaResponse] = await Promise.all([
        apiService.request<any>({ url: '/clients' }),
        apiService.request<any>({ url: '/sales-reps' }),
        apiService.request<any>({ url: '/business-areas' })
      ]);
      setClients(clientResponse?.data || []);
      setSalesReps(salesResponse?.data || []);
      setBusinessAreas(areaResponse?.data || []);
    } catch (error) {
      console.warn('No se pudieron cargar clientes, comerciales o areas:', error);
    }
  };
```

Agregar el campo dentro del bloque `{!isEdit && <>...</>}` (después de `sales_rep_id`, línea 274):

```typescript
          <Form.Item name="area_id" label="Área de negocio"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el área" options={businessAreas.map((area) => ({ value: area.id, label: area.name }))} /></Form.Item>
```

Y agregar `area_id: values.area_id` a `projectData` en `handleSubmit` (junto a `sales_rep_id`, línea 169):

```typescript
        sales_rep_id: values.sales_rep_id,
        area_id: values.area_id,
```

- [ ] **Step 6: Verificar tipos y commit**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: sin errores en ningún paquete.

```bash
git add backend/src/controllers/clientController.ts backend/src/routes/clientRoutes.ts backend/src/__tests__/controllers/clientController.businessAreas.test.ts frontend/src/components/projects/CreateProjectModal.tsx
git commit -m "feat(fase6b): endpoint y selector de area de negocio al crear un proyecto"
```

---

## Task 3: Persistir el PDF de cotización leído por IA

**Contexto verificado:** `uploadQuote` (`backend/src/controllers/projectController.ts:1070-1150`) guarda el archivo con `multer` en un directorio real y estable (`backend/uploads/quotes`, `projectRoutes.ts:11`, no es un temporal del sistema operativo), pero **siempre** llama a `this.documentParserService.cleanupFile(uploadedFilePath)` tras leerlo con `LLMService.extractQuoteDataFromDocument` (línea 1127), incluso cuando la lectura fue exitosa — el archivo nunca llega a existir como fila en la tabla `files`. `commercialController.createQuote` (`backend/src/controllers/commercialController.ts:96,112`) ya acepta un `file_id` explícito en el body y lo usa directo en el INSERT, así que la solución no necesita tocar `createQuote`: basta con que `uploadQuote` registre el archivo en `files` (mismo patrón que `fileController.uploadFiles`, `backend/src/controllers/fileController.ts:100-153`: hash SHA-256 para deduplicar, columnas `filename/original_filename/file_path/file_size/mime_type/file_extension/file_hash/uploaded_by`) y devuelva su `id` en la respuesta, para que el frontend se lo pase a `createQuote` cuando el usuario confirme la versión. Además, `POST /api/projects/upload-quote` (`projectRoutes.ts:117-120`) restringe con `authorize(['team_lead'])`, la misma inconsistencia de permisos que la Task 1 corrigió en `commercialRoutes.ts` — se corrige aquí de paso porque esta tarea ya toca ese endpoint.

**Files:**
- Modify: `backend/src/controllers/projectController.ts` (imports, `uploadQuote`)
- Modify: `backend/src/routes/projectRoutes.ts` (línea 118)
- Test: `backend/src/__tests__/controllers/projectController.uploadQuote.test.ts` (nuevo)

**Interfaces:**
- Produces: `POST /api/projects/upload-quote` responde `{ message, quote_data, file_id: number }` (antes no traía `file_id`). Nada más cambia de forma.

- [ ] **Step 1: Test que falla**

Crear `backend/src/__tests__/controllers/projectController.uploadQuote.test.ts`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

jest.mock('../../services/llmService', () => ({
    LLMService: jest.fn().mockImplementation(() => ({
        extractQuoteDataFromDocument: jest.fn().mockResolvedValue({ project_name: 'Proyecto IA', budgeted_cost: 1000000 })
    }))
}));

const cleanupFile = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/documentParserService', () => ({
    DocumentParserService: jest.fn().mockImplementation(() => ({
        validateFileType: jest.fn().mockReturnValue(true),
        cleanupFile
    }))
}));

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

function tempPdf(content: string): string {
    const filePath = path.join(os.tmpdir(), `quote-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(filePath, content);
    return filePath;
}

function makeReq(user: { id: number; role: string }, filePath: string, originalname = 'cotizacion.pdf'): AuthenticatedRequest {
    return {
        user,
        body: {},
        file: { path: filePath, originalname, filename: path.basename(filePath), size: fs.statSync(filePath).size, mimetype: 'application/pdf' }
    } as unknown as AuthenticatedRequest;
}

describe('ProjectController.uploadQuote - persiste el archivo en vez de borrarlo', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        controller = new ProjectController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    beforeEach(() => cleanupFile.mockClear());

    it('guarda el archivo en la tabla files y devuelve file_id sin borrarlo', async () => {
        const filePath = tempPdf('contenido-a');
        const res = mockRes();

        await controller.uploadQuote(makeReq({ id: users.lead, role: 'team_lead' }, filePath), res);

        const body = (res.json as jest.Mock).mock.calls[0][0];
        expect(body.quote_data.project_name).toBe('Proyecto IA');
        expect(typeof body.file_id).toBe('number');
        expect(cleanupFile).not.toHaveBeenCalled();

        const fileRow = await testDb.get('SELECT file_path, uploaded_by FROM files WHERE id = ?', [body.file_id]);
        expect(fileRow).toMatchObject({ file_path: filePath, uploaded_by: users.lead });
    });

    it('un segundo archivo con el mismo contenido reutiliza la fila existente y limpia la copia duplicada', async () => {
        const first = tempPdf('contenido-b');
        const res1 = mockRes();
        await controller.uploadQuote(makeReq({ id: users.lead, role: 'team_lead' }, first), res1);
        const firstFileId = (res1.json as jest.Mock).mock.calls[0][0].file_id;

        const second = tempPdf('contenido-b');
        const res2 = mockRes();
        await controller.uploadQuote(makeReq({ id: users.lead, role: 'team_lead' }, second), res2);
        const secondFileId = (res2.json as jest.Mock).mock.calls[0][0].file_id;

        expect(secondFileId).toBe(firstFileId);
        expect(cleanupFile).toHaveBeenCalledWith(second);

        const rows = await testDb.query('SELECT id FROM files WHERE file_path IN (?, ?)', [first, second]);
        expect(rows).toHaveLength(1);
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/controllers/projectController.uploadQuote.test.ts`
Expected: FAIL. `body.file_id` es `undefined` y `cleanupFile` sí fue llamado en el primer caso.

- [ ] **Step 3: Implementar la persistencia**

En `backend/src/controllers/projectController.ts`, agregar el import junto a los existentes (línea 11):

```typescript
import * as crypto from 'crypto';
```

Reemplazar el bloque de las líneas 1126-1137 (desde `// Clean up uploaded file` hasta el `res.status(200).json(...)`) por:

```typescript
            // Persistir el archivo en vez de borrarlo, para poder asociarlo a la version de cotizacion que el usuario confirme despues.
            const fileBuffer = await fs.promises.readFile(uploadedFilePath);
            const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
            const fileExtension = path.extname(file.originalname).toLowerCase().substring(1);

            const existingFile = await db.get('SELECT id FROM files WHERE file_hash = ? AND is_deleted = 0', [fileHash]);
            let fileId: number;
            if (existingFile) {
                fileId = existingFile.id;
                await this.documentParserService.cleanupFile(uploadedFilePath);
            } else {
                const inserted = await db.run(`
                    INSERT INTO files (
                        filename, original_filename, file_path, file_size, mime_type,
                        file_extension, file_hash, uploaded_by, description, is_public
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                `, [
                    file.filename, file.originalname, uploadedFilePath, file.size, file.mimetype,
                    fileExtension, fileHash, userId, 'Cotizacion leida con IA'
                ]);
                fileId = inserted.id!;
            }

            logger.info('Quote processed successfully', {
                project_name: quoteData.project_name,
                user_id: userId,
                file_id: fileId
            });

            res.status(200).json({
                message: 'Quote processed successfully',
                quote_data: quoteData,
                file_id: fileId
            });
```

- [ ] **Step 4: Corregir el permiso de la ruta**

En `backend/src/routes/projectRoutes.ts:118`, cambiar:

```typescript
    authorize(['team_lead']),
```

por:

```typescript
    authorize(['team_lead', 'rpa_operations']),
```

(en la ruta `POST /upload-quote`, línea 117-120).

- [ ] **Step 5: Correr y verificar que pasa**

Run: `cd backend && npx jest src/__tests__/controllers/projectController.uploadQuote.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Verificar tipos, suite completa y commit**

Run: `cd backend && npx tsc --noEmit && npx jest src/__tests__/controllers/projectController`
Expected: sin errores; los tests existentes de `projectController` (incluido `listAndQuote`) siguen en PASS.

```bash
git add backend/src/controllers/projectController.ts backend/src/routes/projectRoutes.ts backend/src/__tests__/controllers/projectController.uploadQuote.test.ts
git commit -m "fix(fase6b): persiste el PDF de cotizacion leido por IA en vez de borrarlo, devuelve file_id"
```

---

## Task 4: Rechazar una cotización explícitamente

**Contexto verificado:** `project_quotes.status` ya admite `'rejected'` (CHECK de la migración 38, `migrationList.ts:1686`) pero ningún método de `commercialController.ts` lo setea — solo existe el camino `sent → approved` (`approveQuote`, líneas 128-154) o `sent → replaced` (efecto secundario de aprobar otra versión). El patrón a imitar es el mismo `approveQuote` (validación de rol, de estado `sent`, `activityLogService.logActivity`). En el frontend, el botón "Marcar perdida" (`ProjectCommercialSection.tsx:138`) usa `modal.confirm` con un `Input.TextArea` para pedir un motivo (función `requestLost`, líneas 82-91) — se replica el mismo patrón para pedir el motivo del rechazo. El botón "Validar versión" está en `quoteColumns` (línea 128, dentro de la columna `Acción`, visible solo si `isLead` y `row.status === 'sent'`).

**Files:**
- Modify: `backend/src/controllers/commercialController.ts` (agregar `rejectQuote`)
- Modify: `backend/src/routes/commercialRoutes.ts` (agregar `POST /quotes/:quoteId/reject`)
- Test: `backend/src/__tests__/controllers/commercialController.rejectQuote.test.ts` (nuevo, SQLite real)
- Modify: `frontend/src/components/projects/ProjectCommercialSection.tsx` (columna `Acción` de `quoteColumns`, línea 128)

**Interfaces:**
- Produces: `POST /api/commercial/quotes/:quoteId/reject` con body `{ reason: string }`, solo `team_lead`. 400 si falta `reason`, 404 si la cotización no existe, 409 si no está en `'sent'`. Devuelve `{ data: <quote actualizada> }`.

- [ ] **Step 1: Test backend que falla**

Crear `backend/src/__tests__/controllers/commercialController.rejectQuote.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { commercialController } from '../../controllers/commercialController';
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

describe('commercialController.rejectQuote', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let projectId: number;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('P', ?)`, [users.lead]);
        projectId = project.id!;
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    async function insertQuote(version: number, status = 'sent'): Promise<number> {
        const row = await testDb.run(
            `INSERT INTO project_quotes (project_id, version, amount, currency, status, created_by) VALUES (?, ?, 1000, 'CLP', ?, ?)`,
            [projectId, version, status, users.lead]
        );
        return row.id!;
    }

    it('rpa_operations no puede rechazar (403)', async () => {
        const quoteId = await insertQuote(1);
        const res = mockRes();
        await commercialController.rejectQuote(makeReq({ id: users.ops, role: 'rpa_operations' }, { reason: 'x' }, { quoteId: String(quoteId) }), res);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('exige un motivo (400)', async () => {
        const quoteId = await insertQuote(2);
        const res = mockRes();
        await commercialController.rejectQuote(makeReq({ id: users.lead, role: 'team_lead' }, {}, { quoteId: String(quoteId) }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('team_lead rechaza una version enviada y queda registrado el motivo', async () => {
        const quoteId = await insertQuote(3);
        const res = mockRes();
        await commercialController.rejectQuote(makeReq({ id: users.lead, role: 'team_lead' }, { reason: 'Precio fuera de presupuesto' }, { quoteId: String(quoteId) }), res);
        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.status).not.toHaveBeenCalledWith(403);
        const row = await testDb.get('SELECT status, notes FROM project_quotes WHERE id = ?', [quoteId]);
        expect(row.status).toBe('rejected');
        expect(row.notes).toContain('Precio fuera de presupuesto');
    });

    it('no se puede rechazar una version que no esta en sent (409)', async () => {
        const quoteId = await insertQuote(4, 'approved');
        const res = mockRes();
        await commercialController.rejectQuote(makeReq({ id: users.lead, role: 'team_lead' }, { reason: 'x' }, { quoteId: String(quoteId) }), res);
        expect(res.status).toHaveBeenCalledWith(409);
    });

    it('cotizacion inexistente da 404', async () => {
        const res = mockRes();
        await commercialController.rejectQuote(makeReq({ id: users.lead, role: 'team_lead' }, { reason: 'x' }, { quoteId: '999999' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd backend && npx jest src/__tests__/controllers/commercialController.rejectQuote.test.ts`
Expected: FAIL con `commercialController.rejectQuote is not a function`.

- [ ] **Step 3: Implementar `rejectQuote`**

En `backend/src/controllers/commercialController.ts`, agregar después de `approveQuote` (tras la línea 154):

```typescript
  rejectQuote = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (req.user?.role !== 'team_lead') { res.status(403).json({ error: 'Solo la jefatura puede rechazar una cotización' }); return; }
    const reason = String(req.body.reason ?? '').trim();
    if (!reason) { res.status(400).json({ error: 'Registra el motivo del rechazo' }); return; }
    const quoteId = Number(req.params.quoteId);
    const quote = await db.get('SELECT * FROM project_quotes WHERE id = ?', [quoteId]);
    if (!quote) { res.status(404).json({ error: 'Cotización no encontrada' }); return; }
    if (quote.status !== 'sent') { res.status(409).json({ error: 'Solo se pueden rechazar versiones enviadas al cliente' }); return; }
    const combinedNotes = quote.notes ? `${quote.notes} | Rechazada: ${reason}` : `Rechazada: ${reason}`;
    await db.run(`UPDATE project_quotes SET status = 'rejected', notes = ? WHERE id = ?`, [combinedNotes, quoteId]);
    await activityLogService.logActivity(req.user.id, 'quote', quoteId, 'rejected', { status: 'sent' }, { status: 'rejected', reason });
    res.json({ data: await db.get('SELECT * FROM project_quotes WHERE id = ?', [quoteId]) });
  };
```

En `backend/src/routes/commercialRoutes.ts`, agregar tras la línea de `approve`:

```typescript
router.post('/quotes/:quoteId/reject', authorize(['team_lead']), commercialController.rejectQuote);
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd backend && npx jest src/__tests__/controllers/commercialController.rejectQuote.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Botón "Rechazar" en el frontend**

En `frontend/src/components/projects/ProjectCommercialSection.tsx`, agregar junto a `requestLost` (tras la línea 91):

```typescript
  const requestRejectQuote = (quoteId: number) => modal.confirm({
    title: 'Rechazar versión de cotización',
    content: <Input.TextArea id="reject-reason" placeholder="Motivo del rechazo" rows={3} />,
    okText: 'Rechazar versión', cancelText: 'Cancelar',
    onOk: async () => {
      const reason = (document.getElementById('reject-reason') as HTMLTextAreaElement | null)?.value.trim();
      if (!reason) { message.error('Registra el motivo del rechazo'); throw new Error('reason required'); }
      await save(`/commercial/quotes/${quoteId}/reject`, { reason }, 'Cotización rechazada');
    }
  });
```

Y reemplazar la columna `Acción` de `quoteColumns` (línea 128) para agregar el botón junto al de "Validar versión":

```typescript
    ...(isLead ? [{ title: 'Acción', key: 'action', render: (_: unknown, row: Row) => row.status === 'sent' ? <Space>
      <Button size="small" onClick={() => row.scope_change_id ? setScopeQuoteId(row.id) : void save(`/commercial/quotes/${row.id}/approve`, {}, 'Cotización validada por jefatura')}>Validar versión</Button>
      <Button size="small" danger onClick={() => requestRejectQuote(row.id)}>Rechazar</Button>
    </Space> : null }] : [])
```

- [ ] **Step 6: Verificar tipos y commit**

Run: `cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit`
Expected: sin errores.

```bash
git add backend/src/controllers/commercialController.ts backend/src/routes/commercialRoutes.ts backend/src/__tests__/controllers/commercialController.rejectQuote.test.ts frontend/src/components/projects/ProjectCommercialSection.tsx
git commit -m "feat(fase6b): permite rechazar explicitamente una version de cotizacion"
```

---

## Task 5: Wizard de alta de proyecto — estructura y pasos 1-2 (Datos básicos, Cotización)

**Contexto verificado:** `CreateProjectModal.tsx` (437 líneas) hoy sirve TANTO para crear como para editar (`editProject` prop). Ya tiene, aplanados en un único formulario, los campos de cliente/contacto/comercial (`client_id`/`client_contact_id`/`sales_rep_id`, líneas 267-274, solo visibles `{!isEdit && ...}`) y carga `clients`/`salesReps` vía `loadCommercialDirectories` (líneas 99-110, ampliada en la Task 2 para traer también `businessAreas`). El precio y las horas del proyecto **no se envían nunca al crear** (el bloque `sale_price`/`hours_budgeted`, líneas 399-432, solo se muestra `editProject?.project_type === 'internal'` — es decir, jamás en creación): en la arquitectura real, el precio de un proyecto nuevo se fija con una cotización (`commercialController.createQuote`, ya cubierta por la Task 1 para `rpa_operations`), no con el body de `createProject`. Por eso el wizard nuevo separa "Datos básicos" (que sí crea campos en `projects`) de "Cotización" (que crea una fila en `project_quotes` después de que el proyecto exista, ver Task 6). Este wizard reemplaza el modal **solo para crear**; `CreateProjectModal.tsx` se mantiene sin cambios y sigue siendo el único camino para editar un proyecto existente (Task 6 hace el cableado en `ProjectsPage.tsx`).

**Files:**
- Create: `frontend/src/components/projects/CreateProjectWizard.tsx`
- Test: `frontend/src/__tests__/components/CreateProjectWizard.test.tsx` (nuevo, Vitest + Testing Library)

**Interfaces:**
- Consumes: `apiService.request`/`apiService.get`/`apiService.post` (ya existente), `businessAreas`/`clients`/`salesReps` de `/business-areas`, `/clients`, `/sales-reps` (Task 2), `POST /api/projects/upload-quote` devolviendo `file_id` (Task 3).
- Produces: `export const CreateProjectWizard: React.FC<{ visible: boolean; onCancel: () => void; onSuccess?: (project: Project) => void }>`. Estado interno expuesto a la Task 6 (mismo archivo, se completa ahí): `currentStep: number`, `basicData: Record<string, any>`, `quoteData: { pricing_model: 'fixed'|'hourly'|'mixed'; amount?: number; currency: 'CLP'|'UF'|'USD'; hours?: number; hourly_rate?: number; estimated_cost?: number; notes?: string; file_id?: number } | null`.

- [ ] **Step 1: Test que falla (estructura y navegación de los primeros 2 pasos)**

Crear `frontend/src/__tests__/components/CreateProjectWizard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateProjectWizard } from '@/components/projects/CreateProjectWizard';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

vi.mock('@/services/api', () => ({
    apiService: {
        request: vi.fn(),
        get: vi.fn(),
        post: vi.fn()
    }
}));

vi.mock('@/store/authStore', () => ({
    useAuthStore: vi.fn()
}));

describe('CreateProjectWizard - estructura y pasos 1-2', () => {
    beforeEach(() => {
        vi.mocked(useAuthStore).mockReturnValue({ user: { id: 1, role: 'team_lead' } } as any);
        vi.mocked(apiService.request).mockImplementation(async ({ url }: any) => {
            if (url === '/clients') return { data: [{ id: 1, name: 'Cliente Uno', contacts: [{ id: 10, name: 'Contacto A', is_primary: true }] }] };
            if (url === '/sales-reps') return { data: [{ id: 2, name: 'Comercial Uno' }] };
            if (url === '/business-areas') return { data: [{ id: 3, name: 'RPA/IA', code: 'RPA_IA' }] };
            return { data: [] };
        });
    });

    it('muestra 5 pasos y arranca en "Datos básicos"', () => {
        render(<CreateProjectWizard visible onCancel={() => {}} />);
        expect(screen.getByText('Datos básicos')).toBeInTheDocument();
        expect(screen.getByText('Cotización')).toBeInTheDocument();
        expect(screen.getByText('Equipo')).toBeInTheDocument();
        expect(screen.getByText('Resumen financiero')).toBeInTheDocument();
        expect(screen.getByText('Hitos de pago')).toBeInTheDocument();
        expect(screen.getByLabelText('Nombre del proyecto')).toBeInTheDocument();
    });

    it('no avanza a "Cotización" si falta el nombre del proyecto', async () => {
        render(<CreateProjectWizard visible onCancel={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
        await waitFor(() => expect(screen.getByText('Ingresa el nombre del proyecto')).toBeInTheDocument());
        expect(screen.queryByLabelText('Monto de la cotización')).not.toBeInTheDocument();
    });

    it('avanza a "Cotización" con datos básicos válidos y guarda el modelo de precio por horas', async () => {
        render(<CreateProjectWizard visible onCancel={() => {}} />);
        fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto Wizard' } });
        fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

        await waitFor(() => expect(screen.getByLabelText('Monto de la cotización')).toBeInTheDocument());
        expect(screen.queryByLabelText('Horas cotizadas')).not.toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx`
Expected: FAIL con `Failed to resolve import "@/components/projects/CreateProjectWizard"`.

- [ ] **Step 3: Crear el componente (estructura + pasos 1-2)**

Crear `frontend/src/components/projects/CreateProjectWizard.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import { Modal, Steps, Form, Input, Select, DatePicker, InputNumber, Alert, Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { Project } from '@/types/project';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

export interface QuoteStepData {
  pricing_model: 'fixed' | 'hourly' | 'mixed';
  amount?: number;
  currency: 'CLP' | 'UF' | 'USD';
  hours?: number;
  hourly_rate?: number;
  estimated_cost?: number;
  notes?: string;
  file_id?: number;
}

interface CreateProjectWizardProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (project: Project) => void;
}

export const CreateProjectWizard: React.FC<CreateProjectWizardProps> = ({ visible, onCancel, onSuccess }) => {
  const { user } = useAuthStore();
  const isOperations = user?.role === 'rpa_operations';
  const [currentStep, setCurrentStep] = useState(0);
  const [basicForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [clients, setClients] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [businessAreas, setBusinessAreas] = useState<any[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteStepData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setCurrentStep(0);
    basicForm.resetFields();
    quoteForm.resetFields();
    setQuoteData(null);
    void loadDirectories();
  }, [visible]);

  const loadDirectories = async () => {
    try {
      const [clientResponse, salesResponse, areaResponse] = await Promise.all([
        apiService.request<any>({ url: '/clients' }),
        apiService.request<any>({ url: '/sales-reps' }),
        apiService.request<any>({ url: '/business-areas' })
      ]);
      setClients(clientResponse?.data || []);
      setSalesReps(salesResponse?.data || []);
      setBusinessAreas(areaResponse?.data || []);
    } catch (error) {
      console.warn('No se pudieron cargar clientes, comerciales o areas:', error);
    }
  };

  const goNextFromBasics = async () => {
    await basicForm.validateFields();
    setCurrentStep(1);
  };

  const goNextFromQuote = async () => {
    const values = await quoteForm.validateFields();
    setQuoteData({ ...(quoteData || {}), ...values, file_id: quoteData?.file_id });
    setCurrentStep(2);
  };

  const readWithAi = async (file: File) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiService.request<any>({ url: '/projects/upload-quote', method: 'POST', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
      const extracted = response?.quote_data || {};
      quoteForm.setFieldsValue({
        amount: extracted.expected_revenue ?? undefined,
        estimated_cost: extracted.budgeted_cost ?? undefined,
        currency: 'CLP',
        pricing_model: 'fixed'
      });
      setQuoteData((prev) => ({ ...(prev || { pricing_model: 'fixed', currency: 'CLP' }), file_id: response?.file_id }));
      message.success('Datos de la cotización precargados. Revísalos antes de continuar.');
    } catch (error) {
      message.error('No se pudo leer el archivo con IA. Completa los datos manualmente.');
    } finally {
      setAiLoading(false);
    }
    return false;
  };

  return (
    <Modal title="Nuevo proyecto" open={visible} onCancel={onCancel} footer={null} width={720} destroyOnHidden>
      <Steps
        current={currentStep}
        items={[
          { title: 'Datos básicos' },
          { title: 'Cotización' },
          { title: 'Equipo' },
          { title: 'Resumen financiero' },
          { title: 'Hitos de pago' }
        ]}
        style={{ marginBottom: 24 }}
      />

      <Form form={basicForm} layout="vertical" style={{ display: currentStep === 0 ? 'block' : 'none' }} initialValues={{ opportunity_source: 'direct', priority: 'medium' }}>
        <Form.Item name="opportunity_source" label="Origen de la oportunidad"><Select options={[{ value: 'direct', label: 'Contacto directo con el equipo' }, { value: 'sales', label: 'Traída por un comercial' }]} /></Form.Item>
        <Form.Item name="client_id" label="Cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el cliente" options={clients.map((client) => ({ value: client.id, label: client.name }))} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.client_id !== current.client_id}>
          {({ getFieldValue }) => {
            const client = clients.find((c) => c.id === getFieldValue('client_id'));
            return <Form.Item name="client_contact_id" label="Contacto del cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Contacto principal u otro contacto" options={(client?.contacts || []).map((contact: any) => ({ value: contact.id, label: `${contact.name}${contact.is_primary ? ' · Principal' : ''}` }))} /></Form.Item>;
          }}
        </Form.Item>
        <Form.Item name="sales_rep_id" label="Comercial responsable"><Select allowClear showSearch optionFilterProp="label" placeholder="Origen directo o comercial" options={salesReps.map((rep) => ({ value: rep.id, label: rep.name }))} /></Form.Item>
        <Form.Item name="area_id" label="Área de negocio"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el área" options={businessAreas.map((area) => ({ value: area.id, label: area.name }))} /></Form.Item>
        <Form.Item name="name" label="Nombre del proyecto" rules={[{ required: true, message: 'Ingresa el nombre del proyecto' }, { min: 3, message: 'El nombre debe tener al menos 3 caracteres' }]}>
          <Input placeholder="Ingresa el nombre del proyecto" />
        </Form.Item>
        <Form.Item name="description" label="Descripción" rules={[{ max: 500 }]}><TextArea rows={3} showCount maxLength={500} /></Form.Item>
        <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
          <Select options={[{ label: 'Crítica', value: 'critical' }, { label: 'Alta', value: 'high' }, { label: 'Media', value: 'medium' }, { label: 'Baja', value: 'low' }]} />
        </Form.Item>
        <Form.Item name="budget" label="Presupuesto inicial (CLP)" rules={[{ type: 'number', min: 0 }]}><InputNumber style={{ width: '100%' }} precision={2} /></Form.Item>
        <Form.Item name="dates" label="Fechas del proyecto"><RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item>
        <div style={{ textAlign: 'right' }}><Button type="primary" onClick={goNextFromBasics}>Siguiente</Button></div>
      </Form>

      <Form form={quoteForm} layout="vertical" style={{ display: currentStep === 1 ? 'block' : 'none' }} initialValues={{ pricing_model: 'fixed', currency: 'CLP' }}>
        <Alert type="info" showIcon message="La oportunidad se crea en cotización. Esta versión fija el precio y las horas del proyecto una vez que la jefatura la valide." style={{ marginBottom: 16 }} />
        <Upload beforeUpload={readWithAi} showUploadList={false} accept=".pdf,.docx">
          <Button icon={<UploadOutlined />} loading={aiLoading}>Leer cotización con IA</Button>
        </Upload>
        <Form.Item name="pricing_model" label="Modelo de precio" style={{ marginTop: 16 }}>
          <Select options={[{ value: 'fixed', label: 'Precio cerrado' }, { value: 'hourly', label: 'Por horas' }, { value: 'mixed', label: 'Mixto' }]} />
        </Form.Item>
        <Form.Item name="amount" label="Monto de la cotización" rules={[{ required: true, message: 'Ingresa el monto' }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
        <Form.Item name="currency" label="Moneda"><Select options={[{ value: 'CLP', label: 'CLP' }, { value: 'UF', label: 'UF' }, { value: 'USD', label: 'USD' }]} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.pricing_model !== current.pricing_model}>
          {({ getFieldValue }) => getFieldValue('pricing_model') !== 'fixed' && <>
            <Form.Item name="hours" label="Horas cotizadas" rules={[{ required: true, message: 'Ingresa las horas' }]}><InputNumber style={{ width: '100%' }} min={0} precision={1} /></Form.Item>
            <Form.Item name="hourly_rate" label="Tarifa por hora"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
          </>}
        </Form.Item>
        <Form.Item name="estimated_cost" label="Costo interno estimado (opcional)"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
        <Form.Item name="notes" label="Notas"><TextArea rows={2} /></Form.Item>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setCurrentStep(0)}>Atrás</Button>
          <Button type="primary" onClick={goNextFromQuote}>Siguiente</Button>
        </div>
      </Form>
    </Modal>
  );
};
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx`
Expected: PASS (3 tests). El componente aún no crea el proyecto ni tiene contenido real en los pasos 3-5 (se completan en la Task 6); por eso este test no ejercita "Finalizar".

- [ ] **Step 5: Verificar tipos y commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: sin errores.

```bash
git add frontend/src/components/projects/CreateProjectWizard.tsx frontend/src/__tests__/components/CreateProjectWizard.test.tsx
git commit -m "feat(fase6b): estructura del wizard de alta de proyecto y pasos 1-2 (datos basicos, cotizacion)"
```

---

## Task 6: Wizard de alta — pasos 3-5 (Equipo, Resumen financiero, Hitos de pago), creación real y reemplazo del botón "Nuevo proyecto"

**Contexto verificado:** `ProjectsPage.tsx:112-113,133` usa un único estado `createModalVisible` para abrir `CreateProjectModal` tanto al crear ("Nuevo proyecto", `editingProject=null`) como al editar (`ProjectCard.onEdit`, `editingProject=<project>`). Hay que separar: el wizard nuevo solo atiende creación; `CreateProjectModal` sigue atendiendo edición sin cambios. `buildUserAssignments(userIds, allocation?, hoursPerPerson?, startDate?, endDate?)` (`frontend/src/components/projects/projectAssignments.ts:10-18`) ya arma el payload de asignaciones. El endpoint de estimación de costo (`GET /api/commercial/projects/:id/quote-cost-estimate?hours=&currency=`, `commercialController.ts:266-279`) exige `team_lead` y un proyecto ya existente — por eso el proyecto, la cotización y las asignaciones se crean recién al terminar el paso "Equipo" (no antes), y el paso "Resumen financiero" solo tiene sentido para `team_lead` (a `rpa_operations` no se le muestra, igual que hoy no ve campos financieros). Los hitos de pago (`POST /api/billing/payment-milestones`, `billingRoutes.ts:32`) también son `billingWriteRoles` = solo `team_lead` (`billingRoutes.ts:18`) — el diseño original decía que Operaciones vería los mismos pasos salvo el financiero, pero como no tiene permiso para cargar hitos, el paso "Hitos de pago" le queda visible en modo informativo ("se completa después desde la ficha del proyecto"), sin formulario.

**Files:**
- Modify: `frontend/src/components/projects/CreateProjectWizard.tsx` (reemplazo completo del archivo)
- Modify: `frontend/src/__tests__/components/CreateProjectWizard.test.tsx` (agregar casos de creación real)
- Modify: `frontend/src/pages/projects/ProjectsPage.tsx` (separar estado de creación y edición)
- Test: `frontend/src/__tests__/pages/ProjectsPage.wizard.test.tsx` (nuevo)

**Interfaces:**
- Produces: al terminar el paso "Equipo", el wizard deja `createdProject: Project` en estado interno; los pasos "Resumen financiero" y "Hitos de pago" operan sobre `createdProject.id`. `onSuccess?.(createdProject)` se dispara al presionar "Finalizar" (no antes), igual que hoy dispara `fetchProjects()` en `ProjectsPage.tsx`.

- [ ] **Step 1: Ampliar el test con la creación real y el cableado en ProjectsPage**

Agregar a `frontend/src/__tests__/components/CreateProjectWizard.test.tsx` (mismo `describe`, después del último `it`):

```typescript
  it('team_lead completa los 5 pasos: crea el proyecto, la cotizacion y las asignaciones, y termina en Hitos de pago', async () => {
    vi.mocked(apiService.get).mockResolvedValue([{ id: 5, full_name: 'Dev Uno', role: 'rpa_developer' }]);
    vi.mocked(apiService.post).mockResolvedValue({});
    const createProject = vi.fn().mockResolvedValue({ id: 42, name: 'Proyecto Wizard' });
    vi.doMock('@/store/projectStore', () => ({ useProjectStore: () => ({ createProject, updateProject: vi.fn() }) }));

    const { CreateProjectWizard: Wizard } = await import('@/components/projects/CreateProjectWizard');
    render(<Wizard visible onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto Wizard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => screen.getByLabelText('Monto de la cotización'));

    fireEvent.change(screen.getByLabelText('Monto de la cotización'), { target: { value: '1000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => screen.getByText('Equipo asignado'));

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(createProject).toHaveBeenCalled());
    await waitFor(() => screen.getByText('Resumen financiero'));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => screen.getByText(/Hitos de pago/));
  });

  it('rpa_operations no ve el paso "Resumen financiero" y el paso "Hitos de pago" queda solo informativo', async () => {
    vi.mocked(useAuthStore).mockReturnValue({ user: { id: 9, role: 'rpa_operations' } } as any);
    render(<CreateProjectWizard visible onCancel={() => {}} />);

    fireEvent.change(screen.getByLabelText('Nombre del proyecto'), { target: { value: 'Proyecto Ops' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => screen.getByLabelText('Monto de la cotización'));

    fireEvent.change(screen.getByLabelText('Monto de la cotización'), { target: { value: '500000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => screen.getByText('Quedarás asignado a este proyecto'));

    expect(screen.queryByText('Resumen financiero')).not.toBeInTheDocument();
  });
```

Crear `frontend/src/__tests__/pages/ProjectsPage.wizard.test.tsx` (versión mínima, siguiendo el molde de otro test de página existente en `frontend/src/__tests__/pages/`):

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('ProjectsPage - separa creación (wizard) de edición (modal)', () => {
  it('el boton "Nuevo proyecto" abre CreateProjectWizard, no CreateProjectModal', () => {
    const source = readFileSync(resolve(__dirname, '../../pages/projects/ProjectsPage.tsx'), 'utf-8');
    expect(source).toMatch(/setEditingProject\(null\);\s*setWizardVisible\(true\)/);
    expect(source).toMatch(/<CreateProjectWizard/);
    expect(source).toMatch(/<CreateProjectModal[\s\S]*?editProject=\{editingProject\}/);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx src/__tests__/pages/ProjectsPage.wizard.test.tsx`
Expected: FAIL. No existe "Equipo asignado", "Resumen financiero" ni el cableado en `ProjectsPage.tsx`.

- [ ] **Step 3: Completar `CreateProjectWizard.tsx` con los pasos 3-5 y la creación real**

Reemplazar el `return (...)` final del componente (desde `return (` hasta el cierre `);` antes del `};` de la Task 5) por la versión completa con los 5 pasos. El archivo completo de `frontend/src/components/projects/CreateProjectWizard.tsx` queda:

```typescript
import React, { useEffect, useState } from 'react';
import { Modal, Steps, Form, Input, Select, DatePicker, InputNumber, Alert, Upload, Button, message, Space, Table, Statistic } from 'antd';
import { UploadOutlined, PlusOutlined } from '@ant-design/icons';
import { Project } from '@/types/project';
import { apiService } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useProjectStore } from '@/store/projectStore';
import { buildUserAssignments } from './projectAssignments';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

export interface QuoteStepData {
  pricing_model: 'fixed' | 'hourly' | 'mixed';
  amount?: number;
  currency: 'CLP' | 'UF' | 'USD';
  hours?: number;
  hourly_rate?: number;
  estimated_cost?: number;
  notes?: string;
  file_id?: number;
}

interface MilestoneRow {
  name: string;
  amount: number;
  currency: 'CLP' | 'UF' | 'USD';
  planned_date: string;
}

interface CreateProjectWizardProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (project: Project) => void;
}

export const CreateProjectWizard: React.FC<CreateProjectWizardProps> = ({ visible, onCancel, onSuccess }) => {
  const { user } = useAuthStore();
  const { createProject } = useProjectStore();
  const isOperations = user?.role === 'rpa_operations';
  const stepKeys = isOperations ? ['basics', 'quote', 'team', 'milestones'] : ['basics', 'quote', 'team', 'summary', 'milestones'];
  const stepTitles: Record<string, string> = { basics: 'Datos básicos', quote: 'Cotización', team: 'Equipo', summary: 'Resumen financiero', milestones: 'Hitos de pago' };

  const [currentKey, setCurrentKey] = useState('basics');
  const [basicForm] = Form.useForm();
  const [quoteForm] = Form.useForm();
  const [teamForm] = Form.useForm();
  const [milestoneForm] = Form.useForm();
  const [clients, setClients] = useState<any[]>([]);
  const [salesReps, setSalesReps] = useState<any[]>([]);
  const [businessAreas, setBusinessAreas] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ label: string; value: number; role?: string }[]>([]);
  const [quoteData, setQuoteData] = useState<QuoteStepData | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const [costEstimate, setCostEstimate] = useState<any>(null);
  const [milestoneRows, setMilestoneRows] = useState<MilestoneRow[]>([]);

  useEffect(() => {
    if (!visible) return;
    setCurrentKey('basics');
    basicForm.resetFields();
    quoteForm.resetFields();
    teamForm.resetFields();
    setQuoteData(null);
    setCreatedProject(null);
    setCostEstimate(null);
    setMilestoneRows([]);
    void loadDirectories();
    void loadTeamMembers();
  }, [visible]);

  const loadDirectories = async () => {
    try {
      const [clientResponse, salesResponse, areaResponse] = await Promise.all([
        apiService.request<any>({ url: '/clients' }),
        apiService.request<any>({ url: '/sales-reps' }),
        apiService.request<any>({ url: '/business-areas' })
      ]);
      setClients(clientResponse?.data || []);
      setSalesReps(salesResponse?.data || []);
      setBusinessAreas(areaResponse?.data || []);
    } catch (error) {
      console.warn('No se pudieron cargar clientes, comerciales o areas:', error);
    }
  };

  const loadTeamMembers = async () => {
    try {
      const users = await apiService.getUsers();
      setTeamMembers(users.map((u: any) => ({ label: u.full_name, value: u.id, role: u.role })));
    } catch (error) {
      console.error('No se pudieron cargar los usuarios:', error);
    }
  };

  const goNextFromBasics = async () => {
    await basicForm.validateFields();
    setCurrentKey('quote');
  };

  const goNextFromQuote = async () => {
    const values = await quoteForm.validateFields();
    setQuoteData((prev) => ({ ...(prev || { pricing_model: 'fixed', currency: 'CLP' }), ...values }));
    setCurrentKey('team');
  };

  const readWithAi = async (file: File) => {
    setAiLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiService.request<any>({ url: '/projects/upload-quote', method: 'POST', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
      const extracted = response?.quote_data || {};
      quoteForm.setFieldsValue({ amount: extracted.expected_revenue ?? undefined, estimated_cost: extracted.budgeted_cost ?? undefined, currency: 'CLP', pricing_model: 'fixed' });
      setQuoteData((prev) => ({ ...(prev || { pricing_model: 'fixed', currency: 'CLP' }), file_id: response?.file_id }));
      message.success('Datos de la cotización precargados. Revísalos antes de continuar.');
    } catch (error) {
      message.error('No se pudo leer el archivo con IA. Completa los datos manualmente.');
    } finally {
      setAiLoading(false);
    }
    return false;
  };

  const finalizeCreation = async () => {
    setCreating(true);
    try {
      const basics = basicForm.getFieldsValue();
      const team = isOperations ? {} : teamForm.getFieldsValue();

      const project = await createProject({
        name: basics.name,
        description: basics.description,
        status: 'on_hold',
        priority: basics.priority,
        budget: basics.budget,
        start_date: basics.dates?.[0]?.format('YYYY-MM-DD'),
        end_date: basics.dates?.[1]?.format('YYYY-MM-DD'),
        client_id: basics.client_id,
        client_contact_id: basics.client_contact_id,
        sales_rep_id: basics.sales_rep_id,
        area_id: basics.area_id,
        opportunity_source: basics.opportunity_source || 'direct'
      });
      setCreatedProject(project);

      if (quoteData?.amount !== undefined) {
        try {
          await apiService.post(`/commercial/projects/${project.id}/quotes`, quoteData);
        } catch (error) {
          message.warning('Proyecto creado, pero no se pudo registrar la cotización. Puedes intentarlo desde la ficha del proyecto.');
        }
      }

      if (!isOperations && team.assigned_users?.length) {
        try {
          const userAssignments = buildUserAssignments(team.assigned_users, team.default_allocation, team.budgeted_hours_per_person, basics.dates?.[0]?.format('YYYY-MM-DD'), basics.dates?.[1]?.format('YYYY-MM-DD'));
          await apiService.post(`/projects/${project.id}/assignments`, { user_assignments: userAssignments });
        } catch (error) {
          message.warning('Proyecto creado, pero no se pudieron guardar las asignaciones del equipo.');
        }
      }

      if (!isOperations) {
        const totalHours = quoteData?.hours || (team.budgeted_hours_per_person && team.assigned_users?.length ? team.budgeted_hours_per_person * team.assigned_users.length : 0);
        if (totalHours > 0) {
          try {
            const estimate = await apiService.request<any>({ url: `/commercial/projects/${project.id}/quote-cost-estimate`, method: 'GET', params: { hours: totalHours, currency: quoteData?.currency || 'CLP' } });
            setCostEstimate(estimate);
          } catch (error) {
            setCostEstimate(null);
          }
        }
        setCurrentKey('summary');
      } else {
        setCurrentKey('milestones');
      }
    } catch (error: any) {
      message.error(error?.message || 'No se pudo crear el proyecto');
    } finally {
      setCreating(false);
    }
  };

  const addMilestoneRow = async () => {
    const values = await milestoneForm.validateFields();
    setMilestoneRows((rows) => [...rows, { ...values, planned_date: values.planned_date.format('YYYY-MM-DD') }]);
    milestoneForm.resetFields();
  };

  const finish = async () => {
    if (createdProject && milestoneRows.length) {
      for (const row of milestoneRows) {
        try {
          await apiService.post('/billing/payment-milestones', { project_id: createdProject.id, name: row.name, amount: row.amount, currency: row.currency, trigger_type: 'date', planned_date: row.planned_date });
        } catch (error) {
          message.warning(`No se pudo guardar el hito "${row.name}"`);
        }
      }
    }
    if (createdProject) onSuccess?.(createdProject);
    onCancel();
  };

  return (
    <Modal title="Nuevo proyecto" open={visible} onCancel={onCancel} footer={null} width={720} destroyOnHidden>
      <Steps current={stepKeys.indexOf(currentKey)} items={stepKeys.map((key) => ({ title: stepTitles[key] }))} style={{ marginBottom: 24 }} />

      <Form form={basicForm} layout="vertical" style={{ display: currentKey === 'basics' ? 'block' : 'none' }} initialValues={{ opportunity_source: 'direct', priority: 'medium' }}>
        <Form.Item name="opportunity_source" label="Origen de la oportunidad"><Select options={[{ value: 'direct', label: 'Contacto directo con el equipo' }, { value: 'sales', label: 'Traída por un comercial' }]} /></Form.Item>
        <Form.Item name="client_id" label="Cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el cliente" options={clients.map((client) => ({ value: client.id, label: client.name }))} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.client_id !== current.client_id}>
          {({ getFieldValue }) => {
            const client = clients.find((c) => c.id === getFieldValue('client_id'));
            return <Form.Item name="client_contact_id" label="Contacto del cliente"><Select allowClear showSearch optionFilterProp="label" placeholder="Contacto principal u otro contacto" options={(client?.contacts || []).map((contact: any) => ({ value: contact.id, label: `${contact.name}${contact.is_primary ? ' · Principal' : ''}` }))} /></Form.Item>;
          }}
        </Form.Item>
        <Form.Item name="sales_rep_id" label="Comercial responsable"><Select allowClear showSearch optionFilterProp="label" placeholder="Origen directo o comercial" options={salesReps.map((rep) => ({ value: rep.id, label: rep.name }))} /></Form.Item>
        <Form.Item name="area_id" label="Área de negocio"><Select allowClear showSearch optionFilterProp="label" placeholder="Selecciona el área" options={businessAreas.map((area) => ({ value: area.id, label: area.name }))} /></Form.Item>
        <Form.Item name="name" label="Nombre del proyecto" rules={[{ required: true, message: 'Ingresa el nombre del proyecto' }, { min: 3, message: 'El nombre debe tener al menos 3 caracteres' }]}>
          <Input placeholder="Ingresa el nombre del proyecto" />
        </Form.Item>
        <Form.Item name="description" label="Descripción" rules={[{ max: 500 }]}><TextArea rows={3} showCount maxLength={500} /></Form.Item>
        <Form.Item name="priority" label="Prioridad" rules={[{ required: true }]}>
          <Select options={[{ label: 'Crítica', value: 'critical' }, { label: 'Alta', value: 'high' }, { label: 'Media', value: 'medium' }, { label: 'Baja', value: 'low' }]} />
        </Form.Item>
        <Form.Item name="budget" label="Presupuesto inicial (CLP)" rules={[{ type: 'number', min: 0 }]}><InputNumber style={{ width: '100%' }} precision={2} /></Form.Item>
        <Form.Item name="dates" label="Fechas del proyecto"><RangePicker style={{ width: '100%' }} format="YYYY-MM-DD" /></Form.Item>
        <div style={{ textAlign: 'right' }}><Button type="primary" onClick={goNextFromBasics}>Siguiente</Button></div>
      </Form>

      <Form form={quoteForm} layout="vertical" style={{ display: currentKey === 'quote' ? 'block' : 'none' }} initialValues={{ pricing_model: 'fixed', currency: 'CLP' }}>
        <Alert type="info" showIcon message="La oportunidad se crea en cotización. Esta versión fija el precio y las horas del proyecto una vez que la jefatura la valide." style={{ marginBottom: 16 }} />
        <Upload beforeUpload={readWithAi} showUploadList={false} accept=".pdf,.docx">
          <Button icon={<UploadOutlined />} loading={aiLoading}>Leer cotización con IA</Button>
        </Upload>
        <Form.Item name="pricing_model" label="Modelo de precio" style={{ marginTop: 16 }}>
          <Select options={[{ value: 'fixed', label: 'Precio cerrado' }, { value: 'hourly', label: 'Por horas' }, { value: 'mixed', label: 'Mixto' }]} />
        </Form.Item>
        <Form.Item name="amount" label="Monto de la cotización" rules={[{ required: true, message: 'Ingresa el monto' }]}><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
        <Form.Item name="currency" label="Moneda"><Select options={[{ value: 'CLP', label: 'CLP' }, { value: 'UF', label: 'UF' }, { value: 'USD', label: 'USD' }]} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.pricing_model !== current.pricing_model}>
          {({ getFieldValue }) => getFieldValue('pricing_model') !== 'fixed' && <>
            <Form.Item name="hours" label="Horas cotizadas" rules={[{ required: true, message: 'Ingresa las horas' }]}><InputNumber style={{ width: '100%' }} min={0} precision={1} /></Form.Item>
            <Form.Item name="hourly_rate" label="Tarifa por hora"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
          </>}
        </Form.Item>
        <Form.Item name="estimated_cost" label="Costo interno estimado (opcional)"><InputNumber style={{ width: '100%' }} min={0} precision={2} /></Form.Item>
        <Form.Item name="notes" label="Notas"><TextArea rows={2} /></Form.Item>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setCurrentKey('basics')}>Atrás</Button>
          <Button type="primary" onClick={goNextFromQuote}>Siguiente</Button>
        </div>
      </Form>

      <div style={{ display: currentKey === 'team' ? 'block' : 'none' }}>
        {isOperations ? (
          <Alert type="info" showIcon message="Quedarás asignado a este proyecto" style={{ marginBottom: 24 }} />
        ) : (
          <Form form={teamForm} layout="vertical">
            <Form.Item name="assigned_users" label="Equipo asignado">
              <Select mode="multiple" allowClear maxTagCount="responsive" optionFilterProp="label" placeholder="Selecciona personas del equipo" options={teamMembers.map((member) => ({ ...member, label: `${member.label} (${member.role})` }))} />
            </Form.Item>
            <Form.Item name="default_allocation" label="Dedicación por persona (%)"><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="budgeted_hours_per_person" label="Horas presupuestadas por persona"><InputNumber min={0} precision={1} style={{ width: '100%' }} /></Form.Item>
          </Form>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button onClick={() => setCurrentKey('quote')}>Atrás</Button>
          <Button type="primary" loading={creating} onClick={finalizeCreation}>Siguiente</Button>
        </div>
      </div>

      {!isOperations && (
        <div style={{ display: currentKey === 'summary' ? 'block' : 'none' }}>
          {costEstimate ? (
            <Space size="large" style={{ marginBottom: 24 }}>
              <Statistic title="Costo estimado del equipo (CLP)" value={costEstimate.blended_hourly_cost_clp * (quoteData?.hours || 0)} precision={0} />
              <Statistic title="Venta cotizada" value={quoteData?.amount || 0} precision={0} suffix={quoteData?.currency} />
            </Space>
          ) : (
            <Alert type="info" showIcon message="Aún no hay horas de equipo suficientes para estimar el costo. Puedes revisarlo después desde la ficha del proyecto." style={{ marginBottom: 24 }} />
          )}
          <div style={{ textAlign: 'right' }}><Button type="primary" onClick={() => setCurrentKey('milestones')}>Siguiente</Button></div>
        </div>
      )}

      <div style={{ display: currentKey === 'milestones' ? 'block' : 'none' }}>
        {isOperations ? (
          <Alert type="info" showIcon message="Solo Team Lead puede cargar hitos de pago. Se pueden completar después desde la ficha del proyecto." />
        ) : (
          <>
            <Form form={milestoneForm} layout="inline" style={{ marginBottom: 16 }}>
              <Form.Item name="name" rules={[{ required: true, message: 'Nombre' }]}><Input placeholder="Nombre del hito" /></Form.Item>
              <Form.Item name="amount" rules={[{ required: true, message: 'Monto' }]}><InputNumber placeholder="Monto" min={0} /></Form.Item>
              <Form.Item name="currency" initialValue="CLP"><Select style={{ width: 90 }} options={[{ value: 'CLP', label: 'CLP' }, { value: 'UF', label: 'UF' }, { value: 'USD', label: 'USD' }]} /></Form.Item>
              <Form.Item name="planned_date" rules={[{ required: true, message: 'Fecha' }]}><DatePicker placeholder="Fecha prevista" /></Form.Item>
              <Form.Item><Button icon={<PlusOutlined />} onClick={addMilestoneRow}>Agregar hito</Button></Form.Item>
            </Form>
            <Table size="small" pagination={false} dataSource={milestoneRows} rowKey="name" columns={[{ title: 'Hito', dataIndex: 'name' }, { title: 'Monto', dataIndex: 'amount' }, { title: 'Moneda', dataIndex: 'currency' }, { title: 'Fecha', dataIndex: 'planned_date' }]} />
          </>
        )}
        <div style={{ textAlign: 'right', marginTop: 16 }}><Button type="primary" onClick={finish}>Finalizar</Button></div>
      </div>
    </Modal>
  );
};
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `cd frontend && npx vitest run src/__tests__/components/CreateProjectWizard.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Cablear `ProjectsPage.tsx`**

Renombrar el estado de edición y agregar el del wizard (línea 34):

```typescript
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [wizardVisible, setWizardVisible] = useState(false);
```

Cambiar el botón "Nuevo proyecto" y el `onEdit` de `ProjectCard` (líneas 112, 130) para usar los estados correctos:

```typescript
        {canCreateProject && <Space wrap className="projects-heading-actions"><Button icon={<FileTextOutlined />} onClick={() => setQuoteUploadModalVisible(true)}>Crear desde cotización</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingProject(null); setWizardVisible(true); }}>Nuevo proyecto</Button></Space>}
```

```typescript
          {filteredProjects.map((project) => <Col xs={24} md={12} xl={8} key={project.id}><ProjectCard project={project} health={projectHealth[project.id]} onEdit={(item) => { setEditingProject(item); setEditModalVisible(true); }} onDelete={handleDeleteProject} onView={(item) => navigate(`/projects/${item.id}`)} onClick={(item) => navigate(`/projects/${item.id}`)} /></Col>)}
```

Reemplazar el montaje del modal (línea 133) por el wizard + el modal de edición:

```typescript
      <CreateProjectWizard visible={wizardVisible} onCancel={() => setWizardVisible(false)} onSuccess={() => { void fetchProjects(); }} />
      <CreateProjectModal visible={editModalVisible} onCancel={() => { setEditModalVisible(false); setEditingProject(null); }} onSuccess={() => { void fetchProjects(); }} editProject={editingProject} />
```

Y agregar el import (línea 7):

```typescript
import { CreateProjectWizard } from '@/components/projects/CreateProjectWizard';
```

- [ ] **Step 6: Correr y verificar que pasa**

Run: `cd frontend && npx vitest run src/__tests__/pages/ProjectsPage.wizard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Verificar tipos, suite completa de frontend y commit**

Run: `cd frontend && npx tsc --noEmit && npm test`
Expected: sin errores; todas las suites de frontend en PASS (incluidas las que ya usaban `CreateProjectModal`, que no cambió).

```bash
git add frontend/src/components/projects/CreateProjectWizard.tsx frontend/src/__tests__/components/CreateProjectWizard.test.tsx frontend/src/__tests__/pages/ProjectsPage.wizard.test.tsx frontend/src/pages/projects/ProjectsPage.tsx
git commit -m "feat(fase6b): completa el wizard de alta (equipo, resumen financiero, hitos de pago) y lo cablea en Proyectos"
```

---

## Task 7: Pestaña "Documentos" tipificada con las 5 categorías acordadas

**Contexto verificado:** la pestaña "Documentos" de `ProjectDetailPage.tsx:546-561` hoy es un único `FileManager` con `association_type="evidence"` fijo — un cajón sin tipos (confirmado, no hay ningún selector). `FileManager`/`FileList` (`frontend/src/components/files/`) ya soportan mostrar un cajón filtrado a un solo `association_type` fijo (ese es justamente el patrón usado en `ProjectCommercialSection.tsx:269,293` para adjuntar el PDF de cada cotización con `association_type={quote_v${n}}`). `FileList.tsx:279` en el backend (`fileController.getFiles`, `backend/src/controllers/fileController.ts:207-285`) filtra por `association_type` con igualdad exacta — no hay forma hoy de listar "todas las versiones de cotización" con un solo filtro, porque cada versión usa un `association_type` distinto (`quote_v1`, `quote_v2`, ...). Este plan **no** mezcla la taxonomía nueva con `project_commercial_documents` (esa tabla es el mecanismo de negocio que condiciona `startExecution`/`acceptDelivery`, no una simple etiqueta de archivo — tocarla rompería esas reglas). La solución: 4 categorías (PDD, Documentación técnica, Contrato/OC, Otro) como 4 `FileManager` de un solo tipo fijo (`doc_pdd`, `doc_technical`, `doc_contract`, `doc_other`), y la 5ª categoría ("Cotización") se resuelve agregando una columna "Archivo" a la tabla de versiones de cotización que ya existe en `ProjectCommercialSection.tsx` (línea 152-155) en vez de duplicar esa información en otra pestaña — los archivos de cotización ya están asociados vía `quote_v{n}` desde la Task 4/6, no hace falta que además aparezcan en "Documentos" para cumplir el objetivo original ("no se pierden, quedan accesibles"). **Nota de compatibilidad:** `EvidenceGallery.tsx` (líneas 71, 96), usada en la pestaña "Evidencias" (`ProjectDetailPage.tsx:562-570`, no se toca en este plan), también sube y lee archivos con `association_type: 'evidence'` — es decir, hoy "Documentos" y "Evidencias" muestran el mismo pool de archivos. Tras este cambio, cualquier archivo ya subido con `association_type="evidence"` deja de aparecer en "Documentos" (pasa a verse solo en "Evidencias", donde sigue intacto) y los archivos nuevos que se suban en "Documentos" quedan correctamente tipificados. No se pierde ningún archivo ni hace falta migrar datos; es un cambio de qué pestaña los muestra.

**Files:**
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx` (panel `files`, líneas 545-561)
- Modify: `frontend/src/components/projects/ProjectCommercialSection.tsx` (`quoteColumns`, agregar columna "Archivo")
- Test: `frontend/src/__tests__/pages/ProjectDetailPage.documentTabs.test.tsx` (nuevo)

**Interfaces:**
- Sin cambios de API. Reutiliza `GET /api/files` con `association_type=doc_pdd|doc_technical|doc_contract|doc_other` (ya soportado, sin cambios de backend).

- [ ] **Step 1: Test que falla**

Crear `frontend/src/__tests__/pages/ProjectDetailPage.documentTabs.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('ProjectDetailPage - pestaña Documentos con 4 categorías tipificadas', () => {
  it('reemplaza el FileManager unico de association_type="evidence" por 4 categorias', () => {
    const source = readFileSync(resolve(__dirname, '../../pages/projects/ProjectDetailPage.tsx'), 'utf-8');
    expect(source).not.toMatch(/association_type="evidence"/);
    for (const type of ['doc_pdd', 'doc_technical', 'doc_contract', 'doc_other']) {
      expect(source).toMatch(new RegExp(`association_type="${type}"`));
    }
  });

  it('la tabla de versiones de cotización muestra una columna "Archivo"', () => {
    const source = readFileSync(resolve(__dirname, '../../components/projects/ProjectCommercialSection.tsx'), 'utf-8');
    expect(source).toMatch(/title: 'Archivo', dataIndex: 'file_id'/);
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `cd frontend && npx vitest run src/__tests__/pages/ProjectDetailPage.documentTabs.test.tsx`
Expected: FAIL en los 2 casos (todavía existe `association_type="evidence"`, no existen los 4 tipos nuevos, y no existe la columna "Archivo").

- [ ] **Step 3: Reemplazar el panel "Documentos"**

En `frontend/src/pages/projects/ProjectDetailPage.tsx`, reemplazar el objeto del panel `files` (líneas 545-561) por:

```typescript
            {
              key: 'files',
              label: <span><FolderOutlined /> Documentos</span>,
              children: (
                <div style={{ padding: '8px 0' }}>
                  <Tabs
                    items={[
                      { key: 'doc_pdd', label: 'PDD', children: <FileManager entity_type="project" entity_id={project.id} title="PDD" association_type="doc_pdd" multiple maxFiles={20} /> },
                      { key: 'doc_technical', label: 'Documentación técnica', children: <FileManager entity_type="project" entity_id={project.id} title="Documentación técnica" association_type="doc_technical" multiple maxFiles={20} /> },
                      { key: 'doc_contract', label: 'Contrato/OC', children: <FileManager entity_type="project" entity_id={project.id} title="Contrato/OC" association_type="doc_contract" multiple maxFiles={20} /> },
                      { key: 'doc_other', label: 'Otro', children: <FileManager entity_type="project" entity_id={project.id} title="Otro" association_type="doc_other" multiple maxFiles={20} /> }
                    ]}
                  />
                </div>
              )
            },
```

(`Tabs` ya está importado en este archivo para otros usos; si no lo estuviera, agregar `Tabs` al import de `antd` existente.)

- [ ] **Step 4: Correr y verificar que pasa el primer caso**

Run: `cd frontend && npx vitest run src/__tests__/pages/ProjectDetailPage.documentTabs.test.tsx`
Expected: el primer test PASA; el segundo ("columna Archivo") sigue en FAIL hasta el Step 5.

- [ ] **Step 5: Columna "Archivo" en las versiones de cotización**

En `frontend/src/components/projects/ProjectCommercialSection.tsx`, agregar una columna a `quoteColumns` (antes de la columna `Estado`, línea 126):

```typescript
    { title: 'Archivo', dataIndex: 'file_id', render: (v: number | null) => v ? <a href={`/api/files/${v}/download`} target="_blank" rel="noreferrer">Descargar</a> : 'Sin archivo' },
```

- [ ] **Step 5b: Correr y verificar que pasa**

Run: `cd frontend && npx vitest run src/__tests__/pages/ProjectDetailPage.documentTabs.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Verificar tipos, lint y commit**

Run: `cd frontend && npx tsc --noEmit && npm run lint`
Expected: sin errores.

```bash
git add frontend/src/pages/projects/ProjectDetailPage.tsx frontend/src/components/projects/ProjectCommercialSection.tsx frontend/src/__tests__/pages/ProjectDetailPage.documentTabs.test.tsx
git commit -m "feat(fase6b): pestaña Documentos con 4 categorías tipificadas y archivo visible en versiones de cotización"
```

---

## Task 8: Cobertura de tests para clientes, comerciales y el ciclo de vida de cotizaciones

**Contexto verificado:** `clientController.ts` y `commercialController.ts` (avance del rediseño paralelo, ya commiteado) no tienen ningún test propio — confirmado, no existe ningún archivo bajo `backend/src/__tests__/**` que los mencione (aparte de los nuevos de las Tasks 1-4 de este plan, que solo cubren permisos y rechazo). Esta tarea llena el resto: CRUD de clientes/contactos, CRUD de comerciales, el ciclo `createQuote → approveQuote → approveClient`, y `markLost`.

**Files:**
- Test: `backend/src/__tests__/controllers/clientController.crud.test.ts` (nuevo, SQLite real)
- Test: `backend/src/__tests__/controllers/commercialController.lifecycle.test.ts` (nuevo, SQLite real)

**Interfaces:**
- Consumes: `clientController`, `commercialController` (ya existentes, sin cambios de firma), helper `realTestDb.ts`.

- [ ] **Step 1: Test de clientes/contactos/comerciales que falla**

Crear `backend/src/__tests__/controllers/clientController.crud.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { clientController } from '../../controllers/clientController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(role: string, id: number, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user: { id, role }, body, params } as unknown as AuthenticatedRequest;
}

describe('clientController - CRUD de clientes, contactos y comerciales (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('un rpa_developer no puede crear clientes ni comerciales (403)', async () => {
        const resClient = mockRes();
        await clientController.createClient(makeReq('rpa_developer', users.dev, { name: 'X' }), resClient);
        expect(resClient.status).toHaveBeenCalledWith(403);

        const resRep = mockRes();
        await clientController.createSalesRep(makeReq('rpa_developer', users.dev, { name: 'Y' }), resRep);
        expect(resRep.status).toHaveBeenCalledWith(403);
    });

    it('team_lead crea un cliente con contacto principal, luego agrega un segundo contacto no principal', async () => {
        const res = mockRes();
        await clientController.createClient(makeReq('team_lead', users.lead, { name: 'Cliente Uno', contact: { name: 'Contacto A' } }), res);
        const client = (res.json as jest.Mock).mock.calls[0][0].data;

        const resContact = mockRes();
        await clientController.addContact(makeReq('team_lead', users.lead, { name: 'Contacto B', is_primary: false }, { clientId: String(client.id) }), resContact);
        expect(resContact.status).toHaveBeenCalledWith(201);

        const contacts = await testDb.query('SELECT name, is_primary FROM client_contacts WHERE client_id = ? ORDER BY name', [client.id]);
        expect(contacts).toEqual([{ name: 'Contacto A', is_primary: 1 }, { name: 'Contacto B', is_primary: 0 }]);
    });

    it('marcar un contacto como principal desmarca al anterior', async () => {
        const res = mockRes();
        await clientController.createClient(makeReq('rpa_operations', users.ops, { name: 'Cliente Dos', contact: { name: 'Original' } }), res);
        const client = (res.json as jest.Mock).mock.calls[0][0].data;
        const original = await testDb.get('SELECT id FROM client_contacts WHERE client_id = ? AND name = ?', [client.id, 'Original']);

        const resNew = mockRes();
        await clientController.addContact(makeReq('rpa_operations', users.ops, { name: 'Nuevo Principal', is_primary: true }, { clientId: String(client.id) }), resNew);

        const rows = await testDb.query('SELECT name, is_primary FROM client_contacts WHERE client_id = ? ORDER BY name', [client.id]);
        expect(rows).toEqual([{ name: 'Nuevo Principal', is_primary: 1 }, { name: 'Original', is_primary: 0 }]);
        expect(original).toBeTruthy();
    });

    it('desactivar un cliente no aparece en listClients por defecto, pero sí con include_inactive', async () => {
        const res = mockRes();
        await clientController.createClient(makeReq('team_lead', users.lead, { name: 'Cliente Tres' }), res);
        const client = (res.json as jest.Mock).mock.calls[0][0].data;

        await clientController.updateClient(makeReq('team_lead', users.lead, { is_active: false }, { clientId: String(client.id) }), mockRes());

        const resDefault = mockRes();
        await clientController.listClients(makeReq('rpa_developer', users.dev, {}, {}) as any, resDefault);
        expect((resDefault.json as jest.Mock).mock.calls[0][0].data.some((c: any) => c.id === client.id)).toBe(false);

        const resAll = mockRes();
        await clientController.listClients({ ...makeReq('team_lead', users.lead), query: { include_inactive: 'true' } } as any, resAll);
        expect((resAll.json as jest.Mock).mock.calls[0][0].data.some((c: any) => c.id === client.id)).toBe(true);
    });

    it('crea y desactiva un comercial', async () => {
        const res = mockRes();
        await clientController.createSalesRep(makeReq('team_lead', users.lead, { name: 'Comercial Uno' }), res);
        const rep = (res.json as jest.Mock).mock.calls[0][0].data;

        await clientController.updateSalesRep(makeReq('team_lead', users.lead, { is_active: false }, { salesRepId: String(rep.id) }), mockRes());

        const resList = mockRes();
        await clientController.listSalesReps(makeReq('team_lead', users.lead), resList);
        expect((resList.json as jest.Mock).mock.calls[0][0].data.some((r: any) => r.id === rep.id)).toBe(false);
    });
});
```

- [ ] **Step 2: Correr y verificar que falla o pasa**

Run: `cd backend && npx jest src/__tests__/controllers/clientController.crud.test.ts`
Expected: como `clientController` ya existe, es probable que **ya pase** (código ya implementado en el rediseño paralelo) — si algún caso falla (por ejemplo, el filtro `include_inactive` requiere pasar `query` en el request y el helper `makeReq` no lo incluye por defecto, corregido arriba con `query: {}` en la firma), es una regresión real a corregir, no un falso negativo del test.

- [ ] **Step 3: Test del ciclo de vida de cotizaciones que falla o pasa**

Crear `backend/src/__tests__/controllers/commercialController.lifecycle.test.ts`:

```typescript
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { commercialController } from '../../controllers/commercialController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(role: string, id: number, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user: { id, role }, body, params } as unknown as AuthenticatedRequest;
}

describe('commercialController - ciclo de vida de cotizacion y etapa comercial (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let projectId: number;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    beforeEach(async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('Ciclo', ?)`, [users.lead]);
        projectId = project.id!;
    });

    it('cada nueva version incrementa el numero correlativo y oculta montos a quien no es team_lead', async () => {
        const res1 = mockRes();
        await commercialController.createQuote(makeReq('team_lead', users.lead, { amount: 1000, currency: 'CLP' }, { projectId: String(projectId) }), res1);
        expect((res1.json as jest.Mock).mock.calls[0][0].data.version).toBe(1);

        const res2 = mockRes();
        await commercialController.createQuote(makeReq('rpa_operations', users.ops, { amount: 2000, currency: 'CLP' }, { projectId: String(projectId) }), res2);
        const body2 = (res2.json as jest.Mock).mock.calls[0][0].data;
        expect(body2.version).toBe(2);
        expect(body2).not.toHaveProperty('amount');
    });

    it('aprobar una version reemplaza las demas y copia precio/horas a project_financials', async () => {
        const resA = mockRes();
        await commercialController.createQuote(makeReq('team_lead', users.lead, { amount: 1000, currency: 'CLP', hours: 100 }, { projectId: String(projectId) }), resA);
        const quoteA = (resA.json as jest.Mock).mock.calls[0][0].data;

        const resB = mockRes();
        await commercialController.createQuote(makeReq('team_lead', users.lead, { amount: 1500, currency: 'CLP', hours: 120 }, { projectId: String(projectId) }), resB);
        const quoteB = (resB.json as jest.Mock).mock.calls[0][0].data;

        await commercialController.approveQuote(makeReq('team_lead', users.lead, {}, { quoteId: String(quoteB.id) }), mockRes());

        const rows = await testDb.query('SELECT id, status FROM project_quotes WHERE project_id = ? ORDER BY version', [projectId]);
        expect(rows).toEqual([{ id: quoteA.id, status: 'replaced' }, { id: quoteB.id, status: 'approved' }]);

        const financials = await testDb.get('SELECT sale_price, budgeted_hours FROM project_financials WHERE project_id = ?', [projectId]);
        expect(financials).toEqual({ sale_price: 1500, budgeted_hours: 120 });
    });

    it('el OK del cliente exige una cotizacion aprobada y cambia la etapa comercial', async () => {
        const resDenied = mockRes();
        await commercialController.approveClient(makeReq('team_lead', users.lead, { approval_reference: 'REF-1' }, { projectId: String(projectId) }), resDenied);
        expect(resDenied.status).toHaveBeenCalledWith(409);

        const resQuote = mockRes();
        await commercialController.createQuote(makeReq('team_lead', users.lead, { amount: 500, currency: 'CLP' }, { projectId: String(projectId) }), resQuote);
        const quote = (resQuote.json as jest.Mock).mock.calls[0][0].data;
        await commercialController.approveQuote(makeReq('team_lead', users.lead, {}, { quoteId: String(quote.id) }), mockRes());

        const resOk = mockRes();
        await commercialController.approveClient(makeReq('team_lead', users.lead, { approval_reference: 'REF-1' }, { projectId: String(projectId) }), resOk);
        expect(resOk.status).not.toHaveBeenCalledWith(409);

        const project = await testDb.get('SELECT commercial_stage FROM projects WHERE id = ?', [projectId]);
        expect(project.commercial_stage).toBe('approved');
    });

    it('marcar perdida exige estar en cotizacion y registra el motivo', async () => {
        const res = mockRes();
        await commercialController.markLost(makeReq('team_lead', users.lead, { reason: 'Cliente eligió otro proveedor' }, { projectId: String(projectId) }), res);
        expect(res.status).not.toHaveBeenCalledWith(409);

        const project = await testDb.get('SELECT commercial_stage, loss_reason FROM projects WHERE id = ?', [projectId]);
        expect(project).toEqual({ commercial_stage: 'lost', loss_reason: 'Cliente eligió otro proveedor' });

        const resAgain = mockRes();
        await commercialController.markLost(makeReq('team_lead', users.lead, { reason: 'x' }, { projectId: String(projectId) }), resAgain);
        expect(resAgain.status).toHaveBeenCalledWith(409);
    });
});
```

- [ ] **Step 4: Correr todo y arreglar cualquier regresión real que aparezca**

Run: `cd backend && npx jest src/__tests__/controllers/clientController.crud.test.ts src/__tests__/controllers/commercialController.lifecycle.test.ts`
Expected: PASS. Si algún caso falla contra el código ya existente (no contra código nuevo de este plan), es una regresión real del rediseño paralelo — corregirla en el controller correspondiente y documentar el fix en el commit, no ajustar el test para que "pase igual".

- [ ] **Step 5: Verificar tipos y commit**

Run: `cd backend && npx tsc --noEmit`
Expected: sin errores.

```bash
git add backend/src/__tests__/controllers/clientController.crud.test.ts backend/src/__tests__/controllers/commercialController.lifecycle.test.ts
git commit -m "test(fase6b): cobertura de clientes/contactos/comerciales y del ciclo de vida de cotizaciones"
```

---

## Task 9: Verificación de punta a punta

**Files:** ninguno nuevo. Si esta verificación encuentra un fallo, se arregla en un commit propio que explique la causa (no se “ajustan” los tests para taparlo).

- [ ] **Step 1: Suites completas, tipos y lint**

Run:
```bash
cd backend && npx tsc --noEmit && npm test && npm run lint
cd ../frontend && npx tsc --noEmit && npm test && npm run lint
```
Expected: todo en verde, sin errores nuevos de lint.

- [ ] **Step 2: Recorrido en el navegador (golden path + permisos) sobre BD limpia**

Con backend (5001) y frontend (3000) corriendo:

1. Login `admin@rpa.com` / `admin123` (team_lead). En **Proyectos**, click "Nuevo proyecto": confirma que abre el wizard de 5 pasos (no el modal de un solo formulario).
2. Paso 1: nombre, cliente, contacto, comercial, **área de negocio** (confirmar que el selector ya trae "RPA/IA" y "SAP"). Paso 2: sube un PDF cualquiera con "Leer cotización con IA", confirma que precarga monto/costo estimado (o al menos no falla si el proveedor de IA no está configurado), ajusta el monto a mano si hace falta, "Siguiente". Paso 3: asigna 1-2 personas con horas presupuestadas, "Siguiente" — confirma que en este punto se crea el proyecto de verdad (navegar a **Proyectos** en otra pestaña y verlo listado). Paso 4: revisa que aparezca un resumen (aunque sea "sin horas suficientes para estimar"). Paso 5: agrega un hito de pago, "Finalizar".
3. Abre el proyecto creado: pestaña **Comercial** muestra la cotización v1 con su archivo adjunto (columna "Archivo" con enlace de descarga) y la etiqueta de etapa "En cotización". Sube una v2 y apruébala: v1 pasa a "Reemplazada", el precio del proyecto refleja la v2.
4. Prueba el botón **Rechazar** sobre una versión `enviada` (crea una v3 solo para esto): pide motivo y la deja en "Rechazada".
5. Click "Registrar aprobación cliente" (con la v2 aprobada): la etapa pasa a "En ejecución". Confirma que editar el proyecto desde `CreateProjectModal` (modal de edición) ya no permite crear una cotización nueva por ahí — el precio solo cambia subiendo y aprobando otra versión.
6. Pestaña **Documentos**: confirma las 4 sub-pestañas (PDD, Documentación técnica, Contrato/OC, Otro), sube un archivo en cada una y confirma que no se mezclan.
7. Login como `rpa_operations`: crea un proyecto con el wizard — confirma que el paso "Resumen financiero" no aparece, y que el paso "Equipo" muestra el mensaje de autoasignación. Confirma que SÍ puede subir una versión de cotización desde la ficha del proyecto (antes daba 403).
8. Login como `rpa_developer` asignado a un proyecto con cotizaciones: confirma que ve la pestaña Comercial y la lista de versiones, pero sin columna de monto ni margen (antes recibía 403 total al intentar verla).
9. Crea un segundo proyecto de prueba y usa "Marcar perdida": confirma que desaparece del tablero de **Proyectos**, y que `GET /api/commercial/projects/:id/quotes` (o el propio proyecto) sigue siendo consultable desde la ficha directa (no se borró).

- [ ] **Step 3: Registrar cierre**

No mergear ni pushear. Reportar al usuario (en lenguaje llano, sin código) qué quedó completo de la lista de pendientes original, qué verificaciones pasaron, y preguntar con el menú de `superpowers:finishing-a-development-branch` (la rama sigue siendo `codex/redisenio-ux-ui-pmo`, que ya contiene además el rediseño UX/UI y el resto de la Fase 7).

---

## Fuera de alcance (a propósito)

- El "aviso de sobrecarga si un dev ya tiene 3+ proyectos" en el paso "Equipo" del wizard: depende del cálculo de FTE del **Sub-proyecto F**, que todavía no existe de forma reutilizable. Se agrega cuando F se construya (mismo límite que ya tenía el plan original superseded).
- Revertir un proyecto "Perdido" de vuelta a "En cotización": no se pidió, y `markLost` deliberadamente no lo permite.
- Editar el cliente/contacto/comercial/área de un proyecto **después** de creado: sigue el mismo patrón que ya existe hoy para cliente/contacto/comercial (`CreateProjectModal.tsx` solo los muestra `{!isEdit}`) — el área nueva se agrega con la misma restricción por consistencia, no es una regresión nueva.
- Editar un cliente completo (razón social, RUT, etc.) o un contacto individual desde `ClientsPage.tsx`: la Task 8 solo agrega tests sobre lo que el controller ya permite (`updateClient`/`updateContact` genéricos ya existen); no se construye UI de edición nueva si `ClientsPage.tsx` no la expone hoy — eso es una brecha de UI que puede abordarse aparte si el usuario la pide explícitamente.
- Auditoría exhaustiva de todos los endpoints que hacen `SELECT p.*` en busca de fuga de columnas comerciales nuevas (`commercial_stage`, `loss_reason`, etc.) fuera de los que este plan toca — esos datos no son tan sensibles como `sale_price`/`amount` (ya protegidos) y no se revisaron uno por uno.
- El rol "Facturación", los avisos automáticos de hitos de pago y el correo: Sub-proyecto D. Margen proyectado y desvíos en tiempo real: Sub-proyecto C. Bitácora técnica: Sub-proyecto E. Dashboard de portafolio: Sub-proyecto G.
- Limpiar filas huérfanas en `files` de PDFs leídos con IA pero nunca confirmados como cotización: aceptado como comportamiento existente (ver Review Focus), no se agrega un job de limpieza.

## Self-Review

- **Cobertura de los 8 puntos de pendientes reales:**
  1. Permisos de rutas comerciales → Task 1.
  2. Selector de área de negocio → Task 2.
  3. Persistencia del PDF de cotización → Task 3.
  4. Corregir permiso de subir cotización → cubierto dentro de la Task 1 (mismo mecanismo de alineación de rutas) y en la Task 3 (ruta de `upload-quote`).
  5. Taxonomía de documentos → Task 7.
  6. Rechazo explícito de cotización → Task 4.
  7. Tests automatizados → Task 8 (más los tests propios de cada Task 1-7).
  8. Verificación de punta a punta → Task 9.
  9. Wizard de 5 pasos (alcance añadido durante el diseño, no estaba numerado en la lista original de 8 pero es el pendiente más grande) → Tasks 5 y 6.
- **Placeholders:** ninguno — todo paso de código trae su implementación completa. Las referencias a "Sub-proyecto C/D/E/F/G" son límites de alcance explícitos.
- **Consistencia de nombres/tipos:** `QuoteStepData` (Task 5) se reutiliza sin cambios en Task 6. `stepKeys`/`currentKey` reemplazan el `currentStep` numérico de la Task 5 en la Task 6 — se documenta explícitamente como una sustitución, no una adición ambigua. `businessAreas`/`clients`/`salesReps` (Task 2 y 5) tienen la misma forma en ambos lugares. `doc_pdd`/`doc_technical`/`doc_contract`/`doc_other` (Task 7) son los únicos 4 valores nuevos de `association_type` introducidos; no chocan con `quote_v{n}`, `evidence` (ya no se usa en el proyecto, verificar en Task 7 que no queda huérfano en otras páginas) ni con el enum de `project_commercial_documents`.
- **Review Focus:** los 5 puntos de la cabecera están cubiertos, cada uno con su test en la tarea indicada (ver arriba, corregidos tras encontrar 2 inconsistencias en la primera redacción: el punto del PDF huérfano y el de "Cotización" en Documentos, ambos ajustados para reflejar lo que las tareas realmente prueban).

