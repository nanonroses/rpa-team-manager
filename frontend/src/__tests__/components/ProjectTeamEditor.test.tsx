import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectTeamEditor } from '@/components/projects/ProjectTeamEditor';
import { apiService } from '@/services/api';

vi.mock('@/services/api', () => ({ apiService: { getUsers: vi.fn(), request: vi.fn(), post: vi.fn() } }));

describe('ProjectTeamEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getUsers).mockResolvedValue([{ id: 2, full_name: 'Desarrollador', email: 'dev@example.com', role: 'rpa_developer', is_active: true }]);
    vi.mocked(apiService.post).mockResolvedValue({});
  });
  it('preserva dedicación, fechas y horas al guardar equipo y responsable juntos', async () => {
    const assignment = { user_id: 2, role: 'contributor', allocation_percentage: 50, budgeted_hours: 80, start_date: '2026-09-01', end_date: '2026-10-01' };
    vi.mocked(apiService.request).mockResolvedValue([assignment]);
    const onSaved = vi.fn();
    render(<App><ProjectTeamEditor projectId={2} responsibleId={2} onClose={vi.fn()} onSaved={onSaved} /></App>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar equipo' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    await waitFor(() => expect(apiService.post).toHaveBeenCalledWith('/projects/2/assignments', {
      user_assignments: [assignment], responsible_user_id: 2
    }));
    expect(onSaved).toHaveBeenCalledOnce();
  });
  it('impide guardar sin integrantes ni responsable', async () => {
    vi.mocked(apiService.request).mockResolvedValue([]);
    render(<App><ProjectTeamEditor projectId={2} onClose={vi.fn()} onSaved={vi.fn()} /></App>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar equipo' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar equipo' }));
    await screen.findByText('Agrega al menos una persona al equipo');
    expect(apiService.post).not.toHaveBeenCalled();
  });
  it('no permite sobrescribir el equipo si falla su carga', async () => {
    vi.mocked(apiService.request).mockRejectedValue(new Error('network'));
    render(<App><ProjectTeamEditor projectId={2} onClose={vi.fn()} onSaved={vi.fn()} /></App>);
    await screen.findByText('No se pudo cargar el equipo. Cierra esta ventana y vuelve a intentarlo.');
    expect(screen.getByRole('button', { name: 'Guardar equipo' })).toBeDisabled();
  });
});
