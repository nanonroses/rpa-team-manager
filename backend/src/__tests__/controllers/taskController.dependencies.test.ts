jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));
jest.mock('../../services/taskDependencyService', () => {
    const actual = jest.requireActual('../../services/taskDependencyService');
    return {
        ...actual,
        taskDependencyService: {
            createDependency: jest.fn(),
            getDependenciesForTask: jest.fn(),
            deleteDependency: jest.fn()
        }
    };
});

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { TaskController } from '../../controllers/taskController';
import { taskDependencyService, TaskDependencyError } from '../../services/taskDependencyService';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - dependencias entre tareas', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    describe('getTaskDependencies', () => {
        it('devuelve depends_on/blocks si el usuario tiene acceso', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10 });
            (taskDependencyService.getDependenciesForTask as jest.Mock).mockResolvedValue({
                depends_on: [{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }],
                blocks: []
            });
            const req = { params: { taskId: '10' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskDependencies(req, res);

            expect(taskDependencyService.getDependenciesForTask).toHaveBeenCalledWith(10);
            expect(res.json).toHaveBeenCalledWith({
                depends_on: [{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }],
                blocks: []
            });
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.getTaskDependencies(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.getDependenciesForTask).not.toHaveBeenCalled();
        });
    });

    describe('createTaskDependency', () => {
        it('crea la dependencia cuando el usuario tiene acceso a ambas tareas', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce({ id: 20 });
            (taskDependencyService.createDependency as jest.Mock).mockResolvedValue({
                id: 5, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(taskDependencyService.createDependency).toHaveBeenCalledWith(10, 20, undefined, undefined);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                id: 5, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });
        });

        it('devuelve 400 si falta depends_on_task_id', async () => {
            const req = { params: { taskId: '10' }, body: {}, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea de la URL', async () => {
            (db.get as jest.Mock).mockResolvedValueOnce(undefined);
            const req = {
                params: { taskId: '999' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.createDependency).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea de la que se depende', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce(undefined);
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 999 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.createDependency).not.toHaveBeenCalled();
        });

        it('traduce un error de negocio del service a su status code', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce({ id: 20 });
            (taskDependencyService.createDependency as jest.Mock).mockRejectedValue(
                new TaskDependencyError('Esta dependencia generaria un ciclo entre tareas', 400)
            );
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Esta dependencia generaria un ciclo entre tareas' });
        });

        it('devuelve 500 si el service lanza un error inesperado', async () => {
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 10 })
                .mockResolvedValueOnce({ id: 20 });
            (taskDependencyService.createDependency as jest.Mock).mockRejectedValue(new Error('disk full'));
            const req = {
                params: { taskId: '10' }, body: { depends_on_task_id: 20 }, user: { id: 3 }
            } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.createTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('deleteTaskDependency', () => {
        it('borra la dependencia cuando el usuario tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10 });
            (taskDependencyService.deleteDependency as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '10', dependencyId: '5' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskDependency(req, res);

            expect(taskDependencyService.deleteDependency).toHaveBeenCalledWith(10, 5);
            expect(res.json).toHaveBeenCalledWith({ success: true, deletedId: '5' });
        });

        it('devuelve 404 si el usuario no tiene acceso a la tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const req = { params: { taskId: '999', dependencyId: '5' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(taskDependencyService.deleteDependency).not.toHaveBeenCalled();
        });

        it('devuelve 404 si el dependencyId no pertenece a esa tarea', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 10 });
            (taskDependencyService.deleteDependency as jest.Mock).mockRejectedValue(
                new TaskDependencyError('Dependency not found', 404)
            );
            const req = { params: { taskId: '10', dependencyId: '999' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
            const res = mockRes();

            await controller.deleteTaskDependency(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Dependency not found' });
        });
    });
});
