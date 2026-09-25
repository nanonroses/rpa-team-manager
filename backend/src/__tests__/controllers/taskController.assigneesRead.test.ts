jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
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

describe('TaskController - lecturas exponen assignee_ids/assignee_names', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('getBoard: la query de tareas incluye el subquery GROUP_CONCAT de task_assignees', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 2, name: 'Board 1', project_name: 'X' });
        (db.query as jest.Mock)
            .mockResolvedValueOnce([]) // columns
            .mockResolvedValueOnce([]); // tasks
        const res = mockRes();

        await controller.getBoard({ params: { id: '2' }, user: { id: 9 } } as unknown as AuthenticatedRequest, res);

        const tasksCall = (db.query as jest.Mock).mock.calls[1];
        expect(tasksCall[0]).toContain("GROUP_CONCAT(ta.user_id, '||') as assignee_ids");
        expect(tasksCall[0]).toContain("GROUP_CONCAT(u_ta.full_name, '||') as assignee_names");
        expect(tasksCall[0]).toContain('FROM task_assignees ta');
    });

    it('getTaskById: incluye assignee_ids/assignee_names', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42, title: 'Tarea', assignee_ids: '5||9', assignee_names: 'Ana||Beto' });
        const res = mockRes();

        await controller.getTaskById({ params: { id: '42' }, user: { id: 9 } } as unknown as AuthenticatedRequest, res);

        const [sql] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain("GROUP_CONCAT(ta2.user_id, '||') as assignee_ids");
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ assignee_ids: '5||9', assignee_names: 'Ana||Beto' }));
    });
});
