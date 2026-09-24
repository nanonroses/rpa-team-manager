import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    searchTasks: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { GlobalSearch } from '@/components/common/GlobalSearch';

function renderSearch() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<GlobalSearch />} />
        <Route path="/tasks" element={<div>TasksPage placeholder</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('busca tareas tras escribir 2+ caracteres y navega a /tasks?taskId= al seleccionar un resultado', async () => {
    (apiService.searchTasks as any).mockResolvedValue([
      { id: 7, title: 'Corregir bug X', project_name: 'AGROSUPER', board_name: 'Board 1' }
    ]);

    renderSearch();

    const input = screen.getByPlaceholderText('Buscar tareas...');
    await userEvent.type(input, 'bug');

    await waitFor(() => {
      expect(apiService.searchTasks).toHaveBeenCalledWith('bug');
    }, { timeout: 2000 });

    await userEvent.click(await screen.findByText('Corregir bug X'));

    expect(await screen.findByText('TasksPage placeholder')).toBeInTheDocument();
  }, 15000);

  it('no busca con un solo caracter', async () => {
    renderSearch();

    const input = screen.getByPlaceholderText('Buscar tareas...');
    await userEvent.type(input, 'b');

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(apiService.searchTasks).not.toHaveBeenCalled();
  }, 15000);
});
