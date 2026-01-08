---
description: Checklist de code review antes de merge
---

# Code Review

## 1. Contexto
- ¿Qué problema resuelve este cambio?
- ¿Qué archivos fueron modificados?
- ¿Es feature nueva, fix, o refactor?

## 2. Revisión de Código

### Calidad General
- [ ] Código es legible y bien organizado
- [ ] Nombres de variables/funciones son descriptivos
- [ ] No hay código duplicado
- [ ] Complejidad es manejable

### TypeScript
- [ ] Tipos están correctamente definidos
- [ ] No hay `any` innecesarios
- [ ] Interfaces/types están en lugar apropiado

### Seguridad
- [ ] Inputs están validados
- [ ] No hay SQL injection posible
- [ ] No hay XSS posible
- [ ] Autenticación/autorización correcta

### Performance
- [ ] No hay queries N+1
- [ ] No hay operaciones bloqueantes innecesarias
- [ ] Datos grandes tienen paginación

### Error Handling
- [ ] Errores son capturados apropiadamente
- [ ] Mensajes de error son útiles
- [ ] Logs de error están presentes

## 3. Tests
// turbo
```bash
cd backend && npm test
cd frontend && npm test
```

- [ ] Tests existentes pasan
- [ ] Nueva funcionalidad tiene tests
- [ ] Edge cases están cubiertos

## 4. Documentación
- [ ] Código complejo tiene comentarios
- [ ] README/docs actualizados si es necesario
- [ ] Cambios de API están documentados

## 5. Output del Review
Generar reporte:
```markdown
## Code Review Summary

**Cambios revisados**: [lista de archivos]
**Veredicto**: ✅ Aprobado / ⚠️ Cambios menores / ❌ Requiere cambios

### Positivo
- [qué está bien hecho]

### Sugerencias
- [mejoras opcionales]

### Requerido (si aplica)
- [cambios necesarios antes de merge]
```
