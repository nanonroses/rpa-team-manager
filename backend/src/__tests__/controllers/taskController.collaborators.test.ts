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

describe('TaskController - colaboradores adicionales', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskCollaborators', () => {
        it('devuelve los colaboradores de la tarea si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, task_id: 55, user_id: 9, full_name: 'Ana', avatar_url: null }
            ]);
            const req = { params: { taskId: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskCollaborators(req, res);

            expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM task_collaborators'), ['55']);
            expect(res.json).toHaveBeenCalledWith([{ id: 1, task_id: 55, user_id: 9, full_name: 'Ana', avatar_url: null }]);
        });

        it('devuelve 404 si la tarea no existe o el usuario no tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskCollaborators(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.query).not.toHaveBeenCalled();
        });
    });

    describe('addTaskCollaborator', () => {
        it('agrega el colaborador y devuelve la fila creada', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce({ id: 9, full_name: 'Ana', avatar_url: null })
                .mockResolvedValueOnce(undefined);
            (db.run as jest.Mock).mockResolvedValue({ id: 7, changes: 1 });
            const req = { params: { taskId: '55' }, body: { user_id: 9 }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.addTaskCollaborator(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO task_collaborators'), ['55', 9]);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({ id: 7, task_id: 55, user_id: 9, full_name: 'Ana', avatar_url: null });
        });

        it('devuelve 400 si no se manda user_id', async () => {
            const req = { params: { taskId: '55' }, body: {}, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.addTaskCollaborator(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario a agregar no existe', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce(undefined);
            const req = { params: { taskId: '55' }, body: { user_id: 999 }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.addTaskCollaborator(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('devuelve 409 si el usuario ya es colaborador de esa tarea', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 55 })
                .mockResolvedValueOnce({ id: 9, full_name: 'Ana' })
                .mockResolvedValueOnce({ id: 3 });
            const req = { params: { taskId: '55' }, body: { user_id: 9 }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.addTaskCollaborator(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario que hace la request no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, body: { user_id: 9 }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.addTaskCollaborator(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('removeTaskCollaborator', () => {
        it('borra el colaborador de esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req = { params: { taskId: '55', collaboratorId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.removeTaskCollaborator(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM task_collaborators'), ['7', '55']);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: '7' });
        });

        it('devuelve 404 si el collaboratorId no pertenece a esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 55 });
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });
            const req = { params: { taskId: '55', collaboratorId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.removeTaskCollaborator(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', collaboratorId: '7' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.removeTaskCollaborator(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(db.run).not.toHaveBeenCalled();
        });
    });
});

describe('TaskController.getBoard - colaboradores por tarea', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('incluye collaborators_count y collaborators_names en cada tarea del board', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 2, name: 'Board 1', project_name: 'AGROSUPER' });
        (db.query as jest.Mock)
            .mockResolvedValueOnce([{ id: 1, name: 'To Do', position: 0 }])
            .mockResolvedValueOnce([
                { id: 55, title: 'Con colaboradores', collaborators_count: 2, collaborators_names: 'Ana||Beto' },
                { id: 56, title: 'Sin colaboradores', collaborators_count: 0, collaborators_names: null }
            ]);
        const req = { params: { id: '2' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.getBoard(req, res);

        expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('task_collaborators'), ['2']);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            tasks: [
                { id: 55, title: 'Con colaboradores', collaborators_count: 2, collaborators_names: 'Ana||Beto' },
                { id: 56, title: 'Sin colaboradores', collaborators_count: 0, collaborators_names: null }
            ]
        }));
    });
});
