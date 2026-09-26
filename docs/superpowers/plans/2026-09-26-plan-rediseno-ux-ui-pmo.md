# Plan de rediseño UX/UI — RPA Team Manager como PMO virtual

## Objetivo

Evolucionar la interfaz existente desde un conjunto de módulos operativos a una experiencia coherente para gestionar el ciclo completo de proyectos: repositorio, evaluación comercial, cotizaciones, planificación, ejecución, hitos, pagos, documentos, riesgos y cierre. El rediseño será incremental y conservará la lógica, endpoints, permisos y contratos actuales salvo que una brecha funcional se confirme y se acuerde por separado.

## Estado y alcance

- Rama de trabajo: `codex/redisenio-ux-ui-pmo`, creada desde el `HEAD` local de `main`.
- No se han hecho cambios en `main` ni en lógica de negocio.
- El árbol ya tenía cambios locales y archivos sin seguimiento antes de crear la rama. Se preservaron tal cual.
- Esta fase entrega diagnóstico y plan. La implementación visual comienza después de acordar el primer alcance/estilo.
- Los planes y cambios funcionales preexistentes, incluida la ficha comercial, se consideran contexto de trabajo y no se reemplazan.

## Diagnóstico de la experiencia actual

### Lo que ya existe

- SPA en React 18, TypeScript y Vite; React Router; Ant Design; React Query y Zustand.
- Navegación lateral para Dashboard, Proyectos, Tareas, Tiempo, Ideas, Archivos y Soporte; PMO y Cobranza según rol.
- Proyectos: listado, filtros, creación/edición, carga desde cotización, indicadores de ROI/salud y ficha con pestañas para PMO, actividad, comentarios, archivos y ciclo de vida.
- PMO: vista ejecutiva con métricas, análisis, hitos y vista Gantt.
- Cobranza: hitos de pago, facturas, pagos, indicadores y gráficos.
- Hay componentes visuales reutilizables y pruebas de páginas/componentes existentes.

### Fricciones observables en el código

- Navegación y textos mezclan español e inglés, por ejemplo «Proyectos» junto a «Dashboard», «Tasks» y «Time Tracking».
- El shell global y varias páginas repiten estilos inline, márgenes y fondos; falta una jerarquía de diseño compartida.
- El menú enumera módulos por separado, pero no comunica el recorrido del proyecto ni agrupa claramente portafolio, ejecución y finanzas.
- Dashboard y listado priorizan tarjetas KPI genéricas; el trabajo pendiente, excepciones, próximos hitos y decisiones financieras no forman todavía una cola de acción integrada.
- La ficha del proyecto tiene capacidades amplias distribuidas entre pestañas; el usuario debe cambiar de contexto para entender estado, riesgos, documentos y pagos.
- Hay contenido largo y de alta densidad en PMO/Gantt y cobranza que requiere una jerarquía de lectura y adaptación móvil consistente.
- Algunas pantallas usan vocabulario o mensajes en inglés pese a que los flujos del negocio y la documentación están principalmente en español.

Estas observaciones son sobre la interfaz/código inspeccionados; no sustituyen entrevistas ni observación de usuarios.

## Principios de diseño

1. **Una fuente de verdad por proyecto:** ficha única que conecte etapa comercial, plan, equipo, ejecución, documentos, riesgos e ingresos.
2. **Orientado a decisiones:** primero excepciones y acciones siguientes; luego métricas de contexto.
3. **Trazabilidad financiera:** separar cotizado, contratado, facturado, pagado, costo real y proyección; mostrar moneda y fecha de corte.
4. **Progresive disclosure:** resumen para escanear, detalle bajo demanda; evitar abrumar con todas las métricas a la vez.
5. **Consistencia y lenguaje claro:** interfaz en español neutro, estados uniformes, etiquetas comprensibles y fechas/números con formato local.
6. **Accesibilidad y respuesta:** teclado, foco visible, contraste suficiente, estados que no dependan solo del color y uso móvil/tablet razonable.
7. **Respeto por datos y permisos:** nunca revelar cifras o acciones fuera de los permisos que aplica la API/rol.

## Arquitectura de información propuesta

- **Inicio**: resumen personal/ejecutivo y bandeja de acciones pendientes.
- **Portafolio**: proyectos activos y archivados, salud, capacidad, prioridades y búsqueda/filtros guardables.
- **Proyectos**: repositorio con etapas visibles: oportunidad/cotización → aprobado/planificación → ejecución → cierre. Conservar explícitos los estados actuales y mapearlos sin cambios de backend.
- **PMO**: hitos, cronograma, riesgos, desviaciones y carga del equipo; permitir saltar del indicador a la ficha/elemento que lo origina.
- **Finanzas**: cotizaciones, hitos cobrables, facturas, pagos y proyección; relacionar cada movimiento con proyecto/cliente.
- **Trabajo**: tareas y tiempo con filtros/contexto de proyecto.
- **Conocimiento**: documentos, evidencias, actividad y comentarios asociados primero al proyecto; acceso global como índice.
- **Administración**: equipo, permisos y configuración.

