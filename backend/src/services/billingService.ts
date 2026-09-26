import { db } from '../database/database';
import { logger } from '../utils/logger';
import { financeService, Currency } from './financeService';
import { notificationService } from './notificationService';

export interface PaymentMilestoneRow {
    id: number;
    project_id: number;
    project_name: string;
    name: string;
    amount: number;
    currency: Currency;
    amount_clp: number | null;
    status: string;
    planned_date: string | null;
    trigger_type: string;
    rate_missing: boolean;
}

export interface BillingDashboard {
    ready_to_invoice: PaymentMilestoneRow[];
    invoiced_unpaid: PaymentMilestoneRow[];
    paid: PaymentMilestoneRow[];
    overdue: PaymentMilestoneRow[];
    cashflow_projection: { month: string; expected_amount_clp: number }[];
    summary: {
        total_pending_clp: number;
        total_billable_clp: number;
        total_invoiced_clp: number;
        total_paid_clp: number;
        total_overdue_clp: number;
    };
}

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Lógica de negocio de cobranza. Todo monto se normaliza a CLP vía financeService;
 * este servicio nunca calcula tipo de cambio por su cuenta.
 */
export class BillingService {
    /** Envía alertas internas deduplicadas para cobros próximos o vencidos. */
    async sendCollectionReminders(referenceDate = today()): Promise<number> {
        const candidates = await db.query(`
            SELECT 'invoice' AS entity_type, i.id AS entity_id, i.project_id,
                   i.invoice_number AS label, i.due_date AS reminder_date, i.status
            FROM invoices i
            WHERE i.status IN ('issued', 'partially_paid', 'overdue')
            UNION ALL
            SELECT 'payment_milestone' AS entity_type, pm.id AS entity_id, pm.project_id,
                   pm.name AS label, pm.planned_date AS reminder_date, pm.status
            FROM payment_milestones pm
            WHERE pm.status IN ('pending', 'billable', 'overdue') AND pm.planned_date IS NOT NULL
        `);
        const recipientsByProject = new Map<number, number[]>();
        let sent = 0;
        const reference = new Date(`${referenceDate}T00:00:00Z`);
        for (const item of candidates) {
            if (!item.reminder_date) continue;
            const due = new Date(`${String(item.reminder_date).slice(0, 10)}T00:00:00Z`);
            const days = Math.round((due.getTime() - reference.getTime()) / 86400000);
            let eventKey: 'billing_due_7_days' | 'billing_due_today' | 'billing_overdue_weekly' | null = null;
            let deliveryDate = referenceDate;
            if (days === 7) eventKey = 'billing_due_7_days';
            else if (days === 0) eventKey = 'billing_due_today';
            else if (days < 0 && Math.abs(days) % 7 === 0) eventKey = 'billing_overdue_weekly';
            if (!eventKey) continue;

            let recipients = recipientsByProject.get(item.project_id);
            if (!recipients) {
                const rows = await db.query(`
                    SELECT pm_user_id AS user_id FROM projects WHERE id = ? AND pm_user_id IS NOT NULL
                    UNION SELECT created_by AS user_id FROM projects WHERE id = ? AND created_by IS NOT NULL
                    UNION SELECT id AS user_id FROM users WHERE role = 'team_lead' AND is_active = 1
                `, [item.project_id, item.project_id]);
                recipients = rows.map((row: any) => Number(row.user_id));
                recipientsByProject.set(item.project_id, recipients);
            }
            for (const userId of recipients) {
                const claim = await db.run(`
                    INSERT OR IGNORE INTO notification_deliveries (event_key, entity_type, entity_id, user_id, scheduled_for)
                    VALUES (?, ?, ?, ?, ?)
                `, [eventKey, item.entity_type, item.entity_id, userId, deliveryDate]);
                if (!claim.changes) continue;
                const overdueDays = Math.abs(days);
                const title = eventKey === 'billing_due_7_days' ? 'Cobro vence en 7 días'
                    : eventKey === 'billing_due_today' ? 'Cobro vence hoy'
                        : `Cobro vencido hace ${overdueDays} días`;
                const project = await db.get('SELECT name FROM projects WHERE id = ?', [item.project_id]);
                await notificationService.notify({
                    userId, eventKey,
                    title,
                    message: `${item.label} · ${project?.name || 'Proyecto'}`,
                    type: eventKey === 'billing_overdue_weekly' ? 'error' : 'warning',
                    entityType: item.entity_type,
                    entityId: item.entity_id,
                    link: item.entity_type === 'invoice' ? `/billing?tab=invoices&project_id=${item.project_id}` : `/billing?tab=milestones&project_id=${item.project_id}`
                });
                sent++;
            }
        }
        return sent;
    }

