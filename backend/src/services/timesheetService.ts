import { startOfWeek, addDays, format, parseISO } from 'date-fns';
import { db } from '../database/database';
import { logger } from '../utils/logger';

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
}

export const timesheetService = new TimesheetService();
