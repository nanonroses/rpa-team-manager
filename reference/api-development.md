# Guía de Desarrollo de APIs

## Estructura de Controllers

```typescript
// backend/src/controllers/[nombre]Controller.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../database/database';

export const getItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await db.all('SELECT * FROM items WHERE is_active = 1');
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};
```

## Estructura de Routes

```typescript
// backend/src/routes/[nombre]Routes.ts
import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import * as controller from '../controllers/[nombre]Controller';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', authorize(['team_lead']), validateBody(createSchema), controller.create);
router.put('/:id', authorize(['team_lead']), validateBody(updateSchema), controller.update);
router.delete('/:id', authorize(['team_lead']), controller.delete);

export default router;
```

## Convenciones de Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/[recurso]` | Listar todos |
| GET | `/api/[recurso]/:id` | Obtener uno |
| POST | `/api/[recurso]` | Crear nuevo |
| PUT | `/api/[recurso]/:id` | Actualizar |
| DELETE | `/api/[recurso]/:id` | Eliminar |

## Respuestas Estándar

```typescript
// Éxito
res.json({ success: true, data: result });
res.status(201).json({ success: true, data: newItem, message: 'Creado exitosamente' });

// Error
res.status(400).json({ success: false, error: 'Mensaje descriptivo' });
res.status(404).json({ success: false, error: 'Recurso no encontrado' });
res.status(500).json({ success: false, error: 'Error interno del servidor' });
```

## Validación con Zod

```typescript
// backend/src/validation/schemas.ts
import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  start_date: z.string().datetime().optional(),
  budget: z.number().positive().optional(),
});
```

## Middleware de Autenticación

```typescript
// Requerir autenticación
router.use(authenticate);

// Requerir rol específico
router.post('/', authorize(['team_lead']), controller.create);

// Roles disponibles: team_lead, rpa_developer, rpa_operations, it_support
```

## Queries SQL

```typescript
// SELECT con parámetros seguros
const items = await db.all('SELECT * FROM items WHERE status = ?', [status]);

// INSERT
const result = await db.run(
  'INSERT INTO items (name, value) VALUES (?, ?)',
  [name, value]
);
const newId = result.lastID;

// UPDATE
await db.run('UPDATE items SET name = ? WHERE id = ?', [name, id]);

// DELETE
await db.run('DELETE FROM items WHERE id = ?', [id]);

// Transaction
await db.run('BEGIN TRANSACTION');
try {
  await db.run('INSERT ...');
  await db.run('UPDATE ...');
  await db.run('COMMIT');
} catch (error) {
  await db.run('ROLLBACK');
  throw error;
}
```

## Registrar Nueva Ruta en Server

```typescript
// backend/src/server.ts
import newRoutes from './routes/newRoutes';

// Agregar después de otras rutas
app.use('/api/new', newRoutes);
```

## Testing de Endpoints

```bash
# GET
curl http://localhost:5001/api/projects

# POST con auth
curl -X POST http://localhost:5001/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "Nuevo Proyecto"}'
```

## Archivos Relacionados

- Controllers: `backend/src/controllers/`
- Routes: `backend/src/routes/`
- Validation: `backend/src/validation/`
- Middleware: `backend/src/middleware/`
- Database: `backend/src/database/database.ts`
