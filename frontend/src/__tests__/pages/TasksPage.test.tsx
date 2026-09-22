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

  it('con 2 boards en el proyecto, abre la tarea del board correcto aunque el board "primero" de la lista resuelva después', async () => {
    // Board 1 es el "primero" de la lista (candidato al auto-select preexistente de loadBoards).
    // Board 2 es el board real de la tarea del deep-link.
    const boardOne = {
      id: 1, project_id: 7, name: 'Board Uno', board_type: 'kanban', project_name: 'AGROSUPER',
      columns: [{ id: 10, board_id: 1, name: 'To Do', position: 0, color: '#000', is_done_column: false }],
      tasks: [{ id: 1, board_id: 1, column_id: 10, title: 'Tarea board 1', task_type: 'task', status: 'todo', priority: 'medium', position: 0, created_at: '', updated_at: '' }]
    };
    const boardTwo = board;

    // El fetch del board 1 (auto-select) resuelve DESPUÉS que el del board 2 (deep-link),
    // para forzar la condición de carrera descrita en el hallazgo de revisión.
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([]);
      if (url.startsWith('/tasks/boards?')) {
        return Promise.resolve([
          { id: 1, project_id: 7, name: 'Board Uno', board_type: 'kanban', project_name: 'AGROSUPER' },
          { id: 2, project_id: 7, name: 'Board 1', board_type: 'kanban', project_name: 'AGROSUPER' }
        ]);
      }
      if (url === '/tasks/boards/1') {
        return new Promise((resolve) => setTimeout(() => resolve(boardOne), 30));
      }
      if (url === '/tasks/boards/2') {
        return Promise.resolve(boardTwo);
      }
      return Promise.resolve(null);
    });
    (apiService.getTaskById as any).mockResolvedValue({ ...boardTwo.tasks[0], project_id: 7 });

    renderWithTaskId('42');

    await waitFor(() => {
      expect(apiService.getTaskById).toHaveBeenCalledWith(42);
    });
    expect(await screen.findByDisplayValue('Tarea deep-link')).toBeInTheDocument();

    // Dejar correr el fetch demorado del board 1 (30ms) y confirmar que, aun así,
    // el board mostrado sigue siendo el del deep-link (board 2), no el board "primero".
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(apiService.get).not.toHaveBeenCalledWith('/tasks/boards/1');
    expect(screen.getByText('Tarea deep-link')).toBeInTheDocument();
    expect(screen.queryByText('Tarea board 1')).not.toBeInTheDocument();
  });
});
