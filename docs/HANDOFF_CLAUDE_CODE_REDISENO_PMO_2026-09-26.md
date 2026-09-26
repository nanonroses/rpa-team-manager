# Handoff para Claude Code — Rediseño UX/UI y PMO virtual

**Corte del handoff:** 26 de septiembre de 2026  
**Repositorio:** `rpa-team-manager`  
**Rama activa:** `codex/redisenio-ux-ui-pmo`  
**Estado:** implementación local sin commit ni PR; validar el árbol antes de continuar.

## Para qué existe este documento

Este handoff resume el objetivo del producto, el trabajo funcional y visual que está presente en el árbol de trabajo, las migraciones, la validación de Fase 7 y las brechas que Claude Code debe conocer. Se contrastó con el código y Git el 26-09-2026. No implica que cada archivo modificado pertenezca exclusivamente al rediseño ni que todo esté integrado.

## Instrucción crítica de Git y preservación

- `HEAD` está en `8d5c887` (`fix(fase6a): vuelve a mostrar el campo Budget...`). Git muestra **`HEAD -> codex/redisenio-ux-ui-pmo, main`**: la referencia local `main` y la rama de trabajo señalan el mismo commit. No hay commits exclusivos de la rama en el historial inspeccionado.
- Hay muchos cambios modificados y archivos sin seguimiento. Por tanto, el trabajo sustancial está en el árbol de trabajo y todavía no existe como commit compartible en un PR.
- **No ejecutar `git switch main`, `git reset`, `git clean`, restauraciones masivas ni staging de todo el repositorio.** Eso podría arrastrar o destruir cambios. Antes de preparar commits, clasificar archivo por archivo qué pertenece al usuario, al trabajo previo y al rediseño.
- No hay PR abierto asociado a esta rama según la comprobación hecha el 26-09-2026. No se hizo commit, PR, merge ni despliegue.
- `git branch -vv` muestra además `main` **63 commits ahead of `origin/main`** en la referencia local guardada. `codex/redisenio-ux-ui-pmo` y `main` apuntan al mismo commit local. Antes de publicar, ejecutar `git fetch origin` y comparar contra el `origin/main` recién actualizado; no asumir que el PR incluiría solo los cambios UX/UI: podría contener esa cadena de 63 commits más el árbol sin commit.
- `backend/data/` no está versionado y contiene datos locales que deben protegerse: `database.sqlite` (835.584 bytes, seis usuarios, integrity check `ok`), archivos WAL/SHM, logs de reinicio y respaldos. Los respaldos existentes son del 16 y 24 de septiembre, **no** son una copia exacta anterior a las migraciones 39–41. No añadir esta carpeta al commit ni revertir esa BD a partir de esos backups.
- También se deben inspeccionar antes de publicar `.playwright-mcp/`, `SUPPORT_TICKETS_IMPLEMENTATION.md`, `priorities-tasks-tab.png` y los planes bajo `docs/superpowers/plans/`; estaban sin seguimiento en el corte actual y no se debe asumir su propiedad o alcance.

## Visión del producto

La plataforma debe ser un repositorio de proyectos y un PMO virtual que gestione el ciclo completo, no únicamente tareas e hitos:

1. Oportunidad que llega por un comercial o directamente al equipo.
2. Reuniones de descubrimiento; como regla, conseguir PDD o propuesta técnico-comercial en un máximo objetivo de 2–3 reuniones.
3. Cotización con costo, horas, precio, margen y versiones.
4. Validación interna y aprobación del cliente, claramente diferenciadas.
5. OC/HES, documentos y requisitos para ejecución/facturación.
6. Equipo y FTE, horas presupuestadas y reales, tareas, hitos, riesgos y desvíos, incluyendo dependencias atribuibles al cliente que puedan afectar calendario o cobro.
7. Hitos cobrables, facturas, pagos parciales/totales y recordatorios.
8. Aceptación final del cliente, cierre de entrega y cierre financiero trazable.

Prioridades de UX: una fuente de verdad por proyecto, siguiente acción visible, trazabilidad financiera sin mezclar monedas, progresión de detalle bajo demanda, español consistente, accesibilidad, responsive y permisos aplicados tanto por UI como por API.

