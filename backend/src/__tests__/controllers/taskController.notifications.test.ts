jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(), run: jest.fn(), query: jest.fn(),
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn()
    }
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
import { notificationService } from '../../services/notificationService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - notificaciones', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('createTask notifica task_assigned si viene assignee_id distinto del creador', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva', assignee_id: 9 },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.createTask(req, mockRes());

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 9, eventKey: 'task_assigned', entityType: 'task', entityId: 55, senderId: 3,
            link: '/tasks?taskId=55', message: expect.any(String)
        }));
    });

    it('createTask no notifica si el creador se autoasigna', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva', assignee_id: 3 },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.createTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('createTask no notifica si no viene assignee_id', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva' },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.createTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask notifica task_assigned si assignee_id cambió a otro usuario', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 4 }]); // responsables actuales (solo 4)
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: 9 }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 9, eventKey: 'task_assigned', entityType: 'task', entityId: 55, senderId: 3,
            link: '/tasks?taskId=55', message: expect.any(String)
        }));
    });

    it('updateTask no notifica task_assigned si assignee_id no cambió', async () => {
        const previousTask = { id: 55, assignee_id: 9, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 9 }]); // 9 ya era responsable
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: 9 }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask no notifica task_assigned si assignee_id viene null (quitar asignado)', async () => {
        const previousTask = { id: 55, assignee_id: 9, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: null }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask notifica task_status_changed al reporter cuando cambia status', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { status: 'done' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 8, eventKey: 'task_status_changed', entityType: 'task', entityId: 55, senderId: 3,
            link: '/tasks?taskId=55', message: expect.any(String)
        }));
    });

    it('updateTask no notifica task_status_changed si quien cambia el status es el propio reporter', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 3, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { status: 'done' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask no notifica task_assigned si assignee_id cambia pero es igual a quien hace el cambio (autoreasignación)', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 4 }]);
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: 3 }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask no notifica task_status_changed si status viene en el body pero es igual al valor viejo', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { status: 'todo' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('updateTask dispara ambas notificaciones cuando assignee_id y status cambian en la misma request', async () => {
        const previousTask = { id: 55, assignee_id: 4, status: 'todo', reporter_id: 8, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55, title: 'Tarea' });
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 4 }]);
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { assignee_id: 9, status: 'done' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;

        await controller.updateTask(req, mockRes());

        expect(notificationService.notify).toHaveBeenCalledTimes(2);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 9, eventKey: 'task_assigned', entityType: 'task', entityId: 55, senderId: 3,
            link: '/tasks?taskId=55', message: expect.any(String)
        }));
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 8, eventKey: 'task_status_changed', entityType: 'task', entityId: 55, senderId: 3,
            link: '/tasks?taskId=55', message: expect.any(String)
        }));
    });
});
