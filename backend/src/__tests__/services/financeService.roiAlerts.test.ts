jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { FinanceService } from '../../services/financeService';

describe('FinanceService.syncROIAlerts', () => {
    let financeService: FinanceService;

    beforeEach(() => {
        jest.clearAllMocks();
        financeService = new FinanceService();
    });

    it('crea una alerta cost_overrun cuando el costo real supera el 80% del precio de venta', async () => {
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            project_id: 1, project_name: 'AGROSUPER', planned_hours: 100, real_hours: 100,
            client_delay_hours: 0, hourly_rate_uf: 1, uf_value_clp: 38000, engineer_hourly_cost: 15000,
            assigned_users: 1, user_cost_breakdown: [], sale_price: 1000000, planned_cost: 900000,
            real_cost: 900000, planned_profit: 100000, real_profit: 100000, planned_roi: 11, real_roi: 11,
            delay_impact: 0, lost_profit: 0
        } as any);
        (db.get as jest.Mock).mockResolvedValue(undefined); // no hay alerta activa previa
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await financeService.syncROIAlerts(1);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO roi_alerts'),
            expect.arrayContaining([1, 'cost_overrun'])
        );
    });

    it('crea una alerta low_margin cuando el ROI real es menor a 20%', async () => {
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            project_id: 1, project_name: 'AGROSUPER', planned_hours: 100, real_hours: 100,
            client_delay_hours: 0, hourly_rate_uf: 1, uf_value_clp: 38000, engineer_hourly_cost: 15000,
            assigned_users: 1, user_cost_breakdown: [], sale_price: 1000000, planned_cost: 500000,
            real_cost: 500000, planned_profit: 500000, real_profit: 500000, planned_roi: 15, real_roi: 15,
            delay_impact: 0, lost_profit: 0
        } as any);
        (db.get as jest.Mock).mockResolvedValue(undefined);
        (db.run as jest.Mock).mockResolvedValue({ id: 2, changes: 1 });

        await financeService.syncROIAlerts(1);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO roi_alerts'),
            expect.arrayContaining([1, 'low_margin'])
        );
    });

    it('resuelve una alerta cost_overrun previa si el costo ya no supera el umbral', async () => {
        jest.spyOn(financeService, 'calculateProjectFinancials').mockResolvedValue({
            project_id: 1, project_name: 'AGROSUPER', planned_hours: 100, real_hours: 100,
            client_delay_hours: 0, hourly_rate_uf: 1, uf_value_clp: 38000, engineer_hourly_cost: 15000,
            assigned_users: 1, user_cost_breakdown: [], sale_price: 1000000, planned_cost: 100000,
            real_cost: 100000, planned_profit: 900000, real_profit: 900000, planned_roi: 900, real_roi: 900,
            delay_impact: 0, lost_profit: 0
        } as any);
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes("alert_type = 'cost_overrun'")) return Promise.resolve({ id: 99 });
            return Promise.resolve(undefined);
        });
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

        await financeService.syncROIAlerts(1);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('is_resolved = 1'),
            expect.arrayContaining([99])
        );
    });
});
