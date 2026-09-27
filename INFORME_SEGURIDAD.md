# 🛡️ INFORME DE AUDITORÍA DE CIBERSEGURIDAD Y EVALUACIÓN DE VULNERABILIDADES

**Proyecto:** RPA Team Manager  
**Fecha de Evaluación:** 27 de Septiembre de 2026  
**Clasificación:** Confidencial / Técnico para Equipo de Desarrollo  
**Metodología:** OWASP Top 10 (2021), OWASP ASVS 4.0, NIST SP 800-115, SAST, SCA (Software Composition Analysis) y Revisión de Arquitectura / Configuración.

---

## 1. RESUMEN EJECUTIVO

Se ha ejecutado una auditoría exhaustiva e integral de ciberseguridad sobre la totalidad de la plataforma **RPA Team Manager** (servicios `backend`, `frontend`, `ml-service`, configuraciones de despliegue Docker y orquestación). 

Se identificaron **12 vulnerabilidades directas en código y arquitectura**, de las cuales **3 son CRÍTICAS**, **4 son ALTAS**, **3 son MEDIAS** y **2 son BAJAS**, además de **89 vulnerabilidades conocidas en la cadena de dependencias (SCA)** (2 Críticas, 55 Altas).

### Resumen de Hallazgos por Severidad

| Severidad | Vulnerabilidades de Código / Configuración | Vulnerabilidades de Dependencias (SCA) | Total |
| :--- | :---: | :---: | :---: |
| 🔴 **CRÍTICA** | 3 | 2 | **5** |
| 🟠 **ALTA** | 4 | 55 | **59** |
| 🟡 **MEDIA** | 3 | 27 | **30** |
| 🔵 **BAJA / INFO** | 2 | 5 | **7** |
| **TOTAL** | **12** | **89** | **101** |

---

## 2. MATRIZ DE RIESGO Y ALINEACIÓN OWASP TOP 10

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MATRIZ DE RIESGOS IDENTIFICADOS                       │
├────────────────────┬──────────────────────────────────────┬─────────────────┤
│ Categoría OWASP    │ Hallazgo Principal                  │ Nivel de Riesgo │
├────────────────────┼──────────────────────────────────────┼─────────────────┤
│ A01: Broken Access │ Account Takeover vía Reset Password  │ 🔴 CRÍTICO      │
│ A01: Broken Access │ Exposición Pública de /uploads       │ 🟠 ALTO         │
│ A01: Broken Access │ Bypasses de Rol e IDOR en APIs       │ 🟠 ALTO         │
│ A02: Crypto Failure│ Fallback a JWT Secret por defecto    │ 🔴 CRÍTICO      │
│ A02: Crypto Failure│ Pérdida y Degradación Claves API LLM │ 🟠 ALTO         │
│ A03: Injection     │ Bypass de Sanitización (Orden Midw)  │ 🔴 CRÍTICO      │
│ A03: Injection     │ Stored XSS mediante Archivos SVG     │ 🟠 ALTO         │
│ A04: Insecure Des. │ DoS por Consumo de Memoria en Upload │ 🟠 ALTO         │
│ A04: Insecure Des. │ Fuga de Memoria en Rate Limiting Map │ 🟡 MEDIO        │
│ A05: Security Misc │ ML Service sin Autenticación Default │ 🟠 ALTO         │
│ A05: Security Misc │ Ausencia de 'trust proxy' en Express │ 🟡 MEDIO        │
│ A05: Security Misc │ Headers CSP Débiles y sin HSTS       │ 🟡 MEDIO        │
│ A06: Outdated Deps │ Vulnerabilidades Críticas en Deps    │ 🔴 CRÍTICO      │
└────────────────────┴──────────────────────────────────────┴─────────────────┘
```

---

## 3. DETALLE TÉCNICO DE VULNERABILIDADES Y PLAN DE REMEDIACIÓN

---

### 🔴 HALLAZGO SEC-01 (CRÍTICO)
#### Secuestro Total de Cuentas (Account Takeover) vía Respuesta en Texto Claro en Reset Password
- **ID CWE:** CWE-640 (Weak Password Recovery Mechanism for Forgotten Password) / CWE-200 (Information Exposure)
- **OWASP:** A01:2021 – Broken Access Control / A07:2021 – Identification and Authentication Failures
- **CVSS v3.1:** **9.8** (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`)
- **Archivos Afectados:**
  - `backend/src/controllers/authController.ts` (Líneas 148-168)
  - `backend/src/services/authService.ts` (Líneas 164-190)
  - `frontend/src/store/authStore.ts` (Línea 12)

