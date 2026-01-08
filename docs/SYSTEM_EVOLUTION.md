# Sistema de Evolución - RPA Team Manager

Este documento describe el proceso de mejora continua del sistema, donde cada bug, feature, y desafío se convierte en una oportunidad para fortalecer las reglas, documentación, y prácticas del proyecto.

---

## Filosofía

> **"Cada problema es una oportunidad para que el sistema se vuelva más fuerte"**

En lugar de solo arreglar problemas puntuales, este sistema promueve:
1. Identificar la **causa raíz** de cada problema
2. Documentar el **aprendizaje** obtenido
3. **Actualizar reglas/docs** para prevenir recurrencia
4. **Compartir conocimiento** con el equipo (humano y AI)

---

## Cuándo Activar el Sistema de Evolución

| Evento | Acción |
|--------|--------|
| Bug corregido | Agregar post-mortem a `bugs-fixed.md` |
| Feature completada | Revisar qué se puede mejorar en docs/reglas |
| Problema inesperado | Documentar en `lessons-learned.md` |
| Decisión arquitectónica | Registrar en `decisions.md` |
| Patrón repetido | Crear/actualizar reference doc |

---

## Proceso de Evolución (después de cada tarea)

### Paso 1: Reflexión Inmediata
Después de completar una tarea, preguntarse:
- ¿Hubo algo inesperado?
- ¿Tuve que corregir algo durante el proceso?
- ¿Faltó información que hubiera sido útil?
- ¿Hay algo que pueda fallar de nuevo en el futuro?

### Paso 2: Documentar
Según el tipo de evento:

**Para Bugs:**
```markdown
## [FECHA] - [Título del Bug]
**Síntomas**: Qué se observaba
**Ubicación**: Archivo(s) afectado(s)
**Root Cause**: Por qué ocurrió
**Fix**: Qué se cambió
**Prevención**: Qué hacer para evitar bugs similares
```

**Para Lecciones:**
```markdown
## [FECHA] - [Título]
**Contexto**: Qué estábamos haciendo
**Problema**: Qué salió mal o fue difícil
**Lección**: Qué aprendimos
**Acción**: Qué cambio hicimos en el sistema
```

**Para Decisiones:**
```markdown
## [FECHA] - [Título de la Decisión]
**Contexto**: Problema que resolvíamos
**Opciones**: Alternativas consideradas
**Decisión**: Qué elegimos
**Razón**: Por qué
**Consecuencias**: Implicaciones
```

### Paso 3: Actualizar Reglas/Docs
Identificar qué archivo(s) necesitan actualizarse:

| Si el problema fue en... | Actualizar |
|--------------------------|------------|
| API/Backend | `reference/api-development.md` |
| Frontend/UI | `reference/frontend-components.md` |
| Base de datos | `reference/database-migrations.md` |
| Autenticación | `reference/auth-security.md` |
| Testing | `reference/testing-guide.md` |
| ML Service | `reference/ml-service.md` |
| Proceso general | `CLAUDE.md` o workflow relevante |

### Paso 4: Verificar Mejora
- ¿La documentación ahora cubre el caso problemático?
- ¿Un agente nuevo podría evitar el mismo error?
- ¿Hay un test que detectaría este problema?

---

## Checklist de Evolución Post-Tarea

```markdown
## Checklist de Evolución

### Reflexión
- [ ] ¿Hubo problemas inesperados?
- [ ] ¿Se corrigió algo durante el proceso?
- [ ] ¿Faltó información útil?

### Documentación (si aplica)
- [ ] Bug documentado en `bugs-fixed.md`
- [ ] Lección documentada en `lessons-learned.md`
- [ ] Decisión documentada en `decisions.md`

### Mejora del Sistema (si aplica)
- [ ] Reference doc actualizado
- [ ] Workflow actualizado
- [ ] CLAUDE.md actualizado
- [ ] Test agregado para prevenir regresión

### Commit
- [ ] Cambios de evolución commiteados
```

---

## Ejemplos de Evolución Efectiva

### Ejemplo 1: Bug de UTF-8
**Problema**: Caracteres españoles aparecían corruptos
**Evolución**:
1. ✅ Documentado en `bugs-fixed.md` con root cause y fix
2. ✅ Agregado PRAGMA UTF-8 a `database-migrations.md`
3. ✅ Actualizado `CLAUDE.md` con nota sobre encoding
4. ✅ Creado utility `utf8Fix.ts` reutilizable
5. ✅ Test `utf8Fix.test.ts` para prevenir regresión

### Ejemplo 2: Milestone Responsibility Error
**Problema**: CHECK constraint fallaba por valores en español
**Evolución**:
1. ✅ Documentado en `bugs-fixed.md`
2. ✅ Agregado mapeo bilingual al controller
3. ✅ Nota en `api-development.md`: "mapear inputs antes de DB"
4. ✅ Sugerencia de usar Zod transform para normalizar

### Ejemplo 3: Decisión Multi-Usuario
**Problema**: Sistema solo soportaba un usuario por proyecto
**Evolución**:
1. ✅ Documentado en `decisions.md` como ADR
2. ✅ Creada tabla `project_assignments`
3. ✅ Actualizado cálculo de ROI para multi-usuario
4. ✅ Tests de regresión para cálculos financieros

---

## Métricas de Salud del Sistema

El sistema está evolucionando bien si:
- 📈 `bugs-fixed.md` crece con cada bug (no se repiten)
- 📈 `lessons-learned.md` tiene entradas regulares
- 📈 Reference docs se vuelven más completos
- 📈 Tests de regresión cubren más casos
- 📉 Tiempo para resolver problemas similares disminuye
- 📉 Errores repetidos disminuyen

---

## Integración con Workflows

El workflow `/system-evolution` ya está configurado para guiar este proceso.
Ejecutarlo después de completar features importantes o corregir bugs significativos.

```
Uso: /system-evolution
```

---

## Archivos del Sistema de Evolución

| Archivo | Propósito |
|---------|-----------|
| `.claude/notes/bugs-fixed.md` | Post-mortems de bugs |
| `.claude/notes/lessons-learned.md` | Lecciones aprendidas |
| `.claude/notes/decisions.md` | Decisiones arquitectónicas |
| `.agent/workflows/system-evolution.md` | Workflow de auto-reflexión |
| `docs/SYSTEM_EVOLUTION.md` | Este documento (proceso) |
