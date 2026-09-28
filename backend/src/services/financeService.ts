import { db } from '../database/database';
import { logger } from '../utils/logger';

export type Currency = 'CLP' | 'USD' | 'UF';

export interface UserCostBreakdownEntry {
    user_id: number;
    user_name?: string;
    user_role?: string;
    allocation_percentage: number;
    hourly_cost_clp: number;
    adjusted_hourly_cost_clp: number;
}

export interface ProjectFinancials {
    project_id: number;
    project_name: string;
    planned_hours: number;
    real_hours: number;
    real_hours_source: 'approved' | 'projected';
    approved_hours: number;
    client_delay_hours: number;
    hourly_rate_uf: number;
    uf_value_clp: number;
    engineer_hourly_cost: number;
    assigned_users: number;
    user_cost_breakdown: UserCostBreakdownEntry[];
    sale_price: number;
    planned_cost: number;
    real_cost: number;
    projected_cost: number;
    projected_hours: number;
    planned_profit: number;
    real_profit: number;
    projected_profit: number;
    planned_margin_percentage: number;
    real_margin_percentage: number;
    projected_margin_percentage: number;
    planned_roi: number;
    real_roi: number;
    projected_roi: number;
    delay_impact: number;
    lost_profit: number;
    variance_impact: number;
}

/**
 * Única fuente de verdad para cálculo de costo, ingreso, margen y ROI de un proyecto.
 * Todo se recalcula en el momento a partir de datos vivos (horas, tarifas, tipo de cambio);
 * project_financials.roi_percentage/profit_margin/actual_cost son solo un cache opcional,
 * nunca la fuente de verdad.
 */
export class FinanceService {
    /** Tasa de cambio vigente a una fecha (por defecto hoy). CLP siempre es 1. */
    async getExchangeRate(currency: Currency, asOfDate?: string): Promise<number> {
        if (currency === 'CLP') return 1;

        const date = asOfDate || new Date().toISOString().slice(0, 10);
        const row = await db.get(
            `SELECT rate_to_clp FROM exchange_rates
             WHERE currency = ? AND rate_date <= ?
             ORDER BY rate_date DESC LIMIT 1`,
            [currency, date]
        );

        if (!row) {
            logger.warn(`No hay tipo de cambio configurado para ${currency} en o antes de ${date}`);
            return 0;
        }

        return row.rate_to_clp;
    }

    async toCLP(amount: number, currency: Currency, asOfDate?: string): Promise<number> {
        if (!amount) return 0;
        if (currency === 'CLP') return amount;
        const rate = await this.getExchangeRate(currency, asOfDate);
        return amount * rate;
    }

    async getMonthlyHours(): Promise<number> {
        const row = await db.get(
            `SELECT setting_value FROM global_settings WHERE setting_key = 'monthly_hours'`
        );
        const hours = row ? parseFloat(row.setting_value) : NaN;
        return Number.isFinite(hours) && hours > 0 ? hours : 168;
    }

