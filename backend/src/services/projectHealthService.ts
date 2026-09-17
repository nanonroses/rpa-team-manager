import { db } from '../database/database';
import { financeService } from './financeService';

export interface ProjectBaseline {
    id: number;
    project_id: number;
    baseline_date: string;
    start_date: string;
    end_date: string;
    budgeted_cost_clp: number;
    budgeted_hours: number;
    created_by: number;
    created_at: string;
}

/**
 * Única fuente de verdad para el baseline y la salud (SPI/CPI/semáforo) de un proyecto.
 * El baseline se congela una sola vez (inmutable); la salud se recalcula siempre en vivo.
 */
export class ProjectHealthService {
    async freezeBaseline(projectId: number, userId: number): Promise<ProjectBaseline> {
        const project = await db.get(
            `SELECT id, start_date, end_date FROM projects WHERE id = ?`,
            [projectId]
        );
        if (!project) {
            throw new Error('PROJECT_NOT_FOUND');
        }
        if (!project.start_date || !project.end_date) {
            throw new Error('PROJECT_MISSING_DATES');
        }

        const existing = await db.get(
            `SELECT id FROM project_baselines WHERE project_id = ?`,
            [projectId]
        );
        if (existing) {
            throw new Error('BASELINE_ALREADY_EXISTS');
        }

        const financials = await financeService.calculateProjectFinancials(projectId);

        await db.beginTransaction();
        try {
            await db.run(
                `INSERT INTO project_baselines (project_id, start_date, end_date, budgeted_cost_clp, budgeted_hours, created_by)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [projectId, project.start_date, project.end_date, financials.planned_cost, financials.planned_hours, userId]
            );

            await db.run(
                `UPDATE project_milestones SET baseline_planned_date = planned_date WHERE project_id = ?`,
                [projectId]
            );

            await db.commit();
        } catch (error) {
            await db.rollback();
            throw error;
        }

        return db.get(`SELECT * FROM project_baselines WHERE project_id = ?`, [projectId]);
    }
}

export const projectHealthService = new ProjectHealthService();