#### Descripción del Fallo
El endpoint público `/api/auth/reset-password` recibe un correo electrónico, genera una contraseña temporal, la guarda hasheada en la base de datos y **la devuelve en texto claro directamente en la respuesta HTTP JSON** (`tempPassword: tempPassword`).

```typescript
// backend/src/controllers/authController.ts (Línea 160)
const tempPassword = await this.authService.resetPassword(email);
res.json({ 
    message: 'Password reset successfully',
    tempPassword: tempPassword // ⚠️ RETORNA LA CONTRASEÑA DIRECTAMENTE AL ATACANTE
});
```

#### Impacto y Vector de Explotación
Cualquier usuario anónimo en Internet puede enviar una solicitud POST con el email del administrador (`admin@rpa.com` o cualquier usuario corporativo). Recibe de inmediato la nueva contraseña válida en el cuerpo de la respuesta, invalidando las sesiones del usuario legítimo y tomando control total de la cuenta y privilegios administrativos.

#### Remediación para el Dev
1. **Nunca devolver la contraseña temporal** ni tokens de reseteo en la respuesta JSON.
2. Implementar flujo estándar basado en tokens con caducidad corta (15 min) enviados exclusivamente vía correo electrónico mediante `SMTP` (o enlace firmado único de un solo uso).
3. Si el correo no existe en la base de datos, responder con el mismo mensaje genérico para evitar enumeración de usuarios.

```typescript
// PATCH RECOMENDADO en authController.ts:
resetPassword = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email is required' });
            return;
        }

        await this.authService.requestPasswordReset(email);
        
        // Respuesta idéntica exista o no el correo
        res.json({ 
            message: 'Si el correo existe en el sistema, se ha enviado un enlace para restablecer la contraseña.'
        });
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(400).json({ error: 'Error al procesar la solicitud' });
    }
};
```

---

