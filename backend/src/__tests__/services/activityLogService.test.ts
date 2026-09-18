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
