# Guía de Testing

## Comandos de Testing

```bash
# Backend - Tests unitarios
cd backend && npm test

# Backend - Watch mode
cd backend && npm run test:watch

# Backend - Coverage
cd backend && npm run test:coverage

# Frontend - Tests
cd frontend && npm test

# Frontend - Watch mode
cd frontend && npm run test:watch

# Frontend - Coverage
cd frontend && npm run test:coverage

# Tests de regresión (desde raíz)
npx jest --config jest.config.js

# Test específico
npm test -- --testNamePattern="login"
```

## Estructura de Tests

```
backend/
├── src/
│   └── __tests__/           # Tests unitarios backend
│       ├── controllers/
│       ├── services/
│       └── utils/
│
frontend/
├── src/
│   └── __tests__/           # Tests unitarios frontend
│       ├── components/
│       ├── pages/
│       └── services/
│
tests/                        # Tests de integración/E2E
├── integration/
└── e2e/
```

## Escribir Test Backend (Jest)

```typescript
// backend/src/__tests__/controllers/authController.test.ts
import request from 'supertest';
import { app } from '../../server';

describe('AuthController', () => {
  describe('POST /api/auth/login', () => {
    it('debería retornar token con credenciales válidas', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@rpa.com',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
    });

    it('debería retornar 401 con credenciales inválidas', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@rpa.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
```

## Escribir Test Frontend (Vitest)

```typescript
// frontend/src/__tests__/components/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../components/Button';

describe('Button', () => {
  it('debería renderizar con texto correcto', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('debería llamar onClick cuando se hace click', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('debería estar deshabilitado cuando loading=true', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## Testing de Hooks

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../store/authStore';

describe('useAuthStore', () => {
  it('debería iniciar sin usuario', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
```

## Mocking

```typescript
// Mock de módulo
vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  }
}));

// Mock de función específica
import { api } from '../services/api';

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: mockData });
});
```

## Comandos de Testing

```bash
# Ejecutar todos los tests
npm test

# Watch mode (desarrollo)
npm test -- --watch

# Coverage
npm test -- --coverage

# Test específico
npm test -- --testNamePattern="login"

# Archivo específico
npm test -- auth.test.ts
```

## Regression Tests por Feature

Antes de modificar una feature, ejecutar sus tests:

```bash
# Tests de PMO
npm test -- pmo

# Tests de Support
npm test -- support

# Tests de Auth
npm test -- auth
```

## Testing Manual Rápido

```bash
# Backend health
curl http://localhost:5001/health

# Login
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@rpa.com","password":"admin123"}'

# Endpoint protegido
curl http://localhost:5001/api/projects \
  -H "Authorization: Bearer TOKEN"
```

## Checklist Pre-Commit

1. [ ] Tests pasan: `npm test`
2. [ ] Linting pasa: `npm run lint`
3. [ ] Build funciona: `npm run build`
4. [ ] Funcionalidad manual verificada

## Configuración Jest (Backend)

```javascript
// backend/jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
```

## Configuración Vitest (Frontend)

```typescript
// frontend/vite.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
```

## Archivos Relacionados

- Backend tests: `backend/src/__tests__/`
- Frontend tests: `frontend/src/__tests__/`
- Jest config: `backend/jest.config.js`
- Vitest config: `frontend/vite.config.ts`
