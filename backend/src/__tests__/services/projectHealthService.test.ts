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

describe('ProjectHealthService.getProjectHealth', () => {
    let service: ProjectHealthService;
    const TODAY = '2026-09-17';

    beforeEach(() => {
        jest.clearAllMocks();
        service = new ProjectHealthService();
        jest.useFakeTimers().setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('devuelve insufficient_data si el proyecto no tiene baseline', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 50, baseline_planned_date: null }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce(null); // sin baseline

        const health = await service.getProjectHealth(1);

        expect(health.status).toBe('insufficient_data');
        expect(health.has_baseline).toBe(false);
        expect(health.semaphore).toBe('gray');
        expect(health.spi).toBeNull();
        expect(health.cpi).toBeNull();
        expect(health.ev_percentage).toBe(50);
    });

    it('devuelve insufficient_data si el baseline no tiene ningún hito con baseline_planned_date', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 0, baseline_planned_date: null }
        ]);
        (db.get as jest.Mock).mockResolvedValueOnce({
            id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 5000000
        });

        const health = await service.getProjectHealth(1);

        expect(health.status).toBe('insufficient_data');
        expect(health.has_baseline).toBe(true);
        expect(health.semaphore).toBe('gray');
    });

    it('calcula SPI<1 y semáforo rojo cuando los hitos van atrasados', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 100, baseline_planned_date: '2026-01-01' }, // a tiempo
            { completion_percentage: 0, baseline_planned_date: '2026-02-01' },   // debía estar listo, no lo está
            { completion_percentage: 0, baseline_planned_date: '2026-12-01' }    // futuro, no cuenta en PV
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 6000000 })
            .mockResolvedValueOnce({ status: 'active', actual_end_date: null });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            real_cost: 4000000,
            real_hours_source: 'approved'
        } as any);

        const health = await service.getProjectHealth(1);

        // EV% = (100+0+0)/3 = 33.33 ; PV% = 2 de 3 hitos con baseline_planned_date <= hoy => 66.67
        expect(health.status).toBe('ok');
        expect(health.ev_percentage).toBeCloseTo(33.33, 1);
        expect(health.pv_percentage).toBeCloseTo(66.67, 1);
        expect(health.spi).toBeLessThan(1);
        expect(health.cpi).not.toBeNull();
        expect(health.semaphore).toBe('red');
        expect(health.projected_end_date).not.toBeNull();
        expect(health.schedule_variance_days).toBeGreaterThan(0);
    });

    it('devuelve cpi null y clasifica el semáforo solo por SPI cuando real_hours_source es "projected"', async () => {
        // Todos los hitos con baseline están a tiempo y completos => SPI >= 1, pero real_cost es
        // el placeholder de financeService (no hay horas aprobadas todavía), así que el CPI que se
        // calcularía a partir de él no significa nada y NO debe pintar el semáforo en rojo.
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 100, baseline_planned_date: '2026-01-01' },
            { completion_percentage: 100, baseline_planned_date: '2026-02-01' }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 6000000 })
            .mockResolvedValueOnce({ status: 'active', actual_end_date: null });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            real_cost: 6000000, // == planned_cost: el placeholder de financeService cuando no hay horas aprobadas
            real_hours_source: 'projected'
        } as any);

        const health = await service.getProjectHealth(1);

        expect(health.spi).toBeGreaterThanOrEqual(1);
        expect(health.cpi).toBeNull();
        expect(health.semaphore).toBe('green');
    });

    it('usa actual_end_date en vez de proyectar cuando el proyecto ya está completed', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 100, baseline_planned_date: '2026-01-01' }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 6000000 })
            .mockResolvedValueOnce({ status: 'completed', actual_end_date: '2026-07-01' });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            real_cost: 6000000
        } as any);

        const health = await service.getProjectHealth(1);

        expect(health.projected_end_date).toBe('2026-07-01');
        expect(health.schedule_variance_days).toBe(30);
    });

    it('proyecta la fecha de fin exacta del baseline cuando SPI implica la misma duración (regresión de zona horaria)', async () => {
        // Con SPI == 1, projectedDurationDays == baselineDurationDays, así que projected_end_date debe
        // ser EXACTAMENTE end_date ('2026-06-01'), sin corrimiento de un día. `new Date('2026-06-01')`
        // parsea como medianoche UTC; en cualquier host al oeste de UTC (p.ej. America/Santiago, la zona
        // de este proyecto) eso cae en el día calendario anterior en hora local, y differenceInCalendarDays/
        // addDays (que operan en hora local) arrastrarían ese error. parseISO no tiene ese problema.
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 100, baseline_planned_date: '2026-01-01' }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 6000000 })
            .mockResolvedValueOnce({ status: 'active', actual_end_date: null });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            real_cost: 6000000,
            real_hours_source: 'approved'
        } as any);

        const health = await service.getProjectHealth(1);

        expect(health.spi).toBe(1);
        expect(health.projected_end_date).toBe('2026-06-01');
        expect(health.schedule_variance_days).toBe(0);
    });

    it('no deja que un hito posterior al freeze del baseline arrastre el SPI hacia abajo', async () => {
        // 2 hitos con baseline_planned_date (ambos vencidos y 100% completos) + 1 hito agregado
        // después del freeze (sin baseline_planned_date) en 0%. ev_percentage (público) debe reflejar
        // los 3 hitos, pero SPI debe calcularse como si el hito nuevo no existiera.
        (db.query as jest.Mock).mockResolvedValue([
            { completion_percentage: 100, baseline_planned_date: '2026-01-01' },
            { completion_percentage: 100, baseline_planned_date: '2026-02-01' },
            { completion_percentage: 0, baseline_planned_date: null }
        ]);
        (db.get as jest.Mock)
            .mockResolvedValueOnce({ id: 1, project_id: 1, start_date: '2026-01-01', end_date: '2026-06-01', budgeted_cost_clp: 6000000 })
            .mockResolvedValueOnce({ status: 'active', actual_end_date: null });
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            real_cost: 6000000,
            real_hours_source: 'approved'
        } as any);

        const health = await service.getProjectHealth(1);

        // ev_percentage: (100+100+0)/3 = 66.67 (incluye el hito nuevo, como debe ser)
        expect(health.ev_percentage).toBeCloseTo(66.67, 1);
        // SPI: sobre los 2 hitos con baseline, ambos vencidos y 100% => EV%=100, PV%=100 => SPI=1
        expect(health.spi).toBe(1);
        expect(health.semaphore).not.toBe('red');
    });
});
