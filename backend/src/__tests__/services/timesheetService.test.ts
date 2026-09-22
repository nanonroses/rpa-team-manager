jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
    }
}));

jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));

import { db } from '../../database/database';
import { notificationService } from '../../services/notificationService';
import { TimesheetService } from '../../services/timesheetService';

describe('TimesheetService', () => {
    let timesheetService: TimesheetService;

    beforeEach(() => {
        jest.clearAllMocks();
        timesheetService = new TimesheetService();
    });

    describe('getWeekStart', () => {
        it('devuelve el lunes de la semana para cualquier día de esa semana', () => {
            expect(timesheetService.getWeekStart('2026-09-17')).toBe('2026-09-14'); // jueves -> lunes
            expect(timesheetService.getWeekStart('2026-09-14')).toBe('2026-09-14'); // ya es lunes
            expect(timesheetService.getWeekStart('2026-09-20')).toBe('2026-09-14'); // domingo -> lunes de esa misma semana
        });
    });

    describe('getWeek', () => {
        it('devuelve 7 días (lunes a domingo) con las entradas agrupadas por fecha', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM timesheet_periods')) return Promise.resolve(undefined);
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, project_id: 1, project_name: 'AGROSUPER', task_id: null, task_title: null, description: 'Dev', hours: 4, date: '2026-09-14', is_billable: 1, approval_status: 'draft', is_locked: 0 },
                { id: 2, project_id: 1, project_name: 'AGROSUPER', task_id: null, task_title: null, description: 'QA', hours: 2, date: '2026-09-14', is_billable: 1, approval_status: 'draft', is_locked: 0 },
                { id: 3, project_id: 2, project_name: 'PROMET', task_id: 5, task_title: 'Fix bug', description: null, hours: 3, date: '2026-09-16', is_billable: 0, approval_status: 'draft', is_locked: 0 }
            ]);

            const week = await timesheetService.getWeek(1, '2026-09-14');

            expect(week.days).toHaveLength(7);
            expect(week.days[0].date).toBe('2026-09-14');
            expect(week.days[6].date).toBe('2026-09-20');
            expect(week.days[0].entries).toHaveLength(2);
            expect(week.days[0].total_hours).toBe(6);
            expect(week.days[2].entries).toHaveLength(1);
            expect(week.total_hours).toBe(9);
            expect(week.period).toBeNull();
        });

        it('incluye el periodo si ya existe uno para esa semana', async () => {
            (db.get as jest.Mock).mockResolvedValue({
                id: 10, user_id: 1, period_start: '2026-09-14', period_end: '2026-09-20',
                status: 'submitted', submitted_at: '2026-09-18T10:00:00Z', approved_by: null, approved_at: null, rejection_reason: null
            });
            (db.query as jest.Mock).mockResolvedValue([]);

            const week = await timesheetService.getWeek(1, '2026-09-14');
            expect(week.period?.status).toBe('submitted');
        });
    });

    describe('saveWeekEntries', () => {
        it('rechaza si el periodo ya está submitted o approved', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'approved' });

            await expect(
                timesheetService.saveWeekEntries(1, '2026-09-14', [])
            ).rejects.toThrow('locked');

            expect(db.beginTransaction).not.toHaveBeenCalled();
        });

        it('crea el periodo (open) si no existe, borra las entradas quitadas e inserta/actualiza el resto', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM timesheet_periods')) return Promise.resolve(undefined);
                return Promise.resolve(undefined);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('SELECT id FROM time_entries')) {
                    return Promise.resolve([{ id: 1 }, { id: 2 }]); // entradas existentes de esa semana
                }
                return Promise.resolve([]);
            });

            await timesheetService.saveWeekEntries(1, '2026-09-14', [
                { id: 1, project_id: 1, date: '2026-09-14', hours: 4 },
                { project_id: 1, date: '2026-09-15', hours: 3 }
            ]);

            expect(db.beginTransaction).toHaveBeenCalled();
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO timesheet_periods'),
                expect.arrayContaining([1, '2026-09-14', '2026-09-20'])
            );
            // La entrada id=2 existía pero no vino en el payload -> se borra
            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM time_entries'), [2]);
            // id=1 se actualiza
            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE time_entries'), expect.arrayContaining([1]));
            // la nueva (sin id) se inserta
            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO time_entries'), expect.any(Array));
            expect(db.commit).toHaveBeenCalled();
        });

        it('hace rollback si una escritura falla', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockResolvedValue([]);
            (db.run as jest.Mock).mockRejectedValueOnce(new Error('boom'));

            await expect(
                timesheetService.saveWeekEntries(1, '2026-09-14', [{ project_id: 1, date: '2026-09-14', hours: 1 }])
            ).rejects.toThrow('boom');

            expect(db.rollback).toHaveBeenCalled();
        });

        it('rechaza y hace rollback si el UPDATE no afecta ninguna fila (entrada bloqueada, de otra semana o de otro usuario)', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockResolvedValue([]);
            (db.run as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('UPDATE time_entries')) return Promise.resolve({ changes: 0 });
                return Promise.resolve({ id: 99, changes: 1 });
            });

            await expect(
                timesheetService.saveWeekEntries(1, '2026-09-14', [
                    { id: 42, project_id: 1, date: '2026-09-14', hours: 4 }
                ])
            ).rejects.toThrow('could not be updated');

            expect(db.rollback).toHaveBeenCalled();
        });

        it('rechaza y hace rollback si una entrada trae una fecha fuera de la semana que se está guardando', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockResolvedValue([]);
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });

            await expect(
                timesheetService.saveWeekEntries(1, '2026-09-14', [
                    { project_id: 1, date: '2026-09-21', hours: 4 } // lunes de la semana siguiente
                ])
            ).rejects.toThrow('is outside the week being saved');

            expect(db.run).not.toHaveBeenCalled();
            expect(db.rollback).toHaveBeenCalled();
            expect(db.commit).not.toHaveBeenCalled();
        });

        it('rechaza y hace rollback si el DELETE no afecta ninguna fila (entrada bloqueada)', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('SELECT id FROM time_entries')) return Promise.resolve([{ id: 5 }]);
                return Promise.resolve([]);
            });
            (db.run as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('DELETE FROM time_entries')) return Promise.resolve({ changes: 0 });
                return Promise.resolve({ id: 99, changes: 1 });
            });

            await expect(
                timesheetService.saveWeekEntries(1, '2026-09-14', [])
            ).rejects.toThrow('could not be deleted');

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('is_locked = 0'),
                [5]
            );
            expect(db.rollback).toHaveBeenCalled();
        });

        it('excluye los timers en curso del barrido de borrado', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockResolvedValue([]);
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });

            await timesheetService.saveWeekEntries(1, '2026-09-14', []);

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining('NOT (start_time IS NOT NULL AND end_time IS NULL)'),
                [1, '2026-09-14', '2026-09-20']
            );
        });
    });

    describe('isDateLocked', () => {
        it('devuelve true si la fecha cae en un periodo enviado o aprobado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10 });
            await expect(timesheetService.isDateLocked(1, '2026-09-16')).resolves.toBe(true);
            expect(db.get).toHaveBeenCalledWith(
                expect.stringContaining("status IN ('submitted', 'approved')"),
                [1, '2026-09-16', '2026-09-16']
            );
        });

        it('devuelve false si no hay ningún periodo cerrado para esa fecha', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            await expect(timesheetService.isDateLocked(1, '2026-09-16')).resolves.toBe(false);
        });
    });

    describe('submitWeek', () => {
        it('marca el periodo y sus entradas como submitted', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            (db.query as jest.Mock).mockResolvedValue([]);

            const result = await timesheetService.submitWeek(1, '2026-09-14');

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE timesheet_periods SET status = 'submitted'"),
                expect.arrayContaining([10])
            );
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE time_entries SET approval_status = 'submitted'"),
                expect.arrayContaining([10])
            );
            expect(result.status).toBe('submitted');
        });

        it('adopta las entradas huérfanas de la semana antes de marcarlas como submitted', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            (db.query as jest.Mock).mockResolvedValue([]);

            await timesheetService.submitWeek(1, '2026-09-14');

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('timesheet_period_id IS NULL'),
                [10, 1, '2026-09-14', '2026-09-20']
            );
            const runCalls = (db.run as jest.Mock).mock.calls.map((c: any[]) => c[0] as string);
            const adoptIndex = runCalls.findIndex(sql => sql.includes('timesheet_period_id IS NULL'));
            const markIndex = runCalls.findIndex(sql => sql.includes("UPDATE time_entries SET approval_status = 'submitted'"));
            expect(adoptIndex).toBeGreaterThanOrEqual(0);
            expect(adoptIndex).toBeLessThan(markIndex);
        });

        it('rechaza si no hay periodo (semana vacía) para esa fecha', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            await expect(timesheetService.submitWeek(1, '2026-09-14')).rejects.toThrow('No timesheet period');
        });

        it('rechaza si el periodo ya fue aprobado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'approved' });
            await expect(timesheetService.submitWeek(1, '2026-09-14')).rejects.toThrow('already approved');
        });

        it('notifica timesheet_submitted a cada team_lead activo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1 }, { id: 2 }
            ]);

            await timesheetService.submitWeek(1, '2026-09-14');

            expect(db.query).toHaveBeenCalledWith(
                expect.stringContaining("role = 'team_lead'"),
                []
            );
            expect(notificationService.notify).toHaveBeenCalledTimes(2);
            expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
                userId: 1, eventKey: 'timesheet_submitted', entityType: 'timesheet_period', entityId: 10, senderId: 1
            }));
            expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
                userId: 2, eventKey: 'timesheet_submitted', entityType: 'timesheet_period', entityId: 10, senderId: 1
            }));
        });

        it('no notifica a nadie ni lanza si no hay ningún team_lead activo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            (db.query as jest.Mock).mockResolvedValue([]);

            await expect(timesheetService.submitWeek(1, '2026-09-14')).resolves.toEqual(
                expect.objectContaining({ status: 'submitted' })
            );
            expect(notificationService.notify).not.toHaveBeenCalled();
        });
    });

    describe('approveWeek', () => {
        it('bloquea las entradas y les congela cost_rate_snapshot y bill_rate_snapshot en CLP', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM timesheet_periods WHERE id')) {
                    return Promise.resolve({ id: 10, user_id: 1, status: 'submitted', period_start: '2026-09-14', period_end: '2026-09-20' });
                }
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, project_id: 1, hours: 4, is_billable: 1 }
            ]);
            jest.spyOn(timesheetService as any, 'getUserCostRateCLP').mockResolvedValue(15000);
            jest.spyOn(timesheetService as any, 'getProjectBillRateCLP').mockResolvedValue(20000);
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            const result = await timesheetService.approveWeek(2, 10);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('cost_rate_snapshot = ?, bill_rate_snapshot = ?'),
                expect.arrayContaining([15000, 20000, 1])
            );
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE timesheet_periods SET status = 'approved'"),
                expect.arrayContaining([2, 10])
            );
            expect(result.status).toBe('approved');
        });

        it('rechaza si el periodo no está submitted', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'open' });
            await expect(timesheetService.approveWeek(2, 10)).rejects.toThrow('not submitted');
        });

        it('se niega a aprobar (antes de abrir transacción) si el usuario no tiene tarifa de costo activa', async () => {
            (db.get as jest.Mock).mockResolvedValue({
                id: 10, user_id: 1, status: 'submitted', period_start: '2026-09-14', period_end: '2026-09-20'
            });
            jest.spyOn(timesheetService as any, 'getUserCostRateCLP').mockResolvedValue(0);

            await expect(timesheetService.approveWeek(2, 10)).rejects.toThrow('no active cost rate');

            expect(db.beginTransaction).not.toHaveBeenCalled();
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('rejectWeek', () => {
        it('marca el periodo y sus entradas como rejected con el motivo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'submitted' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            const result = await timesheetService.rejectWeek(2, 10, 'Faltan horas del jueves');

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE timesheet_periods SET status = 'rejected'"),
                expect.arrayContaining(['Faltan horas del jueves', 2, 10])
            );
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE time_entries SET approval_status = 'rejected'"),
                [10]
            );
            expect(result.status).toBe('rejected');
        });

        it('rechaza si el periodo ya está aprobado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10, status: 'approved' });
            await expect(timesheetService.rejectWeek(2, 10, 'Motivo')).rejects.toThrow('cannot be rejected');
        });
    });

    describe('getEffectivenessMetrics', () => {
        it('calcula estimado vs real por persona (con utilización y % facturable) y por tarea', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM global_settings')) return Promise.resolve({ setting_value: '176' });
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('GROUP BY te.user_id')) {
                    return Promise.resolve([
                        { user_id: 1, user_name: 'Dev Uno', real_hours: 80, billable_hours: 60 }
                    ]);
                }
                if (sql.includes('SUM(t.estimated_hours)') && sql.includes('assignee_id')) {
                    return Promise.resolve([{ user_id: 1, estimated_hours: 100 }]);
                }
                if (sql.includes('LEFT JOIN time_entries') && sql.includes('GROUP BY t.id')) {
                    return Promise.resolve([
                        { task_id: 5, task_title: 'Fix bug', project_name: 'PROMET', estimated_hours: 10, real_hours: 14 }
                    ]);
                }
                return Promise.resolve([]);
            });

            const metrics = await timesheetService.getEffectivenessMetrics('2026-09-01', '2026-09-30');

            expect(metrics.by_person[0]).toMatchObject({
                user_id: 1, user_name: 'Dev Uno', estimated_hours: 100, real_hours: 80, billable_pct: 75
            });
            expect(metrics.by_person[0].utilization_pct).toBeCloseTo((80 / 176) * 100, 1);
            expect(metrics.by_task[0]).toMatchObject({
                task_id: 5, task_title: 'Fix bug', project_name: 'PROMET',
                estimated_hours: 10, real_hours: 14, variance_hours: 4
            });
        });
    });

    describe('getPendingReminders', () => {
        it('devuelve los días hábiles de las últimas 2 semanas sin ninguna entrada', async () => {
            (db.query as jest.Mock).mockResolvedValue([{ date: '2026-09-15' }]); // solo el martes tiene registro
            (db.get as jest.Mock).mockResolvedValue(undefined); // sin periodo abierto

            const result = await timesheetService.getPendingReminders(1, '2026-09-17'); // jueves

            // Hábiles entre 2026-09-03 (jueves, 14 días antes) y 2026-09-17 inclusive, sin fines de semana,
            // excluyendo 2026-09-15 que sí tiene entrada.
            expect(result.missing_dates).not.toContain('2026-09-15');
            expect(result.missing_dates).toContain('2026-09-16');
            expect(result.missing_dates.length).toBeGreaterThan(0);
            expect(result.missing_dates.every((d: string) => {
                const day = new Date(`${d}T00:00:00Z`).getUTCDay();
                return day !== 0 && day !== 6;
            })).toBe(true);
        });
    });

    describe('logStartupPendingWorkSummary', () => {
        it('no lanza si no hay usuarios activos', async () => {
            (db.query as jest.Mock).mockResolvedValue([]);
            await expect(timesheetService.logStartupPendingWorkSummary()).resolves.toBeUndefined();
        });
    });
});
