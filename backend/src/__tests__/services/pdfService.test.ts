import { generatePaymentStatement, PaymentStatementData } from '../../services/pdfService';

describe('pdfService.generatePaymentStatement', () => {
    it('genera un buffer con cabecera PDF válida', async () => {
        const data: PaymentStatementData = {
            project_name: 'AGROSUPER - Toma de Control',
            client_name: 'Agrosuper S.A.',
            generated_at: '2026-09-16',
            financials: {
                sale_price: 4470102
            },
            milestones: [
                { name: 'Hito 1', amount: 1000000, currency: 'CLP', status: 'paid', planned_date: '2026-06-01' },
                { name: 'Hito 2', amount: 1000000, currency: 'CLP', status: 'billable', planned_date: '2026-09-01' }
            ],
            hours_summary: [
                { user_name: 'Dev Uno', total_hours: 120 }
            ]
        };

        const buffer = await generatePaymentStatement(data);

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(100);
        expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('no lanza si no hay horas registradas', async () => {
        const data: PaymentStatementData = {
            project_name: 'PROMET',
            client_name: 'Promet',
            generated_at: '2026-09-16',
            financials: { sale_price: 1000000 },
            milestones: [],
            hours_summary: []
        };

        await expect(generatePaymentStatement(data)).resolves.toBeInstanceOf(Buffer);
    });
});
