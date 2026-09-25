jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(), run: jest.fn(), query: jest.fn(),
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn()
    }
}));
jest.mock('../../services/activityLogService', () => ({
    activityLogService: { logActivity: jest.fn() }
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

function req(body: any, userId = 3): AuthenticatedRequest {
    return { body, params: {}, user: { id: userId } } as unknown as AuthenticatedRequest;
}

describe('TaskController - escrituras con assignee_ids (multi-asignado)', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('createTask: con assignee_ids=[5,9], tasks.assignee_id queda en 5 (primero) y task_assignees tiene ambas filas', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, assigned_to: 3 }) // board access
            .mockResolvedValueOnce({ max_position: 0 }) // last position
            .mockResolvedValueOnce({ id: 100, title: 'Nueva tarea', assignee_id: 5 }); // created task
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.createTask(req({
            board_id: 1, column_id: 10, title: 'Nueva tarea', assignee_ids: [5, 9]
        }), res);

        const insertCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('INSERT INTO tasks'));
        expect(insertCall[1]).toContain(5); // assignee_id = primer elemento

        const assigneeInserts = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(assigneeInserts).toHaveLength(2);
        expect(assigneeInserts[0][1]).toEqual([100, 5]);
        expect(assigneeInserts[1][1]).toEqual([100, 9]);
    });

    it('createTask: notifica a todos los assignee_ids (menos al que crea), no solo al primero', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, assigned_to: 3 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 100, title: 'Nueva tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.createTask(req({
            board_id: 1, column_id: 10, title: 'Nueva tarea', assignee_ids: [5, 9]
        }, 3), res);

        expect(notificationService.notify).toHaveBeenCalledTimes(2);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 5, eventKey: 'task_assigned' }));
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, eventKey: 'task_assigned' }));
    });

    it('updateTask: reemplaza la lista completa de responsables y notifica solo a los recien agregados', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: 5, status: 'todo' }) // access check
            .mockResolvedValueOnce({ id: 42, title: 'Tarea' }); // updated task
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 5 }]); // responsables actuales (solo 5)
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask({ params: { id: '42' }, body: { assignee_ids: [5, 9] }, user: { id: 3 } } as unknown as AuthenticatedRequest, res);

        const deleteCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('DELETE FROM task_assignees'));
        expect(deleteCall[1]).toEqual(['42']);

        const insertCalls = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(insertCalls).toHaveLength(2);

        // Solo 9 es nuevo (5 ya era responsable) -> una sola notificacion
        expect(notificationService.notify).toHaveBeenCalledTimes(1);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, eventKey: 'task_assigned' }));
    });

    it('updateTask: assignee_ids=[] deja tasks.assignee_id en NULL y vacia task_assignees', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: 5, status: 'todo' })
            .mockResolvedValueOnce({ id: 42, title: 'Tarea', assignee_id: null });
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 5 }]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask({ params: { id: '42' }, body: { assignee_ids: [] }, user: { id: 3 } } as unknown as AuthenticatedRequest, res);

        const updateCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('UPDATE tasks'));
        expect(updateCall[1]).toContain(null);
        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('batchUpdateTasks: updates.assignee_ids reemplaza responsables de todas las tareas accesibles y notifica agrupado por usuario nuevo', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([
                { id: 1, column_id: 10, position: 1, board_id: 100, project_id: 7 },
                { id: 2, column_id: 10, position: 2, board_id: 100, project_id: 7 }
            ])
            .mockResolvedValueOnce([]) // responsables actuales tarea 1
            .mockResolvedValueOnce([]); // responsables actuales tarea 2
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { assignee_ids: [8] } }, 3), res);

        expect(notificationService.notify).toHaveBeenCalledTimes(1);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 8, eventKey: 'task_assigned' }));
        expect((notificationService.notify as jest.Mock).mock.calls[0][0].message).toContain('2');
    });

    // --- Finding 2: llamadores legacy que solo mandan assignee_id (sin assignee_ids[])
    // tambien deben sincronizar task_assignees, no solo la columna tasks.assignee_id. ---

    it('updateTask: solo con el legacy assignee_id (sin assignee_ids[]) igual sincroniza task_assignees', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: 4, status: 'todo' })
            .mockResolvedValueOnce({ id: 42, title: 'Tarea' });
        (db.query as jest.Mock).mockResolvedValueOnce([{ user_id: 4 }]); // responsable actual (solo 4)
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask({ params: { id: '42' }, body: { assignee_id: 9 }, user: { id: 3 } } as unknown as AuthenticatedRequest, res);

        const deleteCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('DELETE FROM task_assignees'));
        expect(deleteCall).toBeDefined();
        const insertCalls = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0][1]).toEqual(['42', 9]);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, eventKey: 'task_assigned' }));
    });

    it('batchUpdateTasks: updates.assignee_id (legacy) sincroniza task_assignees en cada tarea, no solo la columna assignee_id', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([
                { id: 1, column_id: 10, position: 1, board_id: 100, project_id: 7 }
            ])
            .mockResolvedValueOnce([]); // responsables actuales tarea 1
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { assignee_id: 8 } }, 3), res);

        const insertCalls = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0][1]).toEqual([1, 8]);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 8, eventKey: 'task_assigned' }));
    });

    it('batchCreateTasks: el legacy assignee_id por tarea tambien crea su fila en task_assignees', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 }) // board access
            .mockResolvedValueOnce({ max_position: 0 });     // maxPos de la columna
        (db.query as jest.Mock).mockResolvedValueOnce([{ id: 2, position: 1 }]); // columns
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.batchCreateTasks(req({
            board_id: 1, tasks: [{ column_id: 2, title: 'T1', assignee_id: 9 }]
        }, 3), res);

        const insertTaskCall = (db.run as jest.Mock).mock.calls.find((c) => c[0].includes('INSERT INTO tasks'));
        expect(insertTaskCall[1]).toContain(9); // assignee_id de la tarea

        const assigneeInserts = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(assigneeInserts).toHaveLength(1);
        expect(assigneeInserts[0][1]).toEqual([100, 9]);
    });

    it('batchCreateTasks: assignee_ids (lista) por tarea crea una fila en task_assignees por cada responsable', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 7 })
            .mockResolvedValueOnce({ max_position: 0 });
        (db.query as jest.Mock).mockResolvedValueOnce([{ id: 2, position: 1 }]);
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.batchCreateTasks(req({
            board_id: 1, tasks: [{ column_id: 2, title: 'T1', assignee_ids: [5, 9] }]
        }, 3), res);

        const assigneeInserts = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(assigneeInserts).toHaveLength(2);
        expect(assigneeInserts[0][1]).toEqual([100, 5]);
        expect(assigneeInserts[1][1]).toEqual([100, 9]);
    });

    // --- Finding 5: assignee_ids se normaliza (dedupe + coercion a numero) antes de usarse,
    // en las 3 funciones que lo consumen. ---

    it('createTask: assignee_ids=[5,5] (duplicado) dedupe a una sola fila en task_assignees', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, assigned_to: 3 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 100, title: 'Nueva tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.createTask(req({
            board_id: 1, column_id: 10, title: 'Nueva tarea', assignee_ids: [5, 5]
        }), res);

        const assigneeInserts = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(assigneeInserts).toHaveLength(1);
        expect(assigneeInserts[0][1]).toEqual([100, 5]);
    });

    it('createTask: assignee_ids como strings (["5"]) se coercionan a numero antes de compararse/insertarse', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, assigned_to: 3 })
            .mockResolvedValueOnce({ max_position: 0 })
            .mockResolvedValueOnce({ id: 100, title: 'Nueva tarea' });
        (db.run as jest.Mock).mockResolvedValue({ id: 100, changes: 1 });
        const res = mockRes();

        await controller.createTask(req({
            board_id: 1, column_id: 10, title: 'Nueva tarea', assignee_ids: ['5']
        }, 3), res);

        const assigneeInserts = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(assigneeInserts[0][1]).toEqual([100, 5]); // 5 numerico, no '5' string
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 5 }));
    });

    it('updateTask: assignee_ids duplicados ([5,5]) no rompen el UNIQUE(task_id, user_id) - se dedupean antes del insert', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: null, status: 'todo' })
            .mockResolvedValueOnce({ id: 42, title: 'Tarea' });
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask({ params: { id: '42' }, body: { assignee_ids: [5, '5'] }, user: { id: 3 } } as unknown as AuthenticatedRequest, res);

        const insertCalls = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0][1]).toEqual(['42', 5]);
    });

    it('batchUpdateTasks: updates.assignee_ids duplicados se dedupean antes de insertar en task_assignees', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([
                { id: 1, column_id: 10, position: 1, board_id: 100, project_id: 7 }
            ])
            .mockResolvedValueOnce([]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { assignee_ids: [8, 8] } }, 3), res);

        const insertCalls = (db.run as jest.Mock).mock.calls.filter((c) => c[0].includes('INSERT INTO task_assignees'));
        expect(insertCalls).toHaveLength(1);
        expect(insertCalls[0][1]).toEqual([1, 8]);
    });
});
