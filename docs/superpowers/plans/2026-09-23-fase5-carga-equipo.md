# Carga del Equipo (Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el widget "Carga del Equipo" del Dashboard PMO — hoy muerto porque lee `project_pmo_metrics`, una tabla que nadie escribe — por uno que cuenta tareas activas (`status != 'done'`) por usuario asignado, usando datos reales y vivos de la tabla `tasks`.

**Architecture:** Un solo endpoint existente cambia su query interna: `pmoController.ts::getPMODashboard` reemplaza el cálculo de `teamWorkload` (hoy: `LEFT JOIN projects`/`project_pmo_metrics`) por un `COUNT` de tareas activas agrupado por usuario. La forma de la respuesta sigue siendo `{ projects, overallMetrics, upcomingMilestones, teamWorkload }` — solo cambian los campos dentro de cada elemento de `teamWorkload` (de `assigned_projects`/`remaining_hours`/`avg_project_completion` a `active_tasks`). En el frontend, el único bloque de render que lee esos campos viejos (`PMODashboard.tsx` líneas ~1270-1313) se actualiza para mostrar `active_tasks` con un umbral de color distinto. Ningún otro archivo del frontend consume `teamWorkload` (confirmado por grep — el único otro lugar que usa `assigned_projects` es `resource.assigned_projects` en la sección de "Utilización de Recursos", que viene de `analytics.resourceUtilization`, un endpoint y campo completamente distinto, fuera de este alcance). Sin migración de base de datos.

**Tech Stack:** Node.js/Express/TypeScript/SQLite (backend ya existente), React 18/TypeScript/Vite/Ant Design (frontend ya existente). Sin dependencias nuevas.

**Spec:** Diseño aprobado en chat el 2026-09-23 (sub-proyecto "carga del equipo" de Fase 5 de RPA Team Manager). Este proyecto no usa un archivo de spec separado — el diseño aprobado vive en la conversación que originó este plan; lo que sigue es su traducción a tareas ejecutables.

## Global Constraints

- Acceso a BD siempre vía `db.query`/`db.get`/`db.run` (nunca `db.all`).
- `db.query` usa `sqlite3`'s `.all()` internamente (`backend/src/database/database.ts:578-600`) y devuelve un array de objetos ya parseados — `COUNT(t.id)` llega como `number` en JS, sin necesidad de cast/parseo adicional.
- Roles reales del sistema: `'team_lead' | 'rpa_developer' | 'rpa_operations' | 'it_support'`. El endpoint `GET /api/pmo/dashboard` ya está restringido a `authorize(['team_lead', 'rpa_operations'])` en `backend/src/routes/pmoRoutes.ts:23` — no se toca ese archivo, la visibilidad no cambia.
- Status válidos de `tasks.status` (CHECK en `backend/src/database/migrationList.ts:65`): `'todo' | 'in_progress' | 'review' | 'testing' | 'done' | 'blocked'`. "Activa" = cualquier status distinto de `'done'`.
- `users.is_active` es `BOOLEAN DEFAULT 1` (`migrationList.ts:16`) — filtrar siempre por usuarios activos.
- La nueva query de `teamWorkload` NO filtra por rol (a diferencia de la vieja, que solo incluía `rpa_developer`/`rpa_operations`) — cualquier usuario activo con al menos una tarea activa asignada debe aparecer.
- Tests backend: mock manual de `db` vía `jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn(), query: jest.fn() } }))` + `jest.clearAllMocks()` en `beforeEach`, siguiendo exactamente el patrón de `backend/src/__tests__/controllers/pmoController.gantt.test.ts` (mismo controller, único test existente hoy para `pmoController.ts`).
- No crear un archivo de test nuevo para `PMODashboard.tsx` en el frontend — el archivo no tiene ningún test hoy (confirmado, cero cobertura previa), tiene ~2000 líneas con múltiples tabs/widgets de Ant Design, y añadir un harness de test solo para esta tarjeta es desproporcionado frente al resto del componente sin cobertura. La verificación de este cambio se hace con el test backend (que fija la forma exacta de `active_tasks`) más verificación manual en navegador.
- No mergear a `main` ni abrir PR — se sigue trabajando en la rama `fase0-saneamiento-seguridad`.

