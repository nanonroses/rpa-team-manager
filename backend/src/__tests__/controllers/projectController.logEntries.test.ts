jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getProjectActivity: jest.fn(), logActivity: jest.fn() }
}));
jest.mock('../../services/commentService', () => ({
    commentService: {
        getForEntity: jest.fn(), create: jest.fn(), findById: jest.fn(), update: jest.fn(), delete: jest.fn(), getMentionableUsers: jest.fn()
    }
}));
jest.mock('../../services/projectLogService', () => ({
    projectLogService: { getForProject: jest.fn(), create: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { projectLogService } from '../../services/projectLogService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - bitácora del proyecto', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    describe('getProjectLogEntries', () => {
        it('devuelve las entradas si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (projectLogService.getForProject as jest.Mock).mockResolvedValue([{ id: 1, entry_type: 'decision' }]);
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectLogEntries(req, res);

            expect(projectLogService.getForProject).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, entry_type: 'decision' }]);
        });

        it('devuelve 403 si un rpa_developer sin pertenencia intenta leer la bitácora', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectLogEntries(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(projectLogService.getForProject).not.toHaveBeenCalled();
        });
    });

    describe('createProjectLogEntry', () => {
        it('team_lead puede escribir en la bitácora de cualquier proyecto', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            (projectLogService.create as jest.Mock).mockResolvedValue({ id: 5, entry_type: 'decision', description: 'Nueva' });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: 'Nueva' },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(projectLogService.create).toHaveBeenCalledWith(7, 1, 'decision', 'Nueva', null);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'log_entry', 5, 'created', null, expect.any(Object));
            expect(activityLogService.logActivity).toHaveBeenCalledWith(1, 'project', 7, 'log_entry_created', null, { log_entry_id: 5, entry_type: 'decision' });
        });

        it('el responsable del proyecto puede escribir en su propia bitácora', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 4, created_by: 3 });
            (projectLogService.create as jest.Mock).mockResolvedValue({ id: 6, entry_type: 'incident', description: 'Caída' });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'incident', description: 'Caída' },
                user: { id: 4, role: 'rpa_developer' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('un rpa_developer que no es responsable ni creador de ESE proyecto no puede escribir, aunque tenga acceso de lectura via project_lead global', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 4, created_by: 3 });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'incident', description: 'Caída' },
                user: { id: 9, role: 'rpa_operations' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });

        it('devuelve 400 si entry_type no es uno de los 5 tipos válidos', async () => {
            const req = {
                params: { id: '7' },
                body: { entry_type: 'invalido', description: 'x' },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });

        it('devuelve 400 si description viene vacía', async () => {
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: '   ' },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });

        it('si viene file_id subido por el mismo usuario, inserta la asociacion en file_associations para que cualquiera con acceso pueda descargarlo', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 })
                .mockResolvedValueOnce({ id: 99, uploaded_by: 1 });
            (projectLogService.create as jest.Mock).mockResolvedValue({ id: 5, entry_type: 'decision', description: 'Nueva', file_id: 99 });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: 'Nueva', file_id: 99 },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO file_associations'),
                [99, 7, 1, 99, 7]
            );
        });

        it('devuelve 400 si file_id no existe en files (IDOR)', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 })
                .mockResolvedValueOnce(undefined);
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: 'Nueva', file_id: 999 },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });

        it('devuelve 403 si file_id existe pero fue subido por otro usuario (IDOR)', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 7, assigned_to: 2, created_by: 3 })
                .mockResolvedValueOnce({ id: 99, uploaded_by: 2 });
            const req = {
                params: { id: '7' },
                body: { entry_type: 'decision', description: 'Nueva', file_id: 99 },
                user: { id: 1, role: 'team_lead' }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectLogEntry(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(projectLogService.create).not.toHaveBeenCalled();
        });
    });
});
