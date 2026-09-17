jest.mock('../../services/projectHealthService', () => ({
    projectHealthService: {
        freezeBaseline: jest.fn(),
        getProjectHealth: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { projectHealthService } from '../../services/projectHealthService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - baseline y health', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    describe('freezeBaseline', () => {
        it('devuelve 201 con el baseline creado', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockResolvedValue({ id: 1, project_id: 7 });
            const req = { params: { id: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(projectHealthService.freezeBaseline).toHaveBeenCalledWith(7, 3);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 1, project_id: 7 });
        });

        it('devuelve 404 si el proyecto no existe', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockRejectedValue(new Error('PROJECT_NOT_FOUND'));
            const req = { params: { id: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 400 si el proyecto no tiene fechas', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockRejectedValue(new Error('PROJECT_MISSING_DATES'));
            const req = { params: { id: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('devuelve 409 si ya existe un baseline', async () => {
            (projectHealthService.freezeBaseline as jest.Mock).mockRejectedValue(new Error('BASELINE_ALREADY_EXISTS'));
            const req = { params: { id: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.freezeBaseline(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
        });
    });

    describe('getProjectHealth', () => {
        it('devuelve 200 con la salud del proyecto', async () => {
            (projectHealthService.getProjectHealth as jest.Mock).mockResolvedValue({
                project_id: 7, status: 'ok', semaphore: 'green'
            });
            const req = { params: { id: '7' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectHealth(req, res);

            expect(projectHealthService.getProjectHealth).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith({ project_id: 7, status: 'ok', semaphore: 'green' });
        });
    });
});
