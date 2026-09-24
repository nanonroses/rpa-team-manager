jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
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

describe('TaskController - etiquetas', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskTags', () => {
        it('devuelve las etiquetas de la tarea si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.query as jest.Mock).mockResolvedValue([{ id: 1, task_id: 55, tag: 'urgente' }]);
            const req = { params: { taskId: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskTags(req, res);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM task_tags'), ['55']);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, task_id: 55, tag: 'urgente' }]);
        });

        it('devuelve 404 si la tarea no existe o el usuario no tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskTags(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.query).not.toHaveBeenCalled();
        });
    });

    describe('createTaskTag', () => {
        it('crea la etiqueta normalizada (trim + minusculas) y devuelve la fila creada', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({ id: 7, task_id: 55, tag: 'urgente' });
            (db.run as jest.Mock).mockResolvedValue({ id: 7, changes: 1 });
            const req = { params: { taskId: '55' }, body: { tag: '  Urgente  ' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskTag(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO task_tags'), ['55', 'urgente']);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 7, task_id: 55, tag: 'urgente' });
        });

        it('devuelve 400 si la etiqueta viene vacia o solo con espacios', async () => {
            const req = { params: { taskId: '55' }, body: { tag: '   ' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskTag(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 400 si la etiqueta supera los 50 caracteres', async () => {
            const req = { params: { taskId: '55' }, body: { tag: 'a'.repeat(51) }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskTag(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 409 si la etiqueta ya existe en esa tarea', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce({ id: 3 });
            const req = { params: { taskId: '55' }, body: { tag: 'urgente' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskTag(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, body: { tag: 'x' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskTag(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('deleteTaskTag', () => {
        it('borra la etiqueta de esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { taskId: '55', tagId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskTag(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM task_tags'), ['7', '55']);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: '7' });
        });

        it('devuelve 404 si el tagId no pertenece a esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });
            const req = { params: { taskId: '55', tagId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskTag(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', tagId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskTag(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });
});

describe('TaskController.getBoard - etiquetas por tarea', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('incluye el campo tags (string concatenado con "||") en cada tarea del board', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 2, name: 'Board 1', project_name: 'AGROSUPER' });
        (db.query as jest.Mock)
            .mockResolvedValueOnce([{ id: 1, name: 'To Do', position: 0 }])
            .mockResolvedValueOnce([
                { id: 55, title: 'Con etiquetas', tags: 'urgente||cliente-x' },
                { id: 56, title: 'Sin etiquetas', tags: null }
            ]);
        const req = { params: { id: '2' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getBoard(req, res);

        expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('task_tags'), ['2']);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            tasks: [
                { id: 55, title: 'Con etiquetas', tags: 'urgente||cliente-x' },
                { id: 56, title: 'Sin etiquetas', tags: null }
            ]
        }));
    });
});
