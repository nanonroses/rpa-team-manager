jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn()
    }
}));

import { db } from '../../database/database';
import { financeService } from '../../services/financeService';
import { ProjectHealthService } from '../../services/projectHealthService';

describe('ProjectHealthService.freezeBaseline', () => {
    let service: ProjectHealthService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectHealthService();
    });

    it('lanza PROJECT_NOT_FOUND si el proyecto no existe', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce(null);

        await expect(service.freezeBaseline(999, 1)).rejects.toThrow('PROJECT_NOT_FOUND');
    });

    it('lanza PROJECT_MISSING_DATES si el proyecto no tiene start_date/end_date', async () => {
        (db.get as jest.Mock).mockResolvedValueOnce({ id: 1, start_date: null, end_date: '2026-06-01' });

        await expect(service.freezeBaseline(1, 1)).rejects.toThrow('PROJECT_MISSING_DATES');
    });

    it('lanza BASELINE_ALREADY_EXISTS si ya hay un baseline para el proyecto', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, start_date: '2026-01-01', end_date: '2026-06-01' })
            .mockResolvedValueOnce({ id: 5 });

        await expect(service.freezeBaseline(1, 1)).rejects.toThrow('BASELINE_ALREADY_EXISTS');
    });

    it('congela el baseline y copia planned_date a baseline_planned_date en los hitos', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, start_date: '2026-01-01', end_date: '2026-06-01' }) // proyecto
            .mockResolvedValueOnce(null) // no hay baseline previo
            .mockResolvedValueOnce({ // baseline recién insertado, para el SELECT final
                id: 1, project_id: 1, baseline_date: '2026-09-17', start_date: '2026-01-01',
                end_date: '2026-06-01', budgeted_cost_clp: 5000000, budgeted_hours: 400,
                created_by: 1, created_at: '2026-09-17'
            });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            planned_cost: 5000000, planned_hours: 400
        } as any);
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        const result = await service.freezeBaseline(1, 1);

        expect(db.beginTransaction).toHaveBeenCalled();
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO project_baselines'),
            [1, '2026-01-01', '2026-06-01', 5000000, 400, 1]
        );
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE project_milestones SET baseline_planned_date = planned_date'),
            [1]
        );
        expect(db.commit).toHaveBeenCalled();
        expect(result.budgeted_cost_clp).toBe(5000000);
    });

    it('hace rollback si la escritura falla', async () => {
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, start_date: '2026-01-01', end_date: '2026-06-01' })
            .mockResolvedValueOnce(null);
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            planned_cost: 5000000, planned_hours: 400
        } as any);
        (db.run as jest.Mock).mockRejectedValueOnce(new Error('disk full'));

        await expect(service.freezeBaseline(1, 1)).rejects.toThrow('disk full');
        expect(db.rollback).toHaveBeenCalled();
    });
});