### 🔴 HALLAZGO SEC-02 (CRÍTICO)
#### Bypasseo Completo de Filtros XSS e Inyecciones por Orden de Middleware Incorrecto
- **ID CWE:** CWE-696 (Incorrect Behavior Order) / CWE-79 (Cross-site Scripting) / CWE-89 (SQL Injection)
- **OWASP:** A03:2021 – Injection / A04:2021 – Insecure Design
- **CVSS v3.1:** **9.1** (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N`)
- **Archivos Afectados:**
  - `backend/src/server.ts` (Líneas 75-97)
  - `backend/src/middleware/validation.ts` (Líneas 68-120)
  - `backend/src/middleware/errorHandler.ts` (Líneas 120-165)

#### Descripción del Fallo
En `backend/src/server.ts`, los middlewares `sanitizeInput` y `securityErrorHandler` se inicializan **ANTES** de `express.json()` y `express.urlencoded()`.

```typescript
// backend/src/server.ts (Líneas 76 - 96)
this.app.use(sanitizeInput);           // Línea 76: req.body es undefined!
this.app.use(securityErrorHandler);    // Línea 79: req.body es undefined!
this.app.use(cors(...));
this.app.use(express.json({ limit: '10mb' }));       // Línea 95: recién aquí se parsea el body!
this.app.use(express.urlencoded({ extended: true }));
```

#### Impacto y Vector de Explotación
Cuando una petición `POST`, `PUT` o `PATCH` con carga JSON llega al servidor, `req.body` es `undefined` al pasar por `sanitizeInput` y `securityErrorHandler`. Como consecuencia:
- `checkValue(req.body)` evalúa `undefined` y pasa sin inspeccionar nada.
- La sanitización de entradas no elimina ninguna etiqueta ni patrón malicioso en los bodies.
- Todas las peticiones con payloads JSON evaden el 100% de los filtros de inyección del middleware.

#### Remediación para el Dev
Mover `express.json()` y `express.urlencoded()` antes de los middlewares de seguridad en `backend/src/server.ts`:

```typescript
// PATCH RECOMENDADO en server.ts:
private initializeMiddleware(): void {
    setupGlobalErrorHandlers();
    
    // 1. Parsing primero para tener req.body disponible
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 2. Helmet y Headers de seguridad
    this.app.use(helmet(...));
    this.app.use(securityHeaders);

    // 3. Sanitización e inspección ahora que req.body está parseado
    this.app.use(sanitizeInput);
    this.app.use(securityErrorHandler);

    // 4. CORS y Rate Limiting
    this.app.use(cors(...));
    this.app.use('/api', apiLimiter);
    ...
```

---

### 🔴 HALLAZGO SEC-03 (CRÍTICO)
#### Secreto JWT por Defecto y Forja Potencial de Tokens Administrativos
- **ID CWE:** CWE-1188 (Insecure Default Initialization of Resource) / CWE-798 (Use of Hard-coded Credentials)
- **OWASP:** A02:2021 – Cryptographic Failures
- **CVSS v3.1:** **9.8** (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`)
- **Archivos Afectados:**
  - `docker-compose.yml` (Línea 34)
  - `backend/src/services/authService.ts` (Líneas 16, 25-30)

#### Descripción del Fallo
`docker-compose.yml` define un valor por defecto públicamente conocido para el secreto JWT:
```yaml
JWT_SECRET=${JWT_SECRET:-your-super-secret-jwt-key-change-this}
```
Si el contenedor es desplegado sin un archivo `.env` configurado, la aplicación opera con esta clave conocida. 

#### Impacto y Vector de Explotación
Cualquier atacante puede firmar sus propios tokens JWT con `algorithm: "HS256"`, asignándose `userId: 1`, `role: "team_lead"`, evadiendo la autenticación y obteniendo acceso irrestricto con privilegios de administrador.

#### Remediación para el Dev
1. Modificar `authService.ts` y el arranque del servidor para que la aplicación **aborte de inmediato (`process.exit(1)`)** si `JWT_SECRET` no está configurado o si coincide con la clave por defecto o posee menos de 32 caracteres.
2. Eliminar el valor de respaldo por defecto en `docker-compose.yml`.

---

### 🟠 HALLAZGO SEC-04 (ALTO)
#### Exposición Pública de Archivos Confidenciales e Inyección de Código (Stored XSS) vía /uploads
- **ID CWE:** CWE-306 (Missing Authentication for Critical Function) / CWE-434 (Unrestricted Upload of File with Dangerous Type)
- **OWASP:** A01:2021 – Broken Access Control / A03:2021 – Injection
- **CVSS v3.1:** **8.3** (`AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:L/A:N`)
- **Archivos Afectados:**
  - `backend/src/server.ts` (Líneas 112-113)
  - `backend/src/controllers/fileController.ts` (Línea 38)

#### Descripción del Fallo
1. En `server.ts`:
   ```typescript
   const uploadsPath = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
   this.app.use('/uploads', express.static(uploadsPath));
   ```
   Todos los archivos en `uploads/` se sirven de manera completamente estática y sin ninguna autenticación ni validación de permisos.
2. Aunque `fileController.ts` implementa control de accesos en `/api/files/:id/download`, un atacante puede acceder a cualquier archivo (facturas, cotizaciones, identificaciones, documentos legales) directamente mediante `GET /uploads/<nombre_archivo>`.
3. `fileController.ts` admite `image/svg+xml` en `allowedTypes`. `express.static` sirve archivos SVG con `Content-Type: image/svg+xml`. Los archivos SVG admiten scripts embebidos (`<svg><script>...</script></svg>`), lo que permite ejecutar JavaScript arbitrario en el navegador de la víctima en el origen de la aplicación (Stored XSS).

#### Remediación para el Dev
1. **Eliminar `this.app.use('/uploads', express.static(...))`** de `backend/src/server.ts`.
2. Servir los archivos exclusivamente a través del endpoint protegido y auditado `GET /api/files/:id/download`.
3. Configurar encabezados de descarga obligatorios (`Content-Disposition: attachment; filename="..."`) y sanitizar o rechazar archivos SVG que contengan código script o eventos onload.

---

### 🟠 HALLAZGO SEC-05 (ALTO)
#### Denegación de Servicio (DoS) por Consumo Desmedido de Memoria V8 en File Upload
- **ID CWE:** CWE-400 (Uncontrolled Resource Consumption) / CWE-770 (Allocation of Resources Without Limits)
- **OWASP:** A04:2021 – Insecure Design
- **CVSS v3.1:** **7.5** (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`)
- **Archivos Afectados:**
  - `backend/src/controllers/fileController.ts` (Líneas 59-63, 101)

#### Descripción del Fallo
1. Multer permite un límite excesivo de 500MB por archivo y hasta 10 archivos por solicitud (5GB potenciales por request).
2. Para calcular el hash SHA-256 del archivo se ejecuta:
   ```typescript
   const fileBuffer = await fs.readFile(file.path);
   const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
   ```
   `fs.readFile` carga todo el contenido del archivo de 500MB en un único `Buffer` en memoria RAM de Node.js.

#### Impacto y Vector de Explotación
El límite de memoria del heap de Node.js en 64 bits suele oscilar entre 1.4GB y 2GB. Tres cargas de archivos concurrentes saturan de inmediato el Garbage Collector de V8, provocando un fallo crítico de memoria (`JavaScript heap out of memory`) y reiniciando el servicio para todos los usuarios.

#### Remediación para el Dev
1. Disminuir el tamaño máximo de archivo a un valor razonable (ej. 25MB a 50MB).
2. Usar Streams (`createReadStream`) y piping con `crypto.createHash` en lugar de `fs.readFile` completo:

```typescript
// PATCH RECOMENDADO en fileController.ts:
const calculateHashStream = (filePath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', err => reject(err));
    });
};
```

---

### 🟠 HALLAZGO SEC-06 (ALTO)
#### Ausencia de Control de Acceso por Roles (RBAC) en Gestión de Clientes, Contactos y Proyectos
- **ID CWE:** CWE-285 (Improper Authorization) / CWE-639 (BOLA / IDOR)
- **OWASP:** A01:2021 – Broken Access Control
- **CVSS v3.1:** **8.1** (`AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`)
- **Archivos Afectados:**
  - `backend/src/routes/clientRoutes.ts` (Líneas 6-16)
  - `backend/src/controllers/projectController.ts` (Líneas 382-387, 391)
  - `backend/src/routes/aiRoutes.ts` (Línea 679)

#### Descripción del Fallo
1. En `clientRoutes.ts`, las rutas de creación y modificación (`POST /clients`, `PATCH /clients/:id`, `POST /sales-reps`, etc.) solo aplican `router.use(authenticate)`. No hay restricción de roles, permitiendo que cualquier usuario con rol básico (`it_support` o `rpa_developer`) cree o altere entidades de clientes y ejecutivos comerciales.
2. En `projectController.ts` (`updateProject`), la comprobación de acceso valida:
   ```typescript
   if (req.user?.role === 'rpa_developer' &&
       currentProject.created_by !== req.user.id &&
       currentProject.assigned_to !== req.user.id) {
       res.status(403).json({ error: 'Access denied' });
   }
   ```
   Si el usuario tiene rol `it_support`, no entra en el bloque `rpa_developer` y puede modificar cualquier proyecto, cambiar su presupuesto, estado o datos sin ser dueño ni asignado.

#### Remediación para el Dev
- Agregar `authorize(['team_lead', 'rpa_operations'])` a las rutas de mutación en `clientRoutes.ts`.
- Validar permisos en `projectController.ts` de forma inclusiva (whitelist de roles autorizados) y restringir la edición del campo `budget` exclusivamente a `team_lead`.

---

### 🟠 HALLAZGO SEC-07 (ALTO)
#### Servicio de Machine Learning (ML Service) Abierto y sin Autenticación por Defecto
- **ID CWE:** CWE-306 (Missing Authentication for Critical Function)
- **OWASP:** A05:2021 – Security Misconfiguration / A07:2021 – Identification and Authentication Failures
- **CVSS v3.1:** **7.5** (`AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:L`)
- **Archivos Afectados:**
  - `ml-service/src/api/main.py` (Líneas 89-100)
  - `.env.example`
  - `ml-service/src/config/settings.py`

#### Descripción del Fallo
En `ml-service/src/api/main.py`:
```python
def verify_api_key(credentials: HTTPAuthorizationCredentials = Security(security)) -> bool:
    if not settings.api_key:
        return True  # ⚠️ Si no está configurada la variable en .env, permite paso total
