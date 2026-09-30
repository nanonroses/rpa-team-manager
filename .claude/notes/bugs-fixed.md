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

---

## 2026-09-29 - Hardcoded Colors & Deprecated bodyStyle Breaking Dark Mode

**Síntomas**: 
- Al abrir el modal de imputación por Centros de Costo en Modo Noche, la sección de «Atajos Rápidos» aparecía como una caja blanca brillante deslumbrante (`#fafafa` / `rgb(250, 250, 250)`) con bordes grises claros `#d9d9d9`.
- Consola de DevTools arrojaba `Warning: [antd: Card] bodyStyle is deprecated. Please use styles.body instead`.
- Insignias de CECOs tenían contraste deficiente en modo oscuro y error de sintaxis CSS en border.

**Ubicación**: 
- `frontend/src/components/costCenters/CostCenterDistributionPicker.tsx`
- `frontend/src/components/costCenters/CostCenterTag.tsx`
- `frontend/src/components/settings/CostCentersDirectoryCard.tsx`
- `frontend/src/pages/billing/BillingPage.tsx`
- `frontend/src/components/tasks/TaskDependenciesEditor.tsx`

**Root Cause**: 
- Creación de componentes UI asumiendo fondo claro por defecto y quemando valores hexadecimales (`#fafafa`, `#595959`, `#d9d9d9`).
- Omisión de la API de Design Tokens de Ant Design v5 (`theme.useToken()`).
- Inexistencia de un linter o script de verificación automatizado para reglas de theming.

**Fix**:
1. Migrar todos los componentes afectados a `theme.useToken()` y tokens semánticos adaptativos (`token.colorFillAlter`, `token.colorBorderSecondary`, `token.colorTextSecondary`).
2. Reemplazar `bodyStyle` por `styles={{ body: ... }}` en toda la aplicación.
3. Crear script automatizado `frontend/scripts/check-theme-compliance.js` (`npm run check:theme`) integrado al linting.
4. Crear la especificación `docs/UI_THEME_SPEC.md` con reglas estrictas y checklist obligatorio.

**Prevención**:
- Regla mandatoria agregada en `CLAUDE.md`, `GEMINI.md` y `reference/frontend-components.md`.
- `npm run check:theme` audita automáticamente 100% de los archivos de frontend para bloquear cualquier color quemado o propiedad deprecada.

---

## 2026-09-29 - Select & Dropdown Menus in Dark Mode Showing White Text on White/Cream Background

**Síntomas**: 
- Al abrir cualquier menú desplegable (`<Select>`) en Modo Noche, la opción actualmente seleccionada aparecía con fondo crema/blanco (`#FFF7ED`) y texto blanco, haciéndola completamente invisible e ilegible.

**Ubicación**: 
- `frontend/src/components/common/designTokens.ts`
- `frontend/src/components/common/ThemeProvider.tsx`
- `frontend/src/index.css`

**Root Cause**: 
- En `designTokens.ts`, el componente `Select` tenía configurado `optionSelectedBg: palette.color.primaryBg` (`#FFF7ED` para la paleta orange).
- `ThemeProvider.tsx` no sobreescribía la configuración del componente `Select` ni los tokens globales `controlItemBgActive` / `controlItemBgHover` en Modo Noche (`dark`).
- Ant Design v5 propagó `optionSelectedBg = #FFF7ED` (crema de modo claro) a todas las listas desplegables en modo noche, mientras que el texto usaba el color claro de dark mode (`#F5F5F5`), produciendo contraste blanco sobre blanco.

**Fix**:
1. En `ThemeProvider.tsx`, configurar tokens `controlItemBgActive`, `controlItemBgHover` y `controlItemBgActiveHover` adaptativos para modo claro y oscuro.
2. Sobreescribir componentes `Select`, `Dropdown`, `DatePicker`, `Cascader` y `TreeSelect` en `ThemeProvider.tsx` con fondos oscuros translúcidos (`rgba(234, 88, 12, 0.22)`) y texto de alto contraste (`#FB923C` / `#60A5FA`).
3. En `designTokens.ts`, añadir `optionSelectedColor: palette.color.primary`.
4. En `src/index.css`, incorporar reglas globales para `:root[data-theme="dark"] .ant-select-dropdown` y `.ant-select-item-option-selected` garantizando que cualquier contenido interno (como `<span>` o etiquetas) herede el color de alto contraste.
5. Documentar la Regla 8 en `docs/UI_THEME_SPEC.md`.

**Prevención**:
- Siempre validar la apariencia de menús desplegables (`<Select>`), modales y portales flotantes en ambos modos.
- Regla 8 añadida a `docs/UI_THEME_SPEC.md`.