## Stack y comandos del proyecto

- Frontend: React 18, TypeScript, Vite, React Router, Ant Design 5; estilos compartidos en `frontend/src/index.css`.
- Backend: Node.js, Express, TypeScript, SQLite; migraciones ordenadas en `backend/src/database/migrationList.ts`.
- No se agregaron dependencias para el trabajo resumido aquí.
- Comandos habituales en `CLAUDE.md`: `cd frontend && npm run dev`, `cd backend && npm run dev`; type-check/build/lint/test desde cada paquete según sus scripts.
- El backend ejecuta migraciones al iniciar (`backend/src/server.ts` → `db.initializeSchema()`); reinicios de desarrollo pueden escribir en la BD configurada.

## Trabajo de producto y UX presente en el árbol

### Shell, inicio y sistema visual

- `frontend/src/components/common/AppLayout.tsx`: navegación y encabezados reorganizados/localizados para el espacio PMO.
- `frontend/src/components/common/designTokens.ts` y `FeedbackStates.tsx`: tokens y estados reutilizables de feedback (archivos nuevos sin seguimiento al corte).
- `frontend/src/index.css`: estilos compartidos y responsive.
- `frontend/src/pages/dashboard/DashboardPage.tsx`: resumen y acceso a información de portafolio/finanzas; aclaraciones sobre costos proyectados cuando faltan horas aprobadas.
- `frontend/src/components/common/NotificationBell.tsx`: estado de error y reintento.

### Portafolio y ficha 360

- `frontend/src/pages/projects/ProjectsPage.tsx`, `frontend/src/components/projects/ProjectCard.tsx`: listado/tarjetas con contexto de proyecto y etapa.
- `frontend/src/pages/projects/ProjectDetailPage.tsx`: cabecera y pestañas de resumen, comercial/cobranza/equipo, finanzas/cobranza, documentos, evidencias, hitos/PMO, ciclo de vida y comentarios.
- `frontend/src/components/projects/ProjectCommercialSection.tsx`: oportunidad/reuniones, cotizaciones versionadas, documentos/requisitos, aceptación/cierre, capacidad y resumen de hitos/facturas.
- `frontend/src/types/project.ts`: campos comerciales añadidos al tipo de proyecto.
- Algunos deep links de notificaciones abren la ficha con `?tab=commercial|lifecycle|pmo|files`.

### PMO y capacidad

- `frontend/src/pages/pmo/PMODashboard.tsx` y `backend/src/controllers/pmoController.ts`: información de capacidad asignada y carga.
- Se corrigió navegación a Gantt para seleccionar la pestaña esperada y representar presupuestos ausentes como `N/D`.
- El cálculo de capacidad y horas no implementa todavía todas las reglas de forecast/ausencias ni alertas de sobreasignación requeridas a futuro.

### Finanzas, facturación y cobranza

- `frontend/src/pages/billing/BillingPage.tsx`, `frontend/src/types/billing.ts`, `backend/src/controllers/billingController.ts`, `backend/src/routes/billingRoutes.ts`, `backend/src/services/billingService.ts`.
- Recorrido implementado: hitos billable → factura con líneas → pagos parciales/totales → actualización de estados y cierre automático cuando se cumplen las condiciones aplicables.
- Se registra actividad auditable para acciones financieras. Un documento HES puede ser requisito de facturación si el proyecto lo configura.
- `backend/src/server.ts` ejecuta recordatorios de cobranza al iniciar y luego cada seis horas; `notification_deliveries` evita duplicados. El canal es notificación in-app, no envío de email.

### Módulos restantes

- Se ajustaron vistas de tareas, registro de tiempo, soporte, ideas, archivos/evidencias, administración y prioridades: entre ellas `TasksPage.tsx`, `TimeTrackingPage.tsx`, `SupportPage.tsx`, `IdeasPage.tsx`, `FilesPage.tsx`, `TeamManagementPage.tsx`, `FileList.tsx`, `FileUpload.tsx` y componentes asociados.
- Se localizaron textos/fechas y se añadieron estados compartidos. La consistencia final debe comprobarse al continuar; el tree contiene ediciones de más de una iteración.

