# RPA Team Manager - Project Documentation

## Workflow Instructions

### Git & Version Control
- Agregar y comentar automáticamente cuando se haya completado una tarea
- Usa mensajes descriptivos de confirmación (commit) que capturan el alcance completo de los cambios

### Code Quality - CRÍTICO
**SIEMPRE ejecuta los siguientes comandos antes de completar cualquier tarea:**

1. Usa automáticamente la herramienta de diagnósticos integrada en el IDE para buscar errores de linting y de tipo:
   - Ejecuta `mcp_ide_getDiagnostics` para revisar todos los archivos en busca de diagnósticos
   - Arregla cualquier error de linting o de tipo antes de considerar que la tarea está completa
   - Haz esto para cualquier archivo que crees o modifiques
2. Este es un paso CRÍTICO que NUNCA debe omitirse al trabajar en cualquier tarea relacionada con el código

---

## System Overview

Full-stack RPA project management platform with authentication, ROI tracking, project lifecycle management, and LLM configuration capabilities.

## Current Status (Updated: 2025-10-31)

### Platform Status: FULLY OPERATIONAL
- Database: All migrations applied (17 total)
- Authentication: Working with role-based access control
- ROI System: Complete with financial tracking and alerts
- LLM Integration: Model selection and API key management
- Test Data: 5 complete projects with tasks, milestones, and financials

## Recent Updates

### Database Migrations Completed:
- **Migration 15**: Added critical project fields (priority, assigned_to, actual dates, progress_percentage)
- **Migration 16**: Added 10 core tables:
  - user_sessions, notifications, activity_log, comments, attachments
  - time_entries, issues, task_dependencies, roi_alerts, project_dependencies
- **Migration 17**: Enhanced users table (avatar_url, last_login)

### Seed Data Created:
5 production-ready RPA projects with complete data:
- AGROSUPER - Toma de Control (65% progress)
- CAMANCHACA - RPA San Jose (45% progress)
- COAGRA - BOT Conciliacion (80% progress)
- RAM - Conciliacion (30% progress)
- PROMET - Housekeeping (55% progress)

**Total seeded**: 65 tasks, 40 milestones, 5 financial records

### Critical Fixes Applied:
- **ROI Endpoint Fix** (commit 7a761b6): Resolved HTTP 500 error in `/api/financial/project-roi/:projectId`
  - Fixed duplicate `budgeted_cost` column in SQL INSERT
  - Corrected to proper 10 columns matching 10 values
- **LLM Model Selection**: Added `selected_model` column to llm_api_keys table

## Core Features

### ROI & Financial System
**Backend** (`backend/src/controllers/financialController.ts`):
- GET/POST/PUT `/api/financial/user-costs` - User cost rate management
- GET `/api/financial/project-roi/:projectId` - Project ROI calculations
- POST `/api/financial/project-financial` - Financial data updates
- GET `/api/financial/dashboard` - Profitability dashboard
- Automatic calculations: ROI%, efficiency, margins, alerts
- Automated alerts: Cost overruns >80%, ROI <20%

**Frontend** (`frontend/src/pages/dashboard/DashboardPage.tsx`):
- 4 financial metric cards: Revenue, ROI%, Profit, Active Alerts
- Dynamic color coding: Green (good), Yellow (warning), Red (critical)
- Real-time alert notifications
- Visible only to team_lead role

### Authentication & Permissions
**Roles**:
- **team_lead**: Full access to ROI metrics, user cost management, all projects
- **developer**: Project access, task management, no financial data
- **operations**: Operational views, limited financial access

**Test Credentials**:
- Admin: `admin@rpa.com` / `admin123` (team_lead)
- Developer: `dev1@rpa.com` / `dev123` (developer)
- Operations: `ops1@rpa.com` / `ops123` (operations)

### LLM Configuration
- API key management per provider (OpenAI, Anthropic, Google, OpenRouter)
- Model selection for each provider
- Secure credential storage
- Frontend UI: `frontend/src/pages/settings/LLMConfigPage.tsx`

## Key Files

### Backend
- `backend/src/controllers/financialController.ts` - ROI & financial operations
- `backend/src/controllers/authController.ts` - Authentication endpoints
- `backend/src/services/authService.ts` - Auth business logic
- `backend/src/database/schema.sql` - Complete database schema
- `backend/src/database/migrations/` - All 17 migration scripts

### Frontend
- `frontend/src/pages/dashboard/DashboardPage.tsx` - Main dashboard with ROI
- `frontend/src/pages/settings/LLMConfigPage.tsx` - LLM configuration
- `frontend/src/services/api.ts` - API service layer
- `frontend/src/store/authStore.ts` - Authentication state management
- `frontend/src/components/auth/ProtectedRoute.tsx` - Route protection

## Quick Start

### First Time Setup
1. Start backend: `cd backend && npm run dev`
2. Start frontend: `cd frontend && npm run dev`
3. Database initializes automatically with migrations
4. Use test credentials to login

### Accessing Features
- Login with `admin@rpa.com` / `admin123` to access ROI dashboard
- Navigate to Settings > LLM Configuration for AI setup
- View projects in Projects section (5 pre-loaded projects available)

## Technical Stack
- **Backend**: Node.js, Express, TypeScript, SQLite
- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Database**: SQLite with migration system
- **Authentication**: JWT with role-based access control

## Notes
- All database changes use migration scripts (never manual DB edits)
- localStorage auto-cleanup prevents corrupted auth tokens
- ROI calculations run automatically on financial data updates
- System supports multiple concurrent users with session management

---
**Status**: Production-ready | **Last Verified**: 2025-10-31
