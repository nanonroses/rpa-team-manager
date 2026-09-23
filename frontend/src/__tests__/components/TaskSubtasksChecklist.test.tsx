import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getTaskSubtasks: vi.fn(),
    createTaskSubtask: vi.fn(),
    updateTaskSubtask: vi.fn(),
    deleteTaskSubtask: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TaskSubtasksChecklist } from '@/components/tasks/TaskSubtasksChecklist';

describe('TaskSubtasksChecklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra las subtareas existentes con el contador de hechas', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 1 },
      { id: 2, task_id: 10, title: 'Sub B', is_done: 0 }
    ]);

    render(<TaskSubtasksChecklist taskId={10} />);

    expect(await screen.findByText('Sub A')).toBeInTheDocument();
    expect(screen.getByText('Subtareas (1/2)')).toBeInTheDocument();
  });

  it('muestra un estado vacio cuando la tarea no tiene subtareas', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);

    render(<TaskSubtasksChecklist taskId={10} />);

    expect(await screen.findByText('Sin subtareas todavía')).toBeInTheDocument();
  });

  it('agrega una subtarea nueva al escribir y presionar el boton Agregar', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([]);
    (apiService.createTaskSubtask as any).mockResolvedValue({ id: 3, task_id: 10, title: 'Nueva sub', is_done: 0 });

    render(<TaskSubtasksChecklist taskId={10} />);
    await waitFor(() => expect(apiService.getTaskSubtasks).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('Agregar subtarea...'), 'Nueva sub');
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));

    expect(apiService.createTaskSubtask).toHaveBeenCalledWith(10, 'Nueva sub');
    expect(await screen.findByText('Nueva sub')).toBeInTheDocument();
  });

  it('marca una subtarea como hecha al tildar el checkbox', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 0 }
    ]);
    (apiService.updateTaskSubtask as any).mockResolvedValue({ id: 1, task_id: 10, title: 'Sub A', is_done: 1 });

    render(<TaskSubtasksChecklist taskId={10} />);
    await screen.findByText('Sub A');

    await userEvent.click(screen.getByRole('checkbox'));

    expect(apiService.updateTaskSubtask).toHaveBeenCalledWith(10, 1, { is_done: true });
  });

  it('elimina una subtarea al hacer click en el boton de borrar', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 0 }
    ]);
    (apiService.deleteTaskSubtask as any).mockResolvedValue({ success: true });

    render(<TaskSubtasksChecklist taskId={10} />);
    await screen.findByText('Sub A');

    await userEvent.click(screen.getByRole('button', { name: /eliminar subtarea/i }));

    expect(apiService.deleteTaskSubtask).toHaveBeenCalledWith(10, 1);
    await waitFor(() => expect(screen.queryByText('Sub A')).not.toBeInTheDocument());
  });

  it('llama a onChange despues de agregar, tildar o borrar una subtarea', async () => {
    (apiService.getTaskSubtasks as any).mockResolvedValue([
      { id: 1, task_id: 10, title: 'Sub A', is_done: 0 }
    ]);
    (apiService.updateTaskSubtask as any).mockResolvedValue({ id: 1, task_id: 10, title: 'Sub A', is_done: 1 });
    const onChange = vi.fn();

    render(<TaskSubtasksChecklist taskId={10} onChange={onChange} />);
    await screen.findByText('Sub A');

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