## Backend/API comercial y permisos

Implementación principal en:

- `backend/src/controllers/commercialController.ts`
- `backend/src/routes/commercialRoutes.ts`
- `backend/src/controllers/clientController.ts`
- `backend/src/routes/clientRoutes.ts`
- `backend/src/controllers/projectController.ts`
- `backend/src/controllers/lifecycleController.ts`
- `backend/src/controllers/billingController.ts`
- `backend/src/services/authService.ts`, `billingService.ts`, `notificationService.ts`

Capacidades principales: reuniones y alertas al llegar a la segunda/tercera reunión sin PDD/propuesta; versiones de cotización; costo horario estimado desde equipo asignado para `team_lead`; validación interna de cotización; aprobación del cliente separada; marcar oportunidad perdida; requisitos OC/HES; evidencia y documentos; inicio de ejecución; aceptación de entrega; cierre financiero; y capacidad por asignación.

Permisos intencionados/observados: los importes, costo, tarifa y margen de cotizaciones se reservan a `team_lead`; las pruebas de Fase 7 comprobaron 403 para `rpa_operations` e `it_support` sobre lectura/escritura de hitos/facturas y registro de pagos. Revisar en código cualquier cambio futuro de rutas además de ocultar campos en la UI.

## Base de datos: versiones 38–41

La rama parte del esquema v37 en su plan histórico. El código actual tiene migraciones hasta **v41**:

| Versión | Intención |
|---|---|
| 38 | `client_contacts`, `sales_reps`, `project_quotes`; relaciones/campos comerciales en `projects`; `budgeted_hours` y fechas de asignación; reuniones, documentos comerciales y deduplicación de entregas de notificaciones. |
| 39 | Reparación idempotente para instalaciones que ya marcaban v38 aplicada pero no tenían columnas comerciales/capacidad; completa columnas de reuniones/documentos y normaliza `opportunity_source` desde `sales_rep_id`. |
| 40 | Completa columnas de trazabilidad de reuniones, documentos y cotizaciones en bases existentes. |
| 41 | Reparación idempotente adicional de columnas faltantes en `project_quotes`. |

Detalle importante de compatibilidad:

- v38 marca proyectos ya existentes con `commercial_stage = 'approved'` y completa `client_approved_at` con `created_at`, para tratarlos como proyectos que ya superaron el embudo comercial.
- Esto **no es** un cambio del estado operativo a un nuevo valor `En ejecución`: `projects.status` conserva su enum existente (`active`, `on_hold`, `completed`, `cancelled`). La etapa comercial (`quoting`, `approved`, `lost`) es una dimensión separada. No afirmar que la migración reescribe `status` a “En ejecución”.
- La BD local `backend/data/database.sqlite` tiene migraciones 39–41 registradas. El informe de Fase 7 confirma `integrity_check=ok`, seis usuarios y tamaño 835.584 bytes. El log evidencia que reinicios del backend aplicaron automáticamente esas versiones. No se hizo rollback porque no había backup exacto previo y no se quiso descartar cambios concurrentes. Producción no fue accedida.

## Aclaraciones sobre los puntos comerciales solicitados

Esta sección separa lo que está implementado de lo que no debe darse por terminado solo porque aparecía en un plan conversacional.

