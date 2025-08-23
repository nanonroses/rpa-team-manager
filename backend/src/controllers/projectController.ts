import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';

export class ProjectController {

    // GET /api/projects
    getProjects = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            let query = `
                SELECT p.*, 
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       COUNT(t.id) as total_tasks,
                       SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completed_tasks,
                       SUM(te.hours) as total_hours_logged
                FROM projects p
                LEFT JOIN users u1 ON p.created_by = u1.id
                LEFT JOIN users u2 ON p.assigned_to = u2.id
                LEFT JOIN task_boards tb ON p.id = tb.project_id
                LEFT JOIN tasks t ON tb.id = t.board_id
                LEFT JOIN time_entries te ON p.id = te.project_id
            `;

            const params: any[] = [];

            // Filter based on user role
            if (req.user?.role === 'rpa_developer') {
                query += ' WHERE (p.assigned_to = ? OR p.created_by = ?)';
                params.push(req.user.id, req.user.id);
            }

            query += ' GROUP BY p.id ORDER BY p.created_at DESC';

            const projects = await db.query(query, params);

            // Calculate progress percentage for each project
            const projectsWithProgress = projects.map(project => ({
                ...project,
                progress_percentage: project.total_tasks > 0 
                    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
                    : 0,
                total_hours_logged: project.total_hours_logged || 0
            }));

