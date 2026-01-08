---
description: Auto-reflexión después de completar una feature o fix
---

# System Evolution

## 1. Contexto
- ¿Qué tarea acabamos de completar?
- ¿Hubo problemas inesperados?
- ¿Tuvimos que corregir algo durante el proceso?

## 2. Análisis de Problemas Encontrados
Si hubo correcciones during el proceso:

### Problema 1
- **Qué falló**: [descripción]
- **Por qué falló**: [root cause]
- **Cómo lo arreglamos**: [solución]

### Problema 2
- ...

## 3. Revisar Reglas y Docs
Leer estos archivos buscando qué mejorar:
- `CLAUDE.md` - ¿Falta alguna regla global?
- `reference/[tipo-relevante].md` - ¿Falta algún patrón?
- `.agent/workflows/[workflow-usado].md` - ¿Falta algún paso?

## 4. Proponer Mejoras
Para cada problema encontrado:
```markdown
### Mejora Propuesta
**Archivo**: [cuál archivo modificar]
**Cambio**: [qué agregar/modificar]
**Razón**: [por qué esto evitará el problema]
```

## 5. Implementar Mejoras
- Editar los archivos identificados
- Agregar reglas/patrones/pasos faltantes
- Commit con mensaje descriptivo

## 6. Documentar Lección
Agregar a `.claude/notes/lessons-learned.md`:
```markdown
## [FECHA] - [Título]
**Contexto**: Qué estábamos haciendo
**Problema**: Qué salió mal
**Lección**: Qué aprendimos
**Mejora**: Qué cambiamos en el sistema
```

## 7. Resultado Esperado
El sistema debe volverse más robusto con cada iteración:
- Menos errores repetidos
- Documentación más completa
- Workflows más precisos
- Agentes más efectivos
