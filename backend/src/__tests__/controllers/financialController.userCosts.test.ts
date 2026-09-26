jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { db } from '../../database/database';
import { FinancialController } from '../../controllers/financialController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

const lead = { id: 1, role: 'team_lead' };

function mockDb(monthlyHours: string | null) {
    (db.get as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes('FROM users WHERE id')) return Promise.resolve({ id: 2 });
        if (sql.includes('global_settings')) return Promise.resolve(monthlyHours === null ? undefined : { setting_value: monthlyHours });
        if (sql.includes('FROM user_cost_rates ucr')) return Promise.resolve({ id: 10, user_id: 2 });
        return Promise.resolve(undefined);
    });
    (db.run as jest.Mock).mockResolvedValue({ id: 10, changes: 1 });
}

function insertParams(): any[] {
    const call = (db.run as jest.Mock).mock.calls.find(([sql]) => sql.includes('INSERT INTO user_cost_rates'));
    return call[1];
}

describe('FinancialController - costo empresa por persona', () => {
    let controller: FinancialController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new FinancialController();
    });

    it('calcula el valor HH con las horas mensuales configuradas (no con 160)', async () => {
        mockDb('176');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: 1760000, effective_from: '2026-09-25' } } as unknown as AuthenticatedRequest, res);

        expect(res.status).toHaveBeenCalledWith(201);
        const [userId, monthlyCost, hourlyRate, effectiveFrom] = insertParams();
        expect({ userId, monthlyCost, hourlyRate, effectiveFrom }).toEqual({ userId: 2, monthlyCost: 1760000, hourlyRate: 10000, effectiveFrom: '2026-09-25' });
    });

    it('si monthly_hours no es un número válido usa 168 (nunca NaN ni Infinity)', async () => {
        mockDb('abc');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: 1760000 } } as unknown as AuthenticatedRequest, res);

        expect(insertParams()[2]).toBe(10476.19);
    });

    it('usa la fecha de hoy si no viene effective_from', async () => {
        mockDb('176');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: 1760000 } } as unknown as AuthenticatedRequest, res);

        expect(insertParams()[3]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it.each([0, -5, '1000', null])('rechaza con 400 un costo empresa inválido (%p)', async (monthlyCost) => {
        mockDb('176');
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 2, monthly_cost: monthlyCost } } as unknown as AuthenticatedRequest, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(db.run).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un usuario inexistente', async () => {
        mockDb('176');
        (db.get as jest.Mock).mockImplementation((sql: string) =>
            Promise.resolve(sql.includes('FROM users WHERE id') ? undefined : { setting_value: '176' }));
        const res = mockRes();
        await controller.createUserCost({ user: lead, body: { user_id: 99, monthly_cost: 1000000 } } as unknown as AuthenticatedRequest, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});