    /**
     * Evalúa los hitos de pago 'pending' y los pasa a 'billable' si su disparador se cumplió.
     * No hay scheduler en este proyecto: se llama de forma perezosa antes de leer el dashboard/listas.
     */
    async evaluateTriggers(projectId?: number): Promise<{ transitioned: number }> {
        const projectFilter = projectId ? 'AND pm.project_id = ?' : '';
        const projectParams = projectId ? [projectId] : [];
        let transitioned = 0;

        const dateDue = await db.query(
            `SELECT pm.id FROM payment_milestones pm
             WHERE pm.status = 'pending' AND pm.trigger_type = 'date'
               AND pm.planned_date IS NOT NULL AND pm.planned_date <= ? ${projectFilter}`,
            [today(), ...projectParams]
        );

        const progressDue = await db.query(
            `SELECT pm.id, pm.trigger_value, mile.completion_percentage
             FROM payment_milestones pm
             JOIN project_milestones mile ON mile.id = pm.project_milestone_id
             WHERE pm.status = 'pending' AND pm.trigger_type = 'progress_pct' ${projectFilter}`,
            projectParams
        );

        const deliverableDue = await db.query(
            `SELECT pm.id, mile.status as milestone_status
             FROM payment_milestones pm
             JOIN project_milestones mile ON mile.id = pm.project_milestone_id
             WHERE pm.status = 'pending' AND pm.trigger_type = 'deliverable_approved' ${projectFilter}`,
            projectParams
        );

        const toTransition: number[] = [
            ...dateDue.map((r: any) => r.id),
            ...progressDue.filter((r: any) => (r.completion_percentage ?? 0) >= (r.trigger_value ?? 101)).map((r: any) => r.id),
            ...deliverableDue.filter((r: any) => r.milestone_status === 'completed').map((r: any) => r.id)
        ];

        for (const id of toTransition) {
            await db.run(
                `UPDATE payment_milestones SET status = 'billable', billable_at = datetime('now') WHERE id = ?`,
                [id]
            );
            transitioned++;
        }

        if (transitioned > 0) {
            logger.info(`Billing: ${transitioned} hito(s) de pago pasaron a billable`);
        }

        return { transitioned };
    }

    /** Marca vencidas las facturas con saldo abierto sin alterar los pagos parciales. */
    async evaluateOverdue(projectId?: number): Promise<{ transitioned: number }> {
        const projectFilter = projectId ? 'AND pm.project_id = ?' : '';
        const projectParams = projectId ? [projectId] : [];

        const overdueRows = await db.query(
            `SELECT DISTINCT pm.id, pm.project_id, i.id as invoice_id, i.due_date,
                    CAST(julianday(?) - julianday(i.due_date) AS INTEGER) AS days_overdue
             FROM invoices i
             JOIN invoice_lines il ON il.invoice_id = i.id
             LEFT JOIN payment_milestones pm ON pm.id = il.payment_milestone_id
            WHERE i.due_date < ? AND i.status NOT IN ('paid', 'cancelled') ${projectFilter}`,
            [today(), today(), ...projectParams]
        );

        let transitioned = 0;
        for (const row of overdueRows) {
            const daysOverdue = Number(row.days_overdue || 0);
            if (row.id != null) await db.run(`UPDATE payment_milestones SET status = 'overdue' WHERE id = ?`, [row.id]);
            await db.run(
                `UPDATE invoices SET status = 'overdue' WHERE id = ? AND status NOT IN ('paid', 'cancelled')`,
                [row.invoice_id]
            );
            if (row.id != null) await this.syncOverdueAlert(row.id, projectId ?? row.project_id, daysOverdue);
            transitioned++;
        }

        if (transitioned > 0) {
            logger.info(`Billing: ${transitioned} hito(s) de pago marcados overdue`);
        }

        return { transitioned };
    }

