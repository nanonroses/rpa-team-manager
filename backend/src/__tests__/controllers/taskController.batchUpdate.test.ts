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
import { activityLogService } from '../../services/activityLogService';
import { notificationService } from '../../services/notificationService';
import { TaskController } from '../../controllers/taskController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function req(body: any, userId = 3): AuthenticatedRequest {
    return { body, user: { id: userId } } as unknown as AuthenticatedRequest;
}

describe('TaskController - batchUpdateTasks (edicion masiva)', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('devuelve 400 si taskIds esta vacio o invalido, sin tocar la BD', async () => {
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [], updates: { priority: 'high' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve 400 si updates no trae ningun campo reconocido', async () => {
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: {} }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve 400 si priority no es un valor valido', async () => {
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { priority: 'urgentisimo' } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('excluye en skipped las tareas sin acceso, sin romper el resto del batch', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 999], updates: { priority: 'high' } }), res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true, updated: [1], updatedCount: 1, skipped: [999]
        }));
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET priority = ?'),
            expect.arrayContaining(['high', 1])
        );
    });

    it('devuelve success con updated/skipped vacios de mas si ninguna tarea es accesible, sin abrir transaccion', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [999], updates: { priority: 'high' } }), res);

        expect(res.json).toHaveBeenCalledWith({ success: true, updated: [], updatedCount: 0, skipped: [999] });
        expect(db.beginTransaction).not.toHaveBeenCalled();
    });

    it('devuelve 400 si la columna destino no existe', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce(undefined);
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { column_id: 999 } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.beginTransaction).not.toHaveBeenCalled();
    });

    it('devuelve 400 entero si la columna destino pertenece a otro board (no aplica nada parcialmente)', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 20, board_id: 200 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { column_id: 20 } }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.beginTransaction).not.toHaveBeenCalled();
        expect(db.run).not.toHaveBeenCalled();
    });

    it('mueve varias tareas a la misma columna destino con positions secuenciales distintas', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 },
            { id: 2, column_id: 10, position: 2, assignee_id: 6, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 20, board_id: 100 })   // target column lookup
            .mockResolvedValueOnce({ max_position: 3 });         // max position en columna 20
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { column_id: 20 } }), res);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET column_id = ?, position = ?'),
            [20, 4, 1]
        );
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET column_id = ?, position = ?'),
            [20, 5, 2]
        );
        expect(db.commit).toHaveBeenCalled();
    });

    it('no mueve una tarea que ya esta en la columna destino (no-op de posicion)', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 20, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 20, board_id: 100 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { column_id: 20 } }), res);

        expect(db.run).not.toHaveBeenCalledWith(
            expect.stringContaining('UPDATE tasks SET column_id = ?, position = ?'),
            expect.anything()
        );
    });

    it('no renumera la columna de origen al mover tareas a otra columna (no destruye el orden manual)', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 },
            { id: 2, column_id: 10, position: 2, assignee_id: 6, board_id: 100, project_id: 7 }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 20, board_id: 100 })   // target column lookup
            .mockResolvedValueOnce({ max_position: 3 });         // max position en columna 20
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { column_id: 20 } }), res);

        expect(db.run).toHaveBeenCalledTimes(2);
        expect(db.run).not.toHaveBeenCalledWith(
            expect.stringContaining('SELECT COUNT(*)'),
            expect.anything()
        );
        expect(db.commit).toHaveBeenCalled();
    });

    it('agrupa el log de actividad por proyecto con action=tasks_batch_updated', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 },
            { id: 2, column_id: 10, position: 2, assignee_id: 6, board_id: 200, project_id: 9 }
        ]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2], updates: { priority: 'critical' } }), res);

        expect(activityLogService.logActivity).toHaveBeenCalledTimes(2);
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 7, 'tasks_batch_updated', null, expect.objectContaining({ count: 1 })
        );
        expect(activityLogService.logActivity).toHaveBeenCalledWith(
            3, 'project', 9, 'tasks_batch_updated', null, expect.objectContaining({ count: 1 })
        );
    });

    it('reasignar 3 tareas al mismo usuario nuevo dispara UNA sola notificacion agrupada', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([
                { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 },
                { id: 2, column_id: 10, position: 2, assignee_id: 5, board_id: 100, project_id: 7 },
                { id: 3, column_id: 10, position: 3, assignee_id: 6, board_id: 100, project_id: 7 }
            ])
            .mockResolvedValue([]); // responsables actuales de cada tarea (ninguna tenia al 8)
        (db.run as jest.Mock).mockResolvedValue({ changes: 3 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1, 2, 3], updates: { assignee_id: 8 } }), res);

        expect(notificationService.notify).toHaveBeenCalledTimes(1);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 8, eventKey: 'task_assigned', senderId: 3
        }));
        expect((notificationService.notify as jest.Mock).mock.calls[0][0].message).toContain('3');
    });

    it('no notifica si el nuevo assignee_id es el mismo usuario que hace el cambio', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([
                { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
            ])
            .mockResolvedValue([]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { assignee_id: 3 } }, 3), res);

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('no notifica si ninguna tarea cambia realmente de assignee_id', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([
                { id: 1, column_id: 10, position: 1, assignee_id: 8, board_id: 100, project_id: 7 }
            ])
            .mockResolvedValueOnce([{ user_id: 8 }]); // 8 ya era responsable via task_assignees
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { assignee_id: 8 } }), res);

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('hace rollback si una escritura dentro de la transaccion falla', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([
            { id: 1, column_id: 10, position: 1, assignee_id: 5, board_id: 100, project_id: 7 }
        ]);
        (db.run as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
        const res = mockRes();

        await controller.batchUpdateTasks(req({ taskIds: [1], updates: { priority: 'high' } }), res);

        expect(db.rollback).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
