import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { financeService } from '../services/financeService';

export class FinancialController {

    // GET /api/financial/user-costs - Solo para team_lead
    getUserCosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can access cost information' });
                return;
            }

            const userCosts = await db.query(`
                SELECT 
                    ucr.*,
                    u.full_name,
                    u.email,
                    u.role
                FROM user_cost_rates ucr
                JOIN users u ON ucr.user_id = u.id
                WHERE ucr.is_active = 1
                ORDER BY u.full_name
            `);

            res.json(userCosts);
        } catch (error) {
            logger.error('Get user costs error:', error);
            res.status(500).json({ error: 'Failed to get user costs' });
        }
    };

    // POST /api/financial/user-costs - Solo para team_lead
    // monthly_cost = costo empresa mensual (sueldo + leyes sociales + otros), en CLP.
    createUserCost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can manage cost information' });
                return;
            }

            const { user_id, monthly_cost } = req.body;
            const effective_from: string = req.body.effective_from || new Date().toISOString().slice(0, 10);

            if (!Number.isInteger(user_id) || typeof monthly_cost !== 'number' || !(monthly_cost > 0)) {
                res.status(400).json({ error: 'user_id y un costo empresa mensual mayor a 0 son obligatorios' });
                return;
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(effective_from)) {
                res.status(400).json({ error: 'effective_from debe tener formato YYYY-MM-DD' });
                return;
            }

            const user = await db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', [user_id]);
            if (!user) {
                res.status(400).json({ error: `El usuario ${user_id} no existe o está inactivo` });
                return;
            }

            const monthlyHours = await financeService.getMonthlyHours();
            const hourly_rate = Math.round((monthly_cost / monthlyHours) * 100) / 100;

            await db.run(`
                UPDATE user_cost_rates
                SET is_active = 0, effective_to = ?
                WHERE user_id = ? AND is_active = 1
            `, [effective_from, user_id]);

            const result = await db.run(`
                INSERT INTO user_cost_rates (
                    user_id, monthly_cost, hourly_rate, effective_from,
                    is_active, created_by
                ) VALUES (?, ?, ?, ?, 1, ?)
            `, [user_id, monthly_cost, hourly_rate, effective_from, req.user?.id]);

            const newCost = await db.get(`
                SELECT ucr.*, u.full_name, u.email, u.role
                FROM user_cost_rates ucr
                JOIN users u ON ucr.user_id = u.id
                WHERE ucr.id = ?
            `, [result.id]);

            res.status(201).json(newCost);
        } catch (error) {
            logger.error('Create user cost error:', error);
            res.status(500).json({ error: 'Failed to create user cost' });
        }
    };

    // PUT /api/financial/user-costs/:id - Solo para team_lead
    updateUserCost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can manage cost information' });
                return;
            }

            const { id } = req.params;
            const { monthly_cost } = req.body;

            if (typeof monthly_cost !== 'number' || !(monthly_cost > 0)) {
                res.status(400).json({ error: 'Monthly cost must be a number greater than 0' });
                return;
            }

            const monthlyHours = await financeService.getMonthlyHours();
            const hourly_rate = Math.round((monthly_cost / monthlyHours) * 100) / 100;

            await db.run(`
                UPDATE user_cost_rates 
                SET monthly_cost = ?, hourly_rate = ?
                WHERE id = ? AND is_active = 1
            `, [monthly_cost, hourly_rate, id]);

            // Get updated record
            const updatedCost = await db.get(`
                SELECT 
                    ucr.*,
                    u.full_name,
                    u.email,
                    u.role
                FROM user_cost_rates ucr
                JOIN users u ON ucr.user_id = u.id
                WHERE ucr.id = ?
            `, [id]);

            res.json(updatedCost);
        } catch (error) {
            logger.error('Update user cost error:', error);
            res.status(500).json({ error: 'Failed to update user cost' });
        }
    };

    // GET /api/financial/team-costs - Solo para team_lead
    // Todas las personas activas, tengan o no costo registrado, con su costo vigente más reciente.
    getTeamCosts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const monthly_hours = await financeService.getMonthlyHours();
            const members = await db.query(`
                SELECT u.id as user_id, u.full_name, u.email, u.role,
                       ucr.id as cost_rate_id, ucr.monthly_cost, ucr.hourly_rate, ucr.effective_from
                FROM users u
                LEFT JOIN user_cost_rates ucr ON ucr.id = (
                    SELECT id FROM user_cost_rates
                    WHERE user_id = u.id AND is_active = 1
                    ORDER BY effective_from DESC, id DESC LIMIT 1
                )
                WHERE u.is_active = 1
                ORDER BY u.full_name
            `);
            res.json({ monthly_hours, members });
        } catch (error) {
            logger.error('Get team costs error:', error);
            res.status(500).json({ error: 'Failed to get team costs' });
        }
    };

    // GET /api/financial/project-roi/:projectId
    // Fuente de verdad: financeService.calculateProjectFinancials (siempre recalculado, nunca leído de columnas cacheadas)
    getProjectROI = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { projectId } = req.params;

            const project = await db.get(`SELECT id FROM projects WHERE id = ?`, [projectId]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            const financials = await financeService.calculateProjectFinancials(parseInt(projectId));

            // Cache opcional para reportes que consultan project_financials directamente;
            // financeService siempre recalcula en vivo, esto solo mantiene el cache al día.
            await db.run(`
                UPDATE project_financials
                SET actual_cost = ?, profit_margin = ?, roi_percentage = ?, updated_at = datetime('now')
                WHERE project_id = ?
            `, [financials.real_cost, financials.planned_profit, financials.planned_roi, projectId]);

            const result = {
                ...financials,
                alerts: financials.financial_data_complete === false ? [] : this.generateROIAlerts(
                    financials.planned_roi,
                    financials.real_roi,
                    financials.client_delay_hours,
                    financials.projected_roi,
                    financials.variance_impact
                )
            };

            logger.info(`ROI calculated for project ${projectId}: Planned=${financials.planned_roi.toFixed(1)}%, Real=${financials.real_roi.toFixed(1)}%`);
            res.json(result);
        } catch (error) {
            logger.error('Get project ROI error:', error);
            res.status(500).json({ error: 'Failed to get project ROI' });
        }
    };

    // POST /api/financial/project-financial
    updateProjectFinancial = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { 
                project_id, 
                sale_price, 
                budgeted_cost, 
                hours_budgeted 
            } = req.body;

            if (!project_id) {
                res.status(400).json({ error: 'Project ID is required' });
                return;
            }

            // Check if record exists
            const existing = await db.get(`
                SELECT id FROM project_financials WHERE project_id = ?
            `, [project_id]);

            if (existing) {
                // Update existing record
                await db.run(`
                    UPDATE project_financials 
                    SET sale_price = ?, budgeted_cost = ?, budgeted_hours = ?
                    WHERE project_id = ?
                `, [sale_price, budgeted_cost, hours_budgeted, project_id]);
            } else {
                // Create new record
                await db.run(`
                    INSERT INTO project_financials (
                        project_id, sale_price, budgeted_cost, budgeted_hours
                    ) VALUES (?, ?, ?, ?)
                `, [project_id, sale_price, budgeted_cost, hours_budgeted]);
            }

            // Get updated financial data
            const financial = await db.get(`
                SELECT * FROM project_financials WHERE project_id = ?
            `, [project_id]);

            res.json({ 
                message: 'Project financial data updated successfully',
                financial 
            });

        } catch (error) {
            logger.error('Update project financial error:', error);
            res.status(500).json({ error: 'Failed to update project financial data' });
        }
    };

    // GET /api/financial/dashboard
    // Todas las métricas se recalculan en vivo con financeService (no se leen columnas cacheadas
    // de project_financials, que pueden estar desactualizadas o venir de datos de carga defectuosos).
    getROIDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projects = await db.query(`
                SELECT p.id, p.name FROM projects p
                WHERE p.status != 'cancelled'
            `);

            const perProject = await Promise.all(
                projects.map(async (p: any) => {
                    try {
                        const financials = await financeService.calculateProjectFinancials(p.id);
                        await financeService.syncROIAlerts(p.id);
                        return financials;
                    } catch (error) {
                        logger.warn(`Skipping project ${p.id} in ROI dashboard: ${(error as Error).message}`);
                        return null;
                    }
                })
            );
            const valid = perProject.filter((f): f is NonNullable<typeof f> => f !== null && f.sale_price > 0 && f.financial_data_complete !== false);

            const overallMetrics = {
                total_projects: valid.length,
                avg_roi: valid.length
                    ? Math.round((valid.reduce((s, f) => s + f.real_roi, 0) / valid.length) * 100) / 100
                    : 0,
                total_revenue: valid.reduce((s, f) => s + f.sale_price, 0),
                total_costs: valid.reduce((s, f) => s + f.real_cost, 0),
                total_profit: valid.reduce((s, f) => s + f.real_profit, 0)
            };

            const categoryOf = (roi: number) =>
                roi >= 50 ? 'excellent' : roi >= 20 ? 'good' : roi >= 0 ? 'break_even' : 'loss';

            const roiBreakdownMap = new Map<string, { project_count: number; roi_sum: number }>();
            for (const f of valid) {
                const cat = categoryOf(f.real_roi);
                const entry = roiBreakdownMap.get(cat) || { project_count: 0, roi_sum: 0 };
                entry.project_count += 1;
                entry.roi_sum += f.real_roi;
                roiBreakdownMap.set(cat, entry);
            }
            const roiBreakdown = Array.from(roiBreakdownMap.entries()).map(([roi_category, v]) => ({
                roi_category,
                project_count: v.project_count,
                avg_roi: Math.round((v.roi_sum / v.project_count) * 100) / 100
            }));

            const topProjects = [...valid]
                .sort((a, b) => b.real_roi - a.real_roi)
                .slice(0, 5)
                .map(f => ({
                    id: f.project_id,
                    name: f.project_name,
                    roi_percentage: f.real_roi,
                    profit_margin: f.real_profit,
                    sale_price: f.sale_price,
                    actual_cost: f.real_cost
                }));

            // Active alerts
            const activeAlerts = await db.query(`
                SELECT
                    ra.*,
                    p.name as project_name
                FROM roi_alerts ra
                JOIN projects p ON ra.project_id = p.id
                WHERE ra.is_resolved = 0
                ORDER BY CASE ra.alert_level WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, ra.created_at DESC
                LIMIT 10
            `);

            res.json({
                overall_metrics: overallMetrics,
                roi_breakdown: roiBreakdown,
                top_projects: topProjects,
                active_alerts: activeAlerts
            });
        } catch (error) {
            logger.error('Get ROI dashboard error:', error);
            res.status(500).json({ error: 'Failed to get ROI dashboard' });
        }
    };

    // Private helper method for ROI alerts
    private generateROIAlerts(
        plannedROI: number,
        realROI: number,
        clientDelayHours: number,
        projectedROI?: number,
        varianceImpact?: number
    ): any[] {
        const alerts: any[] = [];

        // Critical ROI loss
        if (realROI < 0) {
            alerts.push({
                type: 'critical_loss',
                level: 'critical',
                message: `Project is losing money with ${realROI.toFixed(1)}% ROI`,
                impact: 'high'
            });
        }

        // Low ROI warning (mismo umbral de 20% que financeService.syncROIAlerts' low_margin,
        // para que este endpoint y el dashboard persistido nunca se contradigan)
        if (realROI >= 0 && realROI < 20) {
            alerts.push({
                type: 'low_roi',
                level: 'warning',
                message: `Low profitability with ${realROI.toFixed(1)}% ROI (target: 20%+)`,
                impact: 'medium'
            });
        }

        // Client delay impact
        if (clientDelayHours > 0) {
            const roiDrop = plannedROI - realROI;
            alerts.push({
                type: 'client_delays',
                level: roiDrop > 10 ? 'warning' : 'info',
                message: `Client delays (${clientDelayHours}h) reduced ROI by ${roiDrop.toFixed(1)} percentage points`,
                impact: roiDrop > 10 ? 'medium' : 'low'
            });
        }

        // Desvío económico proyectado
        if (varianceImpact && varianceImpact > 0) {
            alerts.push({
                type: 'variance_impact',
                level: 'warning',
                message: `Desvío económico proyectado de $${varianceImpact.toLocaleString('es-CL')} sobre lo planificado`,
                impact: 'medium'
            });
        }

        // Excellent performance
        if (realROI > plannedROI && realROI > 30) {
            alerts.push({
                type: 'excellent_performance',
                level: 'success',
                message: `Excellent ROI performance: ${realROI.toFixed(1)}% (${(realROI - plannedROI).toFixed(1)} points above plan)`,
                impact: 'positive'
            });
        }

        return alerts;
    }

    // Private helper methods
    private async calculateActualProjectCost(projectId: number): Promise<{
        total_cost: number;
        total_hours: number;
        average_hourly_cost: number;
        cost_breakdown: any[];
    }> {
        // Get project timeline and assigned engineer
        const project = await db.get(`
            SELECT 
                p.start_date,
                p.end_date,
                p.assigned_to,
                u.full_name as engineer_name
            FROM projects p
            LEFT JOIN users u ON p.assigned_to = u.id
            WHERE p.id = ?
        `, [projectId]);

        if (!project || !project.start_date || !project.end_date || !project.assigned_to) {
            // Fallback to old method if timeline or assignment not set
            return this.calculateLegacyProjectCost(projectId);
        }

        // Get engineer's hourly rate
        const engineerCost = await db.get(`
            SELECT 
                ucr.monthly_cost,
                ucr.hourly_rate,
                gs.setting_value as monthly_hours
            FROM user_cost_rates ucr
            JOIN global_settings gs ON gs.setting_key = 'monthly_hours'
            WHERE ucr.user_id = ? 
            AND ucr.is_active = 1
        `, [project.assigned_to]);

        if (!engineerCost) {
            throw new Error('Engineer cost rate not found');
        }

        // Calculate project duration in days
        const startDate = new Date(project.start_date);
        const endDate = new Date(project.end_date);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const projectDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates

        // Calculate working hours and cost
        const hoursPerDay = 8.8; // 44 hours/week ÷ 5 days = 8.8 hours/day
        const monthlyHours = parseFloat(engineerCost.monthly_hours);
        const hourlyRate = engineerCost.monthly_cost / monthlyHours;
        
        const totalHours = projectDays * hoursPerDay;
        const totalCost = totalHours * hourlyRate;

        const costBreakdown = [{
            user_name: project.engineer_name,
            total_hours: totalHours,
            hourly_rate: hourlyRate,
            total_cost: totalCost,
            project_days: projectDays,
            hours_per_day: hoursPerDay
        }];

        return {
            total_cost: Math.round(totalCost * 100) / 100,
            total_hours: Math.round(totalHours * 100) / 100,
            average_hourly_cost: hourlyRate,
            cost_breakdown: costBreakdown
        };
    }

    // Fallback method for projects without timeline or assignment
    private async calculateLegacyProjectCost(projectId: number): Promise<{
        total_cost: number;
        total_hours: number;
        average_hourly_cost: number;
        cost_breakdown: any[];
    }> {
        const timeEntries = await db.query(`
            SELECT 
                te.user_id,
                te.hours,
                ucr.hourly_rate,
                u.full_name
            FROM time_entries te
            JOIN user_cost_rates ucr ON te.user_id = ucr.user_id 
            JOIN users u ON te.user_id = u.id
            WHERE te.project_id = ? 
            AND ucr.is_active = 1
            AND te.date >= ucr.effective_from
            AND (ucr.effective_to IS NULL OR te.date <= ucr.effective_to)
        `, [projectId]);

        if (timeEntries.length === 0) {
            return {
                total_cost: 0,
                total_hours: 0,
                average_hourly_cost: 0,
                cost_breakdown: []
            };
        }

        let totalCost = 0;
        let totalHours = 0;
        const costBreakdown: any[] = [];

        // Group by user
        const userCosts = timeEntries.reduce((acc: any, entry: any) => {
            const userId = entry.user_id;
            if (!acc[userId]) {
                acc[userId] = {
                    user_name: entry.full_name,
                    total_hours: 0,
                    hourly_rate: entry.hourly_rate,
                    total_cost: 0
                };
            }
            acc[userId].total_hours += entry.hours;
            acc[userId].total_cost += entry.hours * entry.hourly_rate;
            return acc;
        }, {});

        Object.values(userCosts).forEach((userCost: any) => {
            totalCost += userCost.total_cost;
            totalHours += userCost.total_hours;
            costBreakdown.push(userCost);
        });

        return {
            total_cost: totalCost,
            total_hours: totalHours,
            average_hourly_cost: totalHours > 0 ? totalCost / totalHours : 0,
            cost_breakdown: costBreakdown
        };
    }

    private calculateROI(salePrice: number, actualCost: number): {
        percentage: number;
        profit_margin: number;
    } {
        if (!salePrice || !actualCost) {
            return { percentage: 0, profit_margin: 0 };
        }

        const profitMargin = salePrice - actualCost;
        const roiPercentage = (profitMargin / actualCost) * 100;

        return {
            percentage: Math.round(roiPercentage * 100) / 100,
            profit_margin: Math.round(profitMargin * 100) / 100
        };
    }

    private calculateEfficiency(budgetedHours: number, actualHours: number): number {
        if (!budgetedHours || !actualHours) return 0;
        return Math.round((budgetedHours / actualHours) * 100 * 100) / 100;
    }

    private async checkROIAlerts(projectId: number, financial: any, actualCosts: any): Promise<any[]> {
        const alerts: any[] = [];

        // Check cost overrun (80% threshold)
        if (financial.sale_price && actualCosts.total_cost > financial.sale_price * 0.8) {
            alerts.push({
                type: 'cost_overrun',
                level: actualCosts.total_cost > financial.sale_price ? 'critical' : 'warning',
                message: `Project costs are ${Math.round((actualCosts.total_cost / financial.sale_price) * 100)}% of sale price`,
                threshold: financial.sale_price * 0.8,
                current: actualCosts.total_cost
            });
        }

        // Check low ROI (less than 20%)
        const roi = this.calculateROI(financial.sale_price, actualCosts.total_cost);
        if (roi.percentage < 20) {
            alerts.push({
                type: 'low_roi',
                level: roi.percentage < 0 ? 'critical' : 'warning',
                message: `Project ROI is ${roi.percentage}% (target: 20%+)`,
                threshold: 20,
                current: roi.percentage
            });
        }

        return alerts;
    }
}