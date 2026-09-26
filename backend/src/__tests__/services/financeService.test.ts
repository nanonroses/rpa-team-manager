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
                if (sql.includes('FROM time_entries') && sql.includes("approval_status = 'approved'")) {
                    return Promise.resolve({ hours: 0, cost: 0 });
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
                if (sql.includes('FROM time_entries') && sql.includes("approval_status = 'approved'")) {
                    return Promise.resolve({ hours: 0, cost: 0 });
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

        it('usa las horas y el costo realmente aprobados en vez de la proyección, cuando existen', async () => {
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
                    return Promise.resolve({ total_delay_hours: 5 }); // 5h de atraso del cliente, se suman igual
                }
                if (sql.includes('FROM time_entries') && sql.includes("approval_status = 'approved'")) {
                    // El equipo ya registró y aprobó 80h reales, a un costo distinto de la tarifa actual
                    return Promise.resolve({ hours: 80, cost: 80 * 16000 });
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

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.real_hours).toBe(80 + 5); // horas aprobadas + atraso del cliente
            expect(result.real_cost).toBe(80 * 16000 + 5 * 15000); // costo snapshot aprobado + atraso a tarifa vigente
            expect(result.planned_hours).toBe(100); // lo planificado no cambia
            expect(result.real_hours_source).toBe('approved');
            expect(result.approved_hours).toBe(80);
        });

        it('expone que el costo real viene de la proyección mientras no haya ninguna hora aprobada', async () => {
            mockScenario();

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.real_hours_source).toBe('projected');
            expect(result.approved_hours).toBe(0);
        });

        it('lanza un error legible si el proyecto no existe', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.query as jest.Mock).mockResolvedValue([]);

            await expect(financeService.calculateProjectFinancials(999)).rejects.toThrow('Project 999 not found');
        });
    });

    describe('getMonthlyHours', () => {
        it('devuelve 168 si el valor configurado no es un número positivo', async () => {
            (db.get as jest.Mock).mockResolvedValue({ setting_value: '0' });
            expect(await financeService.getMonthlyHours()).toBe(168);
            (db.get as jest.Mock).mockResolvedValue({ setting_value: 'abc' });
            expect(await financeService.getMonthlyHours()).toBe(168);
            (db.get as jest.Mock).mockResolvedValue({ setting_value: '170' });
            expect(await financeService.getMonthlyHours()).toBe(170);
        });
    });

    describe('calculateProjectFinancials - precio de venta guardado', () => {
        function mockWithFinancials(financials: any) {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM projects WHERE id')) return Promise.resolve({ id: 1, name: 'P', assigned_to: null });
                if (sql.includes('FROM project_financials')) return Promise.resolve(financials);
                if (sql.includes('FROM exchange_rates')) return Promise.resolve({ rate_to_clp: 38000 });
                if (sql.includes('FROM user_cost_rates')) return Promise.resolve({ hourly_rate: 10000, hourly_rate_currency: 'CLP' });
                if (sql.includes('FROM project_milestones')) return Promise.resolve({ total_delay_hours: 0 });
                if (sql.includes('FROM time_entries')) return Promise.resolve({ hours: 0, cost: 0 });
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockImplementation((sql: string) =>
                Promise.resolve(sql.includes('FROM project_assignments')
                    ? [{ user_id: 1, allocation_percentage: 100, full_name: 'Dev', role: 'rpa_developer' }]
                    : []));
        }

        it('usa project_financials.sale_price en CLP aunque no haya tarifa por hora cargada', async () => {
            mockWithFinancials({ budgeted_hours: 100, sale_price: 5000000, sale_price_currency: 'CLP', hourly_rate: null });

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.sale_price).toBe(5000000);
            expect(result.planned_cost).toBe(1000000);
            expect(result.planned_profit).toBe(4000000);
        });

        it('convierte a CLP un sale_price guardado en UF', async () => {
            mockWithFinancials({ budgeted_hours: 100, sale_price: 100, sale_price_currency: 'UF', hourly_rate: null });

            const result = await financeService.calculateProjectFinancials(1);

            expect(result.sale_price).toBe(3800000);
        });
    });
});
