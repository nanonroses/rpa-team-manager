jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

jest.mock('../../services/authService', () => ({
    AuthService: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('../../middleware/auth', () => {
    const actual = jest.requireActual('../../middleware/auth');
    return {
        ...actual,
        authenticate: (req: any, _res: any, next: any) => {
            req.user = { id: 1, role: req.headers['x-test-role'] };
            next();
        }
    };
});

import express from 'express';
import request from 'supertest';
import { db } from '../../database/database';
import financialRoutes from '../../routes/financialRoutes';

const app = express();
app.use(express.json());
app.use('/api/financial', financialRoutes);

const protectedRoutes: Array<['get' | 'post', string]> = [
    ['get', '/api/financial/project-roi/1'],
    ['post', '/api/financial/project-financial'],
    ['get', '/api/financial/dashboard'],
    ['get', '/api/financial/team-costs'],
    ['get', '/api/financial/user-costs']
];

describe('financialRoutes - solo team_lead', () => {
    it.each(['rpa_developer', 'rpa_operations', 'it_support'])('%s recibe 403 en todas las rutas financieras', async (role) => {
        for (const [method, url] of protectedRoutes) {
            const res = await request(app)[method](url).set('x-test-role', role).send({});
            expect({ url, status: res.status }).toEqual({ url, status: 403 });
        }
    });

    it('team_lead obtiene el equipo con su costo vigente en /team-costs', async () => {
        (db.get as jest.Mock).mockResolvedValue({ setting_value: '176' });
        (db.query as jest.Mock).mockResolvedValue([
            { user_id: 2, full_name: 'Dev Uno', email: 'd@x.cl', role: 'rpa_developer', cost_rate_id: 5, monthly_cost: 1760000, hourly_rate: 10000, effective_from: '2026-09-01' }
        ]);

        const res = await request(app).get('/api/financial/team-costs').set('x-test-role', 'team_lead');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            monthly_hours: 176,
            members: [{ user_id: 2, full_name: 'Dev Uno', email: 'd@x.cl', role: 'rpa_developer', cost_rate_id: 5, monthly_cost: 1760000, hourly_rate: 10000, effective_from: '2026-09-01' }]
        });
    });
});
