jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn() }
}));

import { Response } from 'express';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { PMOController } from '../../controllers/pmoController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('PMOController - huella de actividad de hitos técnicos', () => {
    let controller: PMOController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new PMOController();
    });

    describe('createMilestone', () => {
        it('loguea la creacion a nivel de hito y a nivel de proyecto', async () => {
            (db.run as jest.Mock).mockResolvedValue({ id: 5, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({ id: 5, project_id: 3, name: 'Entrega v1', status: 'pending', planned_date: '2026-10-01' });
            const req = {
                body: { project_id: 3, name: 'Entrega v1', planned_date: '2026-10-01' },
                user: { id: 1, role: 'team_lead' }
            } as any;
            const res = mockRes();

            await controller.createMilestone(req, res);

            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'milestone', 5, 'created', null, expect.objectContaining({ id: 5 }));
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'project', 3, 'milestone_created', null, expect.objectContaining({ milestone_id: 5, name: 'Entrega v1' }));
        });
    });

    describe('updateMilestone', () => {
        it('devuelve 404 si el hito no existe', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { id: '999' }, body: { status: 'completed' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.updateMilestone(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('loguea a nivel de proyecto cuando cambia el status', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'pending', planned_date: '2026-10-01' })
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'completed', planned_date: '2026-10-01' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { id: '5' }, body: { status: 'completed' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.updateMilestone(req, res);

            expect(activityLogService.logActivity).toHaveBeenCalledWith(
                1, 'project', 3, 'milestone_updated',
                { status: 'pending', planned_date: '2026-10-01' },
                { status: 'completed', planned_date: '2026-10-01' }
            );
        });

        it('NO loguea a nivel de proyecto si solo cambia un campo distinto de status/planned_date', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'pending', planned_date: '2026-10-01', priority: 'medium' })
                .mockResolvedValueOnce({ id: 5, project_id: 3, status: 'pending', planned_date: '2026-10-01', priority: 'high' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { id: '5' }, body: { priority: 'high' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.updateMilestone(req, res);

            const projectLevelCalls = (activityLogService.logActivity as jest.Mock).mock.calls.filter((call) => call[1] === 'project');
            expect(projectLevelCalls).toHaveLength(0);
            // El log especifico del hito si se sigue registrando (auditoria completa del hito, aunque no cambie status/fecha)
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'milestone', 5, 'updated', expect.any(Object), expect.any(Object));
        });
    });

    describe('deleteMilestone', () => {
        it('loguea el borrado a nivel de hito y de proyecto', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 5, name: 'Entrega v1', project_id: 3, status: 'pending', planned_date: '2026-10-01' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { id: '5' }, user: { id: 1, role: 'team_lead' } } as any;
            const res = mockRes();

            await controller.deleteMilestone(req, res);

            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'milestone', 5, 'deleted', expect.objectContaining({ id: 5 }), null);
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'project', 3, 'milestone_deleted', expect.objectContaining({ milestone_id: '5', name: 'Entrega v1' }), null);
        });
    });
});
