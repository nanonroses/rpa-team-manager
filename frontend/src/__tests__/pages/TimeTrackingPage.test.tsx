// frontend/src/__tests__/pages/TimeTrackingPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn().mockResolvedValue([{ id: 1, name: 'AGROSUPER' }]),
    get: vi.fn().mockResolvedValue(null),
    post: vi.fn(),
    getTimesheetWeek: vi.fn().mockResolvedValue({
      period: null,
      total_hours: 0,
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-09-1${i}`,
        entries: [],
        total_hours: 0
      }))
    }),
    saveTimesheetWeek: vi.fn(),
    submitTimesheetWeek: vi.fn(),
    getTimesheetReminders: vi.fn().mockResolvedValue({ missing_dates: [], open_period: null }),
    getPendingTimesheetApprovals: vi.fn().mockResolvedValue([]),
    approveTimesheetWeek: vi.fn(),
    rejectTimesheetWeek: vi.fn(),
    getEffectivenessMetrics: vi.fn().mockResolvedValue({ by_person: [], by_task: [] })
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(() => ({ user: { id: 1, role: 'rpa_developer', full_name: 'Dev Uno' } }))
}));

import { apiService } from '@/services/api';
import { TimeTrackingPage } from '@/pages/time/TimeTrackingPage';

describe('TimeTrackingPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useAuthStore } = await import('@/store/authStore');
    (useAuthStore as any).mockReturnValue({ user: { id: 1, role: 'rpa_developer', full_name: 'Dev Uno' } });
    (apiService.getProjects as any).mockResolvedValue([{ id: 1, name: 'AGROSUPER' }]);
    (apiService.get as any).mockResolvedValue(null);
    (apiService.getTimesheetWeek as any).mockResolvedValue({
      period: null,
      total_hours: 0,
      days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-09-1${i}`,
        entries: [],
        total_hours: 0
      }))
    });
    (apiService.getTimesheetReminders as any).mockResolvedValue({ missing_dates: [], open_period: null });
  });

  it('carga la grilla semanal de 7 días (tab "Mi semana" y sus 7 tarjetas de día)', async () => {
    render(<MemoryRouter><TimeTrackingPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Mi semana')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(apiService.getTimesheetWeek).toHaveBeenCalled();
    });

    // Cada uno de los 7 días de la semana debe renderizar su Card con el botón "Agregar".
    // (el nombre accesible incluye el aria-label del ícono antd, p. ej. "plus Agregar")
    const addButtons = await screen.findAllByRole('button', { name: /Agregar/i });
    expect(addButtons).toHaveLength(7);
  }, 10000);

  it('no muestra los tabs de "Aprobaciones" ni "Efectividad" para un rol que no es team_lead/rpa_operations', async () => {
    render(<MemoryRouter><TimeTrackingPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('Mi semana')).toBeInTheDocument();
    });

    expect(screen.queryByText('Aprobaciones')).not.toBeInTheDocument();
    expect(screen.queryByText('Efectividad')).not.toBeInTheDocument();
  });

  it('abre directo en la tab "Aprobaciones" cuando la URL trae ?tab=approvals', async () => {
    const { useAuthStore } = await import('@/store/authStore');
    (useAuthStore as any).mockReturnValue({ user: { id: 1, role: 'team_lead', full_name: 'Lead Uno' } });

    render(
      <MemoryRouter initialEntries={['/time?tab=approvals']}>
        <TimeTrackingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(apiService.getPendingTimesheetApprovals).toHaveBeenCalled();
    });
  });

  it('fallback a "Mi semana" si usuario sin acceso intenta ir a ?tab=approvals', async () => {
    const { useAuthStore } = await import('@/store/authStore');
    (useAuthStore as any).mockReturnValue({ user: { id: 1, role: 'rpa_developer', full_name: 'Dev Uno' } });

    render(
      <MemoryRouter initialEntries={['/time?tab=approvals']}>
        <TimeTrackingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Mi semana')).toBeInTheDocument();
    });

    // Verificar que NO se intentó cargar aprobaciones
    expect(apiService.getPendingTimesheetApprovals).not.toHaveBeenCalled();
  });
});