```
En `.env.example`, la variable `ML_API_KEY` no se incluye. Si un administrador levanta el servicio siguiendo la guía, el microservicio ML queda completamente expuesto sin credenciales.

#### Impacto y Vector de Explotación
Cualquiera con alcance de red puede invocar reentrenamientos pesados (DoS por uso masivo de CPU en Optuna / LightGBM / XGBoost), extraer métricas del negocio o alterar los modelos predictivos en memoria.

#### Remediación para el Dev
Exigir `ML_API_KEY` de forma mandatoria: si `settings.api_key` es nula o vacía en producción, la aplicación debe rechazar todas las peticiones con código `500/Configuration Error` o fallar en el arranque.

---

### 🟡 HALLAZGO SEC-08 (MEDIO)
#### Gestión Insegura de Clave de Cifrado para Claves de API de Proveedores LLM
- **ID CWE:** CWE-326 (Inadequate Encryption Strength) / CWE-916 (Use of Password Hash with Insufficient Computational Effort)
- **OWASP:** A02:2021 – Cryptographic Failures
- **CVSS v3.1:** **6.5** (`AV:L/AC:L/PR:H/UI:N/S:U/C:H/I:H/A:N`)
- **Archivos Afectados:**
  - `backend/src/services/llmConfigService.ts` (Líneas 58-97)

#### Descripción del Fallo
1. Si `ENCRYPTION_KEY` no está configurada en `.env`, el servicio genera una clave aleatoria en memoria al inicio:
   ```typescript
   this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
   ```
   Al reiniciar el servidor o contenedor Docker, todas las claves de API (OpenAI, Claude, Gemini, DeepSeek) guardadas en la base de datos quedan irrecuperables arrojando error de descifrado.
2. Al derivar la clave: `Buffer.from(this.encryptionKey.substring(0, 32), 'utf-8')`. Si la clave proporcionada es un hex de 64 caracteres, tomar los primeros 32 caracteres ASCII reduce la entropía real a 128 bits en lugar de 256 bits reales.

#### Remediación para el Dev
1. Exigir `ENCRYPTION_KEY` obligatoria en el `.env` y documentarla en `.env.example`.
2. Usar derivación estándar como `crypto.scryptSync(this.encryptionKey, 'salt', 32)` o decodificar con `Buffer.from(this.encryptionKey, 'hex')`.

---

### 🟡 HALLAZGO SEC-09 (MEDIO)
#### Fuga Progresiva de Memoria (Memory Leak) en Middleware de Rate Limiting Personalizado
- **ID CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling) / CWE-400 (Resource Exhaustion)
- **OWASP:** A04:2021 – Insecure Design
- **CVSS v3.1:** **5.3** (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`)
- **Archivos Afectados:**
  - `backend/src/middleware/auth.ts` (Líneas 143-169)