| Punto | Estado comprobado en código al corte |
|---|---|
| Clientes/contactos y comerciales | Hay API y una pantalla combinada `Clientes y comerciales`; permite alta y desactivación lógica de cliente/comercial, añadir contacto y contacto principal. No es un CRM completo: no se aprecia en la pantalla actual edición de todos los datos/contactos ni desactivación individual de contactos, aunque algunas rutas PATCH existen. |
| Cotizaciones/versiones y archivo | Existe alta de versiones en `ProjectCommercialSection` y FileManager asociado a `quote_vN`; se consulta versión/estado y se puede validar internamente. Ver brecha de carga IA/PDF más abajo. |
| Aprobar cotización | `approveQuote` cambia la versión seleccionada a `approved`, marca versiones previas enviadas/aprobadas como `replaced` y copia precio/moneda/horas/costo a `project_financials`; costo aprobado se normaliza a CLP. Esta aprobación interna es distinta del OK del cliente. |
| OK del cliente/perdida/bloqueo de precio | Hay endpoint y controles para aprobar cliente y marcar perdida. La edición directa de precio/horas se bloquea para cotizaciones según reglas de `projectController`; `start-execution` valida aprobación y OC cuando es requisito. |
| Horas presupuestadas por persona | `project_assignments.budgeted_hours` y alta de asignaciones guardan horas, porcentaje y periodo. La ficha muestra plan frente a horas aprobadas. |
| Etapa y pestañas | La ficha enseña etapa comercial y una sección comercial. También hay pestaña de finanzas/cobranza. No asumir una pestaña denominada exactamente “Cotizaciones” separada: en el código observado se encuentra dentro de `ProjectCommercialSection`. |
| Documentos tipificados | El enum actual es `purchase_order`, `service_acceptance`, `client_approval`, `pdd`, `technical_commercial_proposal`. No equivale aún a la taxonomía solicitada `PDD`, `Documentación técnica`, `Cotización`, `Contrato/OC`, `Otro`; requiere decisión/migración compatible antes de ampliar el enum. |
| Wizard de alta en cinco pasos | **No está implementado en el código actual.** `CreateProjectModal.tsx` sigue siendo un único modal con formulario largo. El plan `fase6b` describe un wizard, pero no es prueba de que se haya construido. |
| Catálogo de áreas para alta | Existe `business_areas` desde migraciones anteriores y `projectController` acepta `area_id`, pero no se encontró endpoint/UI actual para cargar y elegir el catálogo en el formulario. No confundir la existencia de la tabla con un selector implementado. |
| PDF procesado por IA | **Brecha vigente:** `/api/projects/upload-quote` extrae datos y luego ejecuta `cleanupFile(uploadedFilePath)` en éxito/error. El archivo temporal no se convierte en un artefacto persistente del historial. El FileManager de cotización es un flujo separado y no demuestra que el PDF procesado quede guardado. |
| Rechazo explícito de cotización | No hay botón/endpoint visible de rechazo formal. El enum tiene `rejected`, pero el flujo presente valida internamente una versión o la reemplaza al aprobar otra. |
| Alerta “desarrollador con 3+ proyectos” | No está implementada. Requiere acordar cálculo de carga/capacidad; mantener como pendiente de fase posterior/subproyecto de capacity planning. |

## Respuesta punto por punto al alcance de Fase 6b

El plan de Fase 6b contiene más tareas de las que el código actual completó. Esta matriz refleja el código inspeccionado y evita presentar el plan como prueba de implementación:

