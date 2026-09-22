jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController.getTaskById', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('devuelve la tarea con project_id si el usuario tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 55, board_id: 2, project_id: 7, title: 'Tarea' });
        const req = { params: { id: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskById(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 55, project_id: 7 }));
    });

    it('devuelve 404 si no existe o el usuario no tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        const req = { params: { id: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTaskById(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });
});
