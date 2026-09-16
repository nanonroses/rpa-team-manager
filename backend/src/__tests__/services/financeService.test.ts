/**
 * Tests para FinanceService
 * Fase 1 - Núcleo de datos nuevo: motor financiero único (costo, venta, margen, ROI)
 */

jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn(),
    }
}));

import { db } from '../../database/database';
import { FinanceService } from '../../services/financeService';

describe('FinanceService', () => {
    let financeService: FinanceService;

    beforeEach(() => {
        jest.clearAllMocks();
        financeService = new FinanceService();
    });

    describe('getExchangeRate / toCLP', () => {
        it('CLP siempre convierte 1:1 sin consultar exchange_rates', async () => {
            const rate = await financeService.getExchangeRate('CLP');
            expect(rate).toBe(1);
            expect(db.get).not.toHaveBeenCalled();
        });

        it('convierte UF a CLP usando la tasa vigente más reciente', async () => {
            (db.get as jest.Mock).mockResolvedValue({ rate_to_clp: 38000 });

            const rate = await financeService.getExchangeRate('UF', '2026-09-16');
            expect(rate).toBe(38000);

            const clpAmount = await financeService.toCLP(2, 'UF');
            expect(clpAmount).toBe(2 * 38000);
        });

        it('devuelve 0 y no lanza si no hay tasa configurada para la moneda/fecha', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            const rate = await financeService.getExchangeRate('USD', '2020-01-01');
            expect(rate).toBe(0);
        });
    });

    describe('calculateProjectFinancials', () => {
        function mockScenario() {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM projects WHERE id')) {
                    return Promise.resolve({ id: 1, name: 'Proyecto Test', assigned_to: null });
                }
                if (sql.includes('FROM project_financials')) {
                    // Costo en UF, venta también depende de UF -> CLP
                    return Promise.resolve({
                        budgeted_hours: 100,
                        hourly_rate: 1, // 1 UF por hora vendida al cliente
                        hourly_rate_currency: 'UF'
                    });
                }
                if (sql.includes('FROM exchange_rates')) {
                    return Promise.resolve({ rate_to_clp: 38000 }); // 1 UF = 38.000 CLP
                }
                if (sql.includes('FROM user_cost_rates')) {
                    return Promise.resolve({ hourly_rate: 15000, hourly_rate_currency: 'CLP' });
                }
                if (sql.includes('FROM project_milestones')) {
                    return Promise.resolve({ total_delay_hours: 0 });
                }
                return Promise.resolve(undefined);
            });

            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM project_assignments')) {
                    return Promise.resolve([
                        { user_id: 1, allocation_percentage: 100, full_name: 'Dev Uno', role: 'rpa_developer' }
                    ]);
                }
                return Promise.resolve([]);
            });
        }

        it('calcula venta en CLP a partir de una tarifa en UF y un margen correcto', async () => {
            mockScenario();

            const result = await financeService.calculateProjectFinancials(1);

            // sale_price = 100h * 1 UF/h * 38.000 CLP/UF
            expect(result.sale_price).toBe(3_800_000);
            // costo = 100h * 15.000 CLP/h (tarifa del único desarrollador asignado, 100% allocation)
            expect(result.planned_cost).toBe(1_500_000);
            expect(result.real_cost).toBe(1_500_000);
            expect(result.planned_profit).toBe(3_800_000 - 1_500_000);
            // ROI = margen / costo * 100
            expect(result.planned_roi).toBeCloseTo(((3_800_000 - 1_500_000) / 1_500_000) * 100, 2);
            expect(result.real_roi).toBe(result.planned_roi);
        });

        it('las horas de atraso atribuibles al cliente suben el costo real pero no el planificado', async () => {
            mockScenario();
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM projects WHERE id')) {
                    return Promise.resolve({ id: 1, name: 'Proyecto Test', assigned_to: null });
                }
                if (sql.includes('FROM project_financials')) {
                    return Promise.resolve({ budgeted_hours: 100, hourly_rate: 1, hourly_rate_currency: 'UF' });
                }
                if (sql.includes('FROM exchange_rates')) {
                    return Promise.resolve({ rate_to_clp: 38000 });
                }
                if (sql.includes('FROM user_cost_rates')) {
                    return Promise.resolve({ hourly_rate: 15000, hourly_rate_currency: 'CLP' });
                }
                if (sql.includes('FROM project_milestones')) {
                    return Promise.resolve({ total_delay_hours: 10 }); // 10h de atraso del cliente
                }
                return Promise.resolve(undefined);
            });

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.planned_hours).toBe(100);
            expect(result.real_hours).toBe(110);
            expect(result.planned_cost).toBe(1_500_000);
            expect(result.real_cost).toBe(110 * 15000);
            expect(result.real_cost).toBeGreaterThan(result.planned_cost);
            expect(result.real_roi).toBeLessThan(result.planned_roi);
        });

        it('lanza un error legible si el proyecto no existe', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockResolvedValue([]);

            await expect(financeService.calculateProjectFinancials(999)).rejects.toThrow('Project 999 not found');
        });
    });
});