| # | Requisito solicitado | Estado al corte |
|---:|---|---|
| 1 | Migración comercial v38: contactos, comerciales, cotizaciones, etapa comercial y horas presupuestadas; tratar proyectos preexistentes como en ejecución | **Implementado con matiz:** v38 más reparaciones v39–v41 crean/completan las estructuras. El backfill fija `commercial_stage='approved'` y `client_approved_at=created_at`; no reescribe `projects.status`. Los proyectos cuyo status operativo ya era `active` se muestran como “En ejecución”; los completados/en pausa conservan su status. |
| 2 | Clientes y contactos: backend y pantalla | **Parcialmente implementado:** API y pestaña de clientes; crear cliente, contacto principal, añadir contacto y desactivar cliente. Hay rutas PATCH, pero la pantalla no da acceso completo a edición ni a desactivación individual de contactos. |
| 3 | Comerciales: backend y pantalla | **Implementado en alcance básico:** API de sales reps y pestaña “Comerciales” dentro de `Clientes y comerciales`; alta/desactivación. No hay pantalla independiente. |
| 4 | Subir cotización como nueva versión, guardando el archivo | **Parcialmente implementado:** crear versión y adjuntar mediante FileManager con asociación `quote_vN`. El parser IA de `/api/projects/upload-quote` borra el temporal después de extraer datos; ese PDF no queda guardado automáticamente en el historial. |
| 5 | Aprobar cotización, fijar precio final y reemplazar versiones anteriores | **Implementado para validación interna:** la versión pasa a `approved`, versiones anteriores `sent/approved` pasan a `replaced` y financieros se actualizan. Esto no equivale al OK del cliente, que es otro paso. No hay rechazo formal con botón. |
| 6 | Etapa comercial, “OK del cliente”, perdida y bloqueo de precio tras entrar a ejecución | **Implementado:** etapas `quoting/approved/lost`; aprobación cliente y pérdida; no permitir activar ejecución desde cotización ni editar libremente precio/horas después de aprobación según guardas actuales. Verificar cualquier cambio con pruebas y roles antes de publicar. |
| 7 | Horas presupuestadas por persona en asignaciones | **Implementado:** columna `project_assignments.budgeted_hours`, carga al asignar y vista de plan frente a horas aprobadas. |
| 8 | Nuevo formulario de alta en cinco pasos que reemplace el modal | **No implementado:** el código sigue usando `CreateProjectModal.tsx`, formulario largo en un modal. El plan fase6b especifica crear un `CreateProjectWizard`, incluyendo pasos 1–5; no existe actualmente el componente cableado. |
| 9 | Pestaña Cotizaciones y etiqueta de etapa en detalle de proyecto | **Parcialmente implementado:** la etapa se muestra en la ficha y existe el panel “Versiones de cotización” dentro de la pestaña comercial; no hay una pestaña separada con key/título “Cotizaciones” como describe fase6b. |
| 10 | Pestaña Documentos tipificados (PDD, documentación técnica, cotización, contrato/OC, otro) | **Parcial:** documentos tipificados sí existen, pero con tipos actuales limitados a PDD, propuesta técnico-comercial, aprobación cliente, OC y HES; falta la taxonomía pedida. |
| 11 | Verificación de punta a punta en navegador | **Parcial:** se recorrió comercial/PMO/tiempo y factura/pago en DB temporal sintética según plan/reporte, y se verificaron permisos financieros; no se validó exhaustivamente cada pantalla/rol. Tablet/móvil se aplaza por decisión del usuario; contraste formal sigue sin evidencia. |

El requerimiento repetido de “pantallas de Clientes y Comerciales” está cubierto en las filas 2–3 (ambos pares backend/UI) y no se cuenta dos veces. El listado original reutiliza los números 9 y 10; esta tabla les asigna numeración única sin combinar documentos con E2E.

## Documentación Markdown: qué está actualizado y qué debe leer Claude

No se actualizaron todos los Markdown del repositorio. No hace falta editar cada documento histórico; Claude debe leer los que gobiernan el alcance y revisar los otros solo si una tarea los afecta.

| Documento | Situación en el árbol al corte | Uso recomendado |
|---|---|---|
| `CLAUDE.md` | Modificado sin commit. El diff actual elimina secciones de stack/estructura y conserva comandos, reglas y referencias. No asumir que esa eliminación se hizo como parte del rediseño; revisar y preservar intención antes de publicar. | Reglas obligatorias del repo. |
| `docs/superpowers/plans/2026-09-26-plan-rediseno-ux-ui-pmo.md` | Sin seguimiento en Git al corte, pero contiene el plan y registro/evidencias Fase 7. | Leer para entender las fases UX/UI y validación; incluirlo solo si se determina que pertenece al cambio. |
| `docs/superpowers/plans/2026-09-26-fase6b-ficha-comercial.md` | Sin seguimiento en Git al corte; plan/spec extenso. Algunas tareas describen wizard, áreas y pestañas que no están en el código, por lo que sus checks/expectativas no prueban que se hayan terminado. | Leer junto al código para requisitos comerciales; priorizar evidencia ejecutable sobre texto aspiracional. |
| `docs/HANDOFF_CLAUDE_CODE_REDISENO_PMO_2026-09-26.md` | Este handoff, nuevo/sin seguimiento hasta publicarlo. | Resumen de estado, brechas y pasos de integración; incluirlo en la entrega del proyecto. |
| `SUPPORT_TICKETS_IMPLEMENTATION.md` | Sin seguimiento en Git al corte; su relación con el rediseño no está determinada. | Inspeccionar propietario/propósito; no agregar por staging global. |
| `QUOTE_UPLOAD_IMPLEMENTATION.md`, `TESTING_RESULTS.md`, `README.md`, `CHANGELOG.md`, referencias y planes históricos `docs/superpowers/plans/*` | Archivos existentes encontrados en el inventario; no todos fueron auditados ni actualizados en este trabajo. | Consultar si la edición toca su dominio y comprobar vigencia antes de editar. |

