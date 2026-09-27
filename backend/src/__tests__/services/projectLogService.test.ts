jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { ProjectLogService } from '../../services/projectLogService';

describe('ProjectLogService.getForProject', () => {
    let service: ProjectLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectLogService();
    });

    it('devuelve las entradas del proyecto ordenadas de mas nueva a mas vieja', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { id: 2, project_id: 7, entry_type: 'decision', description: 'Segunda', file_id: null, created_by: 1, author_name: 'Ana', created_at: '2026-09-27' }
        ]);

        const result = await service.getForProject(7);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY l.created_at DESC, l.id DESC'),
            [7]
        );
        expect(result).toHaveLength(1);
    });
});

describe('ProjectLogService.create', () => {
    let service: ProjectLogService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectLogService();
    });

    it('inserta la entrada, recorta el texto y devuelve la fila creada', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 10, changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({
            id: 10, project_id: 7, entry_type: 'incident', description: 'Caída del servicio', file_id: null, created_by: 3, author_name: 'Ana', created_at: '2026-09-27'
        });

        const result = await service.create(7, 3, 'incident', '  Caída del servicio  ', null);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO project_log_entries'),
            [7, 'incident', 'Caída del servicio', null, 3]
        );
        expect(result.id).toBe(10);
    });
});
