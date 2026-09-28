jest.mock('../../database/database', () => ({ db: { get: jest.fn(), query: jest.fn(), run: jest.fn() } }));
import { db } from '../../database/database';
import { FinanceService } from '../../services/financeService';

describe('Project planning inputs', () => {
  const calculate = async (financials: any, hours = 0) => {
    const service = new FinanceService();
    (db.get as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT * FROM projects')) return { name: 'Agrotop' };
      if (sql.includes('SELECT * FROM project_financials')) return financials;
      if (sql.includes('SUM(t.estimated_hours)')) return { hours };
      return { hours: 0, cost: 0 };
    });
    jest.spyOn(service, 'getExchangeRate').mockResolvedValue(38000);
    jest.spyOn(service, 'getBlendedHourlyCostCLP').mockResolvedValue({ hourlyCostCLP: 10000, breakdown: [] });
    jest.spyOn(service, 'getClientDelayHours').mockResolvedValue(0);
    return service.calculateProjectFinancials(2);
  };
  it('uses an explicit cost budget and its currency', async () => {
    const result = await calculate({ budgeted_hours: 20, budgeted_cost: 10, budgeted_cost_currency: 'UF', sale_price: 1000000 });
    expect(result.planned_cost).toBe(380000);
    expect(result.real_cost).toBe(380000);
    expect(result.financial_data_complete).toBe(true);
  });
  it('uses task estimates when budgeted hours are missing', async () => {
    const result = await calculate({ sale_price: 1000000 }, 25);
    expect(result.planned_hours).toBe(25);
    expect(result.planned_hours_source).toBe('tasks');
    expect(result.planned_cost).toBe(250000);
  });
  it('reports incomplete planning without inventing hours', async () => {
    const result = await calculate({ sale_price: 1000000 });
    expect(result.financial_data_complete).toBe(false);
    expect(result.planned_hours).toBe(0);
    expect(result.missing_financial_data).toContain('Horas planificadas');
  });
});
