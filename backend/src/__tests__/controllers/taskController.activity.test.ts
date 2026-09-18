jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getTaskActivity: jest.fn(), logActivity: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController.getTaskActivity', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('devuelve 404 si la tarea no existe o no hay pertenencia', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce(null);
        const req = { params: { id: '10' }, user: { id: 1 }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskActivity(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(activityLogService.getTaskActivity).not.toHaveBeenCalled();
    });

    it('devuelve el feed de la tarea cuando hay pertenencia', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 10, project_id: 7 });
        (activityLogService.getTaskActivity as jest.Mock).mockResolvedValue([{ id: 1, action: 'created' }]);
        const req = { params: { id: '10' }, user: { id: 1 }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskActivity(req, res);

        expect(activityLogService.getTaskActivity).toHaveBeenCalledWith(10, { limit: 50, offset: 0 });
        expect(res.json).toHaveBeenCalledWith([{ id: 1, action: 'created' }]);
    });

    it('clamp: limit negativo, limit=0 y offset negativo se ajustan a valores sanos', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 10, project_id: 7 })
            .mockResolvedValueOnce({ id: 10, project_id: 7 })
            .mockResolvedValueOnce({ id: 10, project_id: 7 });
        (activityLogService.getTaskActivity as jest.Mock).mockResolvedValue([]);
        const res1 = mockRes();
        await controller.getTaskActivity(
            { params: { id: '10' }, user: { id: 1 }, query: { limit: '-5' } } as unknown as AuthenticatedRequest,
            res1
        );
        expect(activityLogService.getTaskActivity).toHaveBeenCalledWith(10, { limit: 1, offset: 0 });

        const res2 = mockRes();
        await controller.getTaskActivity(
            { params: { id: '10' }, user: { id: 1 }, query: { limit: '0' } } as unknown as AuthenticatedRequest,
            res2
        );
        expect(activityLogService.getTaskActivity).toHaveBeenCalledWith(10, { limit: 1, offset: 0 });

        const res3 = mockRes();
        await controller.getTaskActivity(
            { params: { id: '10' }, user: { id: 1 }, query: { offset: '-10' } } as unknown as AuthenticatedRequest,
            res3
        );
        expect(activityLogService.getTaskActivity).toHaveBeenCalledWith(10, { limit: 50, offset: 0 });
    });
});
