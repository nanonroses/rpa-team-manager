# Guía de Migraciones de Base de Datos

## Sistema de Migraciones

El proyecto usa un sistema de migraciones personalizado en `migrationList.ts`. Las migraciones son incrementales y nunca se editan después de aplicadas.

## Estructura de una Migración

```typescript
// backend/src/database/migrationList.ts
{
  version: 21,  // Siguiente número disponible
  description: 'Descripción clara del cambio',
  up: [
    // Array de statements SQL
    `CREATE TABLE IF NOT EXISTS nueva_tabla (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_nueva_tabla_nombre ON nueva_tabla(nombre)`,
    
    // Triggers
    `CREATE TRIGGER IF NOT EXISTS update_nueva_tabla_timestamp
      AFTER UPDATE ON nueva_tabla
      BEGIN
        UPDATE nueva_tabla SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END`
  ]
}
```

## Agregar Nueva Migración

1. Abrir `backend/src/database/migrationList.ts`
2. Agregar nueva migración al final del array
3. Usar el siguiente número de versión (actualmente: 21)
4. El sistema aplica automáticamente al iniciar el servidor

## Tipos de Cambios Comunes

### Crear Nueva Tabla

```sql
CREATE TABLE IF NOT EXISTS nombre_tabla (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campo1 TEXT NOT NULL,
  campo2 INTEGER DEFAULT 0,
  campo3 DECIMAL(10,2),
  campo4 BOOLEAN DEFAULT 0,
  campo5 DATE,
  foreign_id INTEGER REFERENCES otra_tabla(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Agregar Columna

```sql
ALTER TABLE tabla_existente ADD COLUMN nueva_columna TEXT DEFAULT 'valor'
```

### Agregar Columna con CHECK

```sql
ALTER TABLE tabla ADD COLUMN status TEXT DEFAULT 'active' 
  CHECK (status IN ('active', 'inactive', 'pending'))
```

### Crear Index

```sql
CREATE INDEX IF NOT EXISTS idx_tabla_campo ON tabla(campo)
CREATE INDEX IF NOT EXISTS idx_tabla_campos ON tabla(campo1, campo2)
```

### Crear Trigger

```sql
CREATE TRIGGER IF NOT EXISTS trigger_nombre
  AFTER UPDATE ON tabla
  BEGIN
    UPDATE tabla SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END
```

## Convenciones de Nombres

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Tablas | snake_case, plural | `support_tickets` |
| Columnas | snake_case | `created_at` |
| Foreign keys | referencia_id | `user_id`, `project_id` |
| Indexes | idx_tabla_campo | `idx_tasks_status` |
| Triggers | accion_tabla_contexto | `update_tasks_timestamp` |

## Tipos de Datos SQLite

| Tipo | Uso |
|------|-----|
| INTEGER | IDs, números enteros, booleanos (0/1) |
| TEXT | Strings, enums |
| REAL | Decimales (alternativa a DECIMAL) |
| DECIMAL(10,2) | Moneda, precisión específica |
| DATE | Solo fecha |
| DATETIME | Fecha y hora |
| BOOLEAN | 0 o 1 |

## CHECK Constraints

```sql
-- Enum simulado
status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed'))

-- Rango numérico
percentage INTEGER CHECK (percentage >= 0 AND percentage <= 100)

-- No nulo implícito
campo TEXT NOT NULL
```

## Foreign Keys

```sql
-- En definición de tabla
user_id INTEGER NOT NULL,
FOREIGN KEY (user_id) REFERENCES users(id)

-- Con ON DELETE
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
```

## Seed Data en Migración

```sql
INSERT INTO tabla (campo1, campo2) VALUES 
  ('valor1', 100),
  ('valor2', 200)

-- Con OR IGNORE para evitar duplicados
INSERT OR IGNORE INTO tabla (campo1) VALUES ('valor')
```

## Consultar Schema Actual

```bash
# Ver todas las tablas
sqlite3 backend/database.sqlite ".tables"

# Ver estructura de una tabla
sqlite3 backend/database.sqlite ".schema nombre_tabla"

# Ver migraciones aplicadas
sqlite3 backend/database.sqlite "SELECT * FROM schema_migrations"
```

## Notas Importantes

1. **Nunca editar migraciones ya aplicadas** - Crear nueva migración para cambios
2. **Probar localmente** antes de commit
3. **Backups** antes de migraciones destructivas (DROP, DELETE)
4. **UTF-8** - El sistema ya tiene `PRAGMA encoding = "UTF-8"` configurado

---

## Ejemplos Reales del Proyecto

### Migración 17: Agregar Columnas Simples

```typescript
{
  version: 17,
  description: 'Agregar columnas faltantes a la tabla users (avatar_url, last_login)',
  up: [
    `ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255)`,
    `ALTER TABLE users ADD COLUMN last_login DATETIME`
  ]
}
```

### Migración 18: Tabla Completa con Índices y Trigger

```typescript
{
  version: 18,
  description: 'Crear tabla project_assignments para gestión multi-usuario',
  up: [
    `CREATE TABLE IF NOT EXISTS project_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role VARCHAR(50) DEFAULT 'contributor' 
        CHECK (role IN ('lead', 'contributor', 'reviewer', 'observer')),
      allocation_percentage INTEGER DEFAULT 100 
        CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
      start_date DATE,
      end_date DATE,
      is_active BOOLEAN DEFAULT 1,
      notes TEXT,
      assigned_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (assigned_by) REFERENCES users(id),
      UNIQUE(project_id, user_id, is_active)
    )`,
    
    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id)`,
    
    // Trigger para updated_at automático
    `CREATE TRIGGER IF NOT EXISTS update_project_assignments_timestamp
      AFTER UPDATE ON project_assignments
      BEGIN
        UPDATE project_assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END`
  ]
}
```

### Migración 20: Sistema Completo con Triggers Calculados

```typescript
{
  version: 20,
  description: 'Agregar sistema de Ideas con voting y comentarios',
  up: [
    // Tabla principal
    `CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(50) DEFAULT 'general' 
        CHECK (category IN ('automation', 'process_improvement', 'tool_enhancement', 'cost_reduction', 'productivity', 'general')),
      status VARCHAR(20) DEFAULT 'draft' 
        CHECK (status IN ('draft', 'under_review', 'approved', 'in_progress', 'done', 'rejected')),
      impact_score INTEGER DEFAULT 3 CHECK (impact_score BETWEEN 1 AND 5),
      effort_score INTEGER DEFAULT 3 CHECK (effort_score BETWEEN 1 AND 5),
      priority_score DECIMAL(3,2) DEFAULT 1.0,
      votes_count INTEGER DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`,
    
    // Tabla de votos con restricción única
    `CREATE TABLE IF NOT EXISTS idea_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idea_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      vote_type VARCHAR(10) NOT NULL CHECK (vote_type IN ('up', 'down')),
      UNIQUE(idea_id, user_id),
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`,
    
    // Trigger para calcular priority_score automáticamente
    `CREATE TRIGGER IF NOT EXISTS calculate_priority_score_insert
      AFTER INSERT ON ideas
      BEGIN
        UPDATE ideas SET priority_score = 
          CAST(NEW.impact_score AS DECIMAL) / CAST(NEW.effort_score AS DECIMAL) 
          WHERE id = NEW.id;
      END`,
    
    // Trigger para actualizar vote_count cuando alguien vota
    `CREATE TRIGGER IF NOT EXISTS update_idea_vote_count_insert
      AFTER INSERT ON idea_votes
      BEGIN
        UPDATE ideas SET votes_count = (
          SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'up'
        ) - (
          SELECT COUNT(*) FROM idea_votes WHERE idea_id = NEW.idea_id AND vote_type = 'down'
        ) WHERE id = NEW.idea_id;
      END`
  ]
}
```

---

## Archivos Relacionados

- Migraciones: `backend/src/database/migrationList.ts`
- Schema completo: `backend/src/database/schema.sql`
- Database manager: `backend/src/database/database.ts`
- Documentación: `docs/database-schema.md`

