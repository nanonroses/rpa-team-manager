jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getProjectActivity: jest.fn(), logActivity: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController.getProjectActivity', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    it('devuelve 404 si el proyecto no existe', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce(null);
        const req = { params: { id: '999' }, user: { id: 1, role: 'team_lead' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('devuelve 403 si un rpa_developer sin pertenencia pide el timeline', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 });
        const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(activityLogService.getProjectActivity).not.toHaveBeenCalled();
    });

    it('permite a un rpa_developer con pertenencia (created_by) ver el timeline', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 1 });
        (activityLogService.getProjectActivity as jest.Mock).mockResolvedValue([{ id: 1, action: 'created' }]);
        const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(activityLogService.getProjectActivity).toHaveBeenCalledWith(7, { limit: 50, offset: 0 });
        expect(res.json).toHaveBeenCalledWith([{ id: 1, action: 'created' }]);
    });

    it('permite a team_lead ver el timeline de cualquier proyecto aunque no le pertenezca', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 });
        (activityLogService.getProjectActivity as jest.Mock).mockResolvedValue([]);
        const req = { params: { id: '7' }, user: { id: 1, role: 'team_lead' }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith([]);
    });

    it('usa limit/offset de la query string cuando vienen', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 1, created_by: 1 });
        (activityLogService.getProjectActivity as jest.Mock).mockResolvedValue([]);
        const req = {
            params: { id: '7' }, user: { id: 1, role: 'rpa_developer' }, query: { limit: '10', offset: '20' }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectActivity(req, res);

        expect(activityLogService.getProjectActivity).toHaveBeenCalledWith(7, { limit: 10, offset: 20 });
    });
});
