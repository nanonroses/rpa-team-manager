import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectHealth: vi.fn(),
    freezeProjectBaseline: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'team_lead', full_name: 'PM Uno' } })
}));

import { apiService } from '@/services/api';
import { ProjectHealthCard } from '@/components/projects/ProjectHealthCard';

describe('ProjectHealthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el semáforo y SPI/CPI cuando la salud está ok', async () => {
    (apiService.getProjectHealth as any).mockResolvedValue({
      project_id: 1, has_baseline: true, status: 'ok',
      ev_percentage: 40, pv_percentage: 60, spi: 0.67, cpi: 0.9,
      semaphore: 'red', projected_end_date: '2026-08-01', schedule_variance_days: 45
    });

    render(<ProjectHealthCard projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/SPI/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/0.67/)).toBeInTheDocument();
  });

  it('muestra el botón "Congelar baseline" para team_lead cuando no hay baseline, y lo llama al hacer click', async () => {
    (apiService.getProjectHealth as any).mockResolvedValue({
      project_id: 1, has_baseline: false, status: 'insufficient_data',
      ev_percentage: 0, pv_percentage: null, spi: null, cpi: null,
      semaphore: 'gray', projected_end_date: null, schedule_variance_days: null
    });
    (apiService.freezeProjectBaseline as any).mockResolvedValue({ id: 1, project_id: 1 });

    render(<ProjectHealthCard projectId={1} />);

    const button = await screen.findByRole('button', { name: /congelar baseline/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(apiService.freezeProjectBaseline).toHaveBeenCalledWith(1);
    });
  });

  it('no muestra el botón "Congelar baseline" si ya existe un baseline', async () => {
    (apiService.getProjectHealth as any).mockResolvedValue({
      project_id: 1, has_baseline: true, status: 'insufficient_data',
      ev_percentage: 0, pv_percentage: null, spi: null, cpi: null,
      semaphore: 'gray', projected_end_date: null, schedule_variance_days: null
    });

    render(<ProjectHealthCard projectId={1} />);

    await waitFor(() => {
      expect(screen.getByText(/sin datos suficientes/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /congelar baseline/i })).not.toBeInTheDocument();
  });
});
