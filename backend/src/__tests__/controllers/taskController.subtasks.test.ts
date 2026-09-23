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

describe('TaskController - subtareas', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskSubtasks', () => {
        it('devuelve las subtareas de la tarea si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, task_id: 55, title: 'Sub A', is_done: 0 }
            ]);
            const req = { params: { taskId: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskSubtasks(req, res);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM task_subtasks'), ['55']);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, task_id: 55, title: 'Sub A', is_done: 0 }]);
        });

        it('devuelve 404 si la tarea no existe o el usuario no tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskSubtasks(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.query).not.toHaveBeenCalled();
        });
    });

    describe('createTaskSubtask', () => {
        it('crea la subtarea y devuelve la fila creada', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce({ id: 7, task_id: 55, title: 'Nueva sub', is_done: 0 });
            (db.run as jest.Mock).mockResolvedValue({ id: 7, changes: 1 });
            const req = { params: { taskId: '55' }, body: { title: 'Nueva sub' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO task_subtasks'), ['55', 'Nueva sub']);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 7, task_id: 55, title: 'Nueva sub', is_done: 0 });
        });

        it('devuelve 400 si el titulo viene vacio o solo con espacios', async () => {
            const req = { params: { taskId: '55' }, body: { title: '   ' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, body: { title: 'X' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('updateTaskSubtask', () => {
        it('marca is_done y devuelve la fila actualizada', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce({ id: 7, task_id: 55, title: 'Sub A', is_done: 1 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = {
                params: { taskId: '55', subtaskId: '7' }, body: { is_done: true }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE task_subtasks'),
                [undefined, 1, '7', '55']
            );
            expect(res.json).toHaveBeenCalledWith({ id: 7, task_id: 55, title: 'Sub A', is_done: 1 });
        });

        it('devuelve 404 si el subtaskId no pertenece a esa tarea (no afecta subtareas de otra tarea)', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });
            const req = {
                params: { taskId: '55', subtaskId: '999' }, body: { is_done: true }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.any(String), [undefined, 1, '999', '55']);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = {
                params: { taskId: '999', subtaskId: '7' }, body: { is_done: true }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.updateTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('deleteTaskSubtask', () => {
        it('borra la subtarea de esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { taskId: '55', subtaskId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskSubtask(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM task_subtasks'), ['7', '55']);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: '7' });
        });

        it('devuelve 404 si el subtaskId no pertenece a esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });
            const req = { params: { taskId: '55', subtaskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', subtaskId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskSubtask(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });
});
