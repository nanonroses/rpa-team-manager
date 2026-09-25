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
jest.mock('../../services/taskDependencyService', () => ({
    taskDependencyService: {
        getDependenciesForTask: jest.fn(),
        createDependency: jest.fn(),
        deleteDependency: jest.fn()
    },
    TaskDependencyError: class TaskDependencyError extends Error {
        status: number;
        constructor(message: string, status = 400) { super(message); this.status = status; }
    }
}));
jest.mock('../../services/commentService', () => ({
    commentService: {
        getForEntity: jest.fn(), create: jest.fn(), findById: jest.fn(),
        update: jest.fn(), delete: jest.fn(), getMentionableUsers: jest.fn()
    }
}));

import fs from 'fs';
import path from 'path';
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

function req(params: any = {}, body: any = {}, userId = 3): AuthenticatedRequest {
    return { params, body, query: {}, user: { id: userId } } as unknown as AuthenticatedRequest;
}

describe('TaskController - acceso multi-asignado (co-responsable via task_assignees)', () => {
    let controller: TaskController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new TaskController();
    });

    it('getTaskById: un usuario que SOLO es co-responsable via task_assignees tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42, title: 'Tarea', project_id: 7 });
        const res = mockRes();

        await controller.getTaskById(req({ id: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
        const [sql, params] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toEqual(['42', 9, 9, 9]);
    });

    it('updateTask: la query de chequeo de acceso usa EXISTS contra task_assignees, no assignee_id directo', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42, project_id: 7, assignee_id: 5, status: 'todo' }) // access check
            .mockResolvedValueOnce({ max_position: 1 }) // no aplica (sin column_id)
            .mockResolvedValueOnce({ id: 42, title: 'Tarea', assignee_id: 5 }); // updated task
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const res = mockRes();

        await controller.updateTask(req({ id: '42' }, { title: 'Nuevo titulo' }, 9), res);

        const [sql, params] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toEqual(['42', 9, 9, 9]);
    });

    it('getTaskSubtasks: co-responsable via task_assignees tiene acceso a subtareas', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42 });
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTaskSubtasks(req({ taskId: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
        const [sql] = (db.get as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
    });

    it('createTaskDependency: ambos chequeos de acceso (tarea y depends_on_task) usan EXISTS', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 42 })
            .mockResolvedValueOnce({ id: 43 });
        const res = mockRes();

        await controller.createTaskDependency(req({ taskId: '42' }, { depends_on_task_id: 43 }, 9), res);

        expect((db.get as jest.Mock).mock.calls[0][0]).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect((db.get as jest.Mock).mock.calls[1][0]).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
    });

    it('getTaskCollaborators: co-responsable via task_assignees tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42 });
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTaskCollaborators(req({ taskId: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
    });

    it('getTaskComments: co-responsable via task_assignees tiene acceso', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 42 });
        const { commentService } = require('../../services/commentService');
        commentService.getForEntity.mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTaskComments(req({ taskId: '42' }, {}, 9), res);

        expect(res.status).not.toHaveBeenCalledWith(404);
    });

    it('batchUpdateTasks: la query de tareas accesibles usa EXISTS contra task_assignees', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.batchUpdateTasks(req({}, { taskIds: [42], updates: { priority: 'high' } }, 9), res);

        const [sql] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
    });

    it('getTasks: el filtro ?assignee_id= comprueba pertenencia a task_assignees, no igualdad directa', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getTasks({ query: { assignee_id: '9' }, user: { id: 9 } } as unknown as AuthenticatedRequest, res);

        const [sql, params] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toContain('9');
    });

    it('getMyTasks: incluye tareas donde el usuario es co-responsable via task_assignees, no solo assignee_id principal', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        const res = mockRes();

        await controller.getMyTasks(req({}, {}, 9), res);

        const [sql, params] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = ?)');
        expect(params).toEqual([9]);
    });

    it('no queda ningun chequeo de acceso residual con el criterio viejo (t.assignee_id = ? dentro de un OR de acceso)', () => {
        const source = fs.readFileSync(
            path.join(__dirname, '../../controllers/taskController.ts'),
            'utf-8'
        );

        // Cualquier "OR t.assignee_id = ?" (el criterio viejo de acceso) ya no debe existir:
        // todos los sitios de control de acceso deben usar el EXISTS contra task_assignees.
        expect(source).not.toMatch(/OR t\.assignee_id = \?/);

        // El JOIN de lectura legitimo (para mostrar nombre/avatar del responsable principal)
        // SI debe seguir existiendo tal cual, no se toca:
        expect(source).toContain('LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id');
    });
});
