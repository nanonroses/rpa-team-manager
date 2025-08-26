import { Request, Response } from 'express';
import { db } from '../database/database';
import { logger } from '../utils/logger';

interface AuthenticatedRequest extends Request {
    user?: {
        id: number;
        email: string;
        role: string;
        full_name: string;
    };
}

export class PMOController {
    // GET /api/pmo/dashboard - Main PMO dashboard data
    getPMODashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            // Get all projects with PMO metrics
            const projects = await db.query(`
                SELECT 
                    p.*,
                    pm.completion_percentage,
                    pm.schedule_variance_days,
                    pm.cost_variance_percentage,
                    pm.risk_level,
                    pm.planned_hours,
                    pm.actual_hours,
                    pm.planned_budget,
                    pm.actual_cost,
                    pm.team_velocity,
                    pm.bugs_found,
                    pm.bugs_resolved,
                    pm.client_satisfaction_score,
                    u.full_name as assigned_to_name,
                    CASE 
                        WHEN pm.schedule_variance_days > 5 OR pm.cost_variance_percentage > 20 OR pm.risk_level = 'critical' THEN 'critical'
                        WHEN pm.schedule_variance_days > 2 OR pm.cost_variance_percentage > 10 OR pm.risk_level = 'high' THEN 'warning'
                        ELSE 'healthy'
                    END as project_health_status,
                    -- Calculate days until deadline
                    CASE 
                        WHEN p.end_date IS NOT NULL THEN 
                            CAST((julianday(p.end_date) - julianday('now')) AS INTEGER)
                        ELSE NULL
                    END as days_to_deadline,
                    -- Count milestones
                    (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id) as total_milestones,
                    (SELECT COUNT(*) FROM project_milestones WHERE project_id = p.id AND status = 'completed') as completed_milestones
                FROM projects p
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.status != 'cancelled'
                ORDER BY 
                    CASE 
                        WHEN pm.risk_level = 'critical' THEN 1
                        WHEN pm.risk_level = 'high' THEN 2
                        WHEN pm.risk_level = 'medium' THEN 3
                        ELSE 4
                    END,
                    p.priority DESC,
                    p.end_date ASC
            `);

            // Get overall PMO metrics
            const overallMetrics = await db.get(`
                SELECT 
                    COUNT(DISTINCT p.id) as total_projects,
                    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_projects,
                    COUNT(CASE WHEN pm.risk_level = 'critical' THEN 1 END) as critical_projects,
                    COUNT(CASE WHEN pm.schedule_variance_days < -2 THEN 1 END) as delayed_projects,
                    AVG(pm.completion_percentage) as avg_completion,
                    SUM(pm.planned_budget) as total_planned_budget,
                    SUM(pm.actual_cost) as total_actual_cost,
                    AVG(pm.client_satisfaction_score) as avg_satisfaction
                FROM projects p
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                WHERE p.status != 'cancelled'
            `);

            // Get upcoming milestones (all pending/in_progress milestones)
            const upcomingMilestones = await db.query(`
                SELECT 
                    m.*,
                    p.name as project_name,
                    p.priority as project_priority,
                    u.full_name as responsible_name,
                    CAST((julianday(m.planned_date) - julianday('now')) AS INTEGER) as days_until
                FROM project_milestones m
                JOIN projects p ON m.project_id = p.id
                LEFT JOIN users u ON m.responsible_user_id = u.id
                WHERE m.status IN ('pending', 'in_progress')
                ORDER BY m.planned_date ASC
                LIMIT 15
            `);

            // Get team workload distribution
            const teamWorkload = await db.query(`
                SELECT 
                    u.id,
                    u.full_name,
                    u.role,
                    COUNT(DISTINCT p.id) as assigned_projects,
                    SUM(pm.planned_hours - COALESCE(pm.actual_hours, 0)) as remaining_hours,
                    AVG(pm.completion_percentage) as avg_project_completion
                FROM users u
                LEFT JOIN projects p ON u.id = p.assigned_to AND p.status = 'active'
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                WHERE u.role IN ('rpa_developer', 'rpa_operations')
                GROUP BY u.id, u.full_name, u.role
                ORDER BY remaining_hours DESC
            `);