    /**
     * Costo por hora combinado de todas las personas asignadas a un proyecto,
     * ponderado por porcentaje de asignación y normalizado a CLP.
     * Si no hay asignaciones múltiples, cae al assigned_to legado.
     */
    async getBlendedHourlyCostCLP(
        projectId: number,
        asOfDate?: string
    ): Promise<{ hourlyCostCLP: number; breakdown: UserCostBreakdownEntry[] }> {
        let assignments = await db.query(
            `SELECT pa.user_id, pa.allocation_percentage, u.full_name, u.role
             FROM project_assignments pa
             JOIN users u ON pa.user_id = u.id
             WHERE pa.project_id = ? AND pa.is_active = 1`,
            [projectId]
        );

        if (assignments.length === 0) {
            const project = await db.get(`SELECT assigned_to FROM projects WHERE id = ?`, [projectId]);
            if (project?.assigned_to) {
                const user = await db.get(
                    `SELECT id as user_id, full_name, role FROM users WHERE id = ?`,
                    [project.assigned_to]
                );
                if (user) {
                    assignments = [{ ...user, allocation_percentage: 100 }];
                }
            }
        }

        let hourlyCostCLP = 0;
        const breakdown: UserCostBreakdownEntry[] = [];

        for (const assignment of assignments) {
            const rate = await db.get(
                `SELECT hourly_rate, hourly_rate_currency FROM user_cost_rates
                 WHERE user_id = ? AND is_active = 1
                 ORDER BY effective_from DESC LIMIT 1`,
                [assignment.user_id]
            );

            const rateCLP = rate
                ? await this.toCLP(rate.hourly_rate, rate.hourly_rate_currency as Currency, asOfDate)
                : 0;

            const allocation = assignment.allocation_percentage ?? 100;
            const adjusted = (rateCLP * allocation) / 100;
            hourlyCostCLP += adjusted;

            breakdown.push({
                user_id: assignment.user_id,
                user_name: assignment.full_name,
                user_role: assignment.role,
                allocation_percentage: allocation,
                hourly_cost_clp: Math.round(rateCLP),
                adjusted_hourly_cost_clp: Math.round(adjusted)
            });
        }

        return { hourlyCostCLP, breakdown };
    }

    /** Horas de atraso atribuibles al cliente (impactan costo real, no el planificado). */
    async getClientDelayHours(projectId: number): Promise<number> {
        const row = await db.get(
            `SELECT COALESCE(SUM(estimated_delay_days * 8), 0) as total_delay_hours
             FROM project_milestones
             WHERE project_id = ? AND responsibility = 'external'`,
            [projectId]
        );
        return row?.total_delay_hours || 0;
    }

    /**
     * Horas y costo realmente aprobados (bloqueados) para un proyecto, según Fase 3.
     * costCLP usa cost_rate_snapshot (congelado al aprobar) - nunca la tarifa vigente hoy,
     * para que el costo histórico no cambie si la tarifa de alguien cambia después.
     */
    private async getApprovedTimeSummary(projectId: number): Promise<{ hours: number; costCLP: number }> {
        const row = await db.get(
            `SELECT COALESCE(SUM(hours), 0) as hours, COALESCE(SUM(hours * COALESCE(cost_rate_snapshot, 0)), 0) as cost
             FROM time_entries WHERE project_id = ? AND approval_status = 'approved'`,
            [projectId]
        );
        return { hours: row?.hours || 0, costCLP: row?.cost || 0 };
    }

