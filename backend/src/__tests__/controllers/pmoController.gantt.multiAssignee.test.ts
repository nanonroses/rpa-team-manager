jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { PMOController } from '../../controllers/pmoController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('PMOController.getProjectGantt - multi-asignado', () => {
    let controller: PMOController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new PMOController();
    });

    it('el query de tasks hace JOIN con task_assignees y selecciona assignee_ids/assignee_names', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 7, name: 'AGROSUPER' }) // proyecto
            .mockResolvedValueOnce(null); // baseline
        (db.query as jest.Mock).mockResolvedValue([]);

        const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectGantt(req, res);

        const tasksCall = (db.query as jest.Mock).mock.calls.find((c: any) => c[0].includes('FROM tasks'));
        expect(tasksCall).toBeDefined();
        expect(tasksCall[0]).toContain('FROM task_assignees ta');
        expect(tasksCall[0]).toContain("GROUP_CONCAT(ta.user_id, '||') as assignee_ids");
        expect(tasksCall[0]).toContain("GROUP_CONCAT(u_ta.full_name, '||') as assignee_names");
        expect(tasksCall[0]).toContain('tas.assignee_ids');
        expect(tasksCall[0]).toContain('tas.assignee_names');
        // La agregacion de task_assignees no debe romper el GROUP BY t.id existente (usado por SUM(te.hours))
        expect(tasksCall[0]).toContain('GROUP BY t.id');
    });

    it('propaga assignee_ids/assignee_names de una tarea con 2 responsables en la respuesta', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 7, name: 'AGROSUPER' })
            .mockResolvedValueOnce(null);
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM tasks')) {
                return Promise.resolve([
                    {
                        id: 101,
                        title: 'Tarea con 2 responsables',
                        status: 'todo',
                        assignee_id: 5,
                        assignee_name: 'Ana',
                        assignee_ids: '5||9',
                        assignee_names: 'Ana||Beto'
                    }
                ]);
            }
            if (sql.includes('FROM project_milestones')) return Promise.resolve([]);
            if (sql.includes('project_dependencies')) return Promise.resolve([]);
            if (sql.includes('task_dependencies')) return Promise.resolve([]);
            return Promise.resolve([]);
        });

        const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectGantt(req, res);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.tasks[0].assignee_ids).toBe('5||9');
        expect(payload.tasks[0].assignee_names).toBe('Ana||Beto');
    });
});
