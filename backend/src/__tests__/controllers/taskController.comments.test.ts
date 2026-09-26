jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
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
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - comentarios', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskComments', () => {
        it('devuelve los comentarios si el usuario tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.getForEntity as jest.Mock).mockResolvedValue([{ id: 1, content: 'Hola' }]);
            const req = { params: { taskId: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskComments(req, res);

            expect(commentService.getForEntity).toHaveBeenCalledWith('task', 55);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, content: 'Hola' }]);
        });

        it('devuelve 404 si la tarea no existe o el usuario no tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskComments(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.getForEntity).not.toHaveBeenCalled();
        });
    });

    describe('createTaskComment', () => {
        it('crea el comentario y devuelve la fila creada', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.create as jest.Mock).mockResolvedValue({ id: 7, content: 'Nuevo comentario' });
            const req = { params: { taskId: '55' }, body: { content: 'Nuevo comentario' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskComment(req, res);

            expect(commentService.create).toHaveBeenCalledWith('task', 55, 3, 'Nuevo comentario');
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 7, content: 'Nuevo comentario' });
        });

        it('devuelve 400 si el contenido viene vacio o solo con espacios', async () => {
            const req = { params: { taskId: '55' }, body: { content: '   ' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, body: { content: 'X' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.create).not.toHaveBeenCalled();
        });

        it('devuelve 400 si el contenido no es un string (por ejemplo un numero)', async () => {
            const req = { params: { taskId: '55' }, body: { content: 123 }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });
    });

    describe('updateTaskComment', () => {
        it('actualiza el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 3 });
            (commentService.update as jest.Mock).mockResolvedValue({ id: 7, content: 'Editado' });
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(commentService.update).toHaveBeenCalledWith(7, 'Editado');
            expect(res.json).toHaveBeenCalledWith({ id: 7, content: 'Editado' });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 9 });
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.update).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el comentario no existe o pertenece a otra tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 999, user_id: 3 });
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 400 si el contenido viene vacio', async () => {
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: '' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', commentId: '7' }, body: { content: 'Editado' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.findById).not.toHaveBeenCalled();
        });

        it('devuelve 400 si el contenido no es un string (por ejemplo un numero)', async () => {
            const req = { params: { taskId: '55', commentId: '7' }, body: { content: 123 }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });
    });

    describe('deleteTaskComment', () => {
        it('borra el comentario si pertenece al usuario autenticado', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 3 });
            const req = { params: { taskId: '55', commentId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskComment(req, res);

            expect(commentService.delete).toHaveBeenCalledWith(7);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: 7 });
        });

        it('devuelve 403 si el comentario pertenece a otro usuario', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.findById as jest.Mock).mockResolvedValue({ id: 7, entity_type: 'task', entity_id: 55, user_id: 9 });
            const req = { params: { taskId: '55', commentId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(commentService.delete).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', commentId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskComment(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.delete).not.toHaveBeenCalled();
        });
    });

    describe('getTaskMentionableUsers', () => {
        it('devuelve los usuarios mencionables si el usuario tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (commentService.getMentionableUsers as jest.Mock).mockResolvedValue([{ id: 9, username: 'dev1', full_name: 'Dev Uno' }]);
            const req = { params: { taskId: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskMentionableUsers(req, res);

            expect(commentService.getMentionableUsers).toHaveBeenCalledWith('task', 55);
            expect(res.json).toHaveBeenCalledWith([{ id: 9, username: 'dev1', full_name: 'Dev Uno' }]);
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskMentionableUsers(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(commentService.getMentionableUsers).not.toHaveBeenCalled();
        });
    });
});
