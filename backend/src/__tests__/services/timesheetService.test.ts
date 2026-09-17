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

import { db } from '../../database/database';
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
    });
});