    /**
     * Calcula costo, venta, margen y ROI (planificado y real) de un proyecto.
     * Siempre en vivo: nunca lee roi_percentage/profit_margin/actual_cost de project_financials.
     */
    async calculateProjectFinancials(projectId: number): Promise<ProjectFinancials> {
        const project = await db.get(`SELECT * FROM projects WHERE id = ?`, [projectId]);
        if (!project) {
            throw new Error(`Project ${projectId} not found`);
        }

        const financials = await db.get(
            `SELECT * FROM project_financials WHERE project_id = ?`,
            [projectId]
        );

        // Fallback a cotización aprobada más reciente si existen datos en project_quotes
        const approvedQuote = await db.get(
            `SELECT amount, currency, hours FROM project_quotes WHERE project_id = ? AND status = 'approved' ORDER BY version DESC LIMIT 1`,
            [projectId]
        );

        let plannedHours = financials?.budgeted_hours || 0;
        if (plannedHours === 0 && approvedQuote?.hours > 0) {
            plannedHours = approvedQuote.hours;
        }

        const hourlyRateUF = financials?.hourly_rate || 0;
        const ufValueCLP = await this.getExchangeRate('UF');

        // Precio guardado en el proyecto (alta/edición); si no hay, fallback a cotización aprobada, y si no hay, horas × tarifa.
        let salePrice = 0;
        if (financials?.sale_price > 0) {
            salePrice = await this.toCLP(financials.sale_price, (financials.sale_price_currency as Currency) || 'CLP');
        } else if (approvedQuote && approvedQuote.amount > 0) {
            salePrice = await this.toCLP(approvedQuote.amount, (approvedQuote.currency as Currency) || 'CLP');
        } else {
            salePrice = await this.toCLP(
                plannedHours * hourlyRateUF,
                (financials?.hourly_rate_currency as Currency) || 'UF'
            );
        }

        const { hourlyCostCLP: engineerHourlyCost, breakdown: userCostBreakdown } =
            await this.getBlendedHourlyCostCLP(projectId);

        const clientDelayHours = await this.getClientDelayHours(projectId);

        // Fase 3: las horas/costo reales vienen de time_entries aprobados (el dato real), no de una
        // proyección. Mientras un proyecto no tenga ninguna hora aprobada todavía (arranque de esta
        // fase, o proyectos que aún no cargan timesheet), se usa la proyección anterior como fallback
        // para no mostrar de golpe un costo real de 0. real_hours_source/approved_hours quedan expuestos
        // en el resultado para que quien consuma esto (p. ej. syncROIAlerts) sepa si el dato es completo
        // o parcial, en vez de adivinarlo.
        const approvedTime = await this.getApprovedTimeSummary(projectId);
        const hasApprovedTime = approvedTime.hours > 0;

        const plannedCost = plannedHours * engineerHourlyCost;
        const realHours = hasApprovedTime
            ? approvedTime.hours + clientDelayHours
            : plannedHours + clientDelayHours;
        const realCost = hasApprovedTime
            ? approvedTime.costCLP + (clientDelayHours * engineerHourlyCost)
            : realHours * engineerHourlyCost;

        // Fase 6C: Proyección al término del proyecto
        // Si hay horas aprobadas, las horas restantes presupuestadas se estiman como max(0, plannedHours - approvedTime.hours)
        const remainingHours = hasApprovedTime ? Math.max(0, plannedHours - approvedTime.hours) : plannedHours;
        const projectedHours = hasApprovedTime
            ? approvedTime.hours + remainingHours + clientDelayHours
            : plannedHours + clientDelayHours;
        const projectedCost = hasApprovedTime
            ? approvedTime.costCLP + (remainingHours * engineerHourlyCost) + (clientDelayHours * engineerHourlyCost)
            : plannedCost + (clientDelayHours * engineerHourlyCost);

        const plannedProfit = salePrice - plannedCost;
        const realProfit = salePrice - realCost;
        const projectedProfit = salePrice - projectedCost;

        // Margen % sobre precio de venta: (Ganancia / Precio Venta) * 100
        const plannedMarginPct = salePrice > 0 ? (plannedProfit / salePrice) * 100 : 0;
        const realMarginPct = salePrice > 0 ? (realProfit / salePrice) * 100 : 0;
        const projectedMarginPct = salePrice > 0 ? (projectedProfit / salePrice) * 100 : 0;

        // ROI %: (Ganancia / Costo) * 100
        const plannedROI = plannedCost > 0 ? (plannedProfit / plannedCost) * 100 : 0;
        const realROI = realCost > 0 ? (realProfit / realCost) * 100 : 0;
        const projectedROI = projectedCost > 0 ? (projectedProfit / projectedCost) * 100 : 0;

        const delayImpact = realCost - plannedCost;
        const lostProfit = plannedProfit - realProfit;
        // Impacto económico del desvío en dinero ($): plannedProfit - projectedProfit (= projectedCost - plannedCost)
        const varianceImpact = plannedProfit - projectedProfit;

        return {
            project_id: projectId,
            project_name: project.name,
            planned_hours: plannedHours,
            real_hours: realHours,
            real_hours_source: hasApprovedTime ? 'approved' : 'projected',
            approved_hours: approvedTime.hours,
            client_delay_hours: clientDelayHours,
            hourly_rate_uf: hourlyRateUF,
            uf_value_clp: ufValueCLP,
            engineer_hourly_cost: Math.round(engineerHourlyCost),
            assigned_users: userCostBreakdown.length,
            user_cost_breakdown: userCostBreakdown,
            sale_price: Math.round(salePrice),
            planned_cost: Math.round(plannedCost),
            real_cost: Math.round(realCost),
            projected_cost: Math.round(projectedCost),
            projected_hours: Math.round(projectedHours * 100) / 100,
            planned_profit: Math.round(plannedProfit),
            real_profit: Math.round(realProfit),
            projected_profit: Math.round(projectedProfit),
            planned_margin_percentage: Math.round(plannedMarginPct * 100) / 100,
            real_margin_percentage: Math.round(realMarginPct * 100) / 100,
            projected_margin_percentage: Math.round(projectedMarginPct * 100) / 100,
            planned_roi: Math.round(plannedROI * 100) / 100,
            real_roi: Math.round(realROI * 100) / 100,
            projected_roi: Math.round(projectedROI * 100) / 100,
            delay_impact: Math.round(delayImpact),
            lost_profit: Math.round(lostProfit),
            variance_impact: Math.round(varianceImpact)
        };
    }

