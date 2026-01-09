# Bugs Corregidos - Post-Mortems

Registro de bugs importantes con análisis de root cause y acciones de prevención.

---

## Template

```markdown
## [FECHA] - [Título del Bug]

**Síntomas**: Qué se observaba (error, comportamiento incorrecto)
**Ubicación**: Archivo(s) afectado(s)
**Root Cause**: Por qué ocurría
**Fix**: Qué se cambió
**Prevención**: Qué hacer para evitar bugs similares
```

---

## 2025-08-30 - UTF-8 Characters Showing as Garbage

**Síntomas**: Caracteres españoles (ó, í, ñ) aparecían como `Ã³`, `Ã­`
**Ubicación**: Todo el sistema (backend, frontend, DB)

**Root Cause**: 
- SQLite no tenía PRAGMA encoding configurado
- Express no enviaba charset UTF-8 en responses
- Datos existentes ya estaban corruptos

**Fix**:
1. Agregar `PRAGMA encoding = "UTF-8"` en database.ts
2. Middleware UTF-8 en server.ts
3. Utility `utf8Fix.ts` para corregir datos existentes

**Prevención**:
- Agregado a reference/database-migrations.md: siempre usar UTF-8
- Configuración global de encoding al iniciar servidor

---

## 2025-08-30 - Milestone Responsibility CHECK Constraint Failed

**Síntomas**: Error SQLITE_CONSTRAINT al guardar milestone con responsibility
**Ubicación**: backend/src/controllers/pmoController.ts

**Root Cause**: 
- Frontend enviaba valores en español ("cliente", "interno")
- DB constraint solo aceptaba inglés ("external", "internal", "shared")
- No había mapeo de valores

**Fix**:
- Agregar mapeo bilingual en createMilestone y updateMilestone
- "cliente" → "external", "interno" → "internal"

**Prevención**:
- Documentar en reference/api-development.md: siempre mapear inputs antes de DB
- Agregar validación Zod con transform para normalizar valores

---

## 2025-10-31 - ROI Endpoint 500 Error (Duplicate Column)

**Síntomas**: HTTP 500 en `/api/financial/project-roi/:projectId`
**Ubicación**: backend/src/controllers/financialController.ts

**Root Cause**: 
- SQL INSERT tenía `budgeted_cost` duplicado
- 11 columnas pero solo 10 values

**Fix**: Remover columna duplicada, alinear 10 columnas con 10 values

**Prevención**:
- Siempre contar columnas vs values antes de commit
- Agregar test unitario para endpoints financieros

---

## 2026-01-08 - Create Milestone Error: Column end_date Does Not Exist

**Síntomas**: HTTP 500 al crear milestone. Error: `SQLITE_ERROR: table project_milestones has no column named end_date`
**Ubicación**: 
- `backend/src/controllers/pmoController.ts` (createMilestone, línea 322)
- `backend/src/database/migrationList.ts`

**Root Cause**: 
- El código de `createMilestone` intentaba insertar en columna `end_date`
- La tabla `project_milestones` no tenía esa columna definida
- La columna fue agregada al código pero no a las migraciones

**Fix**:
- Crear migración v21: `ALTER TABLE project_milestones ADD COLUMN end_date DATE`
- Reiniciar backend para aplicar migración

**Prevención**:
- Al agregar campos nuevos a INSERT/UPDATE, verificar que existan en el schema
- Crear migración ANTES de modificar el código del controller
- Agregar test de regresión para verificar columnas requeridas

---

## 2026-01-08 - Get All Contacts Error: Column is_active Does Not Exist

**Síntomas**: HTTP 500 al cargar dropdown de solicitantes. Error: `SQLITE_ERROR: no such column: scc.is_active`
**Ubicación**: 
- `backend/src/controllers/supportController.ts` (getAllContacts, línea 1039)
- `backend/src/database/migrationList.ts`

**Root Cause**: 
- El query en `getAllContacts` usaba `WHERE scc.is_active = 1`
- La tabla `support_company_contacts` (migración v5) no tenía la columna `is_active`
- La columna se esperaba para soft-delete pero nunca fue creada

**Fix**:
- Crear migración v22: `ALTER TABLE support_company_contacts ADD COLUMN is_active INTEGER DEFAULT 1`
- Reiniciar backend para aplicar migración

**Prevención**:
- Al agregar condiciones de soft-delete, verificar que la columna existe
- Mantener sincronizado el schema.sql con las migraciones
- Agregar test de regresión para endpoints de Support

---

## 2026-01-08 - Create Ticket Error: Columnas Faltantes en Support

**Síntomas**: HTTP 500 al crear ticket. Múltiples errores:
1. `SQLITE_ERROR: no such column: is_active` (en support_rpa_processes)
2. `SQLITE_ERROR: table support_tickets has no column named id_ticket`

**Ubicación**: 
- `backend/src/controllers/supportController.ts` (createSupportTicket, getRPAProcesses)
- `backend/src/database/migrationList.ts`

**Root Cause**: 
- El código de `createSupportTicket` usaba columna `id_ticket` para identificador legible
- El código de `getRPAProcesses` usaba `is_active` para soft-delete
- Ninguna de estas columnas existía en las migraciones originales

**Fix**:
- Crear migración v23 con:
  - `ALTER TABLE support_tickets ADD COLUMN id_ticket TEXT`
  - `ALTER TABLE support_rpa_processes ADD COLUMN is_active INTEGER DEFAULT 1`
- Reiniciar backend para aplicar migración

**Prevención**:
- Antes de agregar columnas nuevas en código, verificar que existan en migraciones
- Ejecutar tests de regresión antes de deploy
- Crear tests E2E para flujos críticos como crear ticket

---

## 2026-01-08 - Create Ticket Error: CHECK Constraint Failed

**Síntomas**: HTTP 500 al crear ticket. Error: `SQLITE_CONSTRAINT: CHECK constraint failed`

**Ubicación**: 
- `frontend/src/pages/support/SupportPage.tsx` (dropdown de ticket_type y priority)
- `backend/src/database/migrationList.ts` (CHECK constraints en v3)

**Root Cause**: 
- Frontend enviaba valores para `ticket_type`: `Bug`, `Enhancement`, `Training`
- BD solo acepta: `support`, `maintenance`, `development`, `consultation`
- Frontend enviaba `critical` para priority pero BD solo acepta `urgent`

**Fix**:
- Corregir valores de `ticket_type` en frontend: Bug→support, Enhancement→development, Training→consultation
- Cambiar `critical` por `urgent` en dropdown de prioridad

**Prevención**:
- Documentar valores permitidos por CHECK constraints
- Validar en frontend antes de enviar
- Tests de regresión para verificar valores válidos
