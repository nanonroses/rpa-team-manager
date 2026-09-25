import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => {
  const mockApi = {
    getUsers: vi.fn(),
    getProjects: vi.fn(),
    getPMODashboard: vi.fn(),
    getPMOAnalytics: vi.fn(),
    getPMOProjectGantt: vi.fn(),
    updateTask: vi.fn(),
    updateMilestone: vi.fn(),
    deleteTask: vi.fn(),
    deleteMilestone: vi.fn(),
    createMilestone: vi.fn(),
    createTask: vi.fn(),
    getTaskBoards: vi.fn(),
    getTaskBoard: vi.fn(),
    createTaskBoard: vi.fn(),
    batchCreateTasks: vi.fn()
  };
  // PMODashboard.tsx importa el default; useGanttData.ts importa el named export.
  // Ambos deben apuntar al mismo objeto para que los mocks/asserts sean consistentes.
  return { default: mockApi, apiService: mockApi };
});

import apiService from '../../services/api';
import PMODashboard from '../../pages/pmo/PMODashboard';

const ganttTask = {
  id: 101,
  title: 'Tarea sin responsables',
  status: 'todo',
  priority: 'medium',
  start_date: '2026-01-10',
  due_date: '2026-01-20',
  created_at: '2026-01-01',
  assignee_id: null
};

const ganttResponse = {
  project: { id: 7, name: 'AGROSUPER', completion_percentage: 40 },
  milestones: [],
  tasks: [ganttTask]
};

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/pmo/gantt/7']}>
      <Routes>
        <Route path="/pmo/gantt/:id" element={<PMODashboard ganttMode={true} />} />
      </Routes>
    </MemoryRouter>
  );
}

// Ubica el unico Form.Item "Responsables" visible (solo hay un modal abierto a la vez)
// y selecciona, en orden, cada nombre pasado dentro de su select multiple.
async function selectResponsables(names: string[]) {
  const label = screen.getByText('Responsables');
  const formItem = label.closest('.ant-form-item') as HTMLElement;
  const combobox = within(formItem).getByRole('combobox');
  await userEvent.click(combobox);
  for (const name of names) {
    await userEvent.click(await screen.findByText(name));
  }
  return formItem;
}

describe('PMODashboard - multi-asignado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getUsers as any).mockResolvedValue([
      { id: 5, full_name: 'Ana' },
      { id: 9, full_name: 'Beto' }
    ]);
    (apiService.getProjects as any).mockResolvedValue([{ id: 7, name: 'AGROSUPER' }]);
    (apiService.getPMODashboard as any).mockResolvedValue({ projects: [], overallMetrics: {}, upcomingMilestones: [] });
    (apiService.getPMOAnalytics as any).mockResolvedValue({});
    (apiService.getPMOProjectGantt as any).mockResolvedValue(ganttResponse);
    (apiService.updateTask as any).mockResolvedValue({ ...ganttTask });
  });

  it('el formulario "Crear Nueva Tarea" usa un select multiple de responsables y el submit envia assignee_ids como array', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Tarea sin responsables')).toBeInTheDocument(), { timeout: 10000 });

    await userEvent.click(screen.getByRole('button', { name: /nueva tarea/i }));
    await waitFor(() => expect(screen.getByText('Crear Nueva Tarea')).toBeInTheDocument());

    const formItem = await selectResponsables(['Ana', 'Beto']);
    expect(formItem.querySelector('.ant-select-multiple')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('Ej: Configurar base de datos'), 'Nueva tarea de prueba');

    await userEvent.click(screen.getByRole('button', { name: /crear tarea/i }));

    await waitFor(() => {
      expect(logSpy).toHaveBeenCalledWith(
        'Task creation would send:',
        expect.objectContaining({ assignee_ids: [5, 9] })
      );
    }, { timeout: 15000 });

    logSpy.mockRestore();
  }, 40000);

  it('el formulario de editar tarea usa un select multiple de responsables y el submit envia assignee_ids como array', async () => {
    renderDashboard();

    await waitFor(() => expect(screen.getByText('Tarea sin responsables')).toBeInTheDocument(), { timeout: 10000 });

    const editIcon = screen.getAllByRole('img', { name: 'edit' })[0];
    await userEvent.click(editIcon);
    await waitFor(() => expect(screen.getByText('Editar Tarea')).toBeInTheDocument());

    const formItem = await selectResponsables(['Ana', 'Beto']);
    expect(formItem.querySelector('.ant-select-multiple')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(apiService.updateTask).toHaveBeenCalledWith(
        101,
        expect.objectContaining({ assignee_ids: [5, 9] })
      );
    }, { timeout: 15000 });
  }, 40000);
});