## Review Focus

- Un usuario inactivo (`is_active = 0`) con tareas activas asignadas no debe aparecer en `teamWorkload` — Task 1.
- Una tarea con `status = 'done'` no debe contarse como carga activa, aunque tenga `assignee_id` — Task 1.
- Un usuario activo sin ninguna tarea asignada (o con todas en `done`) no debe aparecer en la lista (la query usa `HAVING COUNT(t.id) > 0`, no `LEFT JOIN` con ceros) — Task 1.
- El orden de la lista debe ser descendente por `active_tasks` (mayor carga primero), igual que el widget viejo ordenaba por `remaining_hours DESC` — Task 1.
- El frontend no debe romper si `teamWorkload` viene vacío (`[]`) — debe seguir mostrando el mensaje "Sin datos del equipo" que ya existe — Task 2.

---

## Task 1: Backend — query de `teamWorkload` basada en tareas activas

**Files:**
- Modify: `backend/src/controllers/pmoController.ts:96-111` (bloque `teamWorkload` dentro de `getPMODashboard`)
- Create: `backend/src/__tests__/controllers/pmoController.teamWorkload.test.ts`

**Interfaces:**
- Produces: cada elemento de `teamWorkload` en la respuesta de `GET /api/pmo/dashboard` tiene la forma `{ id: number, full_name: string, role: string, active_tasks: number }`, usado por Task 2.

- [ ] **Step 1: Escribir el test que falla contra el comportamiento viejo**

Crear `backend/src/__tests__/controllers/pmoController.teamWorkload.test.ts`:

```typescript
jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { PMOController } from '../../controllers/pmoController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('PMOController.getPMODashboard - teamWorkload', () => {
    let controller: PMOController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new PMOController();
    });

    it('cuenta tareas activas por usuario, ordenadas de mayor a menor carga', async () => {
        (db.get as jest.Mock).mockResolvedValue({});
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM users u') && sql.includes('JOIN tasks t')) {
                return Promise.resolve([
                    { id: 2, full_name: 'Ana Dev', role: 'rpa_developer', active_tasks: 5 },
                    { id: 1, full_name: 'Beto Lead', role: 'team_lead', active_tasks: 2 }
                ]);
            }
            return Promise.resolve([]);
        });

        const req = {} as AuthenticatedRequest;
        const res = mockRes();

        await controller.getPMODashboard(req, res);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.teamWorkload).toEqual([
            { id: 2, full_name: 'Ana Dev', role: 'rpa_developer', active_tasks: 5 },
            { id: 1, full_name: 'Beto Lead', role: 'team_lead', active_tasks: 2 }
        ]);
    });

    it('la query de teamWorkload excluye tareas done y usuarios inactivos', async () => {
        (db.get as jest.Mock).mockResolvedValue({});
        let capturedSql = '';
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM users u') && sql.includes('JOIN tasks t')) {
                capturedSql = sql;
            }
            return Promise.resolve([]);
        });

        const req = {} as AuthenticatedRequest;
        const res = mockRes();

        await controller.getPMODashboard(req, res);

        expect(capturedSql).toContain("t.status != 'done'");
        expect(capturedSql).toContain('u.is_active = 1');
        expect(capturedSql).toContain('HAVING COUNT(t.id) > 0');
        expect(capturedSql).toContain('ORDER BY active_tasks DESC');
    });
});
```

- [ ] **Step 2: Correr el test para confirmar que falla**