La navegación final debe respetar visibilidad por rol ya existente. Este mapa es una propuesta de organización, no autorización para fusionar o mover rutas antes de comprobar sus permisos y consumidores.

## Plan incremental

### Fase 0 — Inventario y línea base

- Confirmar branch/base y registrar el `git status` inicial para no mezclar cambios preexistentes.
- Mapear rutas, roles, componentes, endpoints y pruebas por flujo.
- Ejecutar solo verificaciones acordadas antes del primer cambio visual y anotar defectos preexistentes.
- Capturar referencias visuales de Inicio, Proyectos, Detalle de proyecto, PMO/Gantt y Cobranza.

**Salida:** inventario breve, pantallas base y límites de regresión conocidos.

### Fase 1 — Sistema visual y shell de aplicación

- Definir tokens de color, tipografía, escala de espaciado, radios, elevación, estados y foco.
- Configurar tema de Ant Design desde tokens en vez de estilos divergentes.
- Rediseñar sidebar/header/contenedor, breadcrumb, títulos, navegación activa, perfil y búsqueda.
- Añadir patrones coherentes de loading, vacío, error, confirmación y éxito.
- Validar desktop, tablet y móvil; preservar rutas y comportamiento por rol.

**Salida:** marco visual uniforme que sirve de base a todas las páginas.

### Fase 2 — Inicio orientado a la acción

- Saludo/contexto con filtros de periodo y alcance según rol.
- Resumen del portafolio y finanzas con definiciones, moneda y fecha de actualización.
- Bloque prioritario «Requiere atención»: proyectos críticos/atrasados, hitos próximos, cotizaciones por decidir, facturas vencidas y tareas bloqueadas, solo cuando los datos disponibles lo soporten.
- Actividad reciente y accesos a las acciones frecuentes.
- Evitar calcular nuevos KPI en el cliente cuando la semántica no esté clara en API.

### Fase 3 — Repositorio y ficha 360° del proyecto

- Mejorar búsqueda, filtros, orden, estados, densidad y tarjetas/tabla del portafolio.
- Incorporar etapa/cliente/owner, avance, fechas, salud y resumen financiero con permisos.
- Ficha con cabecera persistente: cliente, etapa/estado, responsable, rango de fechas y alertas.
- Resumen superior: salud, progreso, próxima decisión/hito, presupuesto y caja según permiso.
- Ordenar detalle en secciones claras: Resumen, Plan e hitos, Equipo y tareas, Cotizaciones/finanzas, Documentos y actividad.
- Mantener enlaces y pestañas/rutas existentes mientras se implementa; migrar de forma compatible.

### Fase 4 — Centro PMO

- Portafolio PMO con excepciones en primer plano y filtros por cliente, responsable, etapa, salud y periodo.
- Tarjetas/métricas clicables que abren la lista de elementos que las componen.
- Vista de cronograma con hitos principales, retraso, dependencia y responsables; controles útiles en pantallas pequeñas.
- Presentar riesgo, presupuesto y calendario con texto/etiquetas además de color.
- Reducir duplicación entre resumen PMO y ficha del proyecto.

### Fase 5 — Finanzas, cotizaciones y cobranza

- Unificar vocabulario y ciclo de vida: propuesta/cotización, aprobación, hito cobrable, factura y pago.
- Resumen de cuentas por cobrar: por vencer, vencido, facturado y pagado, con periodo/moneda explícitos.
- Tabla accionable de facturas e hitos con filtros, detalle del proyecto y siguiente acción.
- Distinguir monto contratado/cotizado, facturado, recibido y margen/costo; indicar origen y fecha de corte.
- Validar permisos de visibilidad financiera en interfaz y mediante pruebas existentes/API.

### Fase 6 — Consistencia del resto de módulos y accesibilidad

- Aplicar sistema visual a tareas, tiempo, soporte, ideas, archivos y administración.
- Revisar navegación entre tareas, documentos y su proyecto de origen.
- Teclado, lector de pantalla, contraste, foco, reducción de movimiento, mensajes y responsive.
- Afinar español, formatos `es-CL` y componentes densos (tablas, filtros, formularios y modales).

### Fase 7 — Validación y entrega

- Recorrido por rol y flujos principales usando datos existentes, sin mutar producción.
- Ejecutar type-check, lint y pruebas relevantes según alcance acordado; comparar regresiones con línea base.
- Revisar diff para confirmar que cambios son de frontend y documentar excepciones.
- Entregar capturas y resumen de cambios para revisión antes de integrar a `main`.

## Límites para minimizar riesgo

- Cambios solo en `codex/redisenio-ux-ui-pmo`; no mergear ni desplegar desde esta propuesta.
- Preferir cambios de presentación y composición, manteniendo stores, API services, payloads y permisos.
- No rehacer PMO ni finanzas con datos mock cuando exista una API real.
- No renombrar/eliminar rutas ni campos hasta verificar deep links, pruebas y referencias.
- Dividir cada fase en cambios pequeños y revisables; comparar cada pantalla con su estado anterior.
- Mantener los archivos modificados/no seguidos que ya existían antes de la rama; no incluirlos en commits del rediseño salvo instrucción expresa.

