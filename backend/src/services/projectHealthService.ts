import { db } from '../database/database';
import { financeService } from './financeService';
import { differenceInCalendarDays, addDays, format } from 'date-fns';

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

export interface ProjectHealth {
    project_id: number;
    has_baseline: boolean;
    status: 'insufficient_data' | 'ok';
    ev_percentage: number;
    pv_percentage: number | null;
    spi: number | null;
    cpi: number | null;
    semaphore: 'green' | 'yellow' | 'red' | 'gray';
    projected_end_date: string | null;
    schedule_variance_days: number | null;
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

    async getProjectHealth(projectId: number): Promise<ProjectHealth> {
        const milestones = await db.query(
            `SELECT completion_percentage, baseline_planned_date FROM project_milestones WHERE project_id = ?`,
            [projectId]
        );

        const evPercentage = milestones.length > 0
            ? milestones.reduce((sum: number, m: any) => sum + (m.completion_percentage || 0), 0) / milestones.length
            : 0;

        const baseline = await db.get(`SELECT * FROM project_baselines WHERE project_id = ?`, [projectId]);
        const baselineMilestones = milestones.filter((m: any) => m.baseline_planned_date !== null);

        if (!baseline || baselineMilestones.length === 0) {
            return {
                project_id: projectId,
                has_baseline: !!baseline,
                status: 'insufficient_data',
                ev_percentage: Math.round(evPercentage * 100) / 100,
                pv_percentage: null,
                spi: null,
                cpi: null,
                semaphore: 'gray',
                projected_end_date: null,
                schedule_variance_days: null
            };
        }

        const today = format(new Date(), 'yyyy-MM-dd');
        const dueCount = baselineMilestones.filter((m: any) => m.baseline_planned_date <= today).length;
        const pvPercentage = (dueCount / baselineMilestones.length) * 100;

        const financials = await financeService.calculateProjectFinancials(projectId);
        const evDollars = (evPercentage / 100) * baseline.budgeted_cost_clp;

        const spi = pvPercentage > 0
            ? evPercentage / pvPercentage
            : (evPercentage > 0 ? 2 : 1);

        const cpi = financials.real_cost > 0
            ? evDollars / financials.real_cost
            : (evDollars > 0 ? 2 : 1);

        const project = await db.get(`SELECT status, actual_end_date FROM projects WHERE id = ?`, [projectId]);

        let projectedEndDate: string;
        let scheduleVarianceDays: number;

        if (project?.status === 'completed' && project.actual_end_date) {
            projectedEndDate = project.actual_end_date;
            scheduleVarianceDays = differenceInCalendarDays(
                new Date(project.actual_end_date),
                new Date(baseline.end_date)
            );
        } else {
            const baselineDurationDays = differenceInCalendarDays(
                new Date(baseline.end_date),
                new Date(baseline.start_date)
            );
            const effectiveSpi = Math.max(spi, 0.01);
            const projectedDurationDays = Math.round(baselineDurationDays / effectiveSpi);
            const projectedEnd = addDays(new Date(baseline.start_date), projectedDurationDays);
            projectedEndDate = format(projectedEnd, 'yyyy-MM-dd');
            scheduleVarianceDays = differenceInCalendarDays(projectedEnd, new Date(baseline.end_date));
        }

        return {
            project_id: projectId,
            has_baseline: true,
            status: 'ok',
            ev_percentage: Math.round(evPercentage * 100) / 100,
            pv_percentage: Math.round(pvPercentage * 100) / 100,
            spi: Math.round(spi * 100) / 100,
            cpi: Math.round(cpi * 100) / 100,
            semaphore: this.classifySemaphore(spi, cpi),
            projected_end_date: projectedEndDate,
            schedule_variance_days: scheduleVarianceDays
        };
    }

    private classifySemaphore(spi: number, cpi: number): 'green' | 'yellow' | 'red' {
        const classify = (value: number): 'green' | 'yellow' | 'red' =>
            value >= 1.0 ? 'green' : value >= 0.9 ? 'yellow' : 'red';

        const scheduleColor = classify(spi);
        const costColor = classify(cpi);

        if (scheduleColor === 'red' || costColor === 'red') return 'red';
        if (scheduleColor === 'yellow' || costColor === 'yellow') return 'yellow';
        return 'green';
    }
}

export const projectHealthService = new ProjectHealthService();
