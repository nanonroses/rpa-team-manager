jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn(), getTaskActivity: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { activityLogService } from '../../services/activityLogService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('TaskController - logging de actividad', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('createTask loguea entity_type=task con action=created', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 }) // board access check
            .mockResolvedValueOnce({ max_position: 0 })      // lastTask
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' }); // newTask (SELECT final)
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            body: { board_id: 1, column_id: 2, title: 'Nueva', task_type: 'task', priority: 'medium' },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.createTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'task', 55, 'created', null,
            expect.objectContaining({ title: 'Nueva' })
        );
    });

    it('updateTask loguea entity_type=task con action=updated, oldValues=snapshot previo', async () => {
        const previousTask = { id: 55, column_id: 2, position: 1, title: 'Vieja', status: 'todo' };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)              // access check
            .mockResolvedValueOnce({ id: 55, title: 'Nueva' }); // updated task (SELECT final)
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { title: 'Nueva' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.updateTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'task', 55, 'updated', previousTask,
            expect.objectContaining({ title: 'Nueva' })
        );
    });

    it('updateTask no loguea si el body no trae ningún campo actualizable', async () => {
        const previousTask = { id: 55, column_id: 2, position: 1 };
        (db.get as jest.Mock)
            .mockResolvedValueOnce(previousTask)
            .mockResolvedValueOnce({ id: 55 });
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = { params: { id: '55' }, body: {}, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.updateTask(req, res);

        expect(activityLogService.logActivity).not.toHaveBeenCalled();
    });

    it('deleteTask loguea entity_type=task con action=deleted antes del commit', async () => {
        const existsCheck = { id: 55, column_id: 2, position: 1, project_id: 7, assigned_to: 3, created_by: 3 };
        (db.get as jest.Mock).mockResolvedValueOnce(existsCheck);
        (db.run as jest.Mock)
            .mockResolvedValueOnce({ id: 55, changes: 1 }) // DELETE
            .mockResolvedValueOnce({ changes: 0 });        // reorder
        const req = { params: { id: '55' }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.deleteTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledTimes(2);
        expect(activityLogService.logActivity).toHaveBeenNthCalledWith(
            1, 3, 'task', 55, 'deleted', existsCheck, null
        );
        expect(activityLogService.logActivity).toHaveBeenNthCalledWith(
            2, 3, 'project', 7, 'task_deleted', existsCheck, null
        );
        expect(db.commit).toHaveBeenCalled();
    });

    it('moveTask loguea entity_type=task con action=moved', async () => {
        const task = { id: 55, column_id: 2, position: 1, project_id: 7, assigned_to: 3, created_by: 3 };
        (db.get as jest.Mock).mockResolvedValueOnce(task);
        (db.run as jest.Mock).mockResolvedValue({ id: 55, changes: 1 });
        const req = {
            params: { id: '55' }, body: { column_id: 4, position: 0 }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.moveTask(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'task', 55, 'moved',
            { column_id: 2, position: 1 },
            { column_id: 4, position: 0 }
        );
    });

    it('createBoard loguea entity_type=project con action=board_created', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 9, project_id: 7 })       // access check al proyecto
            .mockResolvedValueOnce({ id: 9, name: 'Board X', project_id: 7 }); // newBoard (SELECT final)
        (db.run as jest.Mock).mockResolvedValue({ id: 9, changes: 1 });
        const req = {
            body: { project_id: 7, name: 'Board X', board_type: 'kanban' }, user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.createBoard(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'board_created', null,
            expect.objectContaining({ name: 'Board X' })
        );
    });

    it('batchCreateTasks loguea UNA sola fila resumida con el conteo', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 }) // board access check
            .mockResolvedValueOnce({ max_position: 0 });     // maxPos para la única columna
        (db.query as jest.Mock).mockResolvedValueOnce([{ id: 2, position: 1 }]); // columns
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const req = {
            body: { board_id: 1, tasks: [{ column_id: 2, title: 'T1' }, { column_id: 2, title: 'T2' }] },
            user: { id: 3 }
        } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.batchCreateTasks(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledTimes(1);
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'tasks_batch_created', null,
            expect.objectContaining({ count: 2, board_id: 1 })
        );
    });

    it('batchDeleteTasks agrupa el logging por proyecto (una fila por proyecto distinto)', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 55, column_id: 2, position: 1, project_id: 7, assigned_to: 3, created_by: 3 })
            .mockResolvedValueOnce({ id: 56, column_id: 2, position: 2, project_id: 7, assigned_to: 3, created_by: 3 })
            .mockResolvedValueOnce({ id: 57, column_id: 5, position: 1, project_id: 9, assigned_to: 3, created_by: 3 });
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const req = { body: { taskIds: [55, 56, 57] }, user: { id: 3 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.batchDeleteTasks(req, res);

        expect(activityLogService.logActivity).toHaveBeenCalledTimes(2);
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'tasks_batch_deleted', null, expect.objectContaining({ count: 2 })
        );
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 9, 'tasks_batch_deleted', null, expect.objectContaining({ count: 1 })
        );
    });
});
