jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { getProjectActivity: jest.fn(), logActivity: jest.fn() }
}));
jest.mock('../../services/commentService', () => ({
    commentService: {
        getForEntity: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        getMentionableUsers: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { commentService } from '../../services/commentService';
import { ProjectController } from '../../controllers/projectController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('ProjectController - comentarios', () => {
    let controller: ProjectController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new ProjectController();
    });

    describe('getProjectComments', () => {
        it('devuelve los comentarios si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.getForEntity as jest.Mock).mockResolvedValue([{ id: 1, content: 'Hola' }]);
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectComments(req, res);

            expect(commentService.getForEntity).toHaveBeenCalledWith('project', 7);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, content: 'Hola' }]);
        });

        it('devuelve 404 si el proyecto no existe', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { id: '999' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectComments(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 403 si un rpa_developer sin pertenencia intenta ver los comentarios', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectComments(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.getForEntity).not.toHaveBeenCalled();
        });
    });

    describe('createProjectComment', () => {
        it('crea el comentario y devuelve la fila creada', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.create as jest.Mock).mockResolvedValue({ id: 5, content: 'Nuevo' });
            const req = { params: { id: '7' }, body: { content: 'Nuevo' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectComment(req, res);

            expect(commentService.create).toHaveBeenCalledWith('project', 7, 1, 'Nuevo');
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('devuelve 400 si el contenido viene vacio', async () => {
            const req = { params: { id: '7' }, body: { content: '   ' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 403 si un rpa_developer sin pertenencia intenta comentar', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, body: { content: 'X' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.create).not.toHaveBeenCalled();
        });

        it('devuelve 400 si el contenido no es un string (por ejemplo un numero)', async () => {
            const req = { params: { id: '7' }, body: { content: 123 }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });
    });

    describe('updateProjectComment', () => {
        it('actualiza el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 1 });
            (commentService.update as jest.Mock).mockResolvedValue({ id: 5, content: 'Editado' });
            const req = { params: { id: '7', commentId: '5' }, body: { content: 'Editado' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateProjectComment(req, res);

            expect(commentService.update).toHaveBeenCalledWith(5, 'Editado');
            expect(res.json).toHaveBeenCalledWith({ id: 5, content: 'Editado' });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario, aunque sea team_lead', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 9 });
            const req = { params: { id: '7', commentId: '5' }, body: { content: 'Editado' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.update).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el comentario no existe para ese proyecto', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 999, user_id: 1 });
            const req = { params: { id: '7', commentId: '5' }, body: { content: 'Editado' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 400 si el contenido no es un string (por ejemplo un numero)', async () => {
            const req = { params: { id: '7', commentId: '5' }, body: { content: 123 }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });
    });

    describe('deleteProjectComment', () => {
        it('borra el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 1 });
            const req = { params: { id: '7', commentId: '5' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteProjectComment(req, res);

            expect(commentService.delete).toHaveBeenCalledWith(5);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: 5 });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 5, entity_type: 'project', entity_id: 7, user_id: 9 });
            const req = { params: { id: '7', commentId: '5' }, user: { id: 1, role: 'team_lead' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteProjectComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.delete).not.toHaveBeenCalled();
        });
    });

    describe('getProjectMentionableUsers', () => {
        it('devuelve los usuarios mencionables si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 1, created_by: 1 });
            (commentService.getMentionableUsers as jest.Mock).mockResolvedValue([{ id: 9, username: 'dev1', full_name: 'Dev Uno' }]);
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectMentionableUsers(req, res);

            expect(commentService.getMentionableUsers).toHaveBeenCalledWith('project', 7);
            expect(res.json).toHaveBeenCalledWith([{ id: 9, username: 'dev1', full_name: 'Dev Uno' }]);
        });

        it('devuelve 403 si un rpa_developer sin pertenencia intenta ver los mencionables', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 7, assigned_to: 2, created_by: 3 });
            const req = { params: { id: '7' }, user: { id: 1, role: 'rpa_developer' } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getProjectMentionableUsers(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.getMentionableUsers).not.toHaveBeenCalled();
        });
    });
});
