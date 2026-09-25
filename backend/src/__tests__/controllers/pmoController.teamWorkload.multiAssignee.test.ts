jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { PMOController } from '../../controllers/pmoController';

function mockRes(): any {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('PMOController - teamWorkload cuenta cada responsable via task_assignees', () => {
    it('el JOIN de carga del equipo usa task_assignees, no assignee_id directo', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);
        const controller = new PMOController();
        const res = mockRes();

        await controller.getPMODashboard({ user: { id: 9 } } as any, res);

        const workloadCall = (db.query as jest.Mock).mock.calls.find((c: any) => c[0].includes('active_tasks'));
        expect(workloadCall[0]).toContain('JOIN task_assignees ta ON ta.task_id = t.id AND t.status');
        expect(workloadCall[0]).toContain('GROUP BY u.id, u.full_name, u.role');
    });
});
