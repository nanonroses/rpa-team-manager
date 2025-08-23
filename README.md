# RPA Team Manager

[![Version](https://img.shields.io/badge/version-2.8.0-blue.svg)](https://github.com/nanon/rpa-team-manager)
[![Status](https://img.shields.io/badge/status-production-success.svg)](https://github.com/nanon/rpa-team-manager)
[![Build Status](https://img.shields.io/badge/build-passing-success.svg)](https://github.com/nanon/rpa-team-manager)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#license)
[![Security](https://img.shields.io/badge/security-hardened-red.svg)](#security)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

Sistema de gestión para equipos RPA - Diseñado para equipos pequeños (5 personas) con despliegue en notebook.

---

## 📋 Tabla de Contenidos

- [🚀 Quick Start](#-quick-start)
- [🎯 Características Principales](#-características-principales)
- [📖 Quick Reference](#-quick-reference)
- [👥 Estructura del Equipo](#-estructura-del-equipo-y-funcionalidades-por-rol)
- [🛠️ Stack Tecnológico](#️-stack-tecnológico)
- [📋 Requisitos del Sistema](#-requisitos-del-sistema)
- [🚀 Instalación](#-instalación-con-docker)
- [📁 Estructura del Proyecto](#-estructura-del-proyecto)
- [🎯 URLs Principales](#-urls-principales)
- [🔧 Troubleshooting](#-troubleshooting)
- [💾 Backup y Restore](#-backup-y-restore)
- [🔧 Mantenimiento](#-mantenimiento)
- [🚀 Estado Actual](#-estado-actual-del-sistema-ago-2025)
- [📞 Soporte](#-soporte)
- [📜 License](#-license)
- [🤝 Contributing](#-contributing)
- [🔒 Security](#-security)

---

## 🚀 Quick Start

### Iniciar Servidores
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev
```

### Crear Usuarios de Prueba (si es necesario)
```bash
curl -X POST http://localhost:5001/api/auth/setup-test-users
```

### Verificación Rápida
- **Backend**: http://localhost:5001/health
- **Frontend**: http://localhost:3000
- **Login**: admin@rpa.com / admin123

---

## 🎯 Características Principales - IMPLEMENTADAS

- **Gestión de Tareas**: Tableros tipo Planner con drag & drop ✅
- **Time Tracking**: Seguimiento de horas por desarrollador y proyecto ✅
- **Gestión de Proyectos**: Control de cronogramas y presupuestos ✅
- **Sistema ROI**: Cálculos automáticos de rentabilidad por proyecto ✅
- **Settings Financieros**: Configuración de salarios y tipos de cambio ✅
- **Integración Módulos**: Navegación fluida Projects ↔ Tasks ↔ Time ✅
- **Sistema de Ideas**: Captura y organización de ideas dispersas ✅
- **Control Financiero**: Tracking de delays con responsabilidades ✅
- **Evidencias**: Sistema de documentación y seguimiento ✅
- **Roles y Permisos**: Acceso diferenciado por tipo de usuario ✅
- **🆕 Sistema de Soporte**: Gestión de empresas clientes y tickets de soporte ✅
- **🆕 Importación Excel**: Carga masiva de tickets desde archivos Excel con mapeo automático ✅
- **🆕 Sistema de Facturación**: Cálculos dinámicos y automáticos por empresa cliente ✅
- **🆕 Selector Mensual**: Vista histórica por meses con filtros automáticos ✅
- **🆕 Facturación Fija**: Modelo de contrato mensual fijo + horas extra ✅
- **🆕 PMO Dashboard**: Vista ejecutiva con análisis de desvíos y gestión de hitos ✅
- **🆕 Gantt Chart Profesional**: Cronograma visual interactivo con timeline y gestión de duraciones ✅
- **🆕 Vista General PMO**: Dashboard ejecutivo completo con alertas críticas y centro de control ✅
- **🆕 Team Management**: Administración completa de usuarios y roles ✅
- **🆕 Profile Management**: Gestión de perfil personal y cambio de contraseñas ✅
- **🆕 Security Hardening**: Sistema de seguridad empresarial con rate limiting, validación de entrada y manejo de errores estandarizado ✅

---

## 📖 Quick Reference

### 🔑 Credenciales por Defecto
| Usuario | Rol | Email | Contraseña |
|---------|-----|--------|------------|
| Admin | Team Lead | admin@rpa.com | admin123 |
| Dev1 | RPA Developer | dev1@rpa.com | admin123 |
| Dev2 | RPA Developer | dev2@rpa.com | admin123 |
| Ops1 | RPA Operations | ops1@rpa.com | admin123 |
| IT Support | IT Support | itsupport@rpa.com | admin123 |

### 🌐 URLs Esenciales
- **Dashboard**: http://localhost:3000/dashboard
- **Proyectos**: http://localhost:3000/projects
- **Tareas**: http://localhost:3000/tasks
- **Time Tracking**: http://localhost:3000/time
- **PMO Dashboard**: http://localhost:3000/pmo
- **Soporte**: http://localhost:3000/support
- **Administración**: http://localhost:3000/admin
- **API Health**: http://localhost:5001/health

### ⚡ Comandos Esenciales
```bash
# Desarrollo
npm run dev                    # Iniciar en modo desarrollo
npm run db:migrate            # Aplicar migraciones de BD
curl -X POST http://localhost:5001/api/auth/setup-test-users  # Crear usuarios

# Docker
docker-compose up -d          # Iniciar servicios
docker-compose logs -f        # Ver logs
docker-compose down           # Detener servicios

# Troubleshooting
netstat -ano | findstr :3000  # Verificar puertos
taskkill /F /PID <numero-pid> # Matar proceso específico
```

---

## 👥 Estructura del Equipo y Funcionalidades por Rol

### Team Lead
- ✅ **Team Management**: Crear, editar y eliminar usuarios del equipo
- ✅ **Gestión de Roles**: Asignar roles y permisos por usuario
- ✅ **Reset Passwords**: Cambiar contraseñas de cualquier usuario
- ✅ Creación y eliminación de proyectos
- ✅ **ROI Dashboard**: Métricas financieras exclusivas
- ✅ **Settings**: Configuración salarios USD/UF/CLP
- ✅ **Rentabilidad**: Indicadores visuales por proyecto
- ✅ **🆕 Gestión de Soporte**: Control empresas clientes y facturación
- ✅ **🆕 PMO Dashboard**: Vista ejecutiva con gestión de hitos
- ✅ **🆕 Gantt Chart**: Cronograma visual con timeline interactivo y gestión de duraciones
- ✅ **🆕 Vista General PMO**: Dashboard ejecutivo con alertas críticas y centro de control operacional

### RPA Developers
- ✅ **Perfil Personal**: Gestión de información personal y cambio de contraseña
- ✅ Gestión de tareas asignadas
- ✅ Time tracking personal
- ✅ **🆕 Resolución de Tickets**: Asignación y resolución de tickets de soporte
- ✅ Sistema de ideas (completamente funcional)
- ✅ Subida de archivos y evidencias

### RPA Operations
- ✅ Monitoreo de todos los proyectos
- ✅ **🆕 Gestión de Tickets**: Creación y seguimiento de tickets de soporte
- ✅ Time tracking general

### IT Support
- ✅ Mantenimiento del sistema
- ✅ Soporte técnico a usuarios
- ✅ Monitoreo de salud del sistema

---

## 🛠️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (file-based, zero config)
- **Authentication**: JWT + bcrypt
- **Security**: Rate limiting, Input validation (Zod), XSS protection, Helmet security headers
- **Deployment**: Docker Compose
- **Storage**: Sistema de archivos local

---

## 📋 Requisitos del Sistema

- **CPU**: Intel i5 8va gen o superior
- **RAM**: 16GB (1GB para la aplicación)
- **Storage**: 15GB libres
- **OS**: Windows 10/11, macOS, Linux

---

## 🚀 Instalación con Docker

```bash
# Clonar el proyecto
cd C:\\Users\\nanon\\OneDrive\\Documentos\\GitHub\\rpa-team-manager

# Configurar variables de entorno
cp .env.example .env

# Iniciar con Docker
docker-compose up -d

# Acceder a la aplicación
# Frontend: http://localhost:3000
# Backend: http://localhost:5001
```

---

## 📁 Estructura del Proyecto

```
rpa-team-manager/
├── frontend/          # React application
├── backend/           # Node.js API
├── database/          # SQLite database and migrations
├── docker/            # Docker configurations
├── docs/              # Documentation
├── scripts/           # Backup and maintenance scripts
└── docker-compose.yml # Main deployment configuration
```

---

## 🎯 URLs Principales
- **Dashboard**: http://localhost:3000/dashboard
- **Projects**: http://localhost:3000/projects
- **Tasks**: http://localhost:3000/tasks
- **Time**: http://localhost:3000/time
- **Ideas**: http://localhost:3000/ideas
- **Files**: http://localhost:3000/files
- **Soporte**: http://localhost:3000/support
- **PMO**: http://localhost:3000/pmo
- **Profile**: http://localhost:3000/profile
- **Team Management**: http://localhost:3000/admin
- **Settings**: http://localhost:3000/settings

---

## 🔧 Troubleshooting

### ⚠️ IMPORTANTE: Manejo de Procesos Node.js
**ADVERTENCIA:** Evitar `taskkill /F /IM node.exe` ya que cierra la sesión del usuario.

#### Método Seguro para Reiniciar
```bash
# 1. PRIMERO: Cerrar normalmente con Ctrl+C en las terminales activas
# 2. Esperar 3-5 segundos
# 3. Verificar puertos libres:
netstat -ano | findstr :3000
netstat -ano | findstr :5001

# 4. Si hay procesos bloqueando, matar por PID específico:
taskkill /F /PID <numero-pid-especifico>
```

#### Verificación de Estado (RECOMENDADO)
```powershell
# Verificar procesos Node activos
Get-Process node -ErrorAction SilentlyContinue

# Verificar puertos específicos
Test-NetConnection localhost -Port 3000 -InformationLevel Quiet
Test-NetConnection localhost -Port 5001 -InformationLevel Quiet
```

### Problemas Comunes

#### Problema: Puertos ocupados
1. Usar Ctrl+C en terminales activas
2. Esperar 5 segundos
3. Verificar PID específico con netstat
4. Matar solo el proceso específico por PID

#### Problema: Base de datos bloqueada
1. Cerrar backend con Ctrl+C (NO taskkill)
2. Esperar 5 segundos
3. **🆕 NUEVO**: Usar migraciones automáticas en lugar de eliminar BD:
```bash
cd backend && npm run db:migrate
```

#### Sistema de Migraciones (Desarrollo)
**✅ NUEVO**: Sistema automático que preserva datos durante cambios de esquema:
- **Comando**: `cd backend && npm run db:migrate`
- **Ventaja**: NO requiere eliminar `database.sqlite`
- **Uso**: Ejecutar cada vez que se actualice el código
- **Versionado**: Control incremental de cambios de BD

#### Problema: No aparecen métricas ROI
- Verificar login como admin@rpa.com (team_lead)
- Otros roles NO ven métricas financieras

#### Problema: Caracteres con acentos (ñ, é, í, ó, ú)
- ✅ **Solucionado**: UTF-8 configurado en base de datos y servidor
- Los acentos ahora se manejan correctamente

### 📞 Comando de Emergencia (ÚLTIMO RECURSO)
```bash
# 🚨 SOLO si todo lo anterior falló:
taskkill /F /IM node.exe
del backend/data/database.sqlite*
cd backend && npm run dev
cd frontend && npm run dev
curl -X POST http://localhost:5001/api/auth/setup-test-users
```

---

## 💾 Backup y Restore

### Backup Automático
```bash
# Backup diario automático
./scripts/backup.sh
```

### Restore Manual
```bash
# Restaurar desde backup
./scripts/restore.sh /path/to/backup
```

---

## 🔧 Mantenimiento

- **Logs**: `docker-compose logs -f`
- **Health Check**: `http://localhost:5001/health`
- **Database Size**: Monitoreado automáticamente
- **Updates**: `docker-compose pull && docker-compose up -d`

---

## 🚀 Estado Actual del Sistema (AGO 2025)
- **✅ Backend**: http://localhost:5001 - Operativo con Security Hardening
- **✅ Frontend**: http://localhost:3000 - Operativo  
- **✅ Database**: SQLite con 25+ tablas - Healthy
- **✅ Módulos**: 9/9 principales funcionando (Dashboard, Projects, Tasks, Time, Ideas, Files, Soporte, PMO, Profile, Admin)
- **✅ Security**: Rate limiting, input validation, XSS protection, error handling estandarizado
- **✅ Gantt Chart**: Timeline visual interactivo con gestión profesional de duraciones
- **✅ Vista General PMO**: Dashboard ejecutivo con alertas críticas y centro de control operacional
- **✅ ROI**: Cálculos timeline automáticos
- **✅ Integraciones**: Projects ↔ Tasks ↔ Time ↔ Support
- **✅ Drag & Drop**: Tasks Kanban completamente funcional
- **✅ Support**: Gestión clientes y facturación automática
- **✅ Excel Import**: Importación masiva de tickets con validaciones automáticas
- **✅ Billing System**: Cálculos dinámicos de facturación por empresa con API dedicada
- **✅ Monthly Views**: Selector de mes con filtros históricos automáticos
- **✅ Fixed Contracts**: Modelo de facturación mensual fija + horas extra
- **✅ UTF-8**: Soporte completo para caracteres especiales

---

## 📞 Soporte

Para dudas técnicas o problemas:
1. Revisar logs: `docker-compose logs`
2. Verificar health check: `http://localhost:5001/health`
3. Consultar este README
4. Revisar [CHANGELOG.md](CHANGELOG.md) para historial de cambios
5. Contactar al IT Support del equipo

---

## 📜 License

Este proyecto está licenciado bajo la licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

### MIT License

```
Copyright (c) 2025 RPA Team Manager

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🤝 Contributing

¡Contribuciones, issues y requests de features son bienvenidas!

### Proceso de Contribución

1. **Fork** el proyecto
2. **Crear** una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. **Commit** tus cambios (`git commit -m 'Add: AmazingFeature'`)
4. **Push** a la rama (`git push origin feature/AmazingFeature`)
5. **Abrir** un Pull Request

### Guía de Desarrollo

#### Configuración del Entorno
```bash
# Instalar dependencias
cd backend && npm install
cd frontend && npm install

# Configurar variables de entorno
cp .env.example .env

# Iniciar en modo desarrollo
npm run dev
```

#### Estándares de Código
- **TypeScript**: Usado tanto en frontend como backend
- **ESLint**: Para linting y formato de código
- **Prettier**: Para formato consistente
- **Convenciones de Commits**: Usar prefijos como `Add:`, `Fix:`, `Update:`

#### Testing
```bash
# Ejecutar tests
npm test

# Ejecutar tests con coverage
npm run test:coverage
```

#### Base de Datos
```bash
# Aplicar migraciones
npm run db:migrate

# Crear nuevas migraciones
npm run db:create-migration <nombre>
```

### Code of Conduct

Este proyecto se adhiere al [Contributor Covenant](https://www.contributor-covenant.org/). Se espera que todos los participantes respeten este código de conducta.

---

## 🔒 Security

### Política de Seguridad

#### Reportar Vulnerabilidades

Si encuentras una vulnerabilidad de seguridad, por favor **NO** abras un issue público. En su lugar:

1. Envía un email a: `security@rpa-team-manager.local`
2. Incluye una descripción detallada de la vulnerabilidad
3. Proporciona pasos para reproducir el problema
4. Espera una respuesta dentro de 48 horas

#### Medidas de Seguridad Implementadas

- **🔐 Rate Limiting**: Protección DDoS multinivel (General: 100 req/15min, Auth: 10 req/15min)
- **🛡️ Input Validation**: Esquemas Zod para validación de entrada en todos los endpoints críticos
- **🧹 Input Sanitization**: Limpieza automática contra XSS e inyección de código
- **🔒 Security Headers**: Helmet configurado con CSP, X-Frame-Options, XSS Protection
- **🚨 Attack Detection**: Detección automática de patrones de ataque maliciosos
- **📝 Security Logging**: Registro detallado de violaciones y intentos de ataque
- **🔑 JWT Security**: Validación de fortaleza de secretos para producción
- **🔐 Password Security**: Bcrypt para hashing de contraseñas
- **🌐 CORS**: Configuración estricta de CORS para producción

#### Configuración de Producción

Para un despliegue seguro en producción:

```bash
# Variables de entorno críticas
JWT_SECRET=<strong-random-secret-min-32-chars>
NODE_ENV=production
CORS_ORIGIN=https://your-domain.com
RATE_LIMIT_MAX=50
AUTH_RATE_LIMIT_MAX=5
```

#### Versiones de Seguridad

| Versión | Soporte de Seguridad |
| ------- | -------------------- |
| 2.8.x   | ✅ Soportada         |
| 2.7.x   | ✅ Soportada         |
| < 2.7   | ❌ No soportada      |

---

**Desarrollado específicamente para equipos RPA pequeños con despliegue on-premise.**

**Última actualización:** Agosto 23, 2025  
**Estado:** Sistema completo con 9 módulos operativos + Security Hardening + Selector Mensual + Facturación Fija + Team Management + Gantt Chart Profesional ✅