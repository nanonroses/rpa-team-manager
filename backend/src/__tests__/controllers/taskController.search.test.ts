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

describe('TaskController.getTasks - busqueda por texto', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('agrega un filtro LIKE por titulo/descripcion cuando se pasa "search"', async () => {
        (db.query as jest.Mock).mockResolvedValue([{ id: 1, title: 'Migrar reportes' }]);
        const req = { query: { search: 'migrar' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTasks(req, res);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('t.title LIKE ? OR t.description LIKE ?'),
            expect.arrayContaining(['%migrar%', '%migrar%'])
        );
        expect(res.json).toHaveBeenCalledWith([{ id: 1, title: 'Migrar reportes' }]);
    });

    it('no agrega el filtro LIKE cuando no se pasa "search"', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);
        const req = { query: {}, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTasks(req, res);

        const [query] = (db.query as jest.Mock).mock.calls[0];
        expect(query).not.toContain('LIKE');
    });

    it('sigue acotando el acceso por proyecto/asignacion aunque se busque por texto', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);
        const req = { query: { search: 'algo' }, user: { id: 9 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getTasks(req, res);

        const [query, params] = (db.query as jest.Mock).mock.calls[0];
        expect(query).toContain('p.assigned_to = ? OR p.created_by = ? OR t.assignee_id = ?');
        expect(params.slice(0, 3)).toEqual([9, 9, 9]);
    });
});
