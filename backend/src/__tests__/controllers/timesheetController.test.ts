jest.mock('../../services/timesheetService', () => ({
    timesheetService: {
        getWeek: jest.fn(),
        saveWeekEntries: jest.fn(),
        submitWeek: jest.fn(),
        getPendingApprovals: jest.fn(),
        approveWeek: jest.fn(),
        rejectWeek: jest.fn(),
        getEffectivenessMetrics: jest.fn(),
        getPendingReminders: jest.fn(),
    }
}));

import { timesheetService } from '../../services/timesheetService';
import { TimesheetController } from '../../controllers/timesheetController';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('TimesheetController', () => {
    let controller: TimesheetController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TimesheetController();
    });

    describe('getWeek', () => {
        it('usa el usuario autenticado y el week_start de query', async () => {
            (timesheetService.getWeek as jest.Mock).mockResolvedValue({ period: null, days: [], total_hours: 0 });
            const req: any = { query: { week_start: '2026-09-14' }, user: { id: 7, role: 'rpa_developer' } };
            const res = mockRes();

            await controller.getWeek(req, res);

            expect(timesheetService.getWeek).toHaveBeenCalledWith(7, '2026-09-14');
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('saveWeek', () => {
        it('devuelve 400 si la semana está bloqueada', async () => {
            (timesheetService.saveWeekEntries as jest.Mock).mockRejectedValue(new Error('Timesheet week is locked (status=approved)'));
            const req: any = { body: { week_start: '2026-09-14', entries: [] }, user: { id: 7, role: 'rpa_developer' } };
            const res = mockRes();

            await controller.saveWeek(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('approveWeek', () => {
        it('aprueba con el id de la ruta y el aprobador autenticado', async () => {
            (timesheetService.approveWeek as jest.Mock).mockResolvedValue({ id: 10, status: 'approved' });
            const req: any = { params: { id: '10' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.approveWeek(req, res);

            expect(timesheetService.approveWeek).toHaveBeenCalledWith(1, 10);
            expect(res.json).toHaveBeenCalledWith({ id: 10, status: 'approved' });
        });
    });

    describe('rejectWeek', () => {
        it('rechaza con el motivo del body', async () => {
            (timesheetService.rejectWeek as jest.Mock).mockResolvedValue({ id: 10, status: 'rejected' });
            const req: any = { params: { id: '10' }, body: { reason: 'Faltan horas' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.rejectWeek(req, res);

            expect(timesheetService.rejectWeek).toHaveBeenCalledWith(1, 10, 'Faltan horas');
        });
    });

    describe('getEffectiveness', () => {
        it('pasa from/to de query al servicio', async () => {
            (timesheetService.getEffectivenessMetrics as jest.Mock).mockResolvedValue({ from: '2026-09-01', to: '2026-09-30', by_person: [], by_task: [] });
            const req: any = { query: { from: '2026-09-01', to: '2026-09-30' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.getEffectiveness(req, res);

            expect(timesheetService.getEffectivenessMetrics).toHaveBeenCalledWith('2026-09-01', '2026-09-30');
        });
    });

    describe('getReminders', () => {
        it('devuelve los recordatorios del usuario autenticado', async () => {
            (timesheetService.getPendingReminders as jest.Mock).mockResolvedValue({ missing_dates: ['2026-09-16'], open_period: null });
            const req: any = { user: { id: 7, role: 'rpa_developer' } };
            const res = mockRes();

            await controller.getReminders(req, res);

            expect(timesheetService.getPendingReminders).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith({ missing_dates: ['2026-09-16'], open_period: null });
        });
    });
});
