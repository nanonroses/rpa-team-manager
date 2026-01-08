# Guía de Autenticación y Seguridad

## Sistema de Autenticación

El proyecto usa JWT (JSON Web Tokens) con bcrypt para hashing de contraseñas.

## Roles del Sistema

| Rol | Acceso |
|-----|--------|
| `team_lead` | Acceso completo: ROI, finanzas, administración de usuarios |
| `rpa_developer` | Proyectos, tareas, time tracking (sin finanzas) |
| `rpa_operations` | Operaciones, soporte, vistas limitadas |
| `it_support` | Solo tickets de soporte |

## Credenciales de Prueba

```
Admin:      admin@rpa.com / admin123     (team_lead)
Developer:  dev1@rpa.com / dev123        (rpa_developer)
Operations: ops1@rpa.com / ops123        (rpa_operations)
```

## Middleware de Autenticación

### Requerir Autenticación

```typescript
// backend/src/middleware/auth.ts
import { authenticate, authorize } from '../middleware/auth';

// Todas las rutas requieren auth
router.use(authenticate);

// Ruta específica sin auth (login)
router.post('/login', authController.login);
```

### Autorización por Rol

```typescript
// Solo team_lead puede acceder
router.post('/users', authorize(['team_lead']), controller.create);

// Múltiples roles permitidos
router.get('/reports', authorize(['team_lead', 'rpa_operations']), controller.getReports);
```

## Implementación en Controller

```typescript
// Obtener usuario autenticado
const userId = req.user.id;
const userRole = req.user.role;

// Verificar rol manualmente
if (req.user.role !== 'team_lead') {
  return res.status(403).json({ success: false, error: 'Acceso denegado' });
}
```

## Frontend - AuthStore

```typescript
// frontend/src/store/authStore.ts
import { useAuthStore } from '../store/authStore';

// En componente
const { user, isAuthenticated, login, logout } = useAuthStore();

// Verificar rol
if (user?.role === 'team_lead') {
  // Mostrar opciones de admin
}
```

## Rutas Protegidas Frontend

```tsx
// frontend/src/components/auth/ProtectedRoute.tsx
<ProtectedRoute>
  <ComponenteProtegido />
</ProtectedRoute>

// Con rol específico
<ProtectedRoute allowedRoles={['team_lead']}>
  <AdminPage />
</ProtectedRoute>
```

## Rate Limiting

El sistema tiene rate limiting configurado:

| Endpoint | Límite |
|----------|--------|
| General API | 100 req / 15 min |
| Auth (login) | 10 req / 15 min |
| Analytics | 50 req / 15 min |

## Validación de Input

```typescript
// backend/src/middleware/validation.ts
import { validateBody } from '../middleware/validation';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/login', validateBody(schema), controller.login);
```

## Sanitización de Input

```typescript
// El middleware sanitiza automáticamente:
// - Scripts (<script>)
// - Event handlers (onclick, onerror)
// - iframes
// - Patrones de ataque comunes
```

## Headers de Seguridad

Configurados automáticamente via Helmet:
- Content-Security-Policy
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

## JWT Configuration

```typescript
// Variables de entorno (.env)
JWT_SECRET=tu_secreto_muy_seguro_min_32_chars
JWT_EXPIRES_IN=24h
```

## Crear Nuevo Usuario (Backend)

```typescript
import bcrypt from 'bcrypt';

const hashedPassword = await bcrypt.hash(password, 10);
await db.run(
  'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
  [email, hashedPassword, fullName, role]
);
```

## Verificar Contraseña

```typescript
const isValid = await bcrypt.compare(inputPassword, user.password_hash);
if (!isValid) {
  return res.status(401).json({ error: 'Credenciales inválidas' });
}
```

## Generar Token

```typescript
import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
```

## Archivos Relacionados

- Auth Controller: `backend/src/controllers/authController.ts`
- Auth Service: `backend/src/services/authService.ts`
- Auth Middleware: `backend/src/middleware/auth.ts`
- Validation: `backend/src/middleware/validation.ts`
- Security: `backend/src/middleware/security.ts`
- Frontend Store: `frontend/src/store/authStore.ts`
- Protected Route: `frontend/src/components/auth/ProtectedRoute.tsx`
