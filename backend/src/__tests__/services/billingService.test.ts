jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn(),
    }
}));

import { db } from '../../database/database';
import { BillingService } from '../../services/billingService';

const TODAY = '2026-09-16';

describe('BillingService', () => {
    let billingService: BillingService;

    beforeEach(() => {
        jest.clearAllMocks();
        billingService = new BillingService();
        jest.useFakeTimers().setSystemTime(new Date(`${TODAY}T12:00:00Z`));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('evaluateTriggers', () => {
        it('pasa a billable un hito con trigger_type=date cuya planned_date ya pasó', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) {
                    return Promise.resolve([{ id: 1, planned_date: '2026-09-01' }]);
                }
                if (sql.includes("trigger_type = 'progress_pct'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'deliverable_approved'")) return Promise.resolve([]);
                return Promise.resolve([]);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

            const result = await billingService.evaluateTriggers();

            expect(result.transitioned).toBe(1);
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE payment_milestones SET status = 'billable'"),
                expect.arrayContaining([1])
            );
        });

        it('no toca un hito con trigger_type=date cuya planned_date es futura', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                return Promise.resolve([]);
            });

            const result = await billingService.evaluateTriggers();
            expect(result.transitioned).toBe(0);
            expect(db.run).not.toHaveBeenCalled();
        });

        it('pasa a billable un hito con trigger_type=progress_pct cuando el avance vinculado alcanza trigger_value', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'progress_pct'")) {
                    return Promise.resolve([{ id: 2, trigger_value: 50, completion_percentage: 60 }]);
                }
                if (sql.includes("trigger_type = 'deliverable_approved'")) return Promise.resolve([]);
                return Promise.resolve([]);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 2, changes: 1 });

            const result = await billingService.evaluateTriggers();
            expect(result.transitioned).toBe(1);
        });

        it('pasa a billable un hito con trigger_type=deliverable_approved cuando el project_milestone vinculado está completed', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'progress_pct'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'deliverable_approved'")) {
                    return Promise.resolve([{ id: 3, milestone_status: 'completed' }]);
                }
                return Promise.resolve([]);
            });
            (db.run as jest.Mock).mockResolvedValue({ id: 3, changes: 1 });

            const result = await billingService.evaluateTriggers();
            expect(result.transitioned).toBe(1);
        });
    });

    describe('evaluateOverdue', () => {
        it('marca overdue un hito invoiced cuya factura ya venció y no está pagada', async () => {
            (db.query as jest.Mock).mockResolvedValue([
                { id: 10, invoice_id: 100, due_date: '2026-09-01' }
            ]);
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            const result = await billingService.evaluateOverdue();
            expect(result.transitioned).toBe(1);
            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining("UPDATE payment_milestones SET status = 'overdue'"),
                expect.arrayContaining([10])
            );
        });

        it('no marca overdue si no hay hitos invoiced vencidos', async () => {
            (db.query as jest.Mock).mockResolvedValue([]);
            const result = await billingService.evaluateOverdue();
            expect(result.transitioned).toBe(0);
        });
    });

    describe('getDashboard', () => {
        it('agrega montos convertidos a CLP y separa por estado', async () => {
            (db.query as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes("trigger_type = 'date'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'progress_pct'")) return Promise.resolve([]);
                if (sql.includes("trigger_type = 'deliverable_approved'")) return Promise.resolve([]);
                if (sql.includes('invoices i') && sql.includes('due_date')) return Promise.resolve([]);
                if (sql.includes('FROM payment_milestones pm') && sql.includes('JOIN projects')) {
                    return Promise.resolve([
                        { id: 1, project_id: 1, project_name: 'AGROSUPER', name: 'Hito 1', amount: 1000000, currency: 'CLP', status: 'billable', planned_date: '2026-09-10', trigger_type: 'date' },
                        { id: 2, project_id: 1, project_name: 'AGROSUPER', name: 'Hito 2', amount: 100, currency: 'UF', status: 'paid', planned_date: '2026-08-01', trigger_type: 'date' }
                    ]);
                }
                return Promise.resolve([]);
            });
            (db.get as jest.Mock).mockImplementation((sql: string) => {
                if (sql.includes('FROM exchange_rates')) return Promise.resolve({ rate_to_clp: 38000 });
                return Promise.resolve(undefined);
            });

            const dashboard = await billingService.getDashboard();

            expect(dashboard.ready_to_invoice).toHaveLength(1);
            expect(dashboard.ready_to_invoice[0].amount_clp).toBe(1000000);
            expect(dashboard.paid).toHaveLength(1);
            expect(dashboard.paid[0].amount_clp).toBe(100 * 38000);
            expect(dashboard.summary.total_billable_clp).toBe(1000000);
            expect(dashboard.summary.total_paid_clp).toBe(100 * 38000);
        });
    });

    describe('syncOverdueAlert', () => {
        it('crea una alerta overdue_payment para un hito vencido', async () => {
            (db.get as jest.Mock).mockResolvedValue(undefined);
            (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

            await billingService.syncOverdueAlert(10, 1, 15);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO roi_alerts'),
                expect.arrayContaining([1, 'overdue_payment'])
            );
        });
    });
});
