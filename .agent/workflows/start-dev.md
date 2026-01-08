---
description: Iniciar los servidores de desarrollo
---
// turbo-all

# Iniciar Desarrollo

## 1. Backend (Terminal 1)
```bash
cd backend
npm run dev
```
Esperar mensaje: "Server running on port 5001"

## 2. Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```
Esperar mensaje: "Local: http://localhost:3000"

## 3. ML Service (Terminal 3 - Opcional)
```bash
cd ml-service
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8002 --reload
```

## 4. Verificar
- Backend: http://localhost:5001/health
- Frontend: http://localhost:3000
- ML Service: http://localhost:8002/health

## Credenciales de Prueba
```
Admin:      admin@rpa.com / admin123
Developer:  dev1@rpa.com / dev123
Operations: ops1@rpa.com / ops123
```
