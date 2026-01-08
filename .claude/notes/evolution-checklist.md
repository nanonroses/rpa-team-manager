# Checklist de Evolución

Checklist rápido para ejecutar después de completar tareas importantes.

---

## Post-Feature Checklist

### 🔍 Reflexión
- [ ] ¿Hubo problemas inesperados durante la implementación?
- [ ] ¿Tuve que corregir algo que no estaba documentado?
- [ ] ¿Faltó información que hubiera ahorrado tiempo?
- [ ] ¿Hay algún patrón que pueda repetirse en el futuro?

### 📝 Documentación
- [ ] Si hubo bug → Agregar a `bugs-fixed.md`
- [ ] Si hubo lección → Agregar a `lessons-learned.md`
- [ ] Si hubo decisión importante → Agregar a `decisions.md`

### 🔧 Mejora del Sistema
- [ ] ¿Algún reference doc necesita actualización?
- [ ] ¿Algún workflow necesita un paso adicional?
- [ ] ¿CLAUDE.md necesita una nueva regla?
- [ ] ¿Se debería agregar un test de regresión?

### ✅ Finalización
- [ ] Cambios de evolución commiteados
- [ ] Sistema más robusto que antes

---

## Post-Bug Checklist

### 🐛 Análisis
- [ ] Root cause identificado
- [ ] Entendido por qué no se detectó antes
- [ ] Identificados otros lugares con el mismo patrón

### 📝 Documentación
- [ ] Post-mortem agregado a `bugs-fixed.md`
- [ ] Incluye: síntomas, ubicación, root cause, fix, prevención

### 🛡️ Prevención
- [ ] Test agregado para detectar regresión
- [ ] Documentación actualizada para evitar recurrencia
- [ ] Validación/sanitización agregada si aplica

---

## Quick Reference

```bash
# Archivos a actualizar según el tipo de problema:

# Bug en API
→ bugs-fixed.md
→ reference/api-development.md
→ tests/regression/[feature].test.ts

# Bug en Frontend
→ bugs-fixed.md
→ reference/frontend-components.md

# Bug en DB
→ bugs-fixed.md
→ reference/database-migrations.md

# Bug en Auth
→ bugs-fixed.md
→ reference/auth-security.md

# Lección general
→ lessons-learned.md
→ CLAUDE.md (si es regla global)
```

---

## Preguntas de Auto-Reflexión

Después de cada tarea, preguntarse:

1. **"¿Qué salió diferente de lo esperado?"**
   - Si algo salió diferente, documentarlo

2. **"¿Un agente nuevo cometería el mismo error?"**
   - Si sí, actualizar docs para prevenirlo

3. **"¿Hay un test que detectaría este problema?"**
   - Si no, considerar agregarlo

4. **"¿Qué información me hubiera ahorrado tiempo?"**
   - Esa información debe ir en los docs

5. **"¿Este problema puede volver a ocurrir?"**
   - Si sí, crear regla/validación/test para prevenirlo
