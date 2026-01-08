# Product Requirements Document (PRD)
## RPA Team Manager v3.0

---

## Visión del Producto

Plataforma full-stack para gestión de equipos RPA (~5 personas), que integra proyectos, tareas, tiempo, finanzas, soporte, y predicciones ML en una sola herramienta.

---

## Usuarios Objetivo

| Rol | Necesidades |
|-----|-------------|
| **Team Lead** | ROI, gestión financiera, dashboard ejecutivo, asignación de recursos |
| **RPA Developer** | Tareas, proyectos, registro de tiempo, documentación |
| **RPA Operations** | Soporte, tickets, monitoreo de bots en producción |
| **IT Support** | Tickets de soporte, resolución de incidencias |

---

## Features por Módulo

### 📊 F01: Dashboard Ejecutivo
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F01.1 KPIs financieros | Revenue, ROI%, Profit, Alertas | Cards visibles en dashboard |
| F01.2 Alertas automáticas | Detección de cost overruns >80%, ROI <20% | Notificaciones en tiempo real |
| F01.3 Color coding | Verde/Amarillo/Rojo según estado | Visual claro sin ambigüedad |

---

### 📈 F02: PMO Analytics
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F02.1 Vista General | KPIs, alertas críticas, carga de equipo | Panel ejecutivo funcional |
| F02.2 Gantt Chart | Timeline visual con hitos y tareas | Visualización interactiva |
| F02.3 Gestión de Hitos | CRUD de milestones con fechas y responsables | Guardado persistente |
| F02.4 Dependencias | Relaciones entre proyectos | Visualización de dependencias |

---

### 💰 F03: ROI y Finanzas
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F03.1 Costos por usuario | Salarios y tarifas por hora | Configuración en Settings |
| F03.2 Cálculo multi-usuario | Σ (Salario × Allocation% × Horas) | ROI considera todo el equipo |
| F03.3 Project Financials | Presupuesto, costo real, varianza | Datos persistentes |
| F03.4 Dashboard financiero | Resumen de rentabilidad | Solo visible para team_lead |

---

### 🎫 F04: Soporte y Facturación
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F04.1 Gestión de empresas | CRUD con multi-moneda (USD, CLP, UF) | Empresas persistentes |
| F04.2 Tickets de soporte | Lifecycle completo de tickets | Estado trackeable |
| F04.3 Facturación mensual | Horas contratadas vs consumidas | Cálculo automático |
| F04.4 Import Excel | Carga masiva de tickets | Mapeo automático de campos |

---

### 📋 F05: Gestión de Proyectos
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F05.1 CRUD Proyectos | Crear, editar, eliminar proyectos | Operaciones persistentes |
| F05.2 Asignaciones multi-usuario | Múltiples usuarios por proyecto | Allocation % configurable |
| F05.3 Project Lifecycle | Fases desde Discovery hasta Closure | Tracking de fases |
| F05.4 Archivos y evidencias | Upload de documentos | Sistema de archivos funcional |

---

### ✅ F06: Gestión de Tareas
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F06.1 Tablero Kanban | Columnas arrastrables | Drag & drop funcional |
| F06.2 Time tracking | Registro de horas por tarea | Horas acumuladas |
| F06.3 Prioridades | Critical, High, Medium, Low | Visual por colores |
| F06.4 Dependencias | Relaciones entre tareas | Bloqueos visibles |

---

### 💡 F07: Sistema de Ideas
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F07.1 Propuestas | Crear ideas con impact/effort | Formulario completo |
| F07.2 Voting | Upvote/downvote por usuarios | Conteo actualizado |
| F07.3 Comentarios | Discusión en cada idea | Thread de comentarios |
| F07.4 Priority Matrix | Score automático impact/effort | Ordenamiento por prioridad |

---

### 🤖 F08: ML Service (Predicciones)
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F08.1 Completion Time | Predicción de días para completar | Modelo entrenado |
| F08.2 Budget Variance | Predicción de desviación de costos | Precisión aceptable |
| F08.3 Risk Scoring | Score 0-100 con categoría | Clasificación correcta |
| F08.4 SHAP Explanations | Explicabilidad de predicciones | Insights accionables |

---

### 🔐 F09: Autenticación y Seguridad
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F09.1 JWT Auth | Login/logout con tokens | Sesiones persistentes |
| F09.2 Role-based access | team_lead, developer, operations | Permisos correctos |
| F09.3 Rate limiting | Protección contra abuse | Límites aplicados |
| F09.4 Input validation | Zod schemas + sanitización | XSS prevenido |

---

### ⚙️ F10: Configuración LLM
**Estado**: ✅ Implementado

| Sub-Feature | Descripción | Criterio de Éxito |
|-------------|-------------|-------------------|
| F10.1 API Keys | Gestión por provider | Almacenamiento seguro |
| F10.2 Model selection | OpenAI, Claude, Gemini, DeepSeek | Selección persistente |
| F10.3 Validación | Verificación de keys | Feedback de estado |

---

## Features Futuras (Roadmap)

### 🔮 F11: Notificaciones en Tiempo Real
**Estado**: 🟡 Planificado

- WebSocket para updates en vivo
- Notificaciones push
- Email notifications

### 📱 F12: App Móvil / PWA
**Estado**: 🟡 Planificado

- PWA con offline support
- Push notifications móviles

### 🔗 F13: Integraciones Externas
**Estado**: 🟡 Planificado

- Jira sync
- Slack notifications
- Azure DevOps integration

---

## Criterios de Calidad Global

| Aspecto | Criterio |
|---------|----------|
| **Performance** | LCP < 2.5s, FID < 100ms |
| **Seguridad** | 0 vulnerabilidades críticas en audit |
| **Testing** | >70% coverage en funciones críticas |
| **A11y** | WCAG 2.1 AA compliance |
| **i18n** | UTF-8 + soporte español/inglés |

---

## Referencias

- Stack técnico: Ver `CLAUDE.md`
- APIs: Ver `docs/pmo-api.md`, `docs/support-api.md`
- Base de datos: Ver `docs/database-schema.md`
- Desarrollo: Ver `docs/development-setup.md`
