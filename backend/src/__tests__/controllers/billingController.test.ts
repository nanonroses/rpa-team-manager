jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn(), beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
}));
jest.mock('../../services/billingService', () => ({
    billingService: { getDashboard: jest.fn(), evaluateTriggers: jest.fn(), evaluateOverdue: jest.fn(), completePaymentMilestone: jest.fn() }
}));

import { db } from '../../database/database';
import { billingService } from '../../services/billingService';
import { BillingController } from '../../controllers/billingController';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('BillingController', () => {
    let controller: BillingController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new BillingController();
    });

    describe('getDashboard', () => {
        it('devuelve el dashboard de billingService', async () => {
            const fakeDashboard = { ready_to_invoice: [], invoiced_unpaid: [], paid: [], overdue: [], cashflow_projection: [], summary: {} };
            (billingService.getDashboard as jest.Mock).mockResolvedValue(fakeDashboard);

            const req: any = { query: {}, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.getDashboard(req, res);

            expect(billingService.getDashboard).toHaveBeenCalledWith(undefined);
            expect(res.json).toHaveBeenCalledWith(fakeDashboard);
        });

        it('pasa project_id como número cuando viene en query', async () => {
            (billingService.getDashboard as jest.Mock).mockResolvedValue({});
            const req: any = { query: { project_id: '5' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.getDashboard(req, res);

            expect(billingService.getDashboard).toHaveBeenCalledWith(5);
        });
    });

    describe('createPaymentMilestone', () => {
        it('crea un hito y devuelve 201 con el registro creado', async () => {
            (db.run as jest.Mock).mockResolvedValue({ id: 42, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({ id: 42, name: 'Hito 1', status: 'pending' });

            const req: any = {
                body: { project_id: 1, name: 'Hito 1', amount: 500000, currency: 'CLP', trigger_type: 'date', planned_date: '2026-12-01' },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.createPaymentMilestone(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payment_milestones'), expect.any(Array));
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('deletePaymentMilestone', () => {
        it('rechaza con 400 si el hito ya no está pending', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, status: 'invoiced' });
            const req: any = { params: { id: '1' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.deletePaymentMilestone(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('elimina un hito pending', async () => {
            (db.get as jest.Mock).mockResolvedValue({ id: 1, status: 'pending' });
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
            const req: any = { params: { id: '1' }, user: { id: 1, role: 'team_lead' } };
            const res = mockRes();

            await controller.deletePaymentMilestone(req, res);

            expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM payment_milestones'), [1]);
            expect(res.status).toHaveBeenCalledWith(200);
        });
    });

    describe('createInvoice', () => {
        it('rechaza con 400 si algún hito seleccionado no está billable', async () => {
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, status: 'billable', amount: 100, currency: 'CLP', project_id: 1 },
                { id: 2, status: 'pending', amount: 200, currency: 'CLP', project_id: 1 }
            ]);
            const req: any = {
                body: { project_id: 1, invoice_number: 'F-1', issue_date: '2026-09-16', due_date: '2026-10-16', payment_milestone_ids: [1, 2] },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.createInvoice(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(db.beginTransaction).not.toHaveBeenCalled();
        });

        it('crea la factura, sus líneas, y marca los hitos como invoiced', async () => {
            (db.query as jest.Mock).mockResolvedValue([
                { id: 1, status: 'billable', amount: 100, currency: 'CLP', project_id: 1 }
            ]);
            (db.run as jest.Mock).mockResolvedValue({ id: 999, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({ id: 999, invoice_number: 'F-1' });

            const req: any = {
                body: { project_id: 1, invoice_number: 'F-1', issue_date: '2026-09-16', due_date: '2026-10-16', payment_milestone_ids: [1] },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.createInvoice(req, res);

            expect(db.beginTransaction).toHaveBeenCalled();
            expect(db.commit).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });
    });

    describe('recordPayment', () => {
        it('registra el pago y marca la factura paid cuando el total cubre el monto', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM invoices WHERE id')) return Promise.resolve({ id: 5, amount: 1000, currency: 'CLP', status: 'issued', project_id: 1 });
                return Promise.resolve(undefined);
            });
            (db.query as jest.Mock).mockResolvedValue([{ total_paid: 1000 }]);
            (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

            const req: any = {
                params: { id: '5' },
                body: { amount: 1000, currency: 'CLP', payment_date: '2026-09-16' },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.recordPayment(req, res);

            expect(db.beginTransaction).toHaveBeenCalled();
            expect(db.commit).toHaveBeenCalled();
            expect(db.run).toHaveBeenCalledWith(expect.stringContaining("SET status = 'paid'"), expect.any(Array));
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it('rechaza con 400 si la moneda del pago no coincide con la de la factura', async () => {
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM invoices WHERE id')) return Promise.resolve({ id: 5, amount: 1000, currency: 'CLP', status: 'issued', project_id: 1 });
                return Promise.resolve(undefined);
            });

            const req: any = {
                params: { id: '5' },
                body: { amount: 1000, currency: 'USD', payment_date: '2026-09-16' },
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            await controller.recordPayment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Payment currency must match invoice currency' });
            expect(db.beginTransaction).not.toHaveBeenCalled();
            expect(db.run).not.toHaveBeenCalled();
        });
    });

    describe('completePaymentMilestone', () => {
        it('completa el hito y devuelve 200 con el hito actualizado', async () => {
            const req = {
                params: { id: '5' },
                body: { notes: 'Todo entregado ok' },
                user: { id: 1 }
            } as any;
            const res = mockRes();

            (db.get as jest.Mock).mockResolvedValueOnce({
                id: 5,
                project_id: 1,
                status: 'pending'
            });

            (billingService.completePaymentMilestone as jest.Mock).mockResolvedValueOnce({
                id: 5,
                project_id: 1,
                status: 'billable',
                name: 'Entrega Fase 1'
            });

            await controller.completePaymentMilestone(req, res);

            expect(billingService.completePaymentMilestone).toHaveBeenCalledWith(5, 1, 'Todo entregado ok');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 5, status: 'billable' }));
        });

        it('rechaza con 404 si el hito no existe', async () => {
            const req = { params: { id: '99' }, body: {}, user: { id: 1 } } as any;
            const res = mockRes();

            (db.get as jest.Mock).mockResolvedValueOnce(null);

            await controller.completePaymentMilestone(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Payment milestone not found' });
        });

        it('rechaza con 400 si el hito ya está paid', async () => {
            const req = { params: { id: '5' }, body: {}, user: { id: 1 } } as any;
            const res = mockRes();

            (db.get as jest.Mock).mockResolvedValueOnce({ id: 5, status: 'paid' });

            await controller.completePaymentMilestone(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('already in status') }));
        });
    });
});
