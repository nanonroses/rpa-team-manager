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

describe('PMOController.getProjectGantt - baseline', () => {
    let controller: PMOController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new PMOController();
    });

    it('incluye project.baseline y milestone.baseline_planned_date cuando existe un baseline', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 7, name: 'AGROSUPER' }) // proyecto
            .mockResolvedValueOnce({ // baseline
                start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 5000000
            });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM tasks')) return Promise.resolve([]);
            if (sql.includes('FROM project_milestones')) {
                return Promise.resolve([
                    { id: 1, planned_date: '2026-02-01', baseline_planned_date: '2026-02-01', status: 'completed' }
                ]);
            }
            if (sql.includes('project_dependencies')) return Promise.resolve([]);
            if (sql.includes('task_dependencies')) return Promise.resolve([]);
            return Promise.resolve([]);
        });

        const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectGantt(req, res);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.project.baseline).toEqual({
            start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 5000000
        });
        expect(payload.milestones[0].baseline_planned_date).toBe('2026-02-01');
    });

    it('devuelve project.baseline = null cuando el proyecto no tiene baseline', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 7, name: 'AGROSUPER' })
            .mockResolvedValueOnce(null);
        (db.query as jest.Mock).mockResolvedValue([]);

        const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getProjectGantt(req, res);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.project.baseline).toBeNull();
    });
});
