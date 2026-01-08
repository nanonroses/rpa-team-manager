---
description: Compilar y ejecutar tests del proyecto
---
// turbo-all

# Build and Test

## 1. Backend
```bash
cd backend
npm run build
npm test
```

## 2. Frontend
```bash
cd frontend
npm run build
npm test
```

## 3. Linting
```bash
cd backend && npm run lint
cd frontend && npm run lint
```

## 4. Verificar que no hay errores
- Revisar output de cada comando
- Si hay errores de TypeScript, corregirlos
- Si hay tests fallando, investigar y arreglar

## 5. Reportar resultado
- Indicar si todo pasó correctamente
- Listar cualquier warning importante
