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
    createTaskSubtask: vi.fn(),
    batchUpdateTasks: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TasksPage } from '@/pages/tasks/TasksPage';

const board = {
  id: 2, project_id: 7, name: 'Board 1', board_type: 'kanban', project_name: 'AGROSUPER',
  columns: [
    { id: 1, board_id: 2, name: 'To Do', position: 0, color: '#000', is_done_column: false },
    { id: 2, board_id: 2, name: 'Done', position: 1, color: '#000', is_done_column: true }
  ],
  tasks: [
    { id: 42, board_id: 2, column_id: 1, title: 'Tarea A', task_type: 'task', status: 'todo', priority: 'medium', position: 0, created_at: '', updated_at: '' },
    { id: 43, board_id: 2, column_id: 1, title: 'Tarea B', task_type: 'task', status: 'todo', priority: 'medium', position: 1, created_at: '', updated_at: '' }
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
    expect(screen.getByText('Tarea A')).toBeInTheDocument();
  });
}

describe('TasksPage - edicion masiva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.get as any).mockImplementation((url: string) => {
      if (url.startsWith('/auth/users')) return Promise.resolve([{ id: 9, full_name: 'Ana Reasignada' }]);
      if (url.startsWith('/tasks/boards?')) return Promise.resolve([board]);
      if (url.startsWith('/tasks/boards/')) return Promise.resolve(board);
      return Promise.resolve(null);
    });
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
  });

  it('activa el modo de seleccion, muestra la barra de acciones al tildar una tarea y la oculta al cancelar', async () => {
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('button', { name: /selección múltiple/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea a/i }));

    expect(await screen.findByText(/1 tarea\(s\) seleccionada/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /cancelar selección/i }));

    await waitFor(() => {
      expect(screen.queryByText(/tarea\(s\) seleccionada/i)).not.toBeInTheDocument();
    });
  }, 30000);

  it('aplica un cambio de prioridad a las tareas seleccionadas y limpia la seleccion', async () => {
    (apiService.batchUpdateTasks as any).mockResolvedValue({ success: true, updated: [42, 43], updatedCount: 2, skipped: [] });
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('button', { name: /selección múltiple/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea a/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea b/i }));

    await userEvent.click(screen.getByRole('combobox', { name: /cambiar prioridad/i }));
    await userEvent.click(await screen.findByText('🔴 Crítica'));

    await userEvent.click(screen.getByRole('button', { name: /^aplicar$/i }));

    await waitFor(() => {
      expect(apiService.batchUpdateTasks).toHaveBeenCalledWith([42, 43], { priority: 'critical' });
    });
    await waitFor(() => {
      expect(screen.queryByText(/tarea\(s\) seleccionada/i)).not.toBeInTheDocument();
    });
  }, 30000);

  it('no llama a la API si se cancela la seleccion sin aplicar', async () => {
    renderPage();
    await selectBoard();

    await userEvent.click(screen.getByRole('button', { name: /selección múltiple/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /seleccionar tarea tarea a/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancelar selección/i }));

    expect(apiService.batchUpdateTasks).not.toHaveBeenCalled();
  }, 30000);
});
