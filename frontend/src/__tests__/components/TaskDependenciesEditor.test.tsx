import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getTaskDependencies: vi.fn(),
    createTaskDependency: vi.fn(),
    deleteTaskDependency: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TaskDependenciesEditor } from '@/components/tasks/TaskDependenciesEditor';

describe('TaskDependenciesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDependencies = {
    depends_on: [
      {
        dependency_id: 1,
        task_id: 20,
        title: 'Diseño de base de datos',
        status: 'done',
        dependency_type: 'finish_to_start' as const,
        lag_days: 2
      }
    ],
    blocks: [
      {
        dependency_id: 2,
        task_id: 30,
        title: 'Despliegue a producción',
        status: 'todo',
        dependency_type: 'finish_to_start' as const,
        lag_days: 0
      }
    ]
  };

  const availableTasks = [
    { id: 10, title: 'Tarea Actual' },
    { id: 20, title: 'Diseño de base de datos' },
    { id: 30, title: 'Despliegue a producción' },
    { id: 40, title: 'Pruebas E2E' }
  ];

  it('carga y muestra dependencias de tipo depends_on y blocks', async () => {
    (apiService.getTaskDependencies as any).mockResolvedValue(mockDependencies);

    render(<TaskDependenciesEditor taskId={10} availableTasks={availableTasks} />);

    expect(await screen.findByText(/Diseño de base de datos/)).toBeInTheDocument();
    expect(screen.getByText(/Despliegue a producción/)).toBeInTheDocument();
    expect(screen.getByText(/Dependencias \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Depende de \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Bloquea a \(1\)/)).toBeInTheDocument();
  });

  it('muestra estados vacíos cuando no hay dependencias', async () => {
    (apiService.getTaskDependencies as any).mockResolvedValue({
      depends_on: [],
      blocks: []
    });

    render(<TaskDependenciesEditor taskId={10} availableTasks={availableTasks} />);

    expect(await screen.findByText('Esta tarea no depende de ninguna otra')).toBeInTheDocument();
    expect(screen.getByText('Esta tarea no bloquea ninguna otra')).toBeInTheDocument();
  });

  it('permite eliminar una dependencia llamando a deleteTaskDependency', async () => {
    (apiService.getTaskDependencies as any).mockResolvedValue(mockDependencies);
    (apiService.deleteTaskDependency as any).mockResolvedValue({ success: true });

    render(<TaskDependenciesEditor taskId={10} availableTasks={availableTasks} />);

    const deleteButtons = await screen.findAllByRole('button', { name: 'Eliminar dependencia' });
    expect(deleteButtons.length).toBe(2);

    await userEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(apiService.deleteTaskDependency).toHaveBeenCalledWith(10, 1);
    });
  });

  it('permite alternar opciones avanzadas para configurar tipo y lag', async () => {
    (apiService.getTaskDependencies as any).mockResolvedValue({ depends_on: [], blocks: [] });

    render(<TaskDependenciesEditor taskId={10} availableTasks={availableTasks} />);

    const advButton = await screen.findByRole('button', { name: /Avanzado/i });
    expect(advButton).toBeInTheDocument();
    expect(screen.queryByTestId('advanced-dependency-options')).not.toBeInTheDocument();

    await userEvent.click(advButton);
    expect(screen.getByTestId('advanced-dependency-options')).toBeInTheDocument();
    expect(screen.getByText(/Tipo de dependencia:/i)).toBeInTheDocument();
    expect(screen.getByText(/Días de desfase \(lag\):/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ocultar opciones/i }));
    expect(screen.queryByTestId('advanced-dependency-options')).not.toBeInTheDocument();
  });
});