La regla para Claude es: no decir “todos los MD fueron actualizados”; leer primero los cuatro documentos de referencia principales (`CLAUDE.md`, plan UX/UI, plan fase6b y este handoff), comprobar Git y actualizar solo documentación que cambie materialmente con la implementación final.

## Fases UX/UI y su situación

El plan rector está en `docs/superpowers/plans/2026-09-26-plan-rediseno-ux-ui-pmo.md`.

- **Fase 1 — sistema visual y shell:** tokens, shell y patrones compartidos presentes en el árbol; no confundirlo con auditoría de accesibilidad formal.
- **Fase 2 — Inicio:** dashboard orientado a contexto y acciones, con datos existentes.
- **Fase 3 — Portafolio/ficha 360:** listado y detalle con etapa, cliente, equipo, ciclo comercial y documentos.
- **Fase 4 — Centro PMO:** dashboard/capacidad, hitos, salud y navegación a Gantt/proyecto.
- **Fase 5 — Finanzas y cobranza:** vista billing y flujo hito→factura→pago; permisos y auditoría.
- **Fase 6 — módulos restantes y accesibilidad:** ajustes en tareas, tiempo, soporte, ideas, archivos y administración. Las vistas son funcionales, pero la inspección final de tablet/móvil y contraste formal quedó sin ejecutar.
- **Fase 7 — validación:** ver sección siguiente. A nivel funcional/desktop hay evidencia; no declararla “validación responsive completa”.

## Evidencia reportada para Fase 7

Según el output final compartido el 26-09-2026:

- En base SQLite temporal sintética se completó flujo de factura y pago total CLP 120.000; factura e hito quedaron `paid`; la copia y auxiliares temporales se eliminaron.
- `rpa_operations` e `it_support` recibieron 403 al leer/modificar hitos y facturas e intentar registrar pagos. Pruebas financieras relevantes: 13/13.
- Frontend type-check y build pasaron. Aviso conocido: chunk de Ant Design excede 500 KB. `git diff --check` limpio.
- La base local se verificó en solo lectura: integridad correcta, seis usuarios, migraciones 39–41. La propia salida reporta que el backend local aplicó esas migraciones en reinicios automáticos; no se revirtió por ausencia de backup exacto.
- La revisión visual de móvil/tablet no se ejecutó porque Chrome bloqueó el host local (`ERR_BLOCKED_BY_CLIENT`); el repositorio no tenía Playwright ni axe instalados. También quedó pendiente una medición formal de contraste.
- El usuario decide dejar **móvil/tablet fuera de alcance por ahora**. Esta decisión debe registrarse como aplazamiento aceptado, no como prueba pasada. La medición formal de contraste tampoco está reportada como completada; confirmar con el usuario si se aplaza junto con responsive o se agenda aparte.
- La interfaz local/desktop y algunos recorridos comerciales se habían ejercitado en una DB temporal como consta en el plan, además del ciclo billing descrito arriba. No inventar evidencia para módulos/roles no recorridos.

## Defectos corregidos durante Fase 7 (según reporte)

- Migraciones 39–41 para reparar instalaciones que registraron v38 con columnas incompletas.
- Navegación del Gantt desde dashboard; representación `N/D` de presupuestos ausentes.
- Fechas locales en administración, textos y acceso por teclado en carga de archivos, formulario de proyectos y recordatorios de tiempo.
- Mensajes del resumen de finanzas del Inicio para diferenciar precio y estimaciones con costos proyectados.
- Responsive de rótulos de navegación en tablet corregido en CSS, aunque falta inspección visual en navegador.
- Ajustes a pruebas de finanzas/proyectos, BillingPage y notificaciones durante la validación.