#### Descripción del Fallo
La función `rateLimit` en `AuthMiddleware` mantiene un objeto `Map<string, { count: number; resetTime: number }>()`. Las entradas nunca son eliminadas tras su vencimiento, acumulando claves indefinidamente para cada IP que visite el servidor.

#### Remediación para el Dev
Usar un intervalo de limpieza periódica (`setInterval`) que borre las IPs cuyo `resetTime < Date.now()`, o unificar todos los limitadores sobre la librería ya instalada `express-rate-limit`.

---

### 🟡 HALLAZGO SEC-10 (MEDIO)
#### Omisión de Configuración `trust proxy` en Express Detrás de Reverse Proxy
- **ID CWE:** CWE-345 (Insufficient Verification of Data Authenticity)
- **OWASP:** A05:2021 – Security Misconfiguration
- **CVSS v3.1:** **5.3** (`AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L`)
- **Archivos Afectados:**
  - `backend/src/server.ts`

#### Descripción del Fallo
El backend corre detrás de Nginx y Docker Bridge. Express no tiene configurado `app.set('trust proxy', 1)`. En consecuencia, `req.ip` toma la dirección IP del proxy interno (`172.x.x.x` o `127.0.0.1`). Esto causa que los limitadores de tasa (`rateLimit`) apliquen de forma agregada a todos los clientes como si vinieran de una misma IP, generando bloqueos accidentales a usuarios legítimos o permitiendo bypasses de IP.