            res.json(projectsWithProgress);
        } catch (error) {
            logger.error('Get projects error:', error);
            res.status(500).json({ error: 'Failed to get projects' });
        }
    };

    // GET /api/projects/:id
    getProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            const project = await db.get(`
                SELECT p.*, 
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       pf.budget_allocated,
                       pf.budget_spent,
                       pf.hours_budgeted,
                       pf.hours_spent,
                       pf.delay_cost,
                       pf.penalty_cost,
                       pf.sale_price
                FROM projects p
                LEFT JOIN users u1 ON p.created_by = u1.id
                LEFT JOIN users u2 ON p.assigned_to = u2.id
                LEFT JOIN project_financials pf ON p.id = pf.project_id
                WHERE p.id = ?
            `, [id]);

            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            // Check access permissions
            if (req.user?.role === 'rpa_developer' && 
                project.assigned_to !== req.user.id && 
                project.created_by !== req.user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Get project tasks summary
            const tasksSummary = await db.query(`
                SELECT 
                    t.status,
                    COUNT(*) as count,
                    SUM(t.estimated_hours) as estimated_hours,
                    SUM(t.actual_hours) as actual_hours
                FROM task_boards tb
                JOIN tasks t ON tb.id = t.board_id
                WHERE tb.project_id = ?
                GROUP BY t.status
            `, [id]);

            // Get recent activities
            const recentActivities = await db.query(`
                SELECT 
                    al.*,
                    u.full_name as user_name
                FROM activity_log al
                LEFT JOIN users u ON al.user_id = u.id
                WHERE al.entity_type = 'project' AND al.entity_id = ?
                ORDER BY al.created_at DESC
                LIMIT 10
            `, [id]);

            res.json({
                ...project,
                tasks_summary: tasksSummary,
                recent_activities: recentActivities
            });
        } catch (error) {
            logger.error('Get project error:', error);
            res.status(500).json({ error: 'Failed to get project' });
        }
    };

    // POST /api/projects
    createProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { 
                name, 
                description, 
                status = 'planning',
                priority = 'medium',
                budget,
                start_date,
                end_date,
                assigned_to
            } = req.body;

            // Debug logging
            logger.info('Creating project with data:', {
                name, description, status, priority, budget, start_date, end_date, assigned_to,
                user_id: req.user?.id,
                user_role: req.user?.role
            });

            if (!name) {
                res.status(400).json({ error: 'Project name is required' });
                return;
            }

            // Validate assigned_to user exists if provided
            if (assigned_to) {
                const assignedUser = await db.get('SELECT id FROM users WHERE id = ?', [assigned_to]);
                if (!assignedUser) {
                    logger.error(`Assigned user ${assigned_to} does not exist`);
                    res.status(400).json({ error: `Assigned user with ID ${assigned_to} does not exist` });
                    return;
                }
            }

            // Create project
            const result = await db.run(`
                INSERT INTO projects (
                    name, description, status, priority, budget, 
                    start_date, end_date, assigned_to, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [name, description, status, priority, budget, start_date, end_date, assigned_to || null, req.user?.id]);

            const projectId = result.id!;

            // Create default financial record
            if (budget) {
                await db.run(`
                    INSERT INTO project_financials (
                        project_id, budget_allocated, hours_budgeted
                    ) VALUES (?, ?, ?)
                `, [projectId, budget, 0]);
            }

            // Create default task board
            const boardResult = await db.run(`
                INSERT INTO task_boards (
                    project_id, name, description, board_type, is_default
                ) VALUES (?, ?, ?, 'kanban', 1)
            `, [projectId, `${name} Board`, `Main kanban board for ${name}`]);

            const boardId = boardResult.id!;

            // Create default columns
            const defaultColumns = [
                { name: 'Backlog', position: 1, color: '#gray', is_done: 0 },
                { name: 'To Do', position: 2, color: '#blue', is_done: 0 },
                { name: 'In Progress', position: 3, color: '#yellow', is_done: 0, wip_limit: 3 },
                { name: 'Review', position: 4, color: '#orange', is_done: 0 },
                { name: 'Testing', position: 5, color: '#purple', is_done: 0 },
                { name: 'Done', position: 6, color: '#green', is_done: 1 }
            ];

            for (const column of defaultColumns) {
                await db.run(`
                    INSERT INTO task_columns (
                        board_id, name, position, color, is_done_column, wip_limit
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [boardId, column.name, column.position, column.color, column.is_done, column.wip_limit || null]);
            }

            // Log activity
            await this.logActivity(
                req.user?.id,
                'project',
                projectId,
                'created',
                null,
                { name, status, priority }
            );

            // Get the created project with details
            const createdProject = await db.get(`
                SELECT p.*, u.full_name as created_by_name
                FROM projects p
                LEFT JOIN users u ON p.created_by = u.id
                WHERE p.id = ?
            `, [projectId]);

            res.status(201).json(createdProject);
        } catch (error) {
            logger.error('Create project error:', error);
            res.status(500).json({ error: 'Failed to create project' });
        }
    };

    // PUT /api/projects/:id
    updateProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            console.log('Received update request for project:', id);
            console.log('Update data received:', updates);

            // Get current project
            const currentProject = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
            if (!currentProject) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            // Check permissions
            if (req.user?.role === 'rpa_developer' && 
                currentProject.created_by !== req.user.id && 
                currentProject.assigned_to !== req.user.id) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            // Build update query dynamically
            const allowedFields = [
                'name', 'description', 'status', 'priority', 'budget',
                'start_date', 'end_date', 'actual_start_date', 'actual_end_date',
                'assigned_to', 'progress_percentage'
            ];

            const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
            
            if (updateFields.length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }

            const setClause = updateFields.map(field => `${field} = ?`).join(', ');
            const values = updateFields.map(field => updates[field]);
            values.push(id);

            await db.run(`
                UPDATE projects 
                SET ${setClause}, updated_at = datetime('now')
                WHERE id = ?
            `, values);

            // Update financial information if financial fields changed
            if (updates.budget || updates.sale_price || updates.hours_budgeted) {
                console.log('Updating financial data:', {
                    project_id: id,
                    budget: updates.budget,
                    sale_price: updates.sale_price,
                    hours_budgeted: updates.hours_budgeted
                });
                
                // First, delete any existing financial records for this project
                await db.run(`DELETE FROM project_financials WHERE project_id = ?`, [id]);
                
                // Then, insert the new financial data
                await db.run(`
                    INSERT INTO project_financials (
                        project_id, 
                        budget_allocated, 
                        sale_price, 
                        hours_budgeted,
                        updated_at
                    ) VALUES (?, ?, ?, ?, datetime('now'))
                `, [
                    id, 
                    updates.budget || null, 
                    updates.sale_price || null, 
                    updates.hours_budgeted || null
                ]);
            }

            // Log activity
            await this.logActivity(
                req.user?.id,
                'project',
                parseInt(id),
                'updated',
                currentProject,
                updates
            );

            // Get updated project with financial data
            const updatedProject = await db.get(`
                SELECT p.*, 
                       u1.full_name as created_by_name,
                       u2.full_name as assigned_to_name,
                       pf.budget_allocated,
                       pf.budget_spent,
                       pf.hours_budgeted,
                       pf.hours_spent,
                       pf.delay_cost,
                       pf.penalty_cost,
                       pf.sale_price
                FROM projects p
                LEFT JOIN users u1 ON p.created_by = u1.id
                LEFT JOIN users u2 ON p.assigned_to = u2.id
                LEFT JOIN project_financials pf ON p.id = pf.project_id
                WHERE p.id = ?
            `, [id]);

            res.json(updatedProject);
        } catch (error) {
            logger.error('Update project error:', error);
            res.status(500).json({ error: 'Failed to update project' });
        }
    };

    // DELETE /api/projects/:id
    deleteProject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            // Only team leads can delete projects
            if (req.user?.role !== 'team_lead') {
                res.status(403).json({ error: 'Only team leads can delete projects' });
                return;
            }

            const project = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            // Delete project (cascading deletes will handle related records)
            await db.run('DELETE FROM projects WHERE id = ?', [id]);

            // Log activity
            await this.logActivity(
                req.user?.id,
                'project',
                parseInt(id),
                'deleted',
                project,
                null
            );

            res.json({ message: 'Project deleted successfully' });
        } catch (error) {
            logger.error('Delete project error:', error);
            res.status(500).json({ error: 'Failed to delete project' });
        }
    };

    // GET /api/projects/:id/gantt
    getProjectGantt = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;

            // Get all tasks for the project with dependencies
            const tasks = await db.query(`
                SELECT 
                    t.*,
                    u.full_name as assignee_name,
                    tc.name as column_name
                FROM task_boards tb
                JOIN tasks t ON tb.id = t.board_id
                LEFT JOIN users u ON t.assignee_id = u.id
                LEFT JOIN task_columns tc ON t.column_id = tc.id
                WHERE tb.project_id = ?
                ORDER BY t.start_date ASC, t.created_at ASC
            `, [id]);

            // Get dependencies
            const dependencies = await db.query(`
                SELECT 
                    td.*,
                    t1.title as predecessor_title,
                    t2.title as successor_title
                FROM task_dependencies td
                JOIN tasks t1 ON td.predecessor_id = t1.id
                JOIN tasks t2 ON td.successor_id = t2.id
                JOIN task_boards tb1 ON t1.board_id = tb1.id
                JOIN task_boards tb2 ON t2.board_id = tb2.id
                WHERE tb1.project_id = ? OR tb2.project_id = ?
            `, [id, id]);

            res.json({
                tasks: tasks,
                dependencies: dependencies
            });
        } catch (error) {
            logger.error('Get project Gantt error:', error);
            res.status(500).json({ error: 'Failed to get project Gantt data' });
        }
    };

    private async logActivity(
        userId: number | undefined,
        entityType: string,
        entityId: number,
        action: string,
        oldValues: any,
        newValues: any
    ): Promise<void> {
        try {
            await db.run(`
                INSERT INTO activity_log (
                    user_id, entity_type, entity_id, action, old_values, new_values
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                userId || null,
                entityType,
                entityId,
                action,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null
            ]);
        } catch (error) {
            logger.error('Failed to log activity:', error);
        }
    }

    // DEBUG: Temporary endpoint to check financial data
    debugFinancialData = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projects = await db.query(`
                SELECT 
                    p.id, 
                    p.name, 
                    pf.sale_price, 
                    pf.hours_budgeted,
                    pf.budget_allocated,
                    pf.updated_at as financial_updated
                FROM projects p 
                LEFT JOIN project_financials pf ON p.id = pf.project_id 
                ORDER BY p.id
            `);
            
            res.json(projects);
        } catch (error) {
            logger.error('Debug financial data error:', error);
            res.status(500).json({ error: 'Failed to get debug data' });
        }
    };

    // Clean duplicate financial records (keep only the latest one per project)
    cleanDuplicateFinancials = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            // Get count before cleaning
            const beforeCount = await db.get(`SELECT COUNT(*) as count FROM project_financials`);
            
            // Delete duplicates, keeping only the latest record per project
            await db.run(`
                DELETE FROM project_financials 
                WHERE id NOT IN (
                    SELECT MAX(id) 
                    FROM project_financials 
                    GROUP BY project_id
                )
            `);
            
            // Get count after cleaning
            const afterCount = await db.get(`SELECT COUNT(*) as count FROM project_financials`);
            
            const deleted = beforeCount.count - afterCount.count;
            
            res.json({
                message: 'Duplicate financial records cleaned successfully',
                records_before: beforeCount.count,
                records_after: afterCount.count,
                records_deleted: deleted
            });
        } catch (error) {
            logger.error('Clean duplicate financials error:', error);
            res.status(500).json({ error: 'Failed to clean duplicate records' });
        }
    };
}