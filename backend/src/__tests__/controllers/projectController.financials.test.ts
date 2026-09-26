// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user, body, params, query: {} } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

describe('ProjectController - persistencia financiera (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let lead: { id: number; role: string };
    let ops: { id: number; role: string };
    let dev: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        ops = { id: users.ops, role: 'rpa_operations' };
        dev = { id: users.dev, role: 'rpa_developer' };
        controller = new ProjectController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    async function createAs(user: { id: number; role: string }, body: any): Promise<any> {
        const res = mockRes();
        await controller.createProject(makeReq(user, { project_type: 'internal', ...body }), res);
        expect(res.status).toHaveBeenCalledWith(201);
        return jsonOf(res);
    }

    it('team_lead crea un proyecto interno con precio y horas: se guardan en project_financials', async () => {
        const created = await createAs(lead, { name: 'P1', budget: 5000000, sale_price: 12000000, hours_budgeted: 300 });

        expect(created.project_type).toBe('internal');
        expect(created.status).toBe('on_hold');
        const fin = await testDb.get('SELECT * FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin).toMatchObject({ budgeted_cost: 5000000, sale_price: 12000000, budgeted_hours: 300 });
    });

    it('guarda client_id, area_id, pm_user_id, project_type y currency en projects', async () => {
        const client = await testDb.run(`INSERT INTO clients (name, created_by) VALUES ('Cliente X', ?)`, [users.lead]);
        const area = await testDb.get(`SELECT id FROM business_areas WHERE code = 'RPA_IA'`);

        const created = await createAs(lead, {
            name: 'P-v27', client_id: client.id, area_id: area.id, pm_user_id: users.lead, project_type: 'internal', currency: 'UF'
        });

        const row = await testDb.get('SELECT client_id, area_id, pm_user_id, project_type, currency FROM projects WHERE id = ?', [created.id]);
        expect(row).toEqual({ client_id: client.id, area_id: area.id, pm_user_id: users.lead, project_type: 'internal', currency: 'UF' });
    });

    it('rpa_operations puede crear el proyecto, pero el sale_price que envía se ignora y no aparece en la respuesta', async () => {
        const created = await createAs(ops, { name: 'P-ops', budget: 1000, sale_price: 999999 });

        const fin = await testDb.get('SELECT sale_price, budgeted_cost FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin).toEqual({ sale_price: null, budgeted_cost: 1000 });
        expect(created).not.toHaveProperty('sale_price');
    });

    it('rpa_operations crea un proyecto y el servidor lo autoasigna, ignorando assigned_to del body', async () => {
        const created = await createAs(ops, { name: 'P-ops-self', assigned_to: users.dev });

        expect(created.assigned_to).toBe(ops.id);
        const assignment = await testDb.get(
            'SELECT * FROM project_assignments WHERE project_id = ? AND user_id = ?',
            [created.id, ops.id]
        );
        expect(assignment).toMatchObject({
            user_id: ops.id,
            role: 'lead',
            allocation_percentage: 100,
            assigned_by: ops.id
        });
    });

    it('editar solo sale_price actualiza esa columna y conserva hourly_rate y budgeted_hours (no borra la fila)', async () => {
        const created = await createAs(lead, { name: 'P2', sale_price: 1000, hours_budgeted: 10 });
        await testDb.run(`UPDATE project_financials SET hourly_rate = 1.5, hourly_rate_currency = 'UF' WHERE project_id = ?`, [created.id]);

        const res = mockRes();
        await controller.updateProject(makeReq(lead, { sale_price: 2000 }, { id: String(created.id) }), res);

        expect(res.status).not.toHaveBeenCalled();
        const rows = await testDb.query('SELECT sale_price, budgeted_hours, hourly_rate FROM project_financials WHERE project_id = ?', [created.id]);
        expect(rows).toEqual([{ sale_price: 2000, budgeted_hours: 10, hourly_rate: 1.5 }]);
    });

    it('editar solo el nombre no toca project_financials', async () => {
        const created = await createAs(lead, { name: 'P3', budget: 700, sale_price: 5000, hours_budgeted: 20 });
        await testDb.run(`UPDATE project_financials SET hourly_rate = 2 WHERE project_id = ?`, [created.id]);

        const res = mockRes();
        await controller.updateProject(makeReq(lead, { name: 'P3 renombrado' }, { id: String(created.id) }), res);

        const fin = await testDb.get('SELECT budgeted_cost, sale_price, budgeted_hours, hourly_rate FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin).toEqual({ budgeted_cost: 700, sale_price: 5000, budgeted_hours: 20, hourly_rate: 2 });
        expect(jsonOf(res).name).toBe('P3 renombrado');
    });

    it('rpa_developer asignado puede editar la descripción, pero su sale_price se ignora y no lo ve en la respuesta', async () => {
        const created = await createAs(lead, { name: 'P4', sale_price: 8000, assigned_to: users.dev });

        const res = mockRes();
        await controller.updateProject(makeReq(dev, { description: 'nueva', sale_price: 1 }, { id: String(created.id) }), res);

        const fin = await testDb.get('SELECT sale_price FROM project_financials WHERE project_id = ?', [created.id]);
        expect(fin.sale_price).toBe(8000);
        expect(jsonOf(res).description).toBe('nueva');
        expect(jsonOf(res)).not.toHaveProperty('sale_price');
    });

    it('getProject oculta los campos financieros a un rpa_developer y los muestra a team_lead', async () => {
        const created = await createAs(lead, { name: 'P5', budget: 300, sale_price: 900, assigned_to: users.dev });

        const resDev = mockRes();
        await controller.getProject(makeReq(dev, {}, { id: String(created.id) }), resDev);
        const devView = jsonOf(resDev);
        for (const field of ['sale_price', 'budgeted_cost', 'budget_spent', 'delay_cost', 'penalty_cost']) {
            expect(devView).not.toHaveProperty(field);
        }

        const resLead = mockRes();
        await controller.getProject(makeReq(lead, {}, { id: String(created.id) }), resLead);
        expect(jsonOf(resLead)).toMatchObject({ sale_price: 900, budgeted_cost: 300 });
    });

    it('getProjects oculta budget a un rpa_developer y lo muestra a team_lead', async () => {
        const created = await createAs(lead, { name: 'P-list', budget: 4200, assigned_to: users.dev });

        const resDev = mockRes();
        await controller.getProjects(makeReq(dev), resDev);
        const devRow = jsonOf(resDev).find((p: any) => p.id === created.id);
        expect(devRow).toBeDefined();
        expect(devRow).not.toHaveProperty('budget');

        const resLead = mockRes();
        await controller.getProjects(makeReq(lead), resLead);
        expect(jsonOf(resLead).find((p: any) => p.id === created.id)).toMatchObject({ budget: 4200 });
    });

    it('lo que team_lead guarda al editar (sale_price, budget) no llega a un rpa_developer vía recent_activities ni vía el endpoint de actividad', async () => {
        const created = await createAs(lead, { name: 'P-log', budget: 3000, sale_price: 11000, assigned_to: users.dev });

        const resUpd = mockRes();
        await controller.updateProject(
            makeReq(lead, { name: 'P-log editado', budget: 3500, sale_price: 11000, sale_price_currency: 'CLP', hours_budgeted: 50 }, { id: String(created.id) }),
            resUpd
        );
        expect(resUpd.status).not.toHaveBeenCalled();

        const stored = await testDb.get(
            `SELECT old_values, new_values FROM activity_log WHERE entity_type = 'project' AND entity_id = ? AND action = 'updated'`,
            [created.id]
        );
        const financialKeys = ['sale_price', 'sale_price_currency', 'hours_budgeted', 'budget', 'budgeted_cost'];
        for (const key of financialKeys) {
            expect(JSON.parse(stored.old_values)).not.toHaveProperty(key);
            expect(JSON.parse(stored.new_values)).not.toHaveProperty(key);
        }
        expect(JSON.parse(stored.new_values).name).toBe('P-log editado');

        // Fila heredada de antes del fix: la lectura debe enmascararla igual.
        await testDb.run(
            `INSERT INTO activity_log (user_id, entity_type, entity_id, action, old_values, new_values) VALUES (?, 'project', ?, 'updated', ?, ?)`,
            [users.lead, created.id, JSON.stringify({ budget: 3000, name: 'viejo' }), JSON.stringify({ sale_price: 11000, name: 'nuevo' })]
        );

        const resDev = mockRes();
        await controller.getProject(makeReq(dev, {}, { id: String(created.id) }), resDev);
        const devView = jsonOf(resDev);
        expect(devView).not.toHaveProperty('sale_price');
        expect(devView).not.toHaveProperty('budget');
        expect(devView.recent_activities.length).toBeGreaterThanOrEqual(2);
        for (const activity of devView.recent_activities) {
            for (const column of ['old_values', 'new_values']) {
                const values = activity[column] ? JSON.parse(activity[column]) : {};
                expect(values).not.toHaveProperty('sale_price');
                expect(values).not.toHaveProperty('budget');
            }
        }

        const resAct = mockRes();
        await controller.getProjectActivity(
            { user: dev, params: { id: String(created.id) }, query: {} } as unknown as AuthenticatedRequest,
            resAct
        );
        const entries = jsonOf(resAct);
        expect(entries.some((e: any) => e.old_values?.name === 'viejo')).toBe(true);
        for (const entry of entries) {
            expect(entry.old_values ?? {}).not.toHaveProperty('budget');
            expect(entry.new_values ?? {}).not.toHaveProperty('sale_price');
        }

        const resLeadAct = mockRes();
        await controller.getProjectActivity(
            { user: lead, params: { id: String(created.id) }, query: {} } as unknown as AuthenticatedRequest,
            resLeadAct
        );
        expect(jsonOf(resLeadAct).some((e: any) => e.new_values?.sale_price === 11000)).toBe(true);
    });

    it('updateProject sin campos válidos responde 400', async () => {
        const created = await createAs(lead, { name: 'P6' });
        const res = mockRes();
        await controller.updateProject(makeReq(lead, {}, { id: String(created.id) }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('solo team_lead puede cambiar assigned_to al editar; otros roles lo ven ignorado', async () => {
        const created = await createAs(lead, { name: 'P7', assigned_to: users.dev });
        const otherUser = ops.id;

        const res = mockRes();
        await controller.updateProject(makeReq(dev, { description: 'x', assigned_to: otherUser }, { id: String(created.id) }), res);

        expect(jsonOf(res).description).toBe('x');
        const row = await testDb.get('SELECT assigned_to FROM projects WHERE id = ?', [created.id]);
        expect(row.assigned_to).toBe(users.dev);
    });
});
