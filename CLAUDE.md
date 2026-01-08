# RPA Team Manager - Reglas Globales

## Stack
- **Backend**: Node.js, Express, TypeScript, SQLite
- **Frontend**: React 18, TypeScript, Vite, Ant Design
- **ML**: Python, FastAPI, scikit-learn, XGBoost
- **Auth**: JWT + bcrypt
- **Deploy**: Docker Compose

## Comandos

```bash
# Backend (puerto 5001)
cd backend && npm run dev

# Frontend (puerto 3000)
cd frontend && npm run dev

# ML Service (puerto 8002)
cd ml-service && python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8002 --reload

# Tests
cd backend && npm test
cd frontend && npm test

# Linting
npm run lint
```

## Estructura del Proyecto

```
├── backend/src/         # API Express
│   ├── controllers/     # Lógica de endpoints
│   ├── routes/          # Definición de rutas
│   ├── database/        # SQLite + migraciones
│   └── middleware/      # Auth, validation, security
├── frontend/src/        # React SPA
│   ├── pages/           # Páginas principales
│   ├── components/      # Componentes reutilizables
│   └── services/        # API client
├── ml-service/src/      # Python ML
│   ├── models/          # Predictores
│   └── api/             # FastAPI endpoints
├── reference/           # 📖 Docs por tipo de tarea
└── docs/                # Documentación general
```

## Code Quality - CRÍTICO

**SIEMPRE antes de completar una tarea:**
1. Ejecutar diagnósticos del IDE para errores de linting/tipos
2. Corregir todos los errores antes de considerar completa la tarea
3. Este paso NUNCA debe omitirse

## Reference Docs (cargar según el tipo de tarea)

| Tarea | Documento |
|-------|-----------|
| Desarrollar API | `reference/api-development.md` |
| Componentes UI | `reference/frontend-components.md` |
| Migraciones DB | `reference/database-migrations.md` |
| Auth/Seguridad | `reference/auth-security.md` |
| Testing | `reference/testing-guide.md` |
| ML Service | `reference/ml-service.md` |

## Workflows (Slash Commands)

| Comando | Uso |
|---------|-----|
| `/start-dev` | Iniciar servidores de desarrollo |
| `/build-and-test` | Compilar y ejecutar tests |
| `/new-feature` | Implementar nueva feature |
| `/fix-bug` | Proceso para arreglar bugs |
| `/code-review` | Checklist de code review |
| `/deploy` | Proceso de deployment |
| `/system-evolution` | Auto-reflexión post-tarea |

## Notas Estructuradas

- Decisiones: `.claude/notes/decisions.md`
- Bugs corregidos: `.claude/notes/bugs-fixed.md`
- Lecciones: `.claude/notes/lessons-learned.md`

## Git

- Commits descriptivos que capturen el alcance completo
- Agregar y commitear automáticamente al completar tareas

