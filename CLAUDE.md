# RPA Team Manager - Reglas Globales

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

## Code Quality - CRÍTICO

**SIEMPRE antes de completar una tarea:**
1. Ejecutar diagnósticos del IDE para errores de linting/tipos (`npm run lint` y `npm run check:theme`).
2. En tareas de Frontend/UI: Cumplir estrictamente `docs/UI_THEME_SPEC.md` (cero colores quemados `#fafafa`/`#262626`, cero `bodyStyle`, soporte 100% Día y Noche con `theme.useToken()`).
3. Corregir todos los errores antes de considerar completa la tarea.
4. Este paso NUNCA debe omitirse.

## Reference Docs (cargar según el tipo de tarea)

| Tarea | Documento |
|-------|-----------|
| Theming Día/Noche / UI | `docs/UI_THEME_SPEC.md` |
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

| Archivo | Propósito |
|---------|-----------|
| `.claude/notes/decisions.md` | Decisiones arquitectónicas |
| `.claude/notes/bugs-fixed.md` | Post-mortems de bugs |
| `.claude/notes/lessons-learned.md` | Lecciones aprendidas |
| `.claude/notes/evolution-checklist.md` | Checklist rápido |
| `.claude/notes/metrics.md` | Métricas del sistema |

## Sistema de Evolución

**Después de cada tarea importante, ejecutar `/system-evolution`**

Filosofía: Cada bug/problema es una oportunidad para fortalecer el sistema.
Ver guía completa: `docs/SYSTEM_EVOLUTION.md`

## Git

- Commits descriptivos que capturen el alcance completo
- Agregar y commitear automáticamente al completar tareas
