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

## Archivos Relacionados

- Migraciones: `backend/src/database/migrationList.ts`
- Schema completo: `backend/src/database/schema.sql`
- Database manager: `backend/src/database/database.ts`
- Documentación: `docs/database-schema.md`
