import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { db } from '../database/database';
import { logger } from '../utils/logger';
import { billingService } from '../services/billingService';
import { generatePaymentStatement } from '../services/pdfService';
import { activityLogService } from '../services/activityLogService';

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

            await billingService.evaluateTriggers(projectId);
            await billingService.evaluateOverdue(projectId);
            const rows = await db.query(
                `SELECT pm.*, p.name as project_name, mile.name AS source_milestone_name
                 FROM payment_milestones pm
                 JOIN projects p ON p.id = pm.project_id
                 LEFT JOIN project_milestones mile ON mile.id = pm.project_milestone_id
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
            await activityLogService.logActivity(req.user?.id, 'payment_milestone', Number(result.id), 'created', null, created);
            await activityLogService.logActivity(req.user?.id, 'project', Number(project_id), 'payment_milestone_created', null, { payment_milestone_id: result.id, name, amount, currency });
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
            await activityLogService.logActivity(req.user?.id, 'payment_milestone', Number(id), 'updated', existing, updated);
            await activityLogService.logActivity(req.user?.id, 'project', Number(existing.project_id), 'payment_milestone_updated', existing, updated);
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
            await activityLogService.logActivity(req.user?.id, 'payment_milestone', Number(id), 'deleted', existing, null);
            await activityLogService.logActivity(req.user?.id, 'project', Number(existing.project_id), 'payment_milestone_deleted', existing, null);
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
                `SELECT i.*, p.name as project_name, c.name AS client_name FROM invoices i
                 JOIN projects p ON p.id = i.project_id
                 LEFT JOIN clients c ON c.id = p.client_id
                 ${filter}
                 ORDER BY i.issue_date DESC`,
                params
            );

            const withLines = await Promise.all(invoices.map(async (inv: any) => ({
                ...inv,
                lines: await db.query(`SELECT * FROM invoice_lines WHERE invoice_id = ?`, [inv.id]),
                payments: await db.query(`SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC, id DESC`, [inv.id]),
                totals: await db.get(`SELECT COALESCE(SUM(amount), 0) AS paid_amount FROM payments WHERE invoice_id = ?`, [inv.id])
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
            const wrongProject = milestones.filter((m: any) => Number(m.project_id) !== Number(project_id));
            if (wrongProject.length > 0) {
                res.status(400).json({ error: 'All payment milestones must belong to the given project_id' });
                return;
            }
            const billingGate = await db.get('SELECT require_service_acceptance FROM projects WHERE id = ?', [project_id]);
            if (billingGate?.require_service_acceptance) {
                const serviceAcceptance = await db.get(`SELECT id FROM project_commercial_documents WHERE project_id = ? AND document_type = 'service_acceptance' LIMIT 1`, [project_id]);
                if (!serviceAcceptance) {
                    res.status(409).json({ error: 'La HES o aceptación de servicio es obligatoria antes de facturar este hito' });
                    return;
                }
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
                await activityLogService.logActivity(req.user?.id, 'invoice', Number(invoiceId), 'issued', null, created);
                await activityLogService.logActivity(req.user?.id, 'project', Number(project_id), 'invoice_issued', null, { invoice_id: invoiceId, invoice_number, amount, currency });
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
            if (Number(amount) <= 0 || !Number.isFinite(Number(amount))) {
                res.status(400).json({ error: 'El monto del pago debe ser mayor que cero' });
                return;
            }
            if (currency !== invoice.currency) {
                res.status(400).json({ error: 'Payment currency must match invoice currency' });
                return;
            }

            await db.beginTransaction();
            try {
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
                const currentPaid = Number(totalPaid) - Number(amount);
                const currentBalance = Number(invoice.amount) - currentPaid;
                if (Number(amount) > currentBalance) {
                res.status(400).json({ error: 'El pago excede el saldo pendiente de la factura' });
                await db.rollback();
                return;
            }

                if (Number(totalPaid) >= Number(invoice.amount)) {
                    await db.run(`UPDATE invoices SET status = 'paid' WHERE id = ?`, [id]);

                    const milestoneRows = await db.query(
                        `SELECT payment_milestone_id FROM invoice_lines WHERE invoice_id = ? AND payment_milestone_id IS NOT NULL`,
                        [id]
                    );
                    const milestoneIds: number[] = milestoneRows.map((r: any) => r.payment_milestone_id);

                    await db.run(
                        `UPDATE payment_milestones SET status = 'paid'
                         WHERE id IN (SELECT payment_milestone_id FROM invoice_lines WHERE invoice_id = ?)`,
                        [id]
                    );

                    // Un hito recién pagado ya no puede seguir "vencido": resolvemos la alerta
                    // overdue_payment asociada (roi_alerts no tiene columna dedicada para el id
                    // del hito, se identifica por el mismo patrón LIKE que syncOverdueAlert).
                    for (const milestoneId of milestoneIds) {
                        await db.run(
                            `UPDATE roi_alerts SET is_resolved = 1, resolved_at = datetime('now')
                             WHERE alert_type = 'overdue_payment' AND is_resolved = 0
                               AND message LIKE ?`,
                            [`%hito #${milestoneId}%`]
                        );
                    }
                } else {
                    await db.run(`UPDATE invoices SET status = 'partially_paid' WHERE id = ?`, [id]);
                }

                const outstandingInvoice = await db.get(`SELECT i.id FROM invoices i WHERE i.project_id = ? AND i.status NOT IN ('paid', 'cancelled') AND i.amount > COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.invoice_id = i.id), 0) LIMIT 1`, [invoice.project_id]);
                const pendingMilestone = await db.get(`SELECT id FROM payment_milestones WHERE project_id = ? AND status <> 'paid' LIMIT 1`, [invoice.project_id]);
            if (!outstandingInvoice && !pendingMilestone) {
                    const closedProject = await db.get(`SELECT id, financial_closed_at, status FROM projects WHERE id = ? AND delivery_accepted_at IS NOT NULL AND require_purchase_order = 0 AND require_service_acceptance = 0 AND financial_closed_at IS NULL`, [invoice.project_id]);
                    if (closedProject) {
                        await db.run(`UPDATE projects SET financial_closed_at = datetime('now'), status = 'completed', actual_end_date = COALESCE(actual_end_date, date('now')) WHERE id = ?`, [invoice.project_id]);
                        await activityLogService.logActivity(req.user?.id, 'project', Number(invoice.project_id), 'financials_closed', closedProject, await db.get('SELECT id, financial_closed_at, status FROM projects WHERE id = ?', [invoice.project_id]));
                    }
                }

                await db.commit();

                const created = await db.get(`SELECT * FROM payments WHERE id = ?`, [result.id]);
                await activityLogService.logActivity(req.user?.id, 'payment', Number(result.id), 'recorded', null, created);
                await activityLogService.logActivity(req.user?.id, 'invoice', Number(id), 'payment_recorded', invoice, { ...invoice, status: totalPaid >= invoice.amount ? 'paid' : 'partially_paid', total_paid: totalPaid });
                await activityLogService.logActivity(req.user?.id, 'project', Number(invoice.project_id), 'payment_recorded', null, { invoice_id: Number(id), payment_id: result.id, amount, currency, payment_date });
                res.status(201).json(created);
            } catch (txError) {
                await db.rollback();
                throw txError;
            }
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

    getPaymentStatement = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const projectId = parseInt(req.params.projectId);

            const project = await db.get(
                `SELECT p.id, p.name, p.client_id, p.require_purchase_order, p.require_service_acceptance, p.delivery_accepted_at, p.financial_closed_at, c.name as client_name FROM projects p LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = ?`,
                [projectId]
            );
            if (!project) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }

            const milestones = await db.query(
                `SELECT name, amount, currency, status, planned_date FROM payment_milestones
                 WHERE project_id = ? ORDER BY planned_date ASC`,
                [projectId]
            );

            const buffer = await generatePaymentStatement({
                project_name: project.name,
                client_name: project.client_name || 'N/A',
                generated_at: new Date().toISOString().slice(0, 10),
                financials: { sale_price: 0 },
                milestones,
                hours_summary: []
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="estado-pago-${projectId}.pdf"`);
            res.send(buffer);
        } catch (error) {
            logger.error('Get payment statement error:', error);
            res.status(500).json({ error: 'Failed to generate payment statement' });
        }
    };
}
