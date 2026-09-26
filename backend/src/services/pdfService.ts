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
    financials?: { sale_price: number | null };
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

/** Genera el estado de pago con importes originales y moneda explícita. */
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

        if (data.financials?.sale_price != null) {
            doc.fontSize(13).text('Resumen financiero', { underline: true });
            doc.fontSize(11).text(`Precio de venta: ${formatCLP(data.financials.sale_price)}`);
            doc.moveDown();
        }

        doc.fontSize(13).text(`Hitos de pago al ${data.generated_at}`, { underline: true });
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
        doc.end();
    });
}
