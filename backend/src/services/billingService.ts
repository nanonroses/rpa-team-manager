import { db } from '../database/database';
import { logger } from '../utils/logger';
import { financeService, Currency } from './financeService';

export interface PaymentMilestoneRow {
    id: number;
    project_id: number;
    project_name: string;
    name: string;
    amount: number;
    currency: Currency;
    amount_clp: number;
    status: string;
    planned_date: string | null;
    trigger_type: string;
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

    /** Marca overdue los hitos invoiced cuya factura venció sin estar paga. */
    async evaluateOverdue(projectId?: number): Promise<{ transitioned: number }> {
        const projectFilter = projectId ? 'AND pm.project_id = ?' : '';
        const projectParams = projectId ? [projectId] : [];

        const overdueRows = await db.query(
            `SELECT DISTINCT pm.id, pm.project_id, i.id as invoice_id, i.due_date
             FROM payment_milestones pm
             JOIN invoice_lines il ON il.payment_milestone_id = pm.id
             JOIN invoices i ON i.id = il.invoice_id
             WHERE pm.status = 'invoiced' AND i.due_date < ?
               AND i.status NOT IN ('paid', 'cancelled') ${projectFilter}`,
            [today(), ...projectParams]
        );

        let transitioned = 0;
        for (const row of overdueRows) {
            const daysOverdue = Math.floor((Date.now() - new Date(row.due_date).getTime()) / 86400000);
            await db.run(`UPDATE payment_milestones SET status = 'overdue' WHERE id = ?`, [row.id]);
            await db.run(
                `UPDATE invoices SET status = 'overdue' WHERE id = ? AND status NOT IN ('paid', 'cancelled')`,
                [row.invoice_id]
            );
            await this.syncOverdueAlert(row.id, projectId ?? row.project_id, daysOverdue);
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
        const amountCLP = await financeService.toCLP(raw.amount, raw.currency as Currency);
        return {
            id: raw.id,
            project_id: raw.project_id,
            project_name: raw.project_name,
            name: raw.name,
            amount: raw.amount,
            currency: raw.currency,
            amount_clp: Math.round(amountCLP),
            status: raw.status,
            planned_date: raw.planned_date,
            trigger_type: raw.trigger_type
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

        const sum = (list: PaymentMilestoneRow[]) => list.reduce((s, r) => s + r.amount_clp, 0);

        const cashflowSource = [...pending, ...ready_to_invoice, ...invoiced_unpaid];
        const cashflowMap = new Map<string, number>();
        for (const row of cashflowSource) {
            const month = (row.planned_date || today()).slice(0, 7);
            cashflowMap.set(month, (cashflowMap.get(month) || 0) + row.amount_clp);
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