#### Remediación para el Dev
Agregar en `backend/src/server.ts`:
```typescript
this.app.set('trust proxy', 1);
```

---

### 🔵 HALLAZGO SEC-11 (BAJO)
#### Divulgación de Rutas Internas del Sistema Operativo en API de Respaldo
- **ID CWE:** CWE-200 (Information Exposure)
- **OWASP:** A05:2021 – Security Misconfiguration
- **CVSS v3.1:** **4.3** (`AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N`)
- **Archivos Afectados:**
  - `backend/src/routes/adminRoutes.ts` (Líneas 121, 159)

#### Descripción del Fallo
Los endpoints `/api/admin/db/backup` y `/api/admin/db/backups` devuelven rutas completas de disco (`C:\Users\...\database-backup-...sqlite` o `/app/backups/...`), facilitando a atacantes información sobre la estructura de directorios y sistema operativo del servidor.

#### Remediación para el Dev
Devolver únicamente el nombre del archivo (`filename`) o un identificador opaco en lugar de `backupPath` y `filePath`.

---

### 🔵 HALLAZGO SEC-12 (BAJO)
#### Almacenamiento de Tokens JWT en `localStorage` del Navegador
- **ID CWE:** CWE-922 (Insecure Storage of Sensitive Information)
- **OWASP:** A02:2021 – Cryptographic Failures
- **CVSS v3.1:** **4.2** (`AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N`)
- **Archivos Afectados:**
  - `frontend/src/store/authStore.ts` (Líneas 81-83, 112-114)
  - `frontend/src/services/api.ts`

#### Descripción del Fallo
El token de autenticación se persiste en `localStorage` (`rpa_token` y `rpa-auth-storage`). Si la aplicación sufriera alguna vulnerabilidad XSS (por ejemplo, a través de la subida de un SVG malicioso), el script del atacante puede leer inmediatamente el token de sesión.

#### Remediación para el Dev
Migrar el token JWT a cookies `HttpOnly`, `Secure` y `SameSite=Strict` o `SameSite=Lax`, eliminando el acceso de JavaScript al token.

---

## 4. ANÁLISIS DE LA CADENA DE DEPENDENCIAS (SCA & CVE AUDIT)

La auditoría automatizada de paquetes en `backend`, `frontend` y `ml-service` arrojó las siguientes vulnerabilidades destacadas:

### 1. Dependencias Backend (`backend/package.json`)
- **`handlebars` (CRÍTICO):** Vulnerable a inyección de código JavaScript y Prototype Pollution a través de confusión de tipos AST (`GHSA-4h5x-4648-52ff`).
- **`tar` (CRÍTICO):** Vulnerable a sobreescritura arbitraria de archivos y envenenamiento de enlaces simbólicos mediante Path Traversal (`GHSA-8hfj-j24r-96c4`).
- **`xlsx` (ALTO):** SheetJS vulnerable a Prototype Pollution (`GHSA-4r6h-8v6p-xvw6`) y ReDoS (`GHSA-5pgg-2g8v-p4x9`).
- **`axios` (ALTO):** Filtración de tokens XSRF y credenciales de Proxy en redirecciones (`GHSA-wf5p-g6vw-rhxx`, `GHSA-4h35-98w4-p3cx`).
- **`ws` (ALTO):** DoS por agotamiento de memoria y fuga de memoria no inicializada (`GHSA-96hv-2xvq-fx4p`).

