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
});