            res.json({
                projects,
                overallMetrics,
                upcomingMilestones,
                teamWorkload
            });
        } catch (error) {
            logger.error('Get PMO dashboard error:', error);
            res.status(500).json({ error: 'Failed to get PMO dashboard data' });
        }
    };

    // GET /api/pmo/projects/:id/gantt - Gantt chart data for specific project
    getProjectGantt = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            logger.info(`Loading Gantt data for project: ${id}`);

            // Get project basic info
            const project = await db.get(`
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.status,
                    p.priority,
                    p.budget,
                    p.start_date,
                    p.end_date,
                    p.actual_start_date,
                    p.actual_end_date,
                    p.progress_percentage,
                    p.created_by,
                    p.assigned_to,
                    p.created_at,
                    p.updated_at,
                    pm.planned_hours,
                    pm.planned_start_date,
                    pm.planned_end_date,
                    pm.planned_budget,
                    pm.actual_hours,
                    pm.actual_cost,
                    pm.completion_percentage as pmo_completion_percentage,
                    pm.schedule_variance_days,
                    pm.cost_variance_percentage,
                    pm.scope_variance_percentage,
                    pm.risk_level,
                    pm.risk_factors,
                    pm.bugs_found,
                    pm.bugs_resolved,
                    pm.client_satisfaction_score,
                    pm.team_velocity,
                    pm.last_updated,
                    pm.updated_by
                FROM projects p
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                WHERE p.id = ?
            `, [id]);

            if (!project) {
                logger.warn(`Project not found: ${id}`);
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            logger.info(`Project found: ${project.name}`);

            // Get all tasks for the project
            const tasks = await db.query(`
                SELECT 
                    t.*,
                    tc.name as column_name,
                    u.full_name as assignee_name,
                    COALESCE(SUM(te.hours), 0) as actual_hours,
                    t.estimated_hours as planned_hours
                FROM tasks t
                LEFT JOIN task_columns tc ON t.column_id = tc.id
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN time_entries te ON t.id = te.task_id
                WHERE t.board_id IN (SELECT id FROM task_boards WHERE project_id = ?)
                GROUP BY t.id
                ORDER BY t.position
            `, [id]);

            logger.info(`Found ${tasks.length} tasks`);

            // Get milestones
            const milestones = await db.query(`
                SELECT 
                    m.*,
                    u.full_name as responsible_name
                FROM project_milestones m
                LEFT JOIN users u ON m.responsible_user_id = u.id
                WHERE m.project_id = ?
                ORDER BY m.planned_date
            `, [id]);

            logger.info(`Found ${milestones.length} milestones`);

            // Get project dependencies
            const projectDependencies = await db.query(`
                SELECT 
                    pd.*,
                    sp.name as source_project_name,
                    dp.name as dependent_project_name
                FROM project_dependencies pd
                JOIN projects sp ON pd.source_project_id = sp.id
                JOIN projects dp ON pd.dependent_project_id = dp.id
                WHERE pd.source_project_id = ? OR pd.dependent_project_id = ?
            `, [id, id]);

            logger.info(`Found ${projectDependencies.length} project dependencies`);

            // Get task dependencies
            const taskDependencies = await db.query(`
                SELECT 
                    td.*,
                    pt.title as predecessor_title,
                    st.title as successor_title
                FROM task_dependencies td
                JOIN tasks pt ON td.predecessor_id = pt.id
                JOIN tasks st ON td.successor_id = st.id
                WHERE pt.board_id IN (SELECT id FROM task_boards WHERE project_id = ?)
                   OR st.board_id IN (SELECT id FROM task_boards WHERE project_id = ?)
            `, [id, id]);

            logger.info(`Found ${taskDependencies.length} task dependencies`);

            // Calculate completion percentage based on milestones and tasks
            let totalItems = 0;
            let completedItems = 0;

            // Count completed milestones
            if (milestones.length > 0) {
                totalItems += milestones.length;
                completedItems += milestones.filter((m: any) => m.status === 'completed').length;
            }

            // Count completed tasks
            if (tasks.length > 0) {
                totalItems += tasks.length;
                completedItems += tasks.filter((t: any) => t.status === 'done').length;
            }

            // Calculate completion percentage
            const calculatedCompletion = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

            // Update project with calculated completion if different from stored
            const projectWithCompletion = {
                ...project,
                completion_percentage: calculatedCompletion
            };

            logger.info(`Calculated completion: ${calculatedCompletion}% (${completedItems}/${totalItems} items completed)`);

            const result = {
                project: projectWithCompletion,
                tasks,
                milestones,
                projectDependencies,
                taskDependencies
            };

            logger.info(`Gantt data successfully loaded for project ${id}`);
            res.json(result);
        } catch (error) {
            logger.error('Get project Gantt error:', error);
            res.status(500).json({ error: 'Failed to get project Gantt data' });
        }
    };

    // POST /api/pmo/milestones - Create milestone
    createMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const {
                project_id,
                name,
                description,
                milestone_type,
                planned_date,
                priority,
                responsible_user_id,
                impact_on_timeline,
                responsibility,
                blocking_reason,
                delay_justification,
                external_contact,
                estimated_delay_days,
                financial_impact
            } = req.body;

            if (!project_id || !name || !planned_date) {
                res.status(400).json({ error: 'Missing required fields: project_id, name, planned_date' });
                return;
            }

            const result = await db.run(`
                INSERT INTO project_milestones (
                    project_id, name, description, milestone_type, planned_date, 
                    priority, responsible_user_id, impact_on_timeline, responsibility,
                    blocking_reason, delay_justification, external_contact, 
                    estimated_delay_days, financial_impact, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                project_id, name, description, milestone_type || 'delivery', planned_date,
                priority || 'medium', responsible_user_id, impact_on_timeline || 0, 
                responsibility || 'internal', blocking_reason, delay_justification, 
                external_contact, estimated_delay_days || 0, financial_impact || 0, req.user?.id
            ]);

            const newMilestone = await db.get(`
                SELECT m.*, u.full_name as responsible_name, p.name as project_name
                FROM project_milestones m
                LEFT JOIN users u ON m.responsible_user_id = u.id
                LEFT JOIN projects p ON m.project_id = p.id
                WHERE m.id = ?
            `, [result.id]);

            logger.info(`Milestone created: ${name} for project ${project_id}`);
            res.status(201).json(newMilestone);
        } catch (error) {
            logger.error('Create milestone error:', error);
            res.status(500).json({ error: 'Failed to create milestone' });
        }
    };

    // PUT /api/pmo/milestones/:id - Update milestone
    updateMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updates = req.body;

            // Remove fields that shouldn't be updated directly
            delete updates.id;
            delete updates.created_by;
            delete updates.created_at;

            const fields = [];
            const values = [];

            for (const [key, value] of Object.entries(updates)) {
                fields.push(`${key} = ?`);
                values.push(value);
            }

            if (fields.length === 0) {
                res.status(400).json({ error: 'No fields to update' });
                return;
            }

            fields.push('updated_at = datetime(\'now\')');
            values.push(id);

            await db.run(`
                UPDATE project_milestones 
                SET ${fields.join(', ')} 
                WHERE id = ?
            `, values);

            const updatedMilestone = await db.get(`
                SELECT m.*, u.full_name as responsible_name, p.name as project_name
                FROM project_milestones m
                LEFT JOIN users u ON m.responsible_user_id = u.id
                LEFT JOIN projects p ON m.project_id = p.id
                WHERE m.id = ?
            `, [id]);

            logger.info(`Milestone updated: ${id}`);
            res.json(updatedMilestone);
        } catch (error) {
            logger.error('Update milestone error:', error);
            res.status(500).json({ error: 'Failed to update milestone' });
        }
    };

    // DELETE /api/pmo/milestones/:id - Delete milestone
    deleteMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user?.id;

            // Use EXCLUSIVE transaction to prevent concurrent access
            await db.beginTransaction('EXCLUSIVE');
            
            try {
                // Re-check milestone existence within transaction for consistency
                const milestone = await db.get('SELECT * FROM project_milestones WHERE id = ?', [id]);
                if (!milestone) {
                    await db.rollback();
                    res.status(404).json({ error: 'Milestone not found or already deleted' });
                    return;
                }

                // Perform atomic deletion with existence check
                const deleteResult = await db.run(`
                    DELETE FROM project_milestones 
                    WHERE id = ? AND id IN (SELECT id FROM project_milestones WHERE id = ?)
                `, [id, id]);
                
                if (deleteResult.changes === 0) {
                    await db.rollback();
                    res.status(404).json({ error: 'Milestone not found or already deleted' });
                    return;
                }

                await db.commit();
                
                logger.info(`Milestone deleted successfully: ${id} (${milestone.name}) by user ${userId}`);
                res.json({ 
                    success: true, 
                    message: 'Milestone deleted successfully',
                    deletedId: id
                });
                
            } catch (transactionError) {
                await db.rollback();
                logger.error('Transaction error during milestone deletion:', transactionError);
                throw transactionError;
            }
            
        } catch (error) {
            logger.error('Delete milestone error:', error);
            
            // Provide specific error messages
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('database is locked')) {
                res.status(409).json({ error: 'Database temporarily locked, please try again' });
            } else if (errorMessage.includes('no such table')) {
                res.status(500).json({ error: 'Database schema error' });
            } else {
                res.status(500).json({ error: 'Failed to delete milestone' });
            }
        }
    };

    // POST /api/pmo/projects/:id/metrics - Update PMO metrics for project
    updateProjectMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const metrics = req.body;

            // Check if metrics exist for this project
            const existing = await db.get('SELECT id FROM project_pmo_metrics WHERE project_id = ?', [id]);

            if (existing) {
                // Update existing metrics
                const fields = [];
                const values = [];

                for (const [key, value] of Object.entries(metrics)) {
                    if (key !== 'project_id') {
                        fields.push(`${key} = ?`);
                        values.push(value);
                    }
                }

                fields.push('last_updated = datetime(\'now\')');
                fields.push('updated_by = ?');
                values.push(req.user?.id);
                values.push(id);

                await db.run(`
                    UPDATE project_pmo_metrics 
                    SET ${fields.join(', ')} 
                    WHERE project_id = ?
                `, values);
            } else {
                // Create new metrics
                const columns = ['project_id', 'updated_by', 'last_updated'];
                const placeholders = ['?', '?', 'datetime(\'now\')'];
                const insertValues = [id, req.user?.id];

                for (const [key, value] of Object.entries(metrics)) {
                    if (key !== 'project_id') {
                        columns.push(key);
                        placeholders.push('?');
                        insertValues.push(value as string | number);
                    }
                }

                await db.run(`
                    INSERT INTO project_pmo_metrics (${columns.join(', ')})
                    VALUES (${placeholders.join(', ')})
                `, insertValues);
            }

            const updatedMetrics = await db.get(`
                SELECT * FROM project_pmo_metrics WHERE project_id = ?
            `, [id]);

            logger.info(`PMO metrics updated for project: ${id}`);
            res.json(updatedMetrics);
        } catch (error) {
            logger.error('Update project metrics error:', error);
            res.status(500).json({ error: 'Failed to update project metrics' });
        }
    };

    // GET /api/pmo/analytics - Advanced PMO analytics data
    getPMOAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            // 1. Executive Summary Metrics
            const executiveSummary = await db.get(`
                SELECT 
                    COUNT(DISTINCT p.id) as total_projects,
                    COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_projects,
                    COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_projects,
                    COUNT(DISTINCT CASE WHEN pm.risk_level = 'critical' THEN p.id END) as critical_projects,
                    COUNT(DISTINCT CASE WHEN pm.cost_variance_percentage > 15 THEN p.id END) as over_budget_projects,
                    COUNT(DISTINCT CASE WHEN pm.schedule_variance_days < -3 THEN p.id END) as delayed_projects,
                    ROUND(AVG(pm.completion_percentage), 1) as avg_completion,
                    ROUND(AVG(pm.client_satisfaction_score), 1) as avg_satisfaction,
                    ROUND(SUM(pm.planned_budget), 2) as total_planned_budget,
                    ROUND(SUM(pm.actual_cost), 2) as total_actual_cost,
                    ROUND((SUM(pm.actual_cost) - SUM(pm.planned_budget)) * 100.0 / SUM(pm.planned_budget), 2) as overall_budget_variance
                FROM projects p
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
            `);

            // 2. Trend Analysis (last 12 weeks)
            const trendAnalysis = await db.query(`
                SELECT 
                    strftime('%Y-%W', pm.last_updated) as week,
                    COUNT(DISTINCT p.id) as projects_updated,
                    AVG(pm.completion_percentage) as avg_completion,
                    AVG(pm.client_satisfaction_score) as avg_satisfaction,
                    COUNT(DISTINCT CASE WHEN pm.risk_level = 'critical' THEN p.id END) as critical_count,
                    SUM(pm.planned_budget) as budget_planned,
                    SUM(pm.actual_cost) as budget_spent
                FROM projects p
                JOIN project_pmo_metrics pm ON p.id = pm.project_id
                WHERE pm.last_updated >= datetime('now', '-84 days')
                GROUP BY strftime('%Y-%W', pm.last_updated)
                ORDER BY week DESC
                LIMIT 12
            `);

            // 3. Budget Performance Analysis
            const budgetAnalysis = await db.query(`
                SELECT 
                    p.name as project_name,
                    p.id as project_id,
                    pm.planned_budget,
                    pm.actual_cost,
                    pm.cost_variance_percentage,
                    pm.completion_percentage,
                    ROUND((pm.actual_cost / NULLIF(pm.completion_percentage, 0)) * 100, 2) as projected_total_cost,
                    CASE 
                        WHEN pm.cost_variance_percentage > 20 THEN 'critical'
                        WHEN pm.cost_variance_percentage > 10 THEN 'warning' 
                        WHEN pm.cost_variance_percentage < -10 THEN 'under_budget'
                        ELSE 'on_track'
                    END as budget_status,
                    u.full_name as project_manager
                FROM projects p
                JOIN project_pmo_metrics pm ON p.id = pm.project_id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.status IN ('active', 'completed') AND pm.planned_budget > 0
                ORDER BY pm.cost_variance_percentage DESC
            `);

            // 4. Schedule Performance Analysis
            const scheduleAnalysis = await db.query(`
                SELECT 
                    p.name as project_name,
                    p.id as project_id,
                    p.start_date as planned_start,
                    p.end_date as planned_end,
                    pm.actual_start_date,
                    pm.actual_end_date,
                    pm.schedule_variance_days,
                    pm.completion_percentage,
                    CASE 
                        WHEN p.end_date IS NOT NULL THEN 
                            CAST((julianday(p.end_date) - julianday('now')) AS INTEGER)
                        ELSE NULL
                    END as days_to_deadline,
                    CASE 
                        WHEN pm.schedule_variance_days < -10 THEN 'severely_delayed'
                        WHEN pm.schedule_variance_days < -3 THEN 'delayed'
                        WHEN pm.schedule_variance_days > 7 THEN 'ahead_of_schedule'
                        ELSE 'on_schedule'
                    END as schedule_status,
                    u.full_name as project_manager
                FROM projects p
                JOIN project_pmo_metrics pm ON p.id = pm.project_id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.status IN ('active', 'completed')
                ORDER BY pm.schedule_variance_days ASC
            `);

            // 5. Risk Analysis
            const riskAnalysis = await db.query(`
                SELECT 
                    p.name as project_name,
                    p.id as project_id,
                    pm.risk_level,
                    pm.completion_percentage,
                    pm.cost_variance_percentage,
                    pm.schedule_variance_days,
                    pm.bugs_found,
                    pm.bugs_resolved,
                    ROUND((pm.bugs_resolved * 1.0 / NULLIF(pm.bugs_found, 0)) * 100, 1) as bug_resolution_rate,
                    pm.client_satisfaction_score,
                    u.full_name as project_manager,
                    CASE 
                        WHEN pm.risk_level = 'critical' AND pm.schedule_variance_days < -5 THEN 'high_priority'
                        WHEN pm.risk_level = 'high' AND pm.cost_variance_percentage > 15 THEN 'budget_risk'
                        WHEN pm.completion_percentage < 50 AND pm.schedule_variance_days < -3 THEN 'delivery_risk'
                        ELSE 'manageable'
                    END as priority_level
                FROM projects p
                JOIN project_pmo_metrics pm ON p.id = pm.project_id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.status = 'active'
                ORDER BY 
                    CASE pm.risk_level 
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END,
                    pm.schedule_variance_days ASC
            `);

            // 6. Team Performance Analysis
            const teamAnalysis = await db.query(`
                SELECT 
                    u.full_name,
                    u.role,
                    COUNT(DISTINCT p.id) as total_projects,
                    COUNT(DISTINCT CASE WHEN p.status = 'active' THEN p.id END) as active_projects,
                    COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_projects,
                    ROUND(AVG(pm.completion_percentage), 1) as avg_completion,
                    ROUND(AVG(pm.team_velocity), 1) as avg_velocity,
                    ROUND(AVG(pm.client_satisfaction_score), 1) as avg_satisfaction,
                    SUM(pm.bugs_found) as total_bugs_found,
                    SUM(pm.bugs_resolved) as total_bugs_resolved,
                    ROUND((SUM(pm.bugs_resolved) * 1.0 / NULLIF(SUM(pm.bugs_found), 0)) * 100, 1) as bug_resolution_rate,
                    COUNT(DISTINCT CASE WHEN pm.schedule_variance_days <= 0 THEN p.id END) as on_time_projects,
                    COUNT(DISTINCT CASE WHEN pm.cost_variance_percentage <= 10 THEN p.id END) as on_budget_projects,
                    ROUND(SUM(pm.planned_budget), 2) as total_budget_managed,
                    ROUND(AVG(pm.cost_variance_percentage), 1) as avg_budget_variance
                FROM users u
                LEFT JOIN projects p ON u.id = p.assigned_to
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                WHERE u.role IN ('project_manager', 'rpa_developer', 'rpa_operations') 
                GROUP BY u.id, u.full_name, u.role
                HAVING total_projects > 0
                ORDER BY avg_completion DESC, avg_satisfaction DESC
            `);

            // 7. Quality Metrics
            const qualityMetrics = await db.query(`
                SELECT 
                    p.name as project_name,
                    p.id as project_id,
                    pm.bugs_found,
                    pm.bugs_resolved,
                    ROUND((pm.bugs_resolved * 1.0 / NULLIF(pm.bugs_found, 0)) * 100, 1) as resolution_rate,
                    pm.client_satisfaction_score,
                    pm.completion_percentage,
                    CASE 
                        WHEN pm.bugs_found = 0 THEN 'no_issues'
                        WHEN (pm.bugs_resolved * 1.0 / pm.bugs_found) >= 0.9 THEN 'excellent'
                        WHEN (pm.bugs_resolved * 1.0 / pm.bugs_found) >= 0.7 THEN 'good'
                        WHEN (pm.bugs_resolved * 1.0 / pm.bugs_found) >= 0.5 THEN 'needs_attention'
                        ELSE 'critical'
                    END as quality_status,
                    u.full_name as project_manager
                FROM projects p
                JOIN project_pmo_metrics pm ON p.id = pm.project_id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.status IN ('active', 'completed')
                ORDER BY pm.client_satisfaction_score DESC, resolution_rate DESC
            `);

            // 8. Resource Utilization
            const resourceUtilization = await db.query(`
                SELECT 
                    u.full_name,
                    u.role,
                    COUNT(DISTINCT p.id) as assigned_projects,
                    SUM(pm.planned_hours) as total_planned_hours,
                    SUM(pm.actual_hours) as total_actual_hours,
                    ROUND(AVG(pm.team_velocity), 1) as avg_velocity,
                    ROUND((SUM(pm.actual_hours) / NULLIF(SUM(pm.planned_hours), 0)) * 100, 1) as utilization_percentage,
                    CASE 
                        WHEN (SUM(pm.actual_hours) / NULLIF(SUM(pm.planned_hours), 0)) > 1.2 THEN 'overutilized'
                        WHEN (SUM(pm.actual_hours) / NULLIF(SUM(pm.planned_hours), 0)) < 0.8 THEN 'underutilized'
                        ELSE 'optimal'
                    END as utilization_status
                FROM users u
                LEFT JOIN projects p ON u.id = p.assigned_to AND p.status IN ('active', 'completed')
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                WHERE u.role IN ('project_manager', 'rpa_developer', 'rpa_operations')
                GROUP BY u.id, u.full_name, u.role
                HAVING total_planned_hours > 0
                ORDER BY utilization_percentage DESC
            `);

            // 9. Client Satisfaction Trends (using project name as client reference)
            const satisfactionTrends = await db.query(`
                SELECT 
                    p.name as client_name,
                    COUNT(DISTINCT p.id) as total_projects,
                    ROUND(AVG(pm.client_satisfaction_score), 1) as avg_satisfaction,
                    COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_projects,
                    COUNT(DISTINCT CASE WHEN pm.schedule_variance_days <= 0 THEN p.id END) as on_time_deliveries,
                    COUNT(DISTINCT CASE WHEN pm.cost_variance_percentage <= 10 THEN p.id END) as on_budget_deliveries,
                    ROUND((COUNT(DISTINCT CASE WHEN pm.schedule_variance_days <= 0 THEN p.id END) * 100.0 / COUNT(DISTINCT p.id)), 1) as on_time_rate,
                    ROUND((COUNT(DISTINCT CASE WHEN pm.cost_variance_percentage <= 10 THEN p.id END) * 100.0 / COUNT(DISTINCT p.id)), 1) as on_budget_rate
                FROM projects p
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                WHERE p.name IS NOT NULL AND p.name != ''
                GROUP BY p.name
                HAVING total_projects > 0
                ORDER BY avg_satisfaction DESC, total_projects DESC
                LIMIT 10
            `);

            // 10. Risk Distribution Summary
            const riskDistribution = await db.query(`
                SELECT 
                    pm.risk_level,
                    COUNT(*) as project_count,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM project_pmo_metrics pm2 JOIN projects p2 ON pm2.project_id = p2.id WHERE p2.status = 'active'), 2) as percentage,
                    ROUND(AVG(pm.cost_variance_percentage), 1) as avg_budget_variance,
                    ROUND(AVG(pm.schedule_variance_days), 1) as avg_schedule_variance,
                    ROUND(AVG(pm.client_satisfaction_score), 1) as avg_satisfaction
                FROM project_pmo_metrics pm
                JOIN projects p ON pm.project_id = p.id
                WHERE p.status = 'active'
                GROUP BY pm.risk_level
                ORDER BY 
                    CASE pm.risk_level 
                        WHEN 'critical' THEN 1
                        WHEN 'high' THEN 2
                        WHEN 'medium' THEN 3
                        WHEN 'low' THEN 4
                    END
            `);

            res.json({
                executiveSummary,
                trendAnalysis,
                budgetAnalysis,
                scheduleAnalysis,
                riskAnalysis,
                teamAnalysis,
                qualityMetrics,
                resourceUtilization,
                satisfactionTrends,
                riskDistribution
            });
        } catch (error) {
            logger.error('Get PMO analytics error:', error);
            res.status(500).json({ error: 'Failed to get PMO analytics' });
        }
    };

    // GET /api/pmo/projects/:id/metrics - Project-specific PMO metrics
    getProjectPMOMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.id);

            if (!projectId) {
                res.status(400).json({ error: 'Invalid project ID' });
                return;
            }

            // Get project with PMO metrics
            const projectMetrics = await db.get(`
                SELECT 
                    p.id,
                    p.name,
                    p.description,
                    p.status,
                    p.priority,
                    p.start_date,
                    p.end_date,
                    p.budget,
                    u.full_name as assigned_to_name,
                    
                    -- PMO Metrics
                    pm.completion_percentage,
                    pm.schedule_variance_days,
                    pm.cost_variance_percentage,
                    pm.risk_level,
                    pm.planned_hours,
                    pm.actual_hours,
                    pm.planned_budget,
                    pm.actual_cost,
                    pm.team_velocity,
                    pm.bugs_found,
                    pm.bugs_resolved,
                    pm.client_satisfaction_score,
                    pm.last_updated as metrics_last_updated,
                    
                    -- Calculated metrics
                    CASE 
                        WHEN pm.schedule_variance_days > 5 OR pm.cost_variance_percentage > 20 OR pm.risk_level = 'critical' THEN 'critical'
                        WHEN pm.schedule_variance_days > 2 OR pm.cost_variance_percentage > 10 OR pm.risk_level = 'high' THEN 'warning'
                        ELSE 'healthy'
                    END as project_health_status,
                    
                    -- Days until deadline
                    CASE 
                        WHEN p.end_date IS NOT NULL THEN 
                            CAST((julianday(p.end_date) - julianday('now')) AS INTEGER)
                        ELSE NULL
                    END as days_to_deadline,
                    
                    -- Progress ratio
                    CASE 
                        WHEN pm.planned_hours > 0 THEN 
                            ROUND((pm.actual_hours * 100.0) / pm.planned_hours, 2)
                        ELSE NULL
                    END as hours_completion_ratio,
                    
                    -- Budget utilization
                    CASE 
                        WHEN pm.planned_budget > 0 THEN 
                            ROUND((pm.actual_cost * 100.0) / pm.planned_budget, 2)
                        ELSE NULL
                    END as budget_utilization_percentage

                FROM projects p
                LEFT JOIN project_pmo_metrics pm ON p.id = pm.project_id
                LEFT JOIN users u ON p.assigned_to = u.id
                WHERE p.id = ?
            `, [projectId]);

            if (!projectMetrics) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            // Get milestones for this project
            const milestones = await db.query(`
                SELECT 
                    id,
                    name as title,
                    description,
                    planned_date as due_date,
                    status,
                    actual_date as completion_date,
                    created_at
                FROM project_milestones 
                WHERE project_id = ?
                ORDER BY planned_date ASC
            `, [projectId]);

            // Get recent risks/alerts for this project
            const risks = await db.query(`
                SELECT 
                    'schedule_delay' as risk_type,
                    'Schedule Delay' as risk_title,
                    'Project is ' || ABS(pm.schedule_variance_days) || ' days behind schedule' as risk_description,
                    CASE 
                        WHEN pm.schedule_variance_days < -10 THEN 'critical'
                        WHEN pm.schedule_variance_days < -3 THEN 'high'
                        ELSE 'medium'
                    END as severity,
                    pm.last_updated as detected_date
                FROM project_pmo_metrics pm
                WHERE pm.project_id = ? AND pm.schedule_variance_days < -1
                
                UNION ALL
                
                SELECT 
                    'budget_overrun' as risk_type,
                    'Budget Overrun' as risk_title,
                    'Project is ' || ROUND(pm.cost_variance_percentage, 1) || '% over budget' as risk_description,
                    CASE 
                        WHEN pm.cost_variance_percentage > 25 THEN 'critical'
                        WHEN pm.cost_variance_percentage > 15 THEN 'high'
                        WHEN pm.cost_variance_percentage > 5 THEN 'medium'
                        ELSE 'low'
                    END as severity,
                    pm.last_updated as detected_date
                FROM project_pmo_metrics pm
                WHERE pm.project_id = ? AND pm.cost_variance_percentage > 5
                
                UNION ALL
                
                SELECT 
                    'quality_issues' as risk_type,
                    'Quality Concerns' as risk_title,
                    'High bug ratio: ' || pm.bugs_found || ' found, ' || pm.bugs_resolved || ' resolved' as risk_description,
                    CASE 
                        WHEN (pm.bugs_found - pm.bugs_resolved) > 10 THEN 'critical'
                        WHEN (pm.bugs_found - pm.bugs_resolved) > 5 THEN 'high'
                        ELSE 'medium'
                    END as severity,
                    pm.last_updated as detected_date
                FROM project_pmo_metrics pm
                WHERE pm.project_id = ? AND (pm.bugs_found - pm.bugs_resolved) > 3
                
                ORDER BY severity DESC, detected_date DESC
                LIMIT 10
            `, [projectId, projectId, projectId]);

            // Get team performance metrics
            const teamMetrics = await db.get(`
                SELECT 
                    COUNT(DISTINCT te.user_id) as team_size,
                    ROUND(AVG(te.hours), 2) as avg_daily_hours,
                    SUM(te.hours) as total_hours_logged,
                    COUNT(DISTINCT DATE(te.date)) as active_days
                FROM time_entries te
                JOIN projects p ON te.project_id = p.id
                WHERE te.project_id = ?
                    AND te.date >= datetime('now', '-30 days')
            `, [projectId]);

            // Calculate key performance indicators
            const kpis = {
                schedule_performance: projectMetrics.schedule_variance_days ? 
                    (projectMetrics.schedule_variance_days > 0 ? 'ahead' : 
                     projectMetrics.schedule_variance_days < -5 ? 'critical_delay' : 'minor_delay') : 'on_track',
                
                budget_performance: projectMetrics.cost_variance_percentage ? 
                    (projectMetrics.cost_variance_percentage > 15 ? 'critical_overrun' :
                     projectMetrics.cost_variance_percentage > 5 ? 'minor_overrun' : 'within_budget') : 'within_budget',
                
                quality_score: projectMetrics.bugs_found ? 
                    Math.max(0, 100 - ((projectMetrics.bugs_found - projectMetrics.bugs_resolved) * 10)) : 100,
                
                team_productivity: projectMetrics.team_velocity || 'N/A',
                
                client_satisfaction: projectMetrics.client_satisfaction_score || 'Not rated'
            };

            logger.info(`PMO metrics retrieved for project: ${projectMetrics.name} (ID: ${projectId})`);

            res.json({
                project: projectMetrics,
                milestones: {
                    total: milestones.length,
                    completed: milestones.filter((m: any) => m.status === 'completed').length,
                    upcoming: milestones.filter((m: any) => 
                        m.status !== 'completed' && new Date(m.due_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    ).length,
                    list: milestones
                },
                risks: risks,
                team: teamMetrics,
                kpis: kpis,
                alerts: risks.filter((r: any) => r.severity === 'critical' || r.severity === 'high')
            });

        } catch (error) {
            logger.error(`Get project PMO metrics error for project ${req.params.id}:`, error);
            res.status(500).json({ error: 'Failed to get project PMO metrics' });
        }
    };
}