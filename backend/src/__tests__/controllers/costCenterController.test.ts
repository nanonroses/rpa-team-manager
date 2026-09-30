// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CostCenterController } from '../../controllers/costCenterController';
import { BillingController } from '../../controllers/billingController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}, query: any = {}): AuthenticatedRequest {
    return { user, body, params, query } as unknown as AuthenticatedRequest;
}

function jsonOf(res: Response): any {
    return (res.json as jest.Mock).mock.calls[0][0];
}

describe('CostCenterController & Billing Integration (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let costCenterCtrl: CostCenterController;
    let billingCtrl: BillingController;
    let lead: { id: number; role: string };
    let dev: { id: number; role: string };
    let testProjectId: number;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        dev = { id: users.dev, role: 'rpa_developer' };
        costCenterCtrl = new CostCenterController();
        billingCtrl = new BillingController();

        // Create a test commercial project
        const projectResult = await testDb.run(
            `INSERT INTO projects (name, status, created_by, project_type, currency, budget)
             VALUES ('Proyecto RPA Agrosuper', 'active', ?, 'commercial', 'USD', 10000)`,
            [lead.id]
        );
        testProjectId = projectResult.id!;

        await testDb.run(
            `INSERT INTO project_financials (project_id, sale_price, sale_price_currency)
             VALUES (?, 10000, 'USD')`,
            [testProjectId]
        );
    });

    afterAll(async () => {
        await testDb.close();
    });

    it('listCostCenters devuelve los 28 centros de costo de la empresa', async () => {
        const res = mockRes();
        await costCenterCtrl.listCostCenters(makeReq(lead), res);
        expect(res.json).toHaveBeenCalled();
        const data = jsonOf(res).data;
        expect(data.length).toBe(28);
    });

    it('listCostCenters filtra por país CHILE (13 CECOs) y por is_rpa (9 CECOs)', async () => {
        const resChile = mockRes();
        await costCenterCtrl.listCostCenters(makeReq(lead, {}, {}, { country: 'CHILE' }), resChile);
        const chileData = jsonOf(resChile).data;
        expect(chileData.length).toBe(13);

        const resRPA = mockRes();
        await costCenterCtrl.listCostCenters(makeReq(lead, {}, {}, { is_rpa: 'true' }), resRPA);
        const rpaData = jsonOf(resRPA).data;
        expect(rpaData.length).toBe(9);
        const codes = rpaData.map((c: any) => c.code);
        expect(codes).toContain('RPA-L');
        expect(codes).toContain('RPA-P');
        expect(codes).toContain('RPA-S');
    });

    it('setProjectCostCenters guarda la imputación de 10,000 USD (4k Licencias, 5k Soporte, 1k Proyectos)', async () => {
        const cecos = await testDb.query(`SELECT id, code FROM cost_centers WHERE code IN ('RPA-L', 'RPA-S', 'RPA-P')`);
        const rpaL = cecos.find((c: any) => c.code === 'RPA-L')!.id;
        const rpaS = cecos.find((c: any) => c.code === 'RPA-S')!.id;
        const rpaP = cecos.find((c: any) => c.code === 'RPA-P')!.id;

        const body = {
            allocations: [
                { cost_center_id: rpaL, amount: 4000, description: 'Licencias UiPath' },
                { cost_center_id: rpaS, amount: 5000, description: 'Mesa incidentes Agrosuper' },
                { cost_center_id: rpaP, amount: 1000, description: 'Desarrollo bots inicial' }
            ]
        };

        const res = mockRes();
        await costCenterCtrl.setProjectCostCenters(makeReq(lead, body, { projectId: String(testProjectId) }), res);

        expect(res.json).toHaveBeenCalled();
        const data = jsonOf(res).data;
        expect(data.total_allocated).toBe(10000);
        expect(data.is_balanced).toBe(true);
        expect(data.difference).toBe(0);
        expect(data.allocations.length).toBe(3);
    });

    it('getProjectCostCenters devuelve la distribución del proyecto con detalles de cada CECO', async () => {
        const res = mockRes();
        await costCenterCtrl.getProjectCostCenters(makeReq(dev, {}, { projectId: String(testProjectId) }), res);

        expect(res.json).toHaveBeenCalled();
        const data = jsonOf(res).data;
        expect(data.total_allocated).toBe(10000);
        expect(data.allocations[0].cost_center_code).toBeDefined();
        expect(data.allocations[0].cost_center_name).toBeDefined();
    });

    it('crea un hito de pago asociado a RPA-L (Licencias) y verifica el vínculo en cobros y líneas de factura', async () => {
        const cecoL = await testDb.get(`SELECT id FROM cost_centers WHERE code = 'RPA-L'`);

        // 1. Crear hito
        const milestoneBody = {
            project_id: testProjectId,
            name: 'Cobro Licencias UiPath Año 1',
            amount: 4000,
            currency: 'USD',
            trigger_type: 'date',
            planned_date: '2026-10-01',
            cost_center_id: cecoL.id
        };

        const resMilestone = mockRes();
        await billingCtrl.createPaymentMilestone(makeReq(lead, milestoneBody), resMilestone);
        expect(resMilestone.status).toHaveBeenCalledWith(201);
        const milestone = jsonOf(resMilestone);
        expect(milestone.cost_center_id).toBe(cecoL.id);
        expect(milestone.cost_center_code).toBe('RPA-L');

        // 2. Pasar a billable para poder facturar
        await testDb.run(`UPDATE payment_milestones SET status = 'billable' WHERE id = ?`, [milestone.id]);

        // 3. Crear factura
        const invoiceBody = {
            project_id: testProjectId,
            invoice_number: 'FAC-RPA-001',
            issue_date: '2026-10-02',
            due_date: '2026-10-30',
            payment_milestone_ids: [milestone.id]
        };

        const resInvoice = mockRes();
        await billingCtrl.createInvoice(makeReq(lead, invoiceBody), resInvoice);
        expect(resInvoice.status).toHaveBeenCalledWith(201);

        // 4. Verificar que la línea de factura guardó cost_center_id
        const line = await testDb.get(
            `SELECT * FROM invoice_lines WHERE payment_milestone_id = ?`,
            [milestone.id]
        );
        expect(line).toBeDefined();
        expect(line.cost_center_id).toBe(cecoL.id);
    });

    it('getCostCenterBillingSummary retorna la consolidación financiera por CECO', async () => {
        const res = mockRes();
        await billingCtrl.getCostCenterBillingSummary(makeReq(lead, {}, {}, { is_rpa: 'true' }), res);
        expect(res.json).toHaveBeenCalled();
        const rows = jsonOf(res);

        expect(Array.isArray(rows)).toBe(true);
        const rpaLRow = rows.find((r: any) => r.code === 'RPA-L');
        expect(rpaLRow).toBeDefined();
        expect(rpaLRow.allocated_amount_clp).toBeGreaterThan(0);
        expect(rpaLRow.invoiced_amount_clp).toBeGreaterThan(0);
    });
});
