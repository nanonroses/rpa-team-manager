jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - chequeo de pertenencia en gantt y assignments', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    describe('getProjectGantt', () => {
        it('devuelve 404 si el proyecto no existe', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce(null);
            const req = { params: { id: '999' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectGantt(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 403 si un rpa_developer sin pertenencia pide el Gantt', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectGantt(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('devuelve 200 con tareas y dependencias si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 1, created_by: 3 });
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 1, title: 'Tarea' }])
                .mockResolvedValueOnce([]);
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectGantt(req, res);

            expect(res.json).toHaveBeenCalledWith({ tasks: [{ id: 1, title: 'Tarea' }], dependencies: [] });
        });

        it('permite a team_lead ver el Gantt de cualquier proyecto aunque no le pertenezca', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 });
            (db.query as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
            const req = { params: { id: '7' }, user: { id: 99, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectGantt(req, res);

            expect(res.status).not.toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalled();
        });
    });

    describe('getProjectAssignments', () => {
        it('devuelve 404 si el proyecto no existe', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce(null);
            const req = { params: { id: '999' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectAssignments(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 403 si un rpa_developer sin pertenencia pide las asignaciones', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectAssignments(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it('devuelve 200 con las asignaciones si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce({ id: 7, assigned_to: 1, created_by: 3 });
            (db.query as jest.Mock).mockResolvedValueOnce([{ id: 1, user_id: 1, full_name: 'Ana' }]);
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectAssignments(req, res);

            expect(res.json).toHaveBeenCalledWith([{ id: 1, user_id: 1, full_name: 'Ana' }]);
        });
    });
});
