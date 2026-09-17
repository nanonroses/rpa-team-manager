import { startOfWeek, addDays, format, parseISO } from 'date-fns';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { financeService, Currency } from './financeService';

export interface TimeEntryRow {
    id: number;
    project_id: number;
    project_name: string;
    task_id: number | null;
    task_title: string | null;
    description: string | null;
    hours: number;
    date: string;
    is_billable: boolean;
    approval_status: 'draft' | 'submitted' | 'approved' | 'rejected';
    is_locked: boolean;
}

export interface TimesheetWeekDay {
    date: string;
    entries: TimeEntryRow[];
    total_hours: number;
}

export interface TimesheetPeriodRow {
    id: number;
    user_id: number;
    period_start: string;
    period_end: string;
    status: 'open' | 'submitted' | 'approved' | 'rejected';
    submitted_at: string | null;
    approved_by: number | null;
    approved_at: string | null;
    rejection_reason: string | null;
}

export interface TimesheetWeek {
    period: TimesheetPeriodRow | null;
    days: TimesheetWeekDay[];
    total_hours: number;
}

export interface SaveWeekEntryInput {
    id?: number;
    project_id: number;
    task_id?: number | null;
    description?: string | null;
    date: string;
    hours: number;
    is_billable?: boolean;
}

function toRow(raw: any): TimeEntryRow {
    return {
        id: raw.id,
        project_id: raw.project_id,
        project_name: raw.project_name,
        task_id: raw.task_id,
        task_title: raw.task_title,
        description: raw.description,
        hours: raw.hours,
        date: raw.date,
        is_billable: !!raw.is_billable,
        approval_status: raw.approval_status,
        is_locked: !!raw.is_locked
    };
}

/**
 * Grilla semanal de horas: única fuente para leer/escribir la semana de un usuario.
 * time_entries sigue siendo la tabla de datos; este servicio agrega por semana,
 * gestiona el ciclo de vida de timesheet_periods (Task 3) y las métricas derivadas (Task 5/6).
 */
export class TimesheetService {
    /** Lunes (yyyy-MM-dd) de la semana que contiene anyDateInWeek. */
    getWeekStart(anyDateInWeek: string): string {
        const monday = startOfWeek(parseISO(anyDateInWeek), { weekStartsOn: 1 });
        return format(monday, 'yyyy-MM-dd');
    }

    private getWeekEnd(weekStartDate: string): string {
        return format(addDays(parseISO(weekStartDate), 6), 'yyyy-MM-dd');
    }

    async getPeriod(userId: number, weekStartDate: string): Promise<TimesheetPeriodRow | null> {
        const row = await db.get(
            `SELECT * FROM timesheet_periods WHERE user_id = ? AND period_start = ?`,
            [userId, weekStartDate]
        );
        return row || null;
    }

    async getWeek(userId: number, weekStartDate: string): Promise<TimesheetWeek> {
        const monday = this.getWeekStart(weekStartDate);
        const sunday = this.getWeekEnd(monday);

        const [period, rawRows] = await Promise.all([
            this.getPeriod(userId, monday),
            db.query(
                `SELECT te.id, te.project_id, p.name as project_name, te.task_id, t.title as task_title,
                        te.description, te.hours, te.date, te.is_billable, te.approval_status, te.is_locked
                 FROM time_entries te
                 JOIN projects p ON p.id = te.project_id
                 LEFT JOIN tasks t ON t.id = te.task_id
                 WHERE te.user_id = ? AND te.date >= ? AND te.date <= ?
                 ORDER BY te.date ASC, te.created_at ASC`,
                [userId, monday, sunday]
            )
        ]);

        const rows = rawRows.map(toRow);
        const days: TimesheetWeekDay[] = [];
        let totalHours = 0;

        for (let i = 0; i < 7; i++) {
            const date = format(addDays(parseISO(monday), i), 'yyyy-MM-dd');
            const entries = rows.filter(r => r.date === date);
            const dayTotal = entries.reduce((sum, e) => sum + e.hours, 0);
            totalHours += dayTotal;
            days.push({ date, entries, total_hours: dayTotal });
        }

        return { period, days, total_hours: totalHours };
    }

