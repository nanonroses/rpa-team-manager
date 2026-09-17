// frontend/src/__tests__/pages/BillingPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BillingPage from '../../pages/billing/BillingPage';

vi.mock('../../services/api', () => ({
  default: {
    getProjects: vi.fn().mockResolvedValue([{ id: 1, name: 'AGROSUPER' }]),
    getBillingDashboard: vi.fn().mockResolvedValue({
      ready_to_invoice: [],
      invoiced_unpaid: [],
      paid: [],
      overdue: [],
      cashflow_projection: [{ month: '2026-09', expected_amount_clp: 1000000 }],
      summary: { total_pending_clp: 0, total_billable_clp: 500000, total_invoiced_clp: 0, total_paid_clp: 200000, total_overdue_clp: 0 }
    }),
    getPaymentMilestones: vi.fn().mockResolvedValue([]),
    getInvoices: vi.fn().mockResolvedValue([])
  }
}));

describe('BillingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el título Cobranza y los totales del dashboard', async () => {
    render(<BillingPage />);

    expect(await screen.findByText('Cobranza')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Por facturar')).toBeInTheDocument();
      expect(screen.getByText('Cobrado')).toBeInTheDocument();
    });
  });

  it('muestra el botón para crear un nuevo hito de pago', async () => {
    render(<BillingPage />);
    expect(await screen.findByText('Nuevo hito de pago')).toBeInTheDocument();
  });
});
