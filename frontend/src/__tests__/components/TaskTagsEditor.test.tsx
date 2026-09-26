import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getTaskTags: vi.fn(),
    createTaskTag: vi.fn(),
    deleteTaskTag: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TaskTagsEditor } from '@/components/tasks/TaskTagsEditor';

describe('TaskTagsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra las etiquetas existentes', async () => {
    (apiService.getTaskTags as any).mockResolvedValue([
      { id: 1, task_id: 10, tag: 'urgente' },
      { id: 2, task_id: 10, tag: 'cliente-x' }
    ]);

    render(<TaskTagsEditor taskId={10} />);

    expect(await screen.findByText('urgente')).toBeInTheDocument();
    expect(screen.getByText('cliente-x')).toBeInTheDocument();
  });

  it('muestra un estado vacio cuando la tarea no tiene etiquetas', async () => {
    (apiService.getTaskTags as any).mockResolvedValue([]);

    render(<TaskTagsEditor taskId={10} />);

    expect(await screen.findByText('Sin etiquetas todavía')).toBeInTheDocument();
  });

  it('agrega una etiqueta nueva al escribir y presionar Enter, sin dejar el texto en el input', async () => {
    (apiService.getTaskTags as any).mockResolvedValue([]);
    (apiService.createTaskTag as any).mockResolvedValue({ id: 3, task_id: 10, tag: 'nueva' });

    render(<TaskTagsEditor taskId={10} />);
    await waitFor(() => expect(apiService.getTaskTags).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Agregar etiqueta y presionar Enter...');
    await userEvent.type(input, 'nueva{enter}');

    expect(apiService.createTaskTag).toHaveBeenCalledWith(10, 'nueva');
    expect(await screen.findByText('nueva')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('elimina una etiqueta al cerrar el Tag', async () => {
    (apiService.getTaskTags as any).mockResolvedValue([
      { id: 1, task_id: 10, tag: 'urgente' }
    ]);
    (apiService.deleteTaskTag as any).mockResolvedValue({ success: true });

    render(<TaskTagsEditor taskId={10} />);
    await screen.findByText('urgente');

    await userEvent.click(document.querySelector('.ant-tag .anticon-close') as Element);

    expect(apiService.deleteTaskTag).toHaveBeenCalledWith(10, 1);
    await waitFor(() => expect(screen.queryByText('urgente')).not.toBeInTheDocument());
  });

  it('muestra un error legible si el backend rechaza una etiqueta duplicada', async () => {
    (apiService.getTaskTags as any).mockResolvedValue([]);
    (apiService.createTaskTag as any).mockRejectedValue({ response: { data: { error: 'Tag already exists on this task' } } });

    render(<TaskTagsEditor taskId={10} />);
    await waitFor(() => expect(apiService.getTaskTags).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('Agregar etiqueta y presionar Enter...'), 'urgente{enter}');

    expect(await screen.findByText('Tag already exists on this task')).toBeInTheDocument();
  });

  it('llama a onChange despues de agregar o borrar una etiqueta', async () => {
    (apiService.getTaskTags as any).mockResolvedValue([]);
    (apiService.createTaskTag as any).mockResolvedValue({ id: 3, task_id: 10, tag: 'nueva' });
    const onChange = vi.fn();

    render(<TaskTagsEditor taskId={10} onChange={onChange} />);
    await waitFor(() => expect(apiService.getTaskTags).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText('Agregar etiqueta y presionar Enter...'), 'nueva{enter}');

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
