import PDFDocument from 'pdfkit';

export interface PaymentStatementMilestone {
    name: string;
    amount: number;
    currency: string;
    status: string;
    planned_date: string | null;
}

export interface PaymentStatementHours {
    user_name: string;
    total_hours: number;
}

export interface PaymentStatementData {
    project_name: string;
    client_name: string;
    generated_at: string;
    // Solo el precio de venta es información legítima para el cliente en este documento de cobranza.
    // Costo real, margen y ROI son datos internos que no deben salir en un PDF que puede llegar al cliente
    // (la plataforma no tiene portal de cliente; este es el único artefacto que podría "salir del edificio").
    financials: {
        sale_price: number;
    };
    milestones: PaymentStatementMilestone[];
    hours_summary: PaymentStatementHours[];
}

const STATUS_LABEL: Record<string, string> = {
    pending: 'Pendiente',
    billable: 'Por facturar',
    invoiced: 'Facturado',
    paid: 'Pagado',
    overdue: 'Vencido'
};

function formatCLP(amount: number): string {
    return `$${Math.round(amount).toLocaleString('es-CL')}`;
}

/** Genera el PDF de estado de pago de un proyecto. Los montos ya vienen calculados por financeService/billingService. */
export function generatePaymentStatement(data: PaymentStatementData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(18).text('Estado de Pago', { align: 'center' });
        doc.moveDown();
        doc.fontSize(11);
        doc.text(`Proyecto: ${data.project_name}`);
        doc.text(`Cliente: ${data.client_name}`);
        doc.text(`Generado: ${data.generated_at}`);
        doc.moveDown();

        doc.fontSize(13).text('Resumen financiero', { underline: true });
        doc.fontSize(11);
        doc.text(`Precio de venta: ${formatCLP(data.financials.sale_price)}`);
        doc.moveDown();

        doc.fontSize(13).text('Hitos de pago', { underline: true });
        doc.fontSize(10);
        if (data.milestones.length === 0) {
            doc.text('Sin hitos de pago registrados.');
        } else {
            for (const m of data.milestones) {
                const statusLabel = STATUS_LABEL[m.status] || m.status;
                const dateLabel = m.planned_date || 's/f';
                doc.text(`${m.name} — ${m.amount.toLocaleString('es-CL')} ${m.currency} — ${statusLabel} — ${dateLabel}`);
            }
        }
        doc.moveDown();

        doc.fontSize(13).text('Horas registradas', { underline: true });
        doc.fontSize(10);
        if (data.hours_summary.length === 0) {
            doc.text('Sin horas registradas para este proyecto.');
        } else {
            for (const h of data.hours_summary) {
                doc.text(`${h.user_name}: ${h.total_hours}h`);
            }
        }

        doc.end();
    });
}
