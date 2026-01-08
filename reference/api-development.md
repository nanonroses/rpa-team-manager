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

---

## Ejemplos Reales del Proyecto

### Ejemplo 1: Controller de Projects (getProjects)

```typescript
// backend/src/controllers/projectController.ts
getProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    let query = `
      SELECT p.*, 
             u1.full_name as created_by_name,
             u2.full_name as assigned_to_name,
             COUNT(t.id) as total_tasks,
             SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks
      FROM projects p
      LEFT JOIN users u1 ON p.created_by = u1.id
      LEFT JOIN users u2 ON p.assigned_to = u2.id
      LEFT JOIN task_boards tb ON p.id = tb.project_id
      LEFT JOIN tasks t ON tb.id = t.board_id
    `;

    const params: any[] = [];

    // Filter based on user role
    if (req.user?.role === 'rpa_developer') {
      query += ' WHERE (p.assigned_to = ? OR p.created_by = ?)';
      params.push(req.user.id, req.user.id);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';
    const projects = await db.query(query, params);

    // Calculate progress percentage
    const projectsWithProgress = projects.map(project => ({
      ...project,
      progress_percentage: project.total_tasks > 0 
        ? Math.round((project.completed_tasks / project.total_tasks) * 100)
        : 0
    }));

    res.json(projectsWithProgress);
  } catch (error) {
    logger.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
};
```

### Ejemplo 2: Routes con Multer (File Upload)

```typescript
// backend/src/routes/projectRoutes.ts
import multer from 'multer';
import * as path from 'path';

const uploadDir = path.join(__dirname, '../../uploads/quotes');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `quote-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

// Usar en ruta
router.post('/upload-quote', authorize(['team_lead']), upload.single('file'), controller.uploadQuote);
```

### Ejemplo 3: Transacción con Rollback

```typescript
// backend/src/controllers/projectController.ts (addProjectAssignments)
await db.beginTransaction();

try {
  // Delete existing assignments
  await db.run('DELETE FROM project_assignments WHERE project_id = ?', [id]);

  // Add new assignments
  for (const assignment of user_assignments) {
    await db.run(`
      INSERT INTO project_assignments (project_id, user_id, role, allocation_percentage)
      VALUES (?, ?, ?, ?)
    `, [id, assignment.user_id, assignment.role, assignment.allocation_percentage]);
  }

  await db.commit();
  res.status(201).json({ message: 'Assignments updated' });

} catch (error) {
  await db.rollback();
  throw error;
}
```

### Ejemplo 4: Verificación de Permisos

```typescript
// Verificar rol en controller
if (req.user?.role !== 'team_lead') {
  res.status(403).json({ error: 'Only team leads can delete projects' });
  return;
}

// Verificar acceso a recurso
if (req.user?.role === 'rpa_developer' && 
    project.assigned_to !== req.user.id && 
    project.created_by !== req.user.id) {
  res.status(403).json({ error: 'Access denied' });
  return;
}
```

---

## Archivos Relacionados

- Controllers: `backend/src/controllers/`
- Routes: `backend/src/routes/`
- Validation: `backend/src/validation/`
- Middleware: `backend/src/middleware/`
- Database: `backend/src/database/database.ts`

