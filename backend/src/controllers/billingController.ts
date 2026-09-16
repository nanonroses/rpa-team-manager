import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { billingService } from '../services/billingService';

export class BillingController {

    getDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
            const dashboard = await billingService.getDashboard(projectId);
            res.json(dashboard);
        } catch (error) {
            logger.error('Get billing dashboard error:', error);
            res.status(500).json({ error: 'Failed to get billing dashboard' });
        }
    };

    getPaymentMilestones = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
            const filter = projectId ? 'WHERE pm.project_id = ?' : '';
            const params = projectId ? [projectId] : [];

            const rows = await db.query(
                `SELECT pm.*, p.name as project_name
                 FROM payment_milestones pm
                 JOIN projects p ON p.id = pm.project_id
                 ${filter}
                 ORDER BY pm.sort_order ASC, pm.planned_date ASC`,
                params
            );

            res.json(rows);
        } catch (error) {
            logger.error('Get payment milestones error:', error);
            res.status(500).json({ error: 'Failed to get payment milestones' });
        }
    };

    createPaymentMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const {
                project_id, project_milestone_id, name, description,
                amount, currency, trigger_type, trigger_value, planned_date, sort_order
            } = req.body;

            const result = await db.run(
                `INSERT INTO payment_milestones (
                    project_id, project_milestone_id, name, description, amount, currency,
                    trigger_type, trigger_value, planned_date, sort_order, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [project_id, project_milestone_id ?? null, name, description ?? null, amount, currency,
                 trigger_type, trigger_value ?? null, planned_date ?? null, sort_order ?? 0, req.user?.id]
            );

            const created = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [result.id]);
            res.status(201).json(created);
        } catch (error) {
            logger.error('Create payment milestone error:', error);
            res.status(500).json({ error: 'Failed to create payment milestone' });
        }
    };

    updatePaymentMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [id]);
            if (!existing) {
                res.status(404).json({ error: 'Payment milestone not found' });
                return;
            }
            if (existing.status !== 'pending') {
                res.status(400).json({ error: `Cannot edit a payment milestone in status '${existing.status}'` });
                return;
            }

            const fields = ['name', 'description', 'amount', 'currency', 'planned_date', 'trigger_value', 'sort_order'];
            const updates = fields.filter(f => req.body[f] !== undefined);
            if (updates.length === 0) {
                res.status(400).json({ error: 'No fields to update' });
                return;
            }

            const setClause = updates.map(f => `${f} = ?`).join(', ');
            const values = updates.map(f => req.body[f]);
            await db.run(`UPDATE payment_milestones SET ${setClause} WHERE id = ?`, [...values, id]);

            const updated = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [id]);
            res.json(updated);
        } catch (error) {
            logger.error('Update payment milestone error:', error);
            res.status(500).json({ error: 'Failed to update payment milestone' });
        }
    };

    deletePaymentMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const existing = await db.get(`SELECT * FROM payment_milestones WHERE id = ?`, [id]);
            if (!existing) {
                res.status(404).json({ error: 'Payment milestone not found' });
                return;
            }
            if (existing.status !== 'pending') {
                res.status(400).json({ error: `Cannot delete a payment milestone in status '${existing.status}'` });
                return;
            }

            await db.run(`DELETE FROM payment_milestones WHERE id = ?`, [parseInt(id)]);
            res.status(200).json({ message: 'Payment milestone deleted' });
        } catch (error) {
            logger.error('Delete payment milestone error:', error);
            res.status(500).json({ error: 'Failed to delete payment milestone' });
        }
    };

    getInvoices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : undefined;
            const filter = projectId ? 'WHERE i.project_id = ?' : '';
            const params = projectId ? [projectId] : [];

            const invoices = await db.query(
                `SELECT i.*, p.name as project_name FROM invoices i
                 JOIN projects p ON p.id = i.project_id
                 ${filter}
                 ORDER BY i.issue_date DESC`,
                params
            );

            const withLines = await Promise.all(invoices.map(async (inv: any) => ({
                ...inv,
                lines: await db.query(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [inv.id]),
                payments: await db.query(`SELECT * FROM payments WHERE invoice_id = ?`, [inv.id])
            })));

            res.json(withLines);
        } catch (error) {
            logger.error('Get invoices error:', error);
            res.status(500).json({ error: 'Failed to get invoices' });
        }
    };

    createInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { project_id, invoice_number, issue_date, due_date, payment_milestone_ids, notes } = req.body;

            const placeholders = payment_milestone_ids.map(() => '?').join(',');
            const milestones = await db.query(
                `SELECT * FROM payment_milestones WHERE id IN (${placeholders})`,
                payment_milestone_ids
            );

            if (milestones.length !== payment_milestone_ids.length) {
                res.status(400).json({ error: 'One or more payment milestones not found' });
                return;
            }
            const notBillable = milestones.filter((m: any) => m.status !== 'billable');
            if (notBillable.length > 0) {
                res.status(400).json({ error: `Payment milestones not in billable status: ${notBillable.map((m: any) => m.id).join(', ')}` });
                return;
            }
            const wrongProject = milestones.filter((m: any) => m.project_id !== project_id);
            if (wrongProject.length > 0) {
                res.status(400).json({ error: 'All payment milestones must belong to the given project_id' });
                return;
            }
            const currencies = new Set(milestones.map((m: any) => m.currency));
            if (currencies.size > 1) {
                res.status(400).json({ error: 'All payment milestones in one invoice must share the same currency' });
                return;
            }

            const currency = milestones[0].currency;
            const amount = milestones.reduce((sum: number, m: any) => sum + m.amount, 0);

            await db.beginTransaction();
            try {
                const invoiceResult = await db.run(
                    `INSERT INTO invoices (project_id, invoice_number, issue_date, due_date, currency, amount, status, notes, created_by)
                     VALUES (?, ?, ?, ?, ?, ?, 'issued', ?, ?)`,
                    [project_id, invoice_number, issue_date, due_date, currency, amount, notes ?? null, req.user?.id]
                );
                const invoiceId = invoiceResult.id!;

                for (const m of milestones) {
                    await db.run(
                        `INSERT INTO invoice_lines (invoice_id, payment_milestone_id, description, amount)
                         VALUES (?, ?, ?, ?)`,
                        [invoiceId, m.id, m.name, m.amount]
                    );
                    await db.run(`UPDATE payment_milestones SET status = 'invoiced' WHERE id = ?`, [m.id]);
                }

                await db.commit();

                const created = await db.get(`SELECT * FROM invoices WHERE id = ?`, [invoiceId]);
                res.status(201).json(created);
            } catch (txError) {
                await db.rollback();
                throw txError;
            }
        } catch (error) {
            logger.error('Create invoice error:', error);
            res.status(500).json({ error: 'Failed to create invoice' });
        }
    };

    recordPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { amount, currency, payment_date, method, reference, notes } = req.body;

            const invoice = await db.get(`SELECT * FROM invoices WHERE id = ?`, [id]);
            if (!invoice) {
                res.status(404).json({ error: 'Invoice not found' });
                return;
            }
            if (invoice.status === 'paid' || invoice.status === 'cancelled') {
                res.status(400).json({ error: `Cannot record a payment against an invoice in status '${invoice.status}'` });
                return;
            }

            const result = await db.run(
                `INSERT INTO payments (invoice_id, amount, currency, payment_date, method, reference, notes, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, amount, currency, payment_date, method ?? null, reference ?? null, notes ?? null, req.user?.id]
            );

            const totals = await db.query(
                `SELECT COALESCE(SUM(amount), 0) as total_paid FROM payments WHERE invoice_id = ? AND currency = ?`,
                [id, invoice.currency]
            );
            const totalPaid = totals[0]?.total_paid ?? 0;

            if (totalPaid >= invoice.amount) {
                await db.run(`UPDATE invoices SET status = 'paid' WHERE id = ?`, [id]);
                await db.run(
                    `UPDATE payment_milestones SET status = 'paid'
                     WHERE id IN (SELECT payment_milestone_id FROM invoice_lines WHERE invoice_id = ?)`,
                    [id]
                );
            } else {
                await db.run(`UPDATE invoices SET status = 'partially_paid' WHERE id = ?`, [id]);
            }

            const created = await db.get(`SELECT * FROM payments WHERE id = ?`, [result.id]);
            res.status(201).json(created);
        } catch (error) {
            logger.error('Record payment error:', error);
            res.status(500).json({ error: 'Failed to record payment' });
        }
    };

    evaluate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = req.body.project_id ? parseInt(req.body.project_id) : undefined;
            const triggers = await billingService.evaluateTriggers(projectId);
            const overdue = await billingService.evaluateOverdue(projectId);
            res.json({ ...triggers, ...overdue });
        } catch (error) {
            logger.error('Evaluate billing triggers error:', error);
            res.status(500).json({ error: 'Failed to evaluate billing triggers' });
        }
    };
}
