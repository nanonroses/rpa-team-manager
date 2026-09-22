import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getUnreadNotificationCount: vi.fn(),
    getNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { NotificationBell } from '@/components/common/NotificationBell';

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  );
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getUnreadNotificationCount as any).mockResolvedValue({ count: 0 });
    (apiService.getNotifications as any).mockResolvedValue([]);
  });

  it('muestra el conteo de no leídas en el badge', async () => {
    (apiService.getUnreadNotificationCount as any).mockResolvedValue({ count: 3 });

    renderBell();

    await waitFor(() => {
      expect(apiService.getUnreadNotificationCount).toHaveBeenCalled();
    });
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('al abrir el dropdown carga y muestra las notificaciones', async () => {
    (apiService.getNotifications as any).mockResolvedValue([
      { id: 1, title: 'Te asignaron una tarea', message: 'Tarea X', is_read: false, link: '/tasks?taskId=1', created_at: '2026-09-22T10:00:00Z' }
    ]);

    renderBell();
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('Te asignaron una tarea')).toBeInTheDocument();
  });

  it('muestra un estado vacío si no hay notificaciones', async () => {
    renderBell();
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/sin notificaciones/i)).toBeInTheDocument();
  });

  it('marcar todas leídas llama al endpoint y pone el badge en 0', async () => {
    (apiService.getUnreadNotificationCount as any).mockResolvedValue({ count: 2 });
    (apiService.getNotifications as any).mockResolvedValue([
      { id: 1, title: 'A', message: null, is_read: false, link: null, created_at: '2026-09-22T10:00:00Z' }
    ]);
    (apiService.markAllNotificationsRead as any).mockResolvedValue(undefined);

    renderBell();
    await screen.findByText('2');
    await userEvent.click(screen.getByRole('button'));
    await screen.findByText('A');
    await userEvent.click(screen.getByText(/marcar todas leídas/i));

    expect(apiService.markAllNotificationsRead).toHaveBeenCalled();
  });

  it('refresca el conteo de no leídas cada 60 segundos y limpia el interval al desmontar', async () => {
    vi.useFakeTimers();
    (apiService.getUnreadNotificationCount as any)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 5 });

    const { unmount } = renderBell();
    await vi.waitFor(() => expect(apiService.getUnreadNotificationCount).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60000);
    expect(apiService.getUnreadNotificationCount).toHaveBeenCalledTimes(2);

    unmount();
    await vi.advanceTimersByTimeAsync(60000);
    expect(apiService.getUnreadNotificationCount).toHaveBeenCalledTimes(2); // no llamó de nuevo tras desmontar

    vi.useRealTimers();
  });

  it('no rompe el render si getNotifications falla al abrir el dropdown', async () => {
    (apiService.getNotifications as any).mockRejectedValue(new Error('network error'));

    renderBell();
    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/sin notificaciones/i)).toBeInTheDocument();
  });
});
