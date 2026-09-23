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

describe('PMOController.getPMODashboard - teamWorkload', () => {
    let controller: PMOController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new PMOController();
    });

    it('cuenta tareas activas por usuario, ordenadas de mayor a menor carga', async () => {
        (db.get as jest.Mock).mockResolvedValue({});
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM users u') && sql.includes('JOIN tasks t')) {
                return Promise.resolve([
                    { id: 2, full_name: 'Ana Dev', role: 'rpa_developer', active_tasks: 5 },
                    { id: 1, full_name: 'Beto Lead', role: 'team_lead', active_tasks: 2 }
                ]);
            }
            return Promise.resolve([]);
        });

        const req = {} as AuthenticatedRequest;
        const res = mockRes();

        await controller.getPMODashboard(req, res);

        const payload = (res.json as jest.Mock).mock.calls[0][0];
        expect(payload.teamWorkload).toEqual([
            { id: 2, full_name: 'Ana Dev', role: 'rpa_developer', active_tasks: 5 },
            { id: 1, full_name: 'Beto Lead', role: 'team_lead', active_tasks: 2 }
        ]);
    });

    it('la query de teamWorkload excluye tareas done y usuarios inactivos', async () => {
        (db.get as jest.Mock).mockResolvedValue({});
        let capturedSql = '';
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM users u') && sql.includes('JOIN tasks t')) {
                capturedSql = sql;
            }
            return Promise.resolve([]);
        });

        const req = {} as AuthenticatedRequest;
        const res = mockRes();

        await controller.getPMODashboard(req, res);

        expect(capturedSql).toContain("t.status != 'done'");
        expect(capturedSql).toContain('u.is_active = 1');
        expect(capturedSql).toContain('HAVING COUNT(t.id) > 0');
        expect(capturedSql).toContain('ORDER BY active_tasks DESC');
    });
});
