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
});