    /**
     * Reemplaza el conjunto de entradas de la semana por el payload recibido (semántica de
     * "estado completo de la semana", igual que la grilla lo edita en el frontend): lo que
     * ya existía y no viene en el payload se borra, lo que trae `id` se actualiza, el resto se inserta.
     * Crea el timesheet_period en 'open' si es la primera vez que se guarda algo en esa semana.
     */
    async saveWeekEntries(userId: number, weekStartDate: string, entries: SaveWeekEntryInput[]): Promise<TimesheetWeek> {
        const monday = this.getWeekStart(weekStartDate);
        const sunday = this.getWeekEnd(monday);

        const existingPeriod = await this.getPeriod(userId, monday);
        if (existingPeriod && (existingPeriod.status === 'submitted' || existingPeriod.status === 'approved')) {
            throw new Error(`Timesheet week is locked (status=${existingPeriod.status})`);
        }

        await db.beginTransaction();
        try {
            let periodId = existingPeriod?.id;
            if (!periodId) {
                const created = await db.run(
                    `INSERT INTO timesheet_periods (user_id, period_start, period_end, status) VALUES (?, ?, ?, 'open')`,
                    [userId, monday, sunday]
                );
                periodId = created.id!;
            } else if (existingPeriod!.status === 'rejected') {
                await db.run(`UPDATE timesheet_periods SET status = 'open', rejection_reason = NULL WHERE id = ?`, [periodId]);
            }

            const existingIdsRows = await db.query(
                `SELECT id FROM time_entries WHERE user_id = ? AND date >= ? AND date <= ?`,
                [userId, monday, sunday]
            );
            const existingIds = new Set(existingIdsRows.map((r: any) => r.id));
            const keptIds = new Set(entries.filter(e => e.id).map(e => e.id));

            for (const id of existingIds) {
                if (!keptIds.has(id)) {
                    await db.run(`DELETE FROM time_entries WHERE id = ?`, [id]);
                }
            }

            for (const entry of entries) {
                if (entry.id) {
                    await db.run(
                        `UPDATE time_entries
                         SET project_id = ?, task_id = ?, description = ?, hours = ?, date = ?,
                             is_billable = ?, timesheet_period_id = ?, updated_at = CURRENT_TIMESTAMP
                         WHERE id = ? AND user_id = ?`,
                        [
                            entry.project_id, entry.task_id ?? null, entry.description ?? null, entry.hours, entry.date,
                            entry.is_billable === false ? 0 : 1, periodId, entry.id, userId
                        ]
                    );
                } else {
                    await db.run(
                        `INSERT INTO time_entries (
                            user_id, project_id, task_id, description, hours, date, is_billable,
                            approval_status, timesheet_period_id, created_at, updated_at
                         ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [
                            userId, entry.project_id, entry.task_id ?? null, entry.description ?? null,
                            entry.hours, entry.date, entry.is_billable === false ? 0 : 1, periodId
                        ]
                    );
                }
            }

            await db.commit();
        } catch (error) {
            await db.rollback();
            logger.error('saveWeekEntries failed, rolled back:', error);
            throw error;
        }

        return this.getWeek(userId, monday);
    }

    async submitWeek(userId: number, weekStartDate: string): Promise<TimesheetPeriodRow> {
        const monday = this.getWeekStart(weekStartDate);
        const period = await this.getPeriod(userId, monday);

        if (!period) {
            throw new Error('No timesheet period found for that week (nothing was saved yet)');
        }
        if (period.status === 'approved') {
            throw new Error('This week was already approved and cannot be re-submitted');
        }

        await db.run(
            `UPDATE timesheet_periods SET status = 'submitted', submitted_at = datetime('now'), rejection_reason = NULL WHERE id = ?`,
            [period.id]
        );
        await db.run(
            `UPDATE time_entries SET approval_status = 'submitted' WHERE timesheet_period_id = ?`,
            [period.id]
        );

        logger.info(`Timesheet: usuario ${userId} envió la semana del ${monday} para aprobación`);
        return { ...period, status: 'submitted' };
    }

    async getPendingApprovals(): Promise<Array<TimesheetPeriodRow & { user_name: string; total_hours: number }>> {
        return db.query(
            `SELECT tp.*, u.full_name as user_name,
                    COALESCE((SELECT SUM(hours) FROM time_entries WHERE timesheet_period_id = tp.id), 0) as total_hours
             FROM timesheet_periods tp
             JOIN users u ON u.id = tp.user_id
             WHERE tp.status = 'submitted'
             ORDER BY tp.submitted_at ASC`
        );
    }

    private async getUserCostRateCLP(userId: number): Promise<number> {
        const rate = await db.get(
            `SELECT hourly_rate, hourly_rate_currency FROM user_cost_rates
             WHERE user_id = ? AND is_active = 1 ORDER BY effective_from DESC LIMIT 1`,
            [userId]
        );
        if (!rate) return 0;
        return financeService.toCLP(rate.hourly_rate, rate.hourly_rate_currency as Currency);
    }

    private async getProjectBillRateCLP(projectId: number): Promise<number> {
        const financials = await db.get(
            `SELECT hourly_rate, hourly_rate_currency FROM project_financials WHERE project_id = ?`,
            [projectId]
        );
        if (!financials?.hourly_rate) return 0;
        return financeService.toCLP(financials.hourly_rate, (financials.hourly_rate_currency as Currency) || 'UF');
    }

    /**
     * Aprueba una semana: congela cost_rate_snapshot/bill_rate_snapshot (siempre en CLP, al valor
     * vigente hoy) por cada entrada y las bloquea (is_locked=1). Desde este momento financeService
     * usa estas horas como real_hours/real_cost del proyecto (ver Task 4) - por eso el snapshot
     * se congela aquí y no se recalcula nunca más, ni si cambia la tarifa del usuario a futuro.
     * Toda la operación es transaccional (all-or-nothing).
     */
    async approveWeek(approverId: number, periodId: number): Promise<TimesheetPeriodRow> {
        const period = await db.get(`SELECT * FROM timesheet_periods WHERE id = ?`, [periodId]);
        if (!period) {
            throw new Error(`Timesheet period ${periodId} not found`);
        }
        if (period.status !== 'submitted') {
            throw new Error(`Timesheet period ${periodId} is not submitted (status=${period.status})`);
        }

        const userCostRateCLP = await this.getUserCostRateCLP(period.user_id);
        const entries = await db.query(
            `SELECT id, project_id, hours, is_billable FROM time_entries WHERE timesheet_period_id = ?`,
            [periodId]
        );

        await db.beginTransaction();
        try {
            for (const entry of entries) {
                const billRateCLP = entry.is_billable ? await this.getProjectBillRateCLP(entry.project_id) : 0;
                await db.run(
                    `UPDATE time_entries
                     SET approval_status = 'approved', is_locked = 1, approved_by = ?, approved_at = datetime('now'),
                         cost_rate_snapshot = ?, bill_rate_snapshot = ?
                     WHERE id = ?`,
                    [approverId, userCostRateCLP, billRateCLP, entry.id]
                );
            }

            await db.run(
                `UPDATE timesheet_periods SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?`,
                [approverId, periodId]
            );

            await db.commit();
        } catch (error) {
            await db.rollback();
            logger.error('approveWeek failed, rolled back:', error);
            throw error;
        }

        logger.info(`Timesheet: periodo ${periodId} (usuario ${period.user_id}) aprobado por ${approverId} - ${entries.length} entrada(s) bloqueada(s)`);
        return { ...period, status: 'approved', approved_by: approverId };
    }

    async rejectWeek(approverId: number, periodId: number, reason: string): Promise<TimesheetPeriodRow> {
        const period = await db.get(`SELECT * FROM timesheet_periods WHERE id = ?`, [periodId]);
        if (!period) {
            throw new Error(`Timesheet period ${periodId} not found`);
        }
        if (period.status !== 'submitted') {
            throw new Error(`Timesheet period ${periodId} cannot be rejected (status=${period.status})`);
        }

        await db.run(
            `UPDATE timesheet_periods SET status = 'rejected', rejection_reason = ?, approved_by = ? WHERE id = ?`,
            [reason, approverId, periodId]
        );
        await db.run(`UPDATE time_entries SET approval_status = 'rejected' WHERE timesheet_period_id = ?`, [periodId]);

        logger.info(`Timesheet: periodo ${periodId} (usuario ${period.user_id}) rechazado por ${approverId}: ${reason}`);
        return { ...period, status: 'rejected', rejection_reason: reason };
    }
}

export const timesheetService = new TimesheetService();