### 2. Dependencias Frontend (`frontend/package.json`)
- **`vitest` (CRÍTICO):** Ejecución y lectura arbitraria de archivos a través de `@vitest/mocker`.
- **`react-router` / `react-router-dom` (ALTO):** Redirecciones externas inesperadas (Open Redirect) e inyección en deserialización SSR.
- **`vite` (ALTO):** Bypasses de `server.fs.deny` y path traversal en Windows.
- **`rollup` (ALTO):** Escritura arbitraria de archivos mediante Path Traversal.

### 3. Dependencias ML Service (`ml-service/requirements.txt`)
- **`gunicorn==21.2.0`:** CVE-2024-1135 (HTTP Request Smuggling).
- **`mlflow==2.8.1`:** Múltiples vulnerabilidades de Path Traversal y LFI (Arbitrary File Read) en endpoints de artefactos.
- **`requests==2.31.0`:** Fuga de credenciales en redirecciones HTTP.

---

## 5. GUÍA PASO A PASO PARA EL DESARROLLADOR (CHECKLIST DE CORRECCIÓN)

### Prioridad 1: Inmediata (Hotfix - 24 horas)
- [ ] **SEC-01:** Modificar `authController.ts` para eliminar `tempPassword` de la respuesta JSON en `resetPassword`.
- [ ] **SEC-02:** Reordenar los middlewares en `backend/src/server.ts` para colocar `express.json()` y `express.urlencoded()` **antes** de `sanitizeInput` y `securityErrorHandler`.
- [ ] **SEC-03:** Forzar que la aplicación termine (`process.exit(1)`) si `JWT_SECRET` está ausente o es el valor default. Remover el default de `docker-compose.yml`.
- [ ] **SEC-04:** Eliminar `app.use('/uploads', express.static(...))` en `backend/src/server.ts`. Servir archivos únicamente mediante rutas autenticadas. Desactivar el tipo MIME `image/svg+xml` para evitar XSS.

### Prioridad 2: Corto Plazo (Sprint Actual)
- [ ] **SEC-05:** Reemplazar `fs.readFile` por `createReadStream` en `fileController.ts` y limitar el tamaño máximo de archivo a 25MB.
- [ ] **SEC-06:** Agregar `authorize(['team_lead', 'rpa_operations'])` a las rutas de `clientRoutes.ts` y validar el rol en `updateProject` (restringiendo `budget` a `team_lead`).
- [ ] **SEC-07:** Hacer que `ml-service` requiera obligatoriamente un `ML_API_KEY` válido y agregar las variables faltantes en `.env.example`.
- [ ] **SEC-08:** Validar `ENCRYPTION_KEY` al arrancar el servidor en `llmConfigService.ts`.

### Prioridad 3: Medio Plazo (Siguiente Sprint)
- [ ] **SEC-09:** Limpiar periódicamente el `Map` de rate limiting en `auth.ts` o migrarlo a `express-rate-limit`.
- [ ] **SEC-10:** Activar `app.set('trust proxy', 1)` en `backend/src/server.ts`.
- [ ] **SEC-11:** Sanitizar respuestas de `/api/admin/db/backups` para no retornar rutas absolutas del disco local.
- [ ] **SEC-12:** Actualizar dependencias críticas ejecutando `npm audit fix` en backend y frontend, y actualizar `requirements.txt` en `ml-service`.

---

## 6. CONCLUSIÓN

El proyecto **RPA Team Manager** cuenta con una base sólida de pruebas automatizadas (435 pruebas en backend y 94 pruebas en frontend ejecutándose con 100% de éxito), lo que brinda total confianza para aplicar las remediaciones recomendadas sin provocar regresiones funcionales.

La subsanación inmediata de los hallazgos críticos (**SEC-01**, **SEC-02**, **SEC-03** y **SEC-04**) elevará sustancialmente la postura de seguridad del aplicativo, blindándolo contra vectores comunes de secuestro de cuentas, inyecciones XSS y accesos no autorizados a documentación confidencial.
