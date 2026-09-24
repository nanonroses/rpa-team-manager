import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjects: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    getTaskById: vi.fn(),
    getTaskSubtasks: vi.fn(),
    createTaskSubtask: vi.fn()
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
    { id: 42, board_id: 2, column_id: 1, title: 'Tarea Critica', task_type: 'bug', status: 'todo', priority: 'critical', assignee_id: 9, assignee_name: 'Ana', position: 0, created_at: '', updated_at: '' },
    { id: 43, board_id: 2, column_id: 1, title: 'Tarea Media', task_type: 'task', status: 'todo', priority: 'medium', position: 1, created_at: '', updated_at: '' }
  ]
};

const board2 = {
  id: 3, project_id: 7, name: 'Board 2', board_type: 'kanban', project_name: 'AGROSUPER',
  columns: [{ id: 3, board_id: 3, name: 'To Do', position: 0, color: '#000', is_done_column: false }],
  tasks: [
    { id: 99, board_id: 3, column_id: 3, title: 'Tarea Board 2', task_type: 'task', status: 'todo', priority: 'critical', position: 0, created_at: '', updated_at: '' }
  ]
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/tasks']}>
      <TasksPage />
    </MemoryRouter>
  );
}

async function selectBoard() {
  await waitFor(() => {
    expect(screen.getByText('Tarea Critica')).toBeInTheDocument();
  });
}

describe('TasksPage - filtros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([{ id: 9, full_name: 'Ana' }]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board, board2]);
      if (url.startsWith('/tasks/boards/3')) return Promise.resolve(board2);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
  });

  it('filtra las tareas visibles por prioridad', async () => {
    renderPage();
    await selectBoard();

    expect(screen.getByText('Tarea Media')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: /filtrar por prioridad/i }));
    await userEvent.click(await screen.findByText('🔴 Crítica'));

    expect(screen.getByText('Tarea Critica')).toBeInTheDocument();
    expect(screen.queryByText('Tarea Media')).not.toBeInTheDocument();
  }, 30000);

  it('filtra por asignado y permite limpiar los filtros', async () => {
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('combobox', { name: /filtrar por asignado/i }));
    await userEvent.click(await screen.findByText('Ana'));

    expect(screen.getByText('Tarea Critica')).toBeInTheDocument();
    expect(screen.queryByText('Tarea Media')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));

    expect(screen.getByText('Tarea Critica')).toBeInTheDocument();
    expect(screen.getByText('Tarea Media')).toBeInTheDocument();
  }, 30000);

  it('limpia los filtros al cambiar de board', async () => {
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('combobox', { name: /filtrar por prioridad/i }));
    await userEvent.click(await screen.findByText('🔴 Crítica'));

    expect(screen.queryByText('Tarea Media')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox', { name: /^board$/i }));
    await userEvent.click(await screen.findByText('Board 2'));

    await waitFor(() => {
      expect(screen.getByText('Tarea Board 2')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /limpiar filtros/i })).not.toBeInTheDocument();
  }, 30000);
});
