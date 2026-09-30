# RPA Team Manager 🤖💼

[![Version](https://img.shields.io/badge/version-3.2.0-blue.svg)](https://github.com/nanon/rpa-team-manager)
[![Status](https://img.shields.io/badge/status-production--ready-success.svg)](https://github.com/nanon/rpa-team-manager)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/nanon/rpa-team-manager)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](#-licencia)
[![Security](https://img.shields.io/badge/security-hardened-red.svg)](#-seguridad-empresarial)
[![Theming](https://img.shields.io/badge/theme-D%C3%ADa%20%7C%20Noche%20(WCAG%20AA)-orange.svg)](docs/UI_THEME_SPEC.md)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)

**Plataforma Integral de Gestión Operacional, Financiera y PMO para Equipos de Automatización Robótica de Procesos (RPA) e Inteligencia Artificial.**

Diseñada específicamente para optimizar el ciclo de vida completo de proyectos de automatización: desde la venta inicial e imputación a centros de costo, pasando por el seguimiento ejecutivo en PMO y Gantt, hasta la operación en mesa de ayuda, facturación mensual de clientes y analítica predictiva con Machine Learning.

---

## 📋 Tabla de Contenidos

- [🌟 Novedades Destacadas (v3.2.0)](#-novedades-destacadas-v320)
- [🎯 Módulos y Capacidades del Sistema](#-módulos-y-capacidades-del-sistema)
- [🏢 Sistema de Centros de Costos (CECOs) & Imputación Comercial](#-sistema-de-centros-de-costos-cecos--imputación-comercial)
- [🌓 Sistema de Theming Día / Noche & Diseño Ant Design v5](#-sistema-de-theming-día--noche--diseño-ant-design-v5)
- [🧠 Servicio de Machine Learning (ML Service)](#-servicio-de-machine-learning-ml-service)
- [👥 Roles y Permisos](#-roles-y-permisos)
- [🛠️ Stack Tecnológico](#️-stack-tecnológico)
- [🚀 Puesta en Marcha Rápida (Quick Start)](#-puesta-en-marcha-rápida-quick-start)
- [🐳 Despliegue con Docker](#-despliegue-con-docker)
- [📁 Estructura del Repositorio](#-estructura-del-repositorio)
- [📚 Documentación Completa](#-documentación-completa)
- [🔒 Seguridad Empresarial](#-seguridad-empresarial)
- [📜 Licencia](#-licencia)

---

## 🌟 Novedades Destacadas (v3.2.0)

### 🏢 Centros de Costos (CECOs) e Imputación Comercial Multi-País
- **Catálogo Oficial Corporativo**: Integración de 28 centros de costo oficiales para **Chile 🇨🇱**, **Perú 🇵🇪** y **Estados Unidos 🇺🇸**.
- **Imputación Comercial de Ventas**: Captura del desglose contable desde el primer momento de venta del proyecto (porcentaje y monto estimado por centro de costo).
- **Foco en el Área de RPA & IA**:
  - `RPA-L` (RPA Licencias): Margen por venta de software y licencias.
  - `RPA-P` (RPA Proyectos): Horas Hombre y desarrollo de ingenieros RPA.
  - `RPA-S` (RPA Soporte): Mesa de soporte continuo y atención a incidentes.
- **Atajos Inteligentes (Presets)**: Distribución con un solo clic:
  - ⚡ **100% RPA Proyectos**
  - ⚡ **RPA Integral** (40% Licencias + 50% Soporte + 10% Proyectos)
  - ⚡ **100% RPA Soporte**
- **Validación Automática**: Comprobación estricta de suma 100% y vinculación directa con el módulo de facturación mensual.

### 🎨 Arquitectura de Theming Día/Noche con Ant Design Tokens
- **Consistencia Visual Total**: Soporte nativo para modo claro y modo oscuro respetando las directrices de `docs/UI_THEME_SPEC.md`.
- **Menús y Dropdowns Accesibles**: Corrección global de portales y selects en tema oscuro garantizando legibilidad WCAG 2.1 AA.
- **Auditoría Automatizada**: Nuevo script de verificación `npm run check:theme` para prevenir colores hardcodeados en el código.

---

## 🎯 Módulos y Capacidades del Sistema

| Módulo | Descripción | Características Clave |
|---|---|---|
| **💼 Ficha Comercial & Ventas** | Gestión de ofertas comerciales, hitos de cobro e imputación contable. | Extracción de cotizaciones, imputación de CECOs, hitos de facturación, condiciones de pago. |
| **🚀 PMO & Control de Proyectos** | Monitoreo ejecutivo de plazos, presupuestos y desvíos operacionales. | Semáforos de salud, tracking de desvíos con imputación de responsabilidad, alertas de ROI. |
| **📅 Carta Gantt Profesional** | Cronograma visual interactivo para seguimiento temporal. | Dependencias entre proyectos y tareas, visualización de duraciones, estados en tiempo real. |
| **📋 Tareas & Tableros Planner** | Gestión visual del trabajo diario de los desarrolladores RPA. | Drag & drop Kanban, subtareas, checklist de evidencias, dependencias entre tareas. |
| **⏱️ Time Tracking** | Registro de horas invertidas por persona y proyecto. | Temporizador en vivo, registro manual, imputación a tareas, cálculo de costo real por dedicación. |
| **🎫 Mesa de Ayuda & Soporte** | Gestión de clientes corporativos (e.g. Agrosuper) e incidentes. | SLAs, importación masiva de tickets desde Excel, horas de soporte consumidas vs contratadas. |
| **💵 Facturación & Finanzas** | Facturación recurrente y por hitos de proyecto. | Contrato mensual fijo + horas extras, desglose consolidado por Centro de Costo, multi-moneda (CLP, USD, UF). |
| **🧠 Predicciones con ML** | Inteligencia predictiva para toma de decisiones directivas. | Predicción de fecha de finalización, probabilidad de desvío presupuestario, scoring de riesgo SHAP. |
| **💡 Banco de Ideas RPA** | Pipeline de captura y priorización de iniciativas de automatización. | Cálculo automático de impacto vs esfuerzo, votación del equipo, conversión directa a proyecto. |

---

## 🏢 Sistema de Centros de Costos (CECOs) & Imputación Comercial

Cuando se cierra una venta de servicios de automatización (por ejemplo, por \$10.000 USD o UF), el valor comercial se divide contablemente en diferentes centros de costo para reflejar la realidad del negocio:

```
                  ┌──────────────────────────────────────────────┐
                  │          Venta Total del Proyecto            │
                  │              (Ej: $10,000 USD)               │
                  └──────────────────────┬───────────────────────┘
                                         │
                 ┌───────────────────────┼───────────────────────┐
                 ▼                       ▼                       ▼
      ┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
      │  RPA-L (Licencias)   ││   RPA-S (Soporte)    ││  RPA-P (Proyectos)   │
      │   40%  ->  $4,000    ││   50%  ->  $5,000    ││   10%  ->  $1,000    │
      │  (Margen licencias)  ││   (Mesa de ayuda)    ││   (HH desarrollo)    │
      └──────────────────────┘└──────────────────────┘└──────────────────────┘
```

### Catálogo Multi-País Soportado
- **🇨🇱 Chile**: `RPA-L`, `RPA-P`, `RPA-S`, `E-MONTEL`, `E-MONTI`, `E-OUTS`, `E-MESA`, `E-RESI`, `SAP`, `SAAS`, `DSOFT`, `ARRIENDOS`, `O-OUTS`.
- **🇵🇪 Perú**: `P-RPA-L`, `P-RPA-P`, `P-RPA-S`, `P-E-OUTS`, `P-SAP`, `P-SAAS`, `P-DSOFT`, `P-O-OUTS`.
- **🇺🇸 USA**: `U-RPA-L`, `U-RPA-P`, `U-RPA-S`, `U-SAP`, `U-SAAS`, `U-DSOFT`, `U-OUTS`.

---

## 🌓 Sistema de Theming Día / Noche & Diseño Ant Design v5

La interfaz está construida siguiendo los estándares de diseño corporativo documentados en [`docs/UI_THEME_SPEC.md`](docs/UI_THEME_SPEC.md):

1. **Tokens Dinámicos**: Uso exclusivo de `theme.useToken()` de Ant Design v5.
2. **Cero Colores Hardcodeados**: No se permiten colores fijos en CSS ni estilos en línea.
3. **Alto Contraste WCAG 2.1 AA**: Todos los componentes interactivos, modales y portales flotantes (`Select`, `Dropdown`, `DatePicker`) garantizan legibilidad perfecta tanto en tema claro como oscuro.
4. **Verificación Continua**: Script integrado para validar componentes:
   ```bash
   cd frontend && npm run check:theme
   ```

---

## 🧠 Servicio de Machine Learning (ML Service)

El microservicio de analítica avanzada corre en Python con FastAPI y expone modelos predictivos para los líderes de equipo:

1. **Predicción de Tiempo de Finalización**: Modelos ensamblados (Random Forest, XGBoost, LightGBM) con optimización de hiperparámetros vía Optuna.
2. **Predicción de Variación Presupuestaria**: Detección temprana de sobrecostos basada en la complejidad técnica, dedicación del equipo y desvíos históricos.
3. **Scoring de Riesgo y Explicabilidad SHAP**: Clasificación del nivel de riesgo del proyecto (Bajo, Medio, Alto, Crítico) con gráficos de cascada SHAP para entender los factores determinantes.

---

## 👥 Roles y Permisos

| Rol | Alcance y Responsabilidades |
|---|---|
| **👑 Team Lead / Jefe de Área** | Control integral de proyectos, gestión de usuarios, configuración salarial, acceso a métricas de rentabilidad y ROI, imputación de CECOs, aprobación de hitos de facturación y configuración del sistema. |
| **💻 RPA Developer** | Gestión de tareas asignadas en tableros Kanban, registro de tiempo invertido (Time Tracking), resolución de tickets de soporte técnico asignados, aportación y votación de ideas. |
| **⚙️ RPA Operations** | Monitoreo operacional de proyectos activos, recepción y triaje de tickets de soporte, seguimiento de SLAs de clientes. |
| **🛡️ IT Support** | Supervisión de salud del sistema, mantenimiento técnico, backups y soporte operacional a la plataforma. |

---

## 🛠️ Stack Tecnológico

```
┌─────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND                                  │
│  React 18 + TypeScript + Vite + Ant Design 5 + React Query + Dayjs     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ REST APIs (JSON / JWT)
┌────────────────────────────────────▼────────────────────────────────────┐
│                             BACKEND API                                 │
│  Node.js + Express + TypeScript + SQLite 3 + Zod + Helmet + Bcrypt      │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
┌───────────────────▼─────────────┐     ┌─────────────▼───────────────────┐
│          BASE DE DATOS          │     │           ML SERVICE            │
│  SQLite (WAL Mode, UTF-8, FKs)  │     │  Python 3.10 + FastAPI + Optuna │
│  46 Migraciones versionadas     │     │  XGBoost + LightGBM + SHAP      │
└─────────────────────────────────┘     └─────────────────────────────────┘
```

---

## 🚀 Puesta en Marcha Rápida (Quick Start)

### Prerrequisitos
- **Node.js**: `>= 18.0.0`
- **npm**: `>= 8.0.0`
- **Python**: `>= 3.10` (requerido únicamente para el microservicio de ML)

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/nanon/rpa-team-manager.git
cd rpa-team-manager

# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# ML Service (Opcional)
cd ../ml-service && pip install -r requirements.txt
```

### 2. Variables de Entorno
Copia el archivo de ejemplo en la raíz:
```bash
cp .env.example .env
```

### 3. Iniciar en Modo Desarrollo

Abre terminales separadas para cada servicio:

```bash
# Terminal 1 - Backend (Puerto 5001)
cd backend
npm run dev

# Terminal 2 - Frontend (Puerto 3000)
cd frontend
npm run dev

# Terminal 3 - ML Service (Puerto 8002, opcional)
cd ml-service
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8002 --reload
```

### 4. Credenciales de Acceso Inicial

| Usuario | Rol | Email | Contraseña |
|---|---|---|---|
| Administrador / Lead | `team_lead` | `admin@rpa.com` | `admin123` |
| Desarrollador 1 | `rpa_developer` | `dev1@rpa.com` | `admin123` |
| Desarrollador 2 | `rpa_developer` | `dev2@rpa.com` | `admin123` |
| Operaciones | `rpa_operations` | `ops1@rpa.com` | `admin123` |
| Soporte TI | `it_support` | `itsupport@rpa.com` | `admin123` |

> Si la base de datos está recién creada, ejecuta:
> ```bash
> curl -X POST http://localhost:5001/api/auth/setup-test-users
> ```

---

## 🐳 Despliegue con Docker

El proyecto cuenta con orquestación completa mediante Docker Compose:

```bash
# Construir y levantar todos los contenedores en segundo plano
docker-compose up -d --build

# Ver el estado y logs
docker-compose logs -f

# Detener los servicios
docker-compose down
```

Acceso:
- **Frontend**: `http://localhost:3000`
- **Backend API**: `http://localhost:3001` (o `5001` en dev)
- **ML Service**: `http://localhost:8002`

---

## 📁 Estructura del Repositorio

```
rpa-team-manager/
├── backend/                   # API REST en Node.js + Express + TypeScript
│   ├── src/
│   │   ├── controllers/       # Controladores (CECOs, Proyectos, Facturación, etc.)
│   │   ├── database/          # Conexión SQLite y lista de 46 migraciones
│   │   ├── routes/            # Definición de rutas Express
│   │   ├── services/          # Lógica de negocio (Billing, Time, PMO)
│   │   └── validation/        # Validaciones de esquema con Zod
│   └── uploads/               # Archivos y evidencias adjuntas
├── frontend/                  # Single Page Application en React 18 + Vite
│   ├── src/
│   │   ├── components/        # Componentes UI (CostCenters, Billing, Projects, PMO)
│   │   ├── pages/             # Vistas principales (Projects, Tasks, Time, Support, etc.)
│   │   ├── services/          # Cliente API Axios tipado
│   │   └── types/             # Modelos TypeScript compartidos
│   └── scripts/               # Scripts de control (check-theme-compliance.js)
├── ml-service/                # Microservicio Python para analítica predictiva
│   └── src/                   # Modelos, extractores de features y endpoints FastAPI
├── docs/                      # 📖 Especificaciones y documentación técnica
│   ├── UI_THEME_SPEC.md       # Especificación y 8 Reglas de Oro de UI/UX Día/Noche
│   ├── database-schema.md     # Diccionario de datos y modelo E/R completo
│   ├── pmo-api.md             # Documentación de endpoints de PMO
│   └── support-api.md         # Documentación del módulo de soporte y SLAs
├── scripts/                   # Scripts de utilidad, backup y restore
└── docker-compose.yml         # Manifiesto de despliegue multi-contenedor
```

---

## 📚 Documentación Completa

- 🎨 [Especificación de Theming & UI/UX Día/Noche](docs/UI_THEME_SPEC.md)
- 🗄️ [Diccionario de Datos & Schema SQLite](docs/database-schema.md)
- 📊 [Guía de Analítica PMO](docs/feature-pmo-analytics.md)
- 💵 [Guía de Facturación de Soporte](docs/feature-support-billing.md)
- 📖 [Manual de Usuario - Soporte](docs/user-guide-support.md)
- 📝 [Historial de Versiones & Changelog](CHANGELOG.md)

---

## 🔒 Seguridad Empresarial

- **Rate Limiting Multicapa**: Protección contra abuso y ataques de fuerza bruta en autenticación y endpoints públicos.
- **Validación con Zod**: Tipado estricto y saneamiento de entradas en toda la superficie de la API.
- **Protección XSS & Inyección**: Cabeceras HTTP seguras configuradas con `Helmet`.
- **Criptografía**: Autenticación stateless mediante tokens JWT firmados y contraseñas hasheadas con `bcrypt`.
- **Integridad Referencial**: Foreign keys activadas en SQLite con soporte para operaciones transaccionales seguras.

---

## 📜 Licencia

Distribuido bajo la Licencia **MIT**. Consulta el archivo [`LICENSE`](LICENSE) para más información.

---

<p align="center">
  Desarrollado con ❤️ para potenciar a los equipos de automatización e inteligencia artificial.
</p>