## Comprobaciones reportadas y límites

La evidencia de cierre más reciente que compartió el usuario reporta frontend type-check/build, 13/13 pruebas financieras relevantes, `git diff --check`, validación de integridad SQLite y recorridos sintéticos de cobranza/permisos. No tomar salidas más antiguas como sustituto de una corrida sobre el árbol actual. El corte actual no fue revalidado por este documento.

Aviso Vite: bundle `antd` >500 KB minificado. Sin error de build.

## Próximos pasos sugeridos para Claude Code

1. Leer `CLAUDE.md`, este handoff y el plan rector; inspeccionar `git status`, referencias y diff antes de editar.
2. Tratar la tabla de brechas como la lista real de trabajo por confirmar, no asumir que todas son requisitos aprobados para la siguiente entrega. Prioridades naturales: wizard de cinco pasos, selección de área, persistencia/archivo del PDF de cotización IA, taxonomía documental y reglas completas de versiones/aprobación.
3. Antes de tocar DB, documentar la versión base **41** y crear/verificar una copia segura de desarrollo. No hacer rollback sobre `backend/data/database.sqlite` ni incluir esa carpeta en commits.
4. Mantener las etapas separadas: aprobación interna de cotización ≠ aprobación del cliente; etapa comercial ≠ `projects.status` operativo.
5. Revisar el manejo de clientes/contactos, permisos de ruta de cotización y registro auditado; añadir tests de migración/API en una DB temporal para cambios funcionales.
6. Responsive móvil/tablet y medición formal de contraste están explícitamente fuera de la prioridad actual del usuario; no bloquear otras tareas por eso, pero tampoco declararlos validados.
7. Antes de integrar, obtener una comparación fresca con GitHub: `git fetch origin`, revisar `git log --oneline origin/main..HEAD`, `git diff --stat origin/main...HEAD`, `git status --short --untracked-files=all` y el diff. Resolver qué significan los 63 commits locales pendientes de `origin/main`; no ocultarlos ni publicarlos accidentalmente.
8. Mantener `codex/redisenio-ux-ui-pmo` como rama de trabajo. No desarrollar sobre `main` ni empujar directamente a `main`. Separar archivos de datos/configuración local, backups, logs, `.playwright-mcp`, capturas y documentos ajenos. No incluir `backend/data/` ni bases SQLite en Git.
9. Completar primero las brechas funcionales que el usuario confirme dentro del alcance (wizard, catálogo de áreas, PDF persistente y taxonomía documental son las más visibles), actualizar este handoff y correr pruebas/types/lint/build sobre el resultado final. El responsive tablet/móvil queda aplazado por decisión del usuario; no declarar contraste formal validado.
10. Preparar commits descriptivos y limitados al alcance acordado sobre una rama de feature basada en el `origin/main` actualizado o reconciliada con él. Si la base requiere incluir los 63 commits, mostrarlo en el resumen del PR y validar su impacto antes de publicar. No usar `git add -A` sin clasificar el árbol.
11. Cuando la rama esté limpia de archivos locales, el diff esté revisado y CI/verificaciones estén verdes, publicar la rama al remoto y crear un PR dirigido a `main` con resumen, pruebas, migraciones 38–41 y riesgos. Esperar checks del PR y seguir el flujo de revisión del repositorio; integrar mediante el PR, nunca por push directo a `main`.
12. Para dejarlo en producción, primero identificar en `README.md`, `DEPLOYMENT.md`, workflows CI/CD y configuración remota el mecanismo real de despliegue y las protecciones. Después del merge y únicamente con pipeline/credenciales autorizadas, tomar respaldo de producción verificable, desplegar con el mecanismo documentado, confirmar migración aplicada y health check/logs. No asumir que el servicio correcto es Docker ni ejecutar migraciones manuales a ciegas. Si falta acceso o se requiere una aprobación externa, terminar lo independiente y dejar pasos/estado exactos para el usuario.
