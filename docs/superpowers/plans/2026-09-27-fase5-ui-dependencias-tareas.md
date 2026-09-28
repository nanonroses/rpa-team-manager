# Plan de Implementación: UI de Dependencias entre Tareas (Fase 5/6)

## Objetivo
Implementar la interfaz de usuario para la gestión y visualización de dependencias entre tareas (`task_dependencies`), cuyo backend y reglas de negocio ya existen desde Fase 5 (`taskDependencyService.ts`).

## Decisiones de Producto Confirmadas
1. **Ubicación en UI**:
   - Montado dentro del modal de edición de tareas en `TasksPage.tsx`, bajo el mismo patrón de `TaskSubtasksChecklist`, `TaskTagsEditor` y `TaskCollaboratorsEditor`.
2. **Formulario de Creación**:
   - Selector simple por defecto: selección de tarea predecesora del mismo proyecto/tablero (excluyendo la tarea actual).
   - Opciones por defecto automáticas: Tipo `finish_to_start` ("Fin a Inicio") y 0 días de desfase (`lag_days: 0`).
   - Sección colapsable "Opciones avanzadas": permite cambiar el tipo de dependencia (`finish_to_start`, `start_to_start`, `finish_to_finish`, `start_to_finish`) y configurar días de desfase (`lag_days`).
   - Manejo de errores claro si el backend rechaza la dependencia por ciclo o duplicado.
3. **Visualización en Tarjetas Kanban**:
   - Badge/Tag con ícono de enlace (`LinkOutlined`) en las tarjetas del tablero Kanban si la tarea tiene dependencias (`depends_on_count > 0` o `blocks_count > 0`).
   - Tooltip explicativo con el detalle (ej. "Depende de 2 tareas | Bloquea a 1 tarea").

---

## Tareas

### Tarea 1: Backend - Conteo de dependencias en `getBoard` y `getTasks`
- **Archivo:** `backend/src/controllers/taskController.ts`
- **Cambio:** Agregar subconsultas `LEFT JOIN` a `task_dependencies` en la consulta de tareas de `getBoard` (y `getTasks`) para devolver `depends_on_count` y `blocks_count` en cada tarea del tablero.
- **Tests:** `backend/src/__tests__/controllers/taskController.dependencies.test.ts` (verificar que `getBoard` devuelve los conteos).

### Tarea 2: Frontend API - Métodos de dependencias en `api.ts`
- **Archivo:** `frontend/src/services/api.ts`
- **Cambio:** Exponer:
  - `getTaskDependencies(taskId: number): Promise<{ depends_on: any[]; blocks: any[] }>`
  - `createTaskDependency(taskId: number, data: { depends_on_task_id: number; dependency_type?: string; lag_days?: number }): Promise<any>`
  - `deleteTaskDependency(taskId: number, dependencyId: number): Promise<any>`

### Tarea 3: Frontend Component - `TaskDependenciesEditor.tsx`
- **Archivo:** `frontend/src/components/tasks/TaskDependenciesEditor.tsx`
- **Cambio:**
  - Consulta inicial de dependencias de la tarea vía `apiService.getTaskDependencies(taskId)`.
  - Dos listas: "Depende de" (predecesoras) y "Bloquea a" (sucesoras).
  - Cada ítem muestra título de la tarea, tag de estado (`To Do`, `In Progress`, `Done`, etc.), tipo de relación (`FS`, `SS`, `FF`, `SF`) y lag en días si aplica (+Nd).
  - Botón de eliminación por dependencia con llamada a `apiService.deleteTaskDependency`.
  - Formulario de alta con selector de tareas disponibles del proyecto (filtrando la actual).
  - Acordeón / toggle para opciones avanzadas (tipo y lag).
  - Feedback de error en caso de ciclo circular (400/409).
- **Tests:** `frontend/src/__tests__/components/TaskDependenciesEditor.test.tsx`

### Tarea 4: Integración en `TasksPage.tsx`
- **Archivo:** `frontend/src/pages/tasks/TasksPage.tsx`
- **Cambio:**
  - En la interfaz `Task`, agregar `depends_on_count?: number; blocks_count?: number;`.
  - En la tarjeta del Kanban (`renderTaskCard`), agregar badge con `LinkOutlined` y tooltip informativo.
  - En el modal de edición (`editingTask`), montar `TaskDependenciesEditor` con su correspondiente `Divider`.
- **Tests:** Actualizar `frontend/src/__tests__/pages/TasksPage.test.tsx` para validar el badge y el modal.

### Tarea 5: Validación completa y suite de pruebas
- `tsc --noEmit` en backend y frontend.
- Ejecutar suites completas de tests unitarios de frontend y backend.
