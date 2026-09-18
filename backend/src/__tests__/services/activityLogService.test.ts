jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

import { db } from '../../database/database';
import { ActivityLogService } from '../../services/activityLogService';

describe('ActivityLogService.logActivity', () => {
    let service: ActivityLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ActivityLogService();
    });

    it('inserta la fila con old_values/new_values serializados a JSON', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.logActivity(3, 'project', 7, 'updated', { name: 'A' }, { name: 'B' });

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO activity_log'),
            [3, 'project', 7, 'updated', JSON.stringify({ name: 'A' }), JSON.stringify({ name: 'B' })]
        );
    });

    it('guarda null cuando old_values/new_values no se pasan', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.logActivity(3, 'project', 7, 'deleted', null, null);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO activity_log'),
            [3, 'project', 7, 'deleted', null, null]
        );
    });

    it('guarda user_id null cuando userId es undefined', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.logActivity(undefined, 'project', 7, 'created', null, null);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO activity_log'),
            [null, 'project', 7, 'created', null, null]
        );
    });

    it('nunca lanza si el insert falla (error solo se loguea)', async () => {
        (db.run as jest.Mock).mockRejectedValue(new Error('disk full'));

        await expect(service.logActivity(3, 'project', 7, 'created', null, null)).resolves.toBeUndefined();
    });
});

describe('ActivityLogService.getProjectActivity', () => {
    let service: ActivityLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ActivityLogService();
    });

    it('consulta eventos de proyecto y de tasks del proyecto, con paginación', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            {
                id: 2, user_id: 3, user_name: 'Ana', entity_type: 'task', entity_id: 10,
                action: 'created', old_values: null, new_values: '{"title":"Nueva tarea"}',
                created_at: '2026-09-18T10:00:00Z'
            },
            {
                id: 1, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
                action: 'created', old_values: null, new_values: '{"name":"AGROSUPER"}',
                created_at: '2026-09-17T10:00:00Z'
            }
        ]);

        const result = await service.getProjectActivity(7, { limit: 50, offset: 0 });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("entity_type = 'project'"),
            [7, 7, 50, 0]
        );
        // El branch de tasks del proyecto (feature principal del feed combinado) debe seguir presente.
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('tb.project_id = ?'),
            [7, 7, 50, 0]
        );
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY al.created_at DESC, al.id DESC'),
            [7, 7, 50, 0]
        );
        expect(result).toHaveLength(2);
        expect(result[0].new_values).toEqual({ title: 'Nueva tarea' });
        expect(result[1].new_values).toEqual({ name: 'AGROSUPER' });
    });

    it('devuelve old_values/new_values null si vienen null o el JSON es inválido', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            {
                id: 1, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
                action: 'created', old_values: null, new_values: 'no-es-json',
                created_at: '2026-09-17T10:00:00Z'
            }
        ]);

        const result = await service.getProjectActivity(7, { limit: 50, offset: 0 });

        expect(result[0].old_values).toBeNull();
        expect(result[0].new_values).toBeNull();
    });
});

describe('ActivityLogService.getTaskActivity', () => {
    let service: ActivityLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ActivityLogService();
    });

    it('consulta solo eventos entity_type=task de esa tarea, con paginación', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            {
                id: 5, user_id: 3, user_name: 'Ana', entity_type: 'task', entity_id: 10,
                action: 'updated', old_values: '{"status":"todo"}', new_values: '{"status":"in_progress"}',
                created_at: '2026-09-18T11:00:00Z'
            }
        ]);

        const result = await service.getTaskActivity(10, { limit: 20, offset: 0 });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining("entity_type = 'task'"),
            [10, 20, 0]
        );
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY al.created_at DESC, al.id DESC'),
            [10, 20, 0]
        );
        expect(result[0].old_values).toEqual({ status: 'todo' });
        expect(result[0].new_values).toEqual({ status: 'in_progress' });
    });
});
