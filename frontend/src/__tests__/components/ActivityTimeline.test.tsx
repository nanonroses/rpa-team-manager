import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectActivity: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';

describe('ActivityTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra un mensaje cuando no hay actividad registrada', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([]);

    render(<ActivityTimeline projectId={7} />);

    await waitFor(() => {
      expect(screen.getByText(/sin actividad registrada/i)).toBeInTheDocument();
    });
  });

  it('renderiza cada entrada con el nombre de usuario y la acción', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([
      {
        id: 1, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
        action: 'created', old_values: null, new_values: { name: 'AGROSUPER' },
        created_at: '2026-09-17T10:00:00Z'
      },
      {
        id: 2, user_id: 3, user_name: 'Ana', entity_type: 'task', entity_id: 10,
        action: 'updated', old_values: { status: 'todo' }, new_values: { status: 'in_progress' },
        created_at: '2026-09-18T10:00:00Z'
      }
    ]);

    render(<ActivityTimeline projectId={7} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Ana/)).not.toHaveLength(0);
    });
    expect(screen.getByText(/status/)).toBeInTheDocument();
  });

  it('renderiza información identificatoria a partir de old_values para entradas de borrado (new_values null)', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([
      {
        id: 3, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
        action: 'task_deleted', old_values: { id: 55, column_id: 2, position: 1, project_id: 7 }, new_values: null,
        created_at: '2026-09-18T12:00:00Z'
      }
    ]);

    render(<ActivityTimeline projectId={7} />);

    await waitFor(() => {
      expect(screen.getAllByText(/Ana/)).not.toHaveLength(0);
    });
    // Debe listar los campos de old_values (identificatorios) en vez de no mostrar nada.
    expect(screen.getByText(/column_id: 2/)).toBeInTheDocument();
    expect(screen.getByText(/position: 1/)).toBeInTheDocument();
  });

  it('no anexa el sufijo genérico de entidad para acciones autocontenidas como board_created', async () => {
    (apiService.getProjectActivity as any).mockResolvedValue([
      {
        id: 4, user_id: 3, user_name: 'Ana', entity_type: 'project', entity_id: 7,
        action: 'board_created', old_values: null, new_values: { name: 'Board X' },
        created_at: '2026-09-18T13:00:00Z'
      }
    ]);

    render(<ActivityTimeline projectId={7} />);

    await waitFor(() => {
      expect(screen.getByText(/creó un tablero nuevo/)).toBeInTheDocument();
    });
    expect(screen.queryByText('el proyecto')).not.toBeInTheDocument();
  });
});