Run: `cd backend && npx jest pmoController.teamWorkload -v`
Expected: FAIL — la query vieja no devuelve `active_tasks`, y el mock de `db.query` no matchea el SQL viejo (`FROM users u\n LEFT JOIN projects p`), así que `teamWorkload` llega vacío en ambos tests.

- [ ] **Step 3: Reemplazar la query de `teamWorkload`**

En `backend/src/controllers/pmoController.ts`, reemplazar el bloque completo (líneas 96-111):

```typescript
            // Get team workload distribution (tareas activas por persona, dato vivo de la tabla tasks)
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

- [ ] **Step 4: Correr el test para confirmar que pasa**

Run: `cd backend && npx jest pmoController.teamWorkload -v`
Expected: PASS (2/2)

- [ ] **Step 5: Correr toda la suite del backend para confirmar que no rompió nada**

Run: `cd backend && npm test`
Expected: todos los tests existentes siguen en verde (incluyendo `pmoController.gantt.test.ts`, que cubre otro método del mismo controller y no debe verse afectado).

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/pmoController.ts backend/src/__tests__/controllers/pmoController.teamWorkload.test.ts
git commit -m "fix(fase5): teamWorkload del PMO Dashboard usa tareas activas reales en vez de project_pmo_metrics muerta"
```

---

## Task 2: Frontend — render de la card "Carga del Equipo" con `active_tasks`

**Files:**
- Modify: `frontend/src/pages/pmo/PMODashboard.tsx:1278-1305`

**Interfaces:**
- Consumes: `dashboardData.teamWorkload[i]` con forma `{ id: number, full_name: string, role: string, active_tasks: number }` (producido por Task 1).

- [ ] **Step 1: Reemplazar el bloque de render de cada miembro**

En `frontend/src/pages/pmo/PMODashboard.tsx`, dentro de la card "Carga del Equipo", reemplazar el `.map` de `dashboardData?.teamWorkload` (líneas 1278-1305):

```tsx
                  {dashboardData?.teamWorkload?.slice(0, 6)?.map((member: any) => (
                    <div key={member.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px',
                      background: '#fafafa',
                      borderRadius: '4px',
                      marginBottom: '6px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                          {member.full_name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#666' }}>
                          {member.active_tasks} {member.active_tasks === 1 ? 'tarea activa' : 'tareas activas'}
                        </div>
                      </div>
                      <div style={{
                        padding: '2px 6px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        background: member.active_tasks > 8 ? '#fff1f0' : member.active_tasks > 4 ? '#fff7e6' : '#f6ffed',
                        color: member.active_tasks > 8 ? '#f5222d' : member.active_tasks > 4 ? '#fa8c16' : '#52c41a'
                      }}>
                        {member.active_tasks}
                      </div>
                    </div>
                  )) || (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
                      Sin datos del equipo
                    </div>
                  )}
```

- [ ] **Step 2: Verificar tipos y build del frontend**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errores (el tipo de `teamWorkload` sigue siendo `any[]` en la interfaz `PMODashboardData`, así que no hace falta tocar ningún tipo).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/pmo/PMODashboard.tsx
git commit -m "fix(fase5): card de Carga del Equipo en PMO Dashboard muestra tareas activas en vez de horas placeholder"
```

---

## Verificación manual final (post-implementación, antes de la revisión final)

1. Levantar backend (`cd backend && npm run dev`, puerto 5001) y frontend (`cd frontend && npm run dev`, puerto 3000).
2. Loguearse como `team_lead` (o `rpa_operations`), ir a `/pmo`.
3. Confirmar que la card "Carga del Equipo" muestra personas reales con tareas activas asignadas (no vacío ni en cero, salvo que de verdad no haya tareas activas asignadas en los datos actuales).
4. Confirmar que una persona sin tareas activas no aparece en la lista.
5. Confirmar visualmente el color del badge: verde para carga baja, naranja/rojo si algún usuario supera el umbral de 4/8 tareas activas en los datos reales del entorno de desarrollo.
