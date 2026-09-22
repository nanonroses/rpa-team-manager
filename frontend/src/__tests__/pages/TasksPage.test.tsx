import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    getTaskById: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TasksPage } from '@/pages/tasks/TasksPage';

const board = {
  id: 2, project_id: 7, name: 'Board 1', board_type: 'kanban', project_name: 'AGROSUPER',
  columns: [{ id: 1, board_id: 2, name: 'To Do', position: 0, color: '#000', is_done_column: false }],
  tasks: [{ id: 42, board_id: 2, column_id: 1, title: 'Tarea deep-link', task_type: 'task', status: 'todo', priority: 'medium', position: 0, created_at: '', updated_at: '' }]
};

function renderWithTaskId(taskId: string) {
  return render(
    <MemoryRouter initialEntries={[`/tasks?taskId=${taskId}`]}>
      <TasksPage />
    </MemoryRouter>
  );
}

describe('TasksPage - deep link ?taskId=', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
  });

  it('abre el modal de edición de la tarea indicada por ?taskId=', async () => {
    (apiService.getTaskById as any).mockResolvedValue({ ...board.tasks[0], project_id: 7 });

    renderWithTaskId('42');

    await waitFor(() => {
      expect(apiService.getTaskById).toHaveBeenCalledWith(42);
    });
    expect(await screen.findByDisplayValue('Tarea deep-link')).toBeInTheDocument();
  });

  it('muestra un error legible si la tarea no existe o no hay acceso, sin romper el render', async () => {
    (apiService.getTaskById as any).mockRejectedValue({ response: { status: 404 } });

    renderWithTaskId('999');

    await waitFor(() => {
      expect(apiService.getTaskById).toHaveBeenCalledWith(999);
    });
    expect(await screen.findByText(/no se pudo abrir la tarea/i)).toBeInTheDocument();
  });
});
