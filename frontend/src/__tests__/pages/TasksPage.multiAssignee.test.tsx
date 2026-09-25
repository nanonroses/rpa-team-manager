import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    getTaskSubtasks: vi.fn(),
    getTaskCollaborators: vi.fn(),
    getTaskTags: vi.fn(),
    getComments: vi.fn(),
    getMentionableUsers: vi.fn(),
    batchUpdateTasks: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TasksPage } from '@/pages/tasks/TasksPage';

const board = {
  id: 2, project_id: 7, name: 'Board 1', board_type: 'kanban', project_name: 'AGROSUPER',
  columns: [
    { id: 1, board_id: 2, name: 'To Do', position: 0, color: '#000', is_done_column: false }
  ],
  tasks: [
    {
      id: 42, board_id: 2, column_id: 1, title: 'Tarea con 2 responsables', task_type: 'task',
      status: 'todo', priority: 'medium', position: 0, created_at: '', updated_at: '',
      assignee_id: 5, assignee_ids: '5||9', assignee_names: 'Ana||Beto'
    }
  ]
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <TasksPage />
    </MemoryRouter>
  );
}

describe('TasksPage - multi-asignado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([
        { id: 5, full_name: 'Ana' }, { id: 9, full_name: 'Beto' }, { id: 11, full_name: 'Carla' }
      ]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
    (apiService.getTaskCollaborators as any).mockResolvedValue([]);
    (apiService.getTaskTags as any).mockResolvedValue([]);
    (apiService.getComments as any).mockResolvedValue([]);
    (apiService.getMentionableUsers as any).mockResolvedValue([]);
  });

  it('la tarjeta del Kanban muestra los 2 responsables como avatares/tags con tooltip', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tarea con 2 responsables')).toBeInTheDocument());

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('el formulario de edicion precarga assignee_ids con ambos responsables en un select multiple', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Tarea con 2 responsables')).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /editar tarea/i }));

    await waitFor(() => {
      expect(screen.getByText('Ana')).toBeInTheDocument();
      expect(screen.getByText('Beto')).toBeInTheDocument();
    }, { timeout: 10000 });
  }, 15000);

  it('guardar la edicion envia assignee_ids como array de numeros', async () => {
    (apiService.put as any).mockResolvedValue({ ...board.tasks[0] });
    renderPage();
    await waitFor(() => expect(screen.getByText('Tarea con 2 responsables')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /editar tarea/i }));
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument(), { timeout: 10000 });

    await userEvent.click(screen.getByRole('button', { name: /guardar|actualizar/i }));

    await waitFor(() => {
      expect(apiService.put).toHaveBeenCalledWith(
        '/tasks/42',
        expect.objectContaining({ assignee_ids: [5, 9] })
      );
    }, { timeout: 10000 });
  }, 25000);
});
