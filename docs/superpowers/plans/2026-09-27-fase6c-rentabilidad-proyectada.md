# Plan de Implementación: Fase 6C — Rentabilidad Automática Proyectada

## Objetivo
Completar el Sub-proyecto C de Fase 6: extender el cálculo financiero en `backend/src/services/financeService.ts`, el endpoint `getProjectROI` en `backend/src/controllers/financialController.ts` y el componente frontend `ProjectROICard.tsx` para incorporar:
1. Margen % sobre venta (planificado, real y proyectado).
2. Costo y horas proyectadas al término (`projected_cost`, `projected_hours`).
3. Ganancia y ROI proyectado (`projected_profit`, `projected_roi`, `projected_margin_percentage`).
4. Impacto económico del desvío en dinero (`variance_impact`).
5. Evaluación en vivo de alertas de sobrecosto y margen bajo con el costo proyectado en `syncROIAlerts`.
6. Reflejo visual claro y comprensible en `ProjectROICard.tsx` para el Team Lead.

---

## Tareas

### Tarea 1: Backend — `financeService.ts`
- Actualizar interfaz `ProjectFinancials`:
  - `planned_margin_percentage: number`
  - `real_margin_percentage: number`
  - `projected_hours: number`
  - `projected_cost: number`
  - `projected_profit: number`
  - `projected_roi: number`
  - `projected_margin_percentage: number`
  - `variance_impact: number`
- En `calculateProjectFinancials(projectId)`:
  - Leer cotización aprobada de `quote_versions` si `financials.sale_price` no está definido o es 0.
  - Calcular `remaining_hours = Math.max(0, plannedHours - approvedTime.hours)`.
  - Calcular `projected_hours` y `projected_cost`:
    - Si `hasApprovedTime`: `projected_hours = approvedTime.hours + remaining_hours + clientDelayHours;`
      `projected_cost = approvedTime.costCLP + (remaining_hours * engineerHourlyCost) + (clientDelayHours * engineerHourlyCost);`
    - Si no: `projected_hours = plannedHours + clientDelayHours;`
      `projected_cost = plannedCost + (clientDelayHours * engineerHourlyCost);`
  - Calcular márgenes % sobre venta:
    - `planned_margin_percentage = salePrice > 0 ? (plannedProfit / salePrice) * 100 : 0`
    - `real_margin_percentage = salePrice > 0 ? (realProfit / salePrice) * 100 : 0`
    - `projected_margin_percentage = salePrice > 0 ? (projectedProfit / salePrice) * 100 : 0`
    - `projected_roi = projectedCost > 0 ? (projectedProfit / projectedCost) * 100 : 0`
  - Calcular `variance_impact = plannedProfit - projectedProfit` (`= projectedCost - plannedCost`).
- En `syncROIAlerts(projectId)`:
  - Evaluar alertas de sobrecosto y margen bajo usando las cifras proyectadas (`projected_cost`, `projected_margin_percentage`, `projected_roi`), permitiendo alertar durante la ejecución sin esperar al término del proyecto.

### Tarea 2: Backend — Tests de `financeService`
- Actualizar `backend/src/__tests__/services/financeService.test.ts`:
  - Validar los nuevos campos proyectados, márgenes % y `variance_impact`.
- Actualizar `backend/src/__tests__/services/financeService.roiAlerts.test.ts`:
  - Validar evaluación de alertas de costo y margen usando métricas proyectadas.

### Tarea 3: Frontend — `ProjectROICard.tsx` y types
- Actualizar `ProjectROIData` con las nuevas métricas:
  - `planned_margin_percentage`, `real_margin_percentage`, `projected_cost`, `projected_hours`, `projected_profit`, `projected_margin_percentage`, `projected_roi`, `variance_impact`.
- Renderizar:
  - Fila comparativa de Costo (Planificado vs Real vs Proyectado al término).
  - Métricas de Margen % y Ganancia Proyectada.
  - Indicador de impacto del desvío en dinero ($).
  - Alertas dinámicas de proyección.
- Tests: actualizar `frontend/src/__tests__/components/ProjectROICard.test.tsx`.

### Tarea 4: Verificación completa
- Compilación `npm run build` en backend y frontend (0 errores).
- Tests unitarios en backend y frontend pasando al 100%.
