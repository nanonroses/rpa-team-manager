import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getTaskCollaborators: vi.fn(),
    addTaskCollaborator: vi.fn(),
    removeTaskCollaborator: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { TaskCollaboratorsEditor } from '@/components/tasks/TaskCollaboratorsEditor';

const users = [
  { id: 9, full_name: 'Ana' },
  { id: 10, full_name: 'Beto' }
];

describe('TaskCollaboratorsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('carga y muestra los colaboradores existentes', async () => {
    (apiService.getTaskCollaborators as any).mockResolvedValue([
      { id: 1, task_id: 10, user_id: 9, full_name: 'Ana' }
    ]);

    render(<TaskCollaboratorsEditor taskId={10} users={users} />);

    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });

  it('muestra un estado vacio cuando la tarea no tiene colaboradores adicionales', async () => {
    (apiService.getTaskCollaborators as any).mockResolvedValue([]);

    render(<TaskCollaboratorsEditor taskId={10} users={users} />);

    expect(await screen.findByText('Sin colaboradores adicionales')).toBeInTheDocument();
  });

  it('no ofrece como opcion a un usuario que ya es colaborador', async () => {
    (apiService.getTaskCollaborators as any).mockResolvedValue([
      { id: 1, task_id: 10, user_id: 9, full_name: 'Ana' }
    ]);

    render(<TaskCollaboratorsEditor taskId={10} users={users} />);
    await screen.findByText('Ana');

    await userEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Beto')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Ana' })).not.toBeInTheDocument();
  });

  it('agrega un colaborador al seleccionarlo del combo', async () => {
    (apiService.getTaskCollaborators as any).mockResolvedValue([]);
    (apiService.addTaskCollaborator as any).mockResolvedValue({ id: 2, task_id: 10, user_id: 9, full_name: 'Ana' });

    render(<TaskCollaboratorsEditor taskId={10} users={users} />);
    await waitFor(() => expect(apiService.getTaskCollaborators).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Ana'));

    expect(apiService.addTaskCollaborator).toHaveBeenCalledWith(10, 9);
    await waitFor(() => {
      const tags = Array.from(document.querySelectorAll('.ant-tag')).map((el) => el.textContent);
      expect(tags).toContain('Ana');
    });
  });

  it('quita un colaborador al cerrar el Tag', async () => {
    (apiService.getTaskCollaborators as any).mockResolvedValue([
      { id: 1, task_id: 10, user_id: 9, full_name: 'Ana' }
    ]);
    (apiService.removeTaskCollaborator as any).mockResolvedValue({ success: true });

    render(<TaskCollaboratorsEditor taskId={10} users={users} />);
    await screen.findByText('Ana');

    await userEvent.click(document.querySelector('.ant-tag .anticon-close') as Element);

    expect(apiService.removeTaskCollaborator).toHaveBeenCalledWith(10, 1);
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument());
  });

  it('muestra un error legible si el backend rechaza un colaborador duplicado', async () => {
    (apiService.getTaskCollaborators as any).mockResolvedValue([]);
    (apiService.addTaskCollaborator as any).mockRejectedValue({ response: { data: { error: 'User is already a collaborator on this task' } } });

    render(<TaskCollaboratorsEditor taskId={10} users={users} />);
    await waitFor(() => expect(apiService.getTaskCollaborators).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Ana'));

    expect(await screen.findByText('User is already a collaborator on this task')).toBeInTheDocument();
  });

  it('llama a onChange despues de agregar o quitar un colaborador', async () => {
    (apiService.getTaskCollaborators as any).mockResolvedValue([]);
    (apiService.addTaskCollaborator as any).mockResolvedValue({ id: 2, task_id: 10, user_id: 9, full_name: 'Ana' });
    const onChange = vi.fn();

    render(<TaskCollaboratorsEditor taskId={10} users={users} onChange={onChange} />);
    await waitFor(() => expect(apiService.getTaskCollaborators).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Ana'));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
