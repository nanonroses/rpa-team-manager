---
description: Proceso estructurado para implementar una nueva feature
---

# Nueva Feature

## 1. Entender el Scope
- ¿Qué feature del PRD.md implementaremos? (F01, F02, etc.)
- ¿Cuáles son los criterios de éxito?
- ¿Qué componentes se verán afectados? (backend, frontend, db)

## 2. Cargar Reference Docs Relevantes
Según el tipo de trabajo, leer:
- API: `reference/api-development.md`
- UI: `reference/frontend-components.md`
- DB: `reference/database-migrations.md`
- Auth: `reference/auth-security.md`

## 3. Planificar Cambios
Antes de escribir código:
- Listar archivos que se crearán/modificarán
- Identificar dependencias
- Estimar impacto en otras features

## 4. Implementar (orden recomendado)

### 4.1 Base de Datos (si aplica)
- Crear migración en `backend/src/database/migrationList.ts`
- Seguir guía de `reference/database-migrations.md`

### 4.2 Backend
- Controller: `backend/src/controllers/`
- Routes: `backend/src/routes/`
- Registrar en `backend/src/server.ts`

### 4.3 Frontend
- Página: `frontend/src/pages/`
- Componentes: `frontend/src/components/`
- Agregar ruta en `frontend/src/App.tsx`

## 5. Testing
// turbo
```bash
cd backend && npm test
cd frontend && npm test
```

## 6. Verificar Manualmente
- Iniciar backend: `cd backend && npm run dev`
- Iniciar frontend: `cd frontend && npm run dev`
- Probar la nueva funcionalidad en el navegador

## 7. Commit
```bash
git add .
git commit -m "feat(MODULO): Descripción de la feature

- Detalle de cambios backend
- Detalle de cambios frontend
- Detalle de cambios DB (si aplica)"
```

## 8. Actualizar Documentación
- Si la feature es nueva, agregar al PRD.md
- Si hubo lecciones aprendidas, agregar a `.claude/notes/lessons-learned.md`
