import { db } from '../database/database';
import { financeService } from './financeService';
import { differenceInCalendarDays, addDays, format, parseISO } from 'date-fns';

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

        // SPI y CPI solo deben medirse contra el alcance que existía cuando se congeló el baseline:
        // budgeted_cost_clp y baseline_planned_date solo cubren esos hitos, así que promediar sobre
        // TODOS los hitos (incluyendo los agregados después del freeze, sin plan original) distorsionaría
        // el desempeño vs. lo planificado. ev_percentage (el campo público) sigue siendo el promedio
        // sobre todos los hitos actuales, para reflejar el avance real incluyendo crecimiento de alcance.
        const baselineEvPercentage = baselineMilestones.length > 0
            ? baselineMilestones.reduce((sum: number, m: any) => sum + (m.completion_percentage || 0), 0) / baselineMilestones.length
            : 0;

        const financials = await financeService.calculateProjectFinancials(projectId);
        // financeService usa 'projected' cuando no hay horas de timesheet aprobadas: en ese caso
        // real_cost es un placeholder (= planned_cost), no una medición real, y el CPI calculado a
        // partir de él no significa nada. Tratamos el costo como no disponible en ese escenario.
        const hasRealCostData = financials.real_hours_source === 'approved';
        const evDollars = (baselineEvPercentage / 100) * baseline.budgeted_cost_clp;

        const spi = pvPercentage > 0
            ? baselineEvPercentage / pvPercentage
            : (baselineEvPercentage > 0 ? 2 : 1);

        const cpi = hasRealCostData
            ? (financials.real_cost > 0 ? evDollars / financials.real_cost : (evDollars > 0 ? 2 : 1))
            : null;

        const project = await db.get(`SELECT status, actual_end_date FROM projects WHERE id = ?`, [projectId]);

        let projectedEndDate: string;
        let scheduleVarianceDays: number;

        if (project?.status === 'completed' && project.actual_end_date) {
            projectedEndDate = project.actual_end_date;
            scheduleVarianceDays = differenceInCalendarDays(
                parseISO(project.actual_end_date),
                parseISO(baseline.end_date)
            );
        } else {
            const baselineDurationDays = differenceInCalendarDays(
                parseISO(baseline.end_date),
                parseISO(baseline.start_date)
            );
            const effectiveSpi = Math.max(spi, 0.01);
            const projectedDurationDays = Math.round(baselineDurationDays / effectiveSpi);
            const projectedEnd = addDays(parseISO(baseline.start_date), projectedDurationDays);
            projectedEndDate = format(projectedEnd, 'yyyy-MM-dd');
            scheduleVarianceDays = differenceInCalendarDays(projectedEnd, parseISO(baseline.end_date));
        }

        return {
            project_id: projectId,
            has_baseline: true,
            status: 'ok',
            ev_percentage: Math.round(evPercentage * 100) / 100,
            pv_percentage: Math.round(pvPercentage * 100) / 100,
            spi: Math.round(spi * 100) / 100,
            cpi: cpi !== null ? Math.round(cpi * 100) / 100 : null,
            semaphore: this.classifySemaphore(spi, cpi),
            projected_end_date: projectedEndDate,
            schedule_variance_days: scheduleVarianceDays
        };
    }

    private classifySemaphore(spi: number, cpi: number | null): 'green' | 'yellow' | 'red' {
        const classify = (value: number): 'green' | 'yellow' | 'red' =>
            value >= 1.0 ? 'green' : value >= 0.9 ? 'yellow' : 'red';

        if (cpi === null) {
            return classify(spi);
        }

        const scheduleColor = classify(spi);
        const costColor = classify(cpi);

        if (scheduleColor === 'red' || costColor === 'red') return 'red';
        if (scheduleColor === 'yellow' || costColor === 'yellow') return 'yellow';
        return 'green';
    }
}

export const projectHealthService = new ProjectHealthService();
