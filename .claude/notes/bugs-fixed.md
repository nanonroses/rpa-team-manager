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
