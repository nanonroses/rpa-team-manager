# Decisiones de Diseño

Registro de decisiones arquitectónicas y de diseño importantes del proyecto.

---

## Template

```markdown
## [FECHA] - [Título de la Decisión]

**Contexto**: ¿Qué problema estábamos resolviendo?
**Opciones Consideradas**:
1. Opción A - pros/cons
2. Opción B - pros/cons

**Decisión**: Qué elegimos
**Razón**: Por qué elegimos esta opción
**Consecuencias**: Qué implica esta decisión
```

---

## 2025-08-30 - Sistema de Migraciones Personalizado

**Contexto**: Necesitábamos gestionar cambios de schema de BD sin perder datos.

**Opciones Consideradas**:
1. Knex.js migrations - Más features pero más complejidad
2. Sistema personalizado en migrationList.ts - Simple, control total

**Decisión**: Sistema personalizado con versiones incrementales
**Razón**: SQLite es simple, no necesitamos rollbacks complejos
**Consecuencias**: Debemos mantener manualmente el orden de versiones

---

## 2025-08-23 - Multi-Usuario por Proyecto

**Contexto**: El sistema original solo permitía un usuario por proyecto.

**Opciones Consideradas**:
1. Campo JSON con array de usuarios - Simple pero sin integridad referencial
2. Tabla pivot project_assignments - Más robusto

**Decisión**: Tabla project_assignments con roles y allocation%
**Razón**: Permite queries eficientes y relaciones claras
**Consecuencias**: Cálculo ROI considera todos los usuarios asignados

---

## 2025-08-22 - Ant Design sobre TailwindCSS

**Contexto**: Elegir framework de UI para el frontend.

**Opciones Consideradas**:
1. TailwindCSS - Muy flexible pero más código
2. Ant Design - Componentes listos, menos personalización

**Decisión**: Ant Design
**Razón**: Velocidad de desarrollo, componentes enterprise-ready
**Consecuencias**: Dependencia de diseño de Ant, menos flexibilidad visual
