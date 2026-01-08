---
description: Auto-reflexión después de completar una feature o fix
---

# System Evolution

> **Filosofía**: Cada problema es una oportunidad para que el sistema se vuelva más fuerte.

Ver guía completa: `docs/SYSTEM_EVOLUTION.md`

---

## 1. Contexto
- ¿Qué tarea acabamos de completar?
- ¿Hubo problemas inesperados?
- ¿Tuvimos que corregir algo durante el proceso?

## 2. Análisis de Problemas Encontrados
Si hubo correcciones durante el proceso:

### Problema 1
- **Qué falló**: [descripción]
- **Por qué falló**: [root cause]
- **Cómo lo arreglamos**: [solución]

## 3. Documentar (según corresponda)

### Si fue Bug:
Agregar a `.claude/notes/bugs-fixed.md`:
```markdown
## [FECHA] - [Título del Bug]
**Síntomas**: Qué se observaba
**Ubicación**: Archivo(s) afectado(s)
**Root Cause**: Por qué ocurrió
**Fix**: Qué se cambió
**Prevención**: Qué hacer para evitar bugs similares
```

### Si fue Lección:
Agregar a `.claude/notes/lessons-learned.md`:
```markdown
## [FECHA] - [Título]
**Contexto**: Qué estábamos haciendo
**Problema**: Qué salió mal
**Lección**: Qué aprendimos
**Mejora**: Qué cambiamos en el sistema
```

### Si fue Decisión Arquitectónica:
Agregar a `.claude/notes/decisions.md`:
```markdown
## [FECHA] - [Título]
**Contexto**: Problema que resolvíamos
**Opciones**: Alternativas consideradas
**Decisión**: Qué elegimos
**Razón**: Por qué
```

## 4. Actualizar Reglas/Docs

| Si el problema fue en... | Actualizar |
|--------------------------|------------|
| API/Backend | `reference/api-development.md` |
| Frontend/UI | `reference/frontend-components.md` |
| Base de datos | `reference/database-migrations.md` |
| Autenticación | `reference/auth-security.md` |
| Testing | `reference/testing-guide.md` |
| ML Service | `reference/ml-service.md` |
| Proceso general | `CLAUDE.md` |

## 5. Agregar Test de Regresión (si aplica)
```bash
# Crear test que detectaría este problema
tests/regression/[feature].test.ts
```

## 6. Ejecutar Checklist
Ver `.claude/notes/evolution-checklist.md` para checklist rápido.

## 7. Actualizar Métricas
Actualizar contadores en `.claude/notes/metrics.md`.

## 8. Commit
```bash
git add .
git commit -m "chore(evolution): [descripción de la mejora]

- Documentado [bug/lección/decisión]
- Actualizado [archivo(s)]
- Agregado test de regresión (si aplica)"
```

## 9. Resultado Esperado
El sistema debe volverse más robusto con cada iteración:
- ✅ Menos errores repetidos
- ✅ Documentación más completa
- ✅ Workflows más precisos
- ✅ Tests más comprehensivos
- ✅ Agentes más efectivos
