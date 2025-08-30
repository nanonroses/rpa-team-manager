import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

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
    createUserCost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can manage cost information' });
                return;
            }

            const { user_id, monthly_cost, effective_from } = req.body;

            if (!user_id || !monthly_cost || !effective_from) {
                res.status(400).json({ error: 'User ID, monthly cost, and effective date are required' });
                return;
            }

            // Calculate hourly rate (assuming 160 hours per month)
            const hourly_rate = monthly_cost / 160;

            // Deactivate previous rates for this user
            await db.run(`
                UPDATE user_cost_rates 
                SET is_active = 0, effective_to = ?
                WHERE user_id = ? AND is_active = 1
            `, [effective_from, user_id]);

            // Create new rate
            const result = await db.run(`
                INSERT INTO user_cost_rates (
                    user_id, monthly_cost, hourly_rate, effective_from, 
                    is_active, created_by
                ) VALUES (?, ?, ?, ?, 1, ?)
            `, [user_id, monthly_cost, hourly_rate, effective_from, req.user?.id]);

            // Get the created record with user info
            const newCost = await db.get(`
                SELECT 
                    ucr.*,
                    u.full_name,
                    u.email,
                    u.role
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

            if (!monthly_cost) {
                res.status(400).json({ error: 'Monthly cost is required' });
                return;
            }

            // Calculate new hourly rate
            const hourly_rate = monthly_cost / 160;

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

    // GET /api/financial/project-roi/:projectId
    getProjectROI = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { projectId } = req.params;

            // Get project basic data
            const project = await db.get(`
                SELECT p.*, pf.* 
                FROM projects p
                LEFT JOIN project_financials pf ON p.id = pf.project_id
                WHERE p.id = ?
            `, [projectId]);

            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            // Get settings (UF value and hours per month)
            const ufValue = await db.get(`SELECT setting_value FROM global_settings WHERE setting_key = 'uf_rate'`);
            const hoursPerMonth = await db.get(`SELECT setting_value FROM global_settings WHERE setting_key = 'monthly_hours'`);
            
            const ufValueCLP = parseFloat(ufValue?.setting_value || '37250.85'); // Default UF value
            const monthlyHours = parseFloat(hoursPerMonth?.setting_value || '176'); // Default hours

            // Get ALL assigned users and their costs
            const assignedUsers = await db.query(`
                SELECT 
                    pa.user_id,
                    pa.allocation_percentage,
                    pa.role as project_role,
                    u.full_name,
                    u.role as user_role,
                    ucr.monthly_cost,
                    ucr.hourly_rate
                FROM project_assignments pa
                JOIN users u ON pa.user_id = u.id
                LEFT JOIN user_cost_rates ucr ON pa.user_id = ucr.user_id AND ucr.is_active = 1
                WHERE pa.project_id = ? AND pa.is_active = 1
            `, [projectId]);

            // Fallback to old single assignment if no multi-assignments found
            if (assignedUsers.length === 0 && project.assigned_to) {
                const singleUser = await db.get(`
                    SELECT 
                        u.id as user_id,
                        100 as allocation_percentage,
                        'primary' as project_role,
                        u.full_name,
                        u.role as user_role,
                        ucr.monthly_cost,
                        ucr.hourly_rate
                    FROM users u
                    LEFT JOIN user_cost_rates ucr ON u.id = ucr.user_id AND ucr.is_active = 1
                    WHERE u.id = ?
                `, [project.assigned_to]);
                
                if (singleUser) {
                    assignedUsers.push(singleUser);
                }
            }

            // Calculate total hourly cost from all assigned users
            let totalHourlyEngineerCost = 0;
            const userCostBreakdown: any[] = [];
            
            for (const user of assignedUsers) {
                const monthlySalary = user.monthly_cost || 1000000; // Default salary
                const userHourlyCost = monthlySalary / monthlyHours;
                const adjustedHourlyCost = (userHourlyCost * user.allocation_percentage) / 100;
                
                totalHourlyEngineerCost += adjustedHourlyCost;
                
                userCostBreakdown.push({
                    user_name: user.full_name,
                    user_role: user.user_role,
                    project_role: user.project_role,
                    allocation_percentage: user.allocation_percentage,
                    monthly_salary: monthlySalary,
                    hourly_cost: userHourlyCost,
                    adjusted_hourly_cost: adjustedHourlyCost
                });
            }

            const hourlyEngineerCost = totalHourlyEngineerCost;

            // Get client delay hours from milestones
            const clientDelays = await db.get(`
                SELECT COALESCE(SUM(estimated_delay_days * 8), 0) as total_delay_hours
                FROM project_milestones
                WHERE project_id = ? AND responsibility = 'client'
            `, [projectId]);

            const clientDelayHours = clientDelays?.total_delay_hours || 0;

            // CALCULATIONS BASED ON YOUR LOGIC
            const plannedHours = project.budgeted_hours || 100; // Default if not set
            const hourlyRateUF = project.hourly_rate || 1.2; // Default if not set
            
            // 1. SALE PRICE (VENTA)
            const salePrice = plannedHours * hourlyRateUF * ufValueCLP;
            
            // 2. PLANNED COST (COSTO PLANIFICADO)
            const plannedCost = plannedHours * hourlyEngineerCost;
            
            // 3. REAL HOURS (with client delays)
            const realHours = plannedHours + clientDelayHours;
            
            // 4. REAL COST (COSTO REAL)
            const realCost = realHours * hourlyEngineerCost;
            
            // 5. PLANNED PROFIT (UTILIDAD PLANIFICADA)
            const plannedProfit = salePrice - plannedCost;
            
            // 6. REAL PROFIT (GANANCIA REAL)
            const realProfit = salePrice - realCost;
            
            // 7. ROI CALCULATIONS
            const plannedROI = plannedCost > 0 ? (plannedProfit / plannedCost) * 100 : 0;
            const realROI = realCost > 0 ? (realProfit / realCost) * 100 : 0;
            
            // 8. IMPACT OF CLIENT DELAYS
            const delayImpact = realCost - plannedCost;
            const lostProfit = plannedProfit - realProfit;

            // Update financial record
            await db.run(`
                INSERT OR REPLACE INTO project_financials (
                    project_id, sale_price, sale_price_currency,
                    hourly_rate, hourly_rate_currency,
                    budgeted_hours, budgeted_cost,
                    budgeted_cost, actual_cost,
                    profit_margin, roi_percentage,
                    updated_at
                ) VALUES (?, ?, 'CLP', ?, 'UF', ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                projectId, salePrice, hourlyRateUF,
                plannedHours, plannedCost,
                salePrice, realCost,
                plannedProfit, plannedROI
            ]);

            const result = {
                project_id: parseInt(projectId),
                project_name: project.name,
                
                // BASIC PARAMETERS
                planned_hours: plannedHours,
                real_hours: realHours,
                client_delay_hours: clientDelayHours,
                hourly_rate_uf: hourlyRateUF,
                uf_value_clp: ufValueCLP,
                engineer_hourly_cost: Math.round(hourlyEngineerCost),
                
                // ASSIGNED USERS BREAKDOWN
                assigned_users: assignedUsers.length,
                user_cost_breakdown: userCostBreakdown,
                
                // FINANCIAL RESULTS
                sale_price: Math.round(salePrice),
                planned_cost: Math.round(plannedCost),
                real_cost: Math.round(realCost),
                planned_profit: Math.round(plannedProfit),
                real_profit: Math.round(realProfit),
                
                // ROI METRICS
                planned_roi: Math.round(plannedROI * 100) / 100,
                real_roi: Math.round(realROI * 100) / 100,
                
                // CLIENT IMPACT
                delay_impact: Math.round(delayImpact),
                lost_profit: Math.round(lostProfit),
                
                // ALERTS
                alerts: this.generateROIAlerts(plannedROI, realROI, clientDelayHours)
            };

            logger.info(`ROI calculated for project ${projectId}: Planned=${plannedROI.toFixed(1)}%, Real=${realROI.toFixed(1)}%`);
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
    getROIDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            // Overall metrics (filtered to reasonable amounts)
            const overallMetrics = await db.get(`
                SELECT 
                    COUNT(*) as total_projects,
                    AVG(roi_percentage) as avg_roi,
                    SUM(CASE WHEN sale_price <= 1000000 THEN sale_price ELSE 50000 END) as total_revenue,
                    SUM(CASE WHEN actual_cost <= 500000 THEN actual_cost ELSE 25000 END) as total_costs,
                    SUM(CASE WHEN profit_margin <= 500000 THEN profit_margin ELSE 25000 END) as total_profit,
                    AVG(efficiency_percentage) as avg_efficiency
                FROM project_financials pf
                JOIN projects p ON pf.project_id = p.id
                WHERE p.status != 'cancelled'
                AND pf.sale_price IS NOT NULL
            `);

            // Project breakdown by ROI ranges
            const roiBreakdown = await db.query(`
                SELECT 
                    CASE 
                        WHEN roi_percentage >= 50 THEN 'excellent'
                        WHEN roi_percentage >= 20 THEN 'good'
                        WHEN roi_percentage >= 0 THEN 'break_even'
                        ELSE 'loss'
                    END as roi_category,
                    COUNT(*) as project_count,
                    AVG(roi_percentage) as avg_roi
                FROM project_financials pf
                JOIN projects p ON pf.project_id = p.id
                WHERE p.status != 'cancelled'
                GROUP BY roi_category
            `);

            // Top performing projects
            const topProjects = await db.query(`
                SELECT 
                    p.id,
                    p.name,
                    pf.roi_percentage,
                    pf.profit_margin,
                    pf.sale_price,
                    pf.actual_cost
                FROM project_financials pf
                JOIN projects p ON pf.project_id = p.id
                WHERE p.status != 'cancelled'
                ORDER BY pf.roi_percentage DESC
                LIMIT 5
            `);

            // Active alerts
            const activeAlerts = await db.query(`
                SELECT 
                    ra.*,
                    p.name as project_name
                FROM roi_alerts ra
                JOIN projects p ON ra.project_id = p.id
                WHERE ra.is_resolved = 0
                ORDER BY ra.alert_level DESC, ra.created_at DESC
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
    private generateROIAlerts(plannedROI: number, realROI: number, clientDelayHours: number): any[] {
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

        // Low ROI warning
        if (realROI >= 0 && realROI < 15) {
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