---
description: Proceso estructurado para arreglar un bug
---

# Fix Bug

## 1. Reproducir el Bug
- ¿Cuál es el comportamiento esperado?
- ¿Cuál es el comportamiento actual?
- ¿En qué condiciones ocurre?

## 2. Localizar el Problema
- Revisar logs de backend (`backend/logs/` o consola)
- Revisar consola del navegador (errores JS)
- Identificar el archivo/función donde ocurre

## 3. Cargar Context Relevante
- Leer el archivo problemático
- Revisar archivos relacionados
- Cargar reference doc según el área afectada

## 4. Analizar Root Cause
- ¿Por qué ocurre este bug?
- ¿Es un error de lógica, datos, o configuración?
- ¿Hay otros lugares con el mismo patrón problemático?

## 5. Implementar Fix
- Hacer el cambio mínimo necesario
- Agregar validaciones si es apropiado
- Considerar edge cases

## 6. Verificar el Fix
// turbo
```bash
cd backend && npm test
cd frontend && npm test
```

- Probar manualmente el escenario del bug
- Verificar que no se rompió nada más

## 7. Commit
```bash
git add .
git commit -m "fix(MODULO): Descripción concisa del fix

- Root cause: [explicación]
- Solución: [qué se cambió]

Fixes #ISSUE (si aplica)"
```

## 8. Post-Mortem (IMPORTANTE)
Agregar entrada en `.claude/notes/bugs-fixed.md`:
```markdown
## [FECHA] - Título del Bug
**Síntomas**: Qué se veía mal
**Root Cause**: Por qué ocurría
**Fix**: Qué se cambió
**Prevención**: Qué cambiar en reglas/docs para evitarlo
```

## 9. System Evolution
Preguntarse:
- ¿Este bug revela un patrón problemático?
- ¿Debemos agregar validación/test para evitarlo?
- ¿Hay que actualizar algún reference doc?