    /** Persiste en roi_alerts una alerta de cobro vencido para un hito de pago específico. */
    async syncOverdueAlert(paymentMilestoneId: number, projectId: number, daysOverdue: number): Promise<void> {
        const existing = await db.get(
            `SELECT id FROM roi_alerts WHERE project_id = ? AND alert_type = 'overdue_payment' AND is_resolved = 0
             AND message LIKE ?`,
            [projectId, `%hito #${paymentMilestoneId}%`]
        );

        const message = `Cobro vencido para el hito #${paymentMilestoneId} (${daysOverdue} días de atraso)`;
        const level = daysOverdue > 30 ? 'critical' : 'warning';

        if (existing) {
            await db.run(
                `UPDATE roi_alerts SET current_value = ?, message = ?, alert_level = ? WHERE id = ?`,
                [daysOverdue, message, level, existing.id]
            );
        } else {
            await db.run(
                `INSERT INTO roi_alerts (project_id, alert_type, alert_level, message, threshold_value, current_value)
                 VALUES (?, ?, ?, ?, 0, ?)`,
                [projectId, 'overdue_payment', level, message, daysOverdue]
            );
        }
    }

    private async toRow(raw: any): Promise<PaymentMilestoneRow> {
        const amountCLP = raw.currency === 'CLP' ? Number(raw.amount) : await financeService.toCLP(Number(raw.amount), raw.currency as Currency);
        const rateMissing = raw.currency !== 'CLP' && amountCLP === 0 && Number(raw.amount) > 0;
        return {
            id: raw.id,
            project_id: raw.project_id,
            project_name: raw.project_name,
            name: raw.name,
            amount: raw.amount,
            currency: raw.currency,
            amount_clp: rateMissing ? null : Math.round(amountCLP),
            status: raw.status,
            planned_date: raw.planned_date,
            trigger_type: raw.trigger_type,
            rate_missing: rateMissing
        };
    }

    async getDashboard(projectId?: number): Promise<BillingDashboard> {
        await this.evaluateTriggers(projectId);
        await this.evaluateOverdue(projectId);

        const projectFilter = projectId ? 'AND pm.project_id = ?' : '';
        const projectParams = projectId ? [projectId] : [];

        const rawRows = await db.query(
            `SELECT pm.id, pm.project_id, p.name as project_name, pm.name, pm.amount, pm.currency,
                    pm.status, pm.planned_date, pm.trigger_type
             FROM payment_milestones pm
             JOIN projects p ON p.id = pm.project_id
             WHERE 1=1 ${projectFilter}
             ORDER BY pm.planned_date ASC`,
            projectParams
        );

        const rows = await Promise.all(rawRows.map((r: any) => this.toRow(r)));

        const ready_to_invoice = rows.filter(r => r.status === 'billable');
        const invoiced_unpaid = rows.filter(r => r.status === 'invoiced');
        const paid = rows.filter(r => r.status === 'paid');
        const overdue = rows.filter(r => r.status === 'overdue');
        const pending = rows.filter(r => r.status === 'pending');

        const sum = (list: PaymentMilestoneRow[]) => list.reduce((s, r) => s + (r.amount_clp ?? 0), 0);

        const cashflowSource = [...pending, ...ready_to_invoice];
        const cashflowMap = new Map<string, number>();
        for (const row of cashflowSource) {
            const month = (row.planned_date || today()).slice(0, 7);
            if (row.amount_clp !== null) cashflowMap.set(month, (cashflowMap.get(month) || 0) + row.amount_clp);
        }
        const cashflow_projection = Array.from(cashflowMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, expected_amount_clp]) => ({ month, expected_amount_clp }));

        return {
            ready_to_invoice,
            invoiced_unpaid,
            paid,
            overdue,
            cashflow_projection,
            summary: {
                total_pending_clp: sum(pending),
                total_billable_clp: sum(ready_to_invoice),
                total_invoiced_clp: sum(invoiced_unpaid),
                total_paid_clp: sum(paid),
                total_overdue_clp: sum(overdue)
            }
        };
    }
}

export const billingService = new BillingService();