    /**
     * Persiste en roi_alerts los estados de sobrecosto y margen bajo del proyecto.
     * Idempotente: si la condición ya no aplica, resuelve la alerta activa en vez de dejarla huérfana.
     * Se llama de forma perezosa (no hay scheduler): desde el dashboard de cobranza y desde
     * getProjectROI/getROIDashboard en financialController.
     * Fase 6C: Se evalúan alertas usando métricas proyectadas al término (projected_cost y projected_roi),
     * permitiendo alertar preventivamente durante la ejecución sin omitir por horas parciales.
     */
    async syncROIAlerts(projectId: number): Promise<void> {
        const financials = await this.calculateProjectFinancials(projectId);

        const costToEvaluate = financials.projected_cost !== undefined ? financials.projected_cost : financials.real_cost;
        const roiToEvaluate = financials.projected_roi !== undefined ? financials.projected_roi : financials.real_roi;

        await this.upsertAlert(projectId, 'cost_overrun',
            financials.sale_price > 0 && costToEvaluate > financials.sale_price * 0.8,
            financials.sale_price * 0.8,
            costToEvaluate,
            `Costo proyectado (${costToEvaluate.toLocaleString('es-CL')}) supera el 80% del precio de venta`,
            costToEvaluate > financials.sale_price ? 'critical' : 'warning'
        );

        await this.upsertAlert(projectId, 'low_margin',
            roiToEvaluate < 20,
            20,
            roiToEvaluate,
            `ROI proyectado de ${roiToEvaluate.toFixed(1)}% por debajo del objetivo de 20%`,
            roiToEvaluate < 0 ? 'critical' : 'warning'
        );
    }

    /** Crea, actualiza o resuelve una alerta de roi_alerts según si la condición sigue activa. */
    private async upsertAlert(
        projectId: number,
        alertType: string,
        conditionActive: boolean,
        thresholdValue: number,
        currentValue: number,
        message: string,
        level: 'info' | 'warning' | 'critical'
    ): Promise<void> {
        // alertType es siempre una constante interna ('cost_overrun' | 'low_margin'), nunca input de usuario;
        // se embebe literal (igual que billingService.syncOverdueAlert) en vez de parametrizarlo.
        const existing = await db.get(
            `SELECT id FROM roi_alerts WHERE project_id = ? AND alert_type = '${alertType}' AND is_resolved = 0`,
            [projectId]
        );

        if (conditionActive) {
            if (existing) {
                await db.run(
                    `UPDATE roi_alerts SET current_value = ?, threshold_value = ?, message = ?, alert_level = ? WHERE id = ?`,
                    [currentValue, thresholdValue, message, level, existing.id]
                );
            } else {
                await db.run(
                    `INSERT INTO roi_alerts (project_id, alert_type, alert_level, message, threshold_value, current_value)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [projectId, alertType, level, message, thresholdValue, currentValue]
                );
            }
        } else if (existing) {
            await db.run(
                `UPDATE roi_alerts SET is_resolved = 1, resolved_at = datetime('now') WHERE id = ?`,
                [existing.id]
            );
        }
    }
}

export const financeService = new FinanceService();