## Primera entrega sugerida

Implementar primero Fase 1 y un prototipo funcional de Fase 2 en `/dashboard`, usando los datos que ya consume `DashboardPage`. Así se valida dirección visual, idioma, navegación y densidad con un cambio de alcance acotado antes de extender el sistema a portafolio, ficha y finanzas.

## Decisiones por confirmar antes de implementar

1. Dirección visual: **PMO ejecutivo sobrio** (recomendada: neutros cálidos/fríos, acento azul/índigo, estados semánticos) o **operación densa** (más información visible y menor espacio entre controles).
2. ¿Se confirma español como idioma principal de toda la interfaz?
3. ¿El primer corte será shell + Inicio + Portafolio, dejando la ficha y finanzas para iteraciones posteriores? (recomendado por riesgo y visibilidad).

## Registro de validación de Fase 7 — 2026-09-26

**Estado: parcial; no declarar todas las fases listas.** Se validaron en una copia local temporal recorridos con `team_lead` y `rpa_developer`, incluida la creación de una oportunidad, reunión, versión de cotización, validación interna, aprobación sintética de cliente, registros de OC/HES, aceptación de entrega, hito PMO, tarea y registro/aprobación de tiempo. La copia temporal se eliminó al finalizar.

Defectos corregidos durante la validación:

- Migraciones 39–41 completan columnas comerciales que faltaban en bases que ya habían registrado la migración 38; la copia reprodujo fallos al crear oportunidad, reunión y cotización antes de aplicar las reparaciones.
- La ruta `/pmo/gantt/:id` podía conservar seleccionada la pestaña de resumen al navegar desde el dashboard PMO; ahora selecciona Gantt al entrar en esa ruta y vuelve a Resumen al salir.
- El panel PMO ya representa presupuestos sin datos como `N/D`, y administración presenta las fechas de creación con formato local.
- Se ajustaron textos y acceso por teclado del área de carga de archivos; se localizó el formulario de creación de proyecto y las fechas de recordatorio de tiempo.
- El resumen financiero de Inicio distinguía precio configurado y resultado estimado de facturación/pagos recibidos, y ahora aclara que los costos pueden estar proyectados cuando faltan horas aprobadas.
- En tablet se observó truncamiento de rótulos de grupo en la navegación colapsada; se ocultaron esos rótulos en ese breakpoint. La compilación posterior pasó, pero falta repetir la inspección visual en navegador.

Pendientes para declarar la fase completa: recorrido visual real en tablet y móvil y medición formal de contraste. La inspección del CSS confirma breakpoints hasta 420 px, navegación móvil, skip link, `:focus-visible`, `prefers-reduced-motion` y `prefers-contrast`, pero no sustituye esa validación visual/formal. El navegador conectado bloqueó el servidor local (`ERR_BLOCKED_BY_CLIENT`) y el proyecto no contiene Playwright ni axe instalados. No se debe inferir validación formal a partir del CSS.

Validaciones adicionales completadas el 2026-09-26:

- Se completó en una DB temporal sintética el flujo HTTP de cobranza: factura por CLP 120.000 y pago total; la factura y su hito quedaron en `paid`. La base temporal y sus archivos WAL/SHM se eliminaron al finalizar.
- Se verificó que `rpa_operations` e `it_support` reciben 403 al leer o escribir hitos/facturas y al intentar registrar pagos. Las rutas financieras también se cubrieron con pruebas existentes.
- El type-check y el build frontend pasan; Vite reporta el aviso de chunk de Ant Design >500 kB. Las pruebas backend relevantes pasaron (13/13) y `git diff --check` no reporta errores de whitespace.
- `backend/data/database.sqlite` se comprobó con apertura `OPEN_READONLY`: `integrity_check=ok`, seis usuarios y migraciones 39–41 presentes. Conserva 835.584 bytes y fecha 2026-09-26 17:33:32; no se restauró, migró ni escribió durante esta revisión.
- El log muestra que nodemon aplicó automáticamente las migraciones 39 (17:25:16), 40 (17:31:24) y 41 (17:33:32), en reinicios sucesivos. Los respaldos disponibles son del 16 y 24 de septiembre, no copias exactas previas; no se revirtió ninguna migración.

**Estado: parcial. Fase 7 sigue abierta hasta completar revisión visual real tablet/móvil y auditoría formal de contraste.**

**Incidencia de entorno que requiere seguimiento:** al inspeccionar `backend/data/backend-restart.stdout.log` al cierre, se confirmó que el backend local preexistente se reinició al cambiar archivos y aplicó automáticamente las migraciones 39, 40 y 41 a `backend/data/database.sqlite`. La base pasó de 827.392 a 835.584 bytes según las observaciones disponibles. No se ejecutaron migraciones manuales contra esa base ni pruebas UI contra ella; el origen fueron los reinicios automáticos registrados. No se restauró ni revirtió porque no hay una copia exacta previa disponible y no es seguro descartar escrituras concurrentes. Producción no fue accedida. Mantener la fase como parcial.
