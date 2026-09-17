jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { TimeController } from '../../controllers/timeController';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('TimeController - bloqueo de horas aprobadas (Fase 3)', () => {
    let controller: TimeController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TimeController();
    });

    describe('updateTimeEntry', () => {
        it('rechaza con 400 si la entrada está bloqueada (is_locked)', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, user_id: 7, is_locked: 1 });
            const req: any = { params: { id: '1' }, body: { hours: 5 }, user: { id: 7 } };
            const res = mockRes();

            await controller.updateTimeEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('deleteTimeEntry', () => {
        it('rechaza con 400 si la entrada está bloqueada (is_locked)', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, user_id: 7, is_locked: 1 });
            const req: any = { params: { id: '1' }, user: { id: 7 } };
            const res = mockRes();

            await controller.deleteTimeEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('stopTimer', () => {
        it('rechaza con 400 si el timer activo quedó bloqueado (is_locked) y no escribe', async () => {
            (db.get as jest.Mock).mockResolvedValue({
                id: 1, user_id: 7, is_locked: 1, date: '2026-09-17', start_time: '09:00:00'
            });
            const req: any = { user: { id: 7 } };
            const res = mockRes();

            await controller.stopTimer(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.run).not.toHaveBeenCalled();
        });
    });
});
