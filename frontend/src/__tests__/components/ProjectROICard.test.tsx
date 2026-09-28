import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectROI: vi.fn(),
    getUserCosts: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 1, role: 'team_lead', full_name: 'Lead' } })
}));

import { apiService } from '@/services/api';
import { ProjectROICard } from '@/components/projects/ProjectROICard';

const base = {
  project_id: 1, project_name: 'P', planned_hours: 100, real_hours: 120, approved_hours: 120,
  client_delay_hours: 0, hourly_rate_uf: 0, uf_value_clp: 38000, engineer_hourly_cost: 10000,
  sale_price: 3000000, planned_cost: 1000000, real_cost: 1200000, planned_profit: 2000000, real_profit: 1800000,
  planned_roi: 200, real_roi: 150, delay_impact: 200000, lost_profit: 200000, alerts: []
};

describe('ProjectROICard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getUserCosts as any).mockResolvedValue([]);
  });

  it('muestra valores reales cuando hay horas aprobadas aunque no haya atraso del cliente', async () => {
    (apiService.getProjectROI as any).mockResolvedValue({ ...base, real_hours_source: 'approved' });

    render(<ProjectROICard projectId={1} projectName="P" />);

    await waitFor(() => expect(screen.getByText('Costo Real')).toBeInTheDocument());
    expect(screen.queryByText('Costo Planificado')).not.toBeInTheDocument();
  });

  it('muestra valores planificados cuando aún no hay horas aprobadas ni atraso', async () => {
    (apiService.getProjectROI as any).mockResolvedValue({ ...base, real_hours_source: 'projected', approved_hours: 0 });

    render(<ProjectROICard projectId={1} projectName="P" />);

    await waitFor(() => expect(screen.getByText('Costo Planificado')).toBeInTheDocument());
  });

  it('muestra sección de proyección al término con margen proyectado y desvío económico', async () => {
    (apiService.getProjectROI as any).mockResolvedValue({
      ...base,
      real_hours_source: 'approved',
      projected_cost: 1500000,
      projected_hours: 130,
      projected_profit: 1500000,
      planned_margin_percentage: 66.7,
      real_margin_percentage: 60,
      projected_margin_percentage: 50,
      projected_roi: 100,
      variance_impact: 500000
    });

    render(<ProjectROICard projectId={1} projectName="P" />);

    await waitFor(() => expect(screen.getByText('Costo Proyectado')).toBeInTheDocument());
    expect(screen.getByText('Margen % Proyectado')).toBeInTheDocument();
    expect(screen.getByText('Impacto del Desvío')).toBeInTheDocument();
    expect(screen.getByText('Sobrecosto de $500.000')).toBeInTheDocument();
    expect(screen.getByText('Desvío: -$500.000')).toBeInTheDocument();
  });

  it('muestra tag de ahorro cuando el desvío económico es favorable (ahorro presupuestario)', async () => {
    (apiService.getProjectROI as any).mockResolvedValue({
      ...base,
      real_hours_source: 'approved',
      projected_cost: 900000,
      projected_hours: 90,
      projected_profit: 2100000,
      planned_margin_percentage: 66.7,
      real_margin_percentage: 70,
      projected_margin_percentage: 70,
      projected_roi: 233.3,
      variance_impact: -100000
    });

    render(<ProjectROICard projectId={1} projectName="P" />);

    await waitFor(() => expect(screen.getByText('Ahorro de $100.000')).toBeInTheDocument());
    expect(screen.getByText('Ahorro: +$100.000')).toBeInTheDocument();
  });
});
