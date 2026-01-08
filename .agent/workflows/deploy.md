---
description: Proceso de deployment con Docker
---

# Deploy

## 1. Pre-Deploy Checklist
- [ ] Todos los tests pasan
- [ ] No hay errores de linting
- [ ] Build de producción funciona
- [ ] Variables de entorno configuradas

## 2. Verificar Builds
// turbo
```bash
cd backend && npm run build
cd frontend && npm run build
```

## 3. Verificar Docker Compose
```bash
docker-compose config
```

## 4. Build de Imágenes
```bash
docker-compose build --no-cache
```

## 5. Iniciar Servicios
```bash
docker-compose up -d
```

## 6. Verificar Health
```bash
# Backend
curl http://localhost:3001/health

# Frontend
curl http://localhost:3000

# ML Service (si está habilitado)
curl http://localhost:8002/health
```

## 7. Verificar Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

## 8. Rollback (si hay problemas)
```bash
docker-compose down
git checkout HEAD~1
docker-compose up -d --build
```

## 9. Post-Deploy
- Verificar funcionalidades críticas en producción
- Monitorear logs por errores
- Notificar al equipo del deploy
