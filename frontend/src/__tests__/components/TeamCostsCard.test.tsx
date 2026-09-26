import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getTeamCosts: vi.fn(),
    createUserCost: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TeamCostsCard } from '@/components/settings/TeamCostsCard';

const response = {
  monthly_hours: 176,
  members: [
    { user_id: 2, full_name: 'Dev Uno', email: 'd@x.cl', role: 'rpa_developer', cost_rate_id: 5, monthly_cost: 1760000, hourly_rate: 10000, effective_from: '2026-09-01' },
    { user_id: 3, full_name: 'Ops Uno', email: 'o@x.cl', role: 'rpa_operations', cost_rate_id: null, monthly_cost: null, hourly_rate: null, effective_from: null }
  ]
};

function rowOf(name: string): HTMLElement {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

describe('TeamCostsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getTeamCosts as any).mockResolvedValue(response);
    (apiService.createUserCost as any).mockResolvedValue({ id: 9 });
  });

  it('lista a cada persona activa con su valor HH calculado con las horas del mes', async () => {
    render(<TeamCostsCard />);

    await waitFor(() => expect(screen.getByText('Dev Uno')).toBeInTheDocument());
    expect(within(rowOf('Dev Uno')).getByText(/10\.000/)).toBeInTheDocument();
    expect(within(rowOf('Ops Uno')).getByText(/sin costo registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/176/)).toBeInTheDocument();
  });

  it('guarda el costo empresa de una persona sin costo previo', async () => {
    render(<TeamCostsCard />);
    await waitFor(() => expect(screen.getByText('Ops Uno')).toBeInTheDocument());

    const input = within(rowOf('Ops Uno')).getByLabelText(/costo empresa de ops uno/i);
    fireEvent.change(input, { target: { value: '3520000' } });
    fireEvent.click(within(rowOf('Ops Uno')).getByRole('button', { name: /guardar/i }));

    await waitFor(() => {
      expect(apiService.createUserCost).toHaveBeenCalledWith({
        user_id: 3,
        monthly_cost: 3520000,
        effective_from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      });
    });
    expect(apiService.getTeamCosts).toHaveBeenCalledTimes(2);
  });

  it('el botón Guardar está deshabilitado si no se cambió el costo', async () => {
    render(<TeamCostsCard />);
    await waitFor(() => expect(screen.getByText('Dev Uno')).toBeInTheDocument());

    expect(within(rowOf('Dev Uno')).getByRole('button', { name: /guardar/i })).toBeDisabled();
  });
});
