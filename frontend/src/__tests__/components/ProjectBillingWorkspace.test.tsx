import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectBillingWorkspace } from '@/components/projects/ProjectBillingWorkspace';
import { apiService } from '@/services/api';
vi.mock('@/services/api', () => ({ apiService: { getProjectGantt: vi.fn(), createPaymentMilestone: vi.fn(), updatePaymentMilestone: vi.fn(), createInvoice: vi.fn(), recordPayment: vi.fn(), deletePaymentMilestone: vi.fn() } }));
const milestone = { id: 7, project_id: 2, name: 'Entrega', amount: 100, currency: 'UF', status: 'pending', trigger_type: 'date', planned_date: '2027-10-01' } as any;
const invoice = { id: 9, project_id: 2, invoice_number: 'F-9', amount: 100, currency: 'UF', status: 'partially_paid', due_date: '2027-10-01', totals: { paid_amount: 40 }, payments: [] } as any;
const refresh = vi.fn().mockResolvedValue(undefined);
const show = (props: any = {}) => render(<App><ProjectBillingWorkspace projectId={2} canManage milestones={[]} invoices={[]} loading={false} onRefresh={refresh} {...props} /></App>);
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiService.getProjectGantt).mockResolvedValue({ milestones: [] } as any); });
describe('Cobranza del proyecto', () => {
  it('crea un hito vinculado al proyecto abierto y actualiza los datos', async () => {
    show(); fireEvent.click(screen.getByRole('button', { name: 'Agregar hito de pago' }));
    fireEvent.change(screen.getByLabelText('Nombre del hito'), { target: { value: 'Anticipo' } });
    fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '50000' } });
    fireEvent.change(screen.getByLabelText('Fecha prevista'), { target: { value: '2027-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(apiService.createPaymentMilestone).toHaveBeenCalledWith(expect.objectContaining({ project_id: 2, name: 'Anticipo', amount: 50000, currency: 'CLP', trigger_type: 'date', planned_date: '2027-10-01' })));
    expect(refresh).toHaveBeenCalled();
  });
  it('edita hitos pendientes sin cambiar su condición', async () => {
    show({ milestones: [milestone] }); fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Nombre del hito'), { target: { value: 'Entrega final' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(apiService.updatePaymentMilestone).toHaveBeenCalledWith(7, expect.objectContaining({ name: 'Entrega final', amount: 100, currency: 'UF' })));
  });
  it('registra el saldo restante en la moneda de la factura', async () => {
    show({ invoices: [invoice] }); fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
    expect(screen.getByLabelText('Monto recibido (UF)')).toHaveValue('60');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(apiService.recordPayment).toHaveBeenCalledWith(9, expect.objectContaining({ amount: 60, currency: 'UF' })));
  });
  it('no permite editar hitos facturados ni registrar pagos en facturas pagadas', () => {
    show({ milestones: [{ ...milestone, status: 'invoiced' }], invoices: [{ ...invoice, status: 'paid', totals: { paid_amount: 100 } }] });
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar pago' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Facturar seleccionados (0)' })).toBeDisabled();
  });
  it('factura los hitos cobrables seleccionados del proyecto', async () => {
    show({ milestones: [{ ...milestone, status: 'billable' }] });
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Facturar seleccionados (1)' }));
    fireEvent.change(screen.getByLabelText('Número de factura'), { target: { value: 'F-10' } });
    fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), { target: { value: '2027-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(apiService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ project_id: 2, invoice_number: 'F-10', payment_milestone_ids: [7] })));
  });
  it('bloquea la facturación conjunta de monedas distintas', () => {
    show({ milestones: [{ ...milestone, status: 'billable' }, { ...milestone, id: 8, currency: 'CLP', status: 'billable' }] });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: 'Facturar seleccionados (2)' })).toBeDisabled();
    expect(screen.getByText('Cada factura debe contener hitos de una misma moneda.')).toBeInTheDocument();
  });
  it('reserva la gestión financiera para jefatura', () => {
    show({ canManage: false }); expect(screen.queryByRole('button', { name: 'Agregar hito de pago' })).not.toBeInTheDocument();
  });
});
