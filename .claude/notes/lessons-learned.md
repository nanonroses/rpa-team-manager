# Lecciones Aprendidas

Conocimiento acumulado del desarrollo del proyecto para referencia futura.

---

## Template

```markdown
## [FECHA] - [Título]

**Contexto**: Qué estábamos haciendo
**Problema**: Qué salió mal o fue difícil
**Lección**: Qué aprendimos
**Acción**: Qué cambio hicimos en el sistema
```

---

## SQLite en Producción

**Contexto**: Elegimos SQLite por simplicidad para equipo pequeño
**Problema**: Algunos queries complejos son más difíciles sin subqueries avanzados
**Lección**: SQLite es suficiente para ~5 usuarios, pero planificar migración si crece
**Acción**: Documentado en GEMINI.md como consideración futura

---

## Ant Design Forms

**Contexto**: Implementando formularios complejos
**Problema**: Form.useForm() requiere instancia específica para setFieldsValue
**Lección**: Siempre usar `const [form] = Form.useForm()` y pasarlo al componente
**Acción**: Agregado patrón en reference/frontend-components.md

---

## Rate Limiting con proxies

**Contexto**: Configurando rate limiting en desarrollo
**Problema**: Vite proxy hace que todas las requests parezcan del mismo IP
**Lección**: En desarrollo, rate limiting puede no funcionar como en producción
**Acción**: Documentado en reference/auth-security.md

---

## Migraciones y Datos Existentes

**Contexto**: Agregando columnas con CHECK constraints
**Problema**: ALTER TABLE + CHECK puede fallar si hay datos que no cumplen
**Lección**: Agregar DEFAULT que cumpla el CHECK, o actualizar datos primero
**Acción**: Agregado como nota en reference/database-migrations.md

---

## React Query vs Estado Local

**Contexto**: Decidiendo cómo manejar fetching de datos
**Problema**: Inicialmente usamos useEffect + useState, causando race conditions
**Lección**: React Query maneja caching, deduplicación y revalidation automáticamente
**Acción**: Preferir React Query para datos del servidor

---

## Modales y Datos Frescos

**Contexto**: Modal de edición mostraba datos viejos
**Problema**: El modal mantenía estado anterior entre aperturas
**Lección**: Usar `destroyOnClose` en Modal de Ant Design
**Acción**: Agregado patrón en reference/frontend-components.md
