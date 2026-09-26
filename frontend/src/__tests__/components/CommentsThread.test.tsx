import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    getMentionableUsers: vi.fn()
  }
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 3, role: 'rpa_developer', full_name: 'Ana' } })
}));

import { apiService } from '@/services/api';
import { CommentsThread } from '@/components/comments/CommentsThread';

const mentionableUsers = [
  { id: 3, full_name: 'Ana', username: 'ana' },
  { id: 9, full_name: 'Dev Uno', username: 'dev1' }
];

describe('CommentsThread', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getMentionableUsers as any).mockResolvedValue(mentionableUsers);
  });

  it('carga y muestra los comentarios existentes', async () => {
    (apiService.getComments as any).mockResolvedValue([
      { id: 1, entity_type: 'task', entity_id: 55, user_id: 9, author_name: 'Dev Uno', content: 'Hola equipo', created_at: '2026-09-23T10:00:00Z', updated_at: '2026-09-23T10:00:00Z' }
    ]);

    render(<CommentsThread entityType="task" entityId={55} />);

    expect(await screen.findByText('Hola equipo')).toBeInTheDocument();
    expect(screen.getByText('Dev Uno')).toBeInTheDocument();
  });

  it('muestra el estado vacio cuando no hay comentarios', async () => {
    (apiService.getComments as any).mockResolvedValue([]);

    render(<CommentsThread entityType="task" entityId={55} />);

    expect(await screen.findByText('Sin comentarios todavía')).toBeInTheDocument();
  });

  it('carga los usuarios mencionables acotados a la entidad (no una lista global)', async () => {
    (apiService.getComments as any).mockResolvedValue([]);

    render(<CommentsThread entityType="task" entityId={55} />);

    await waitFor(() => expect(apiService.getMentionableUsers).toHaveBeenCalledWith('task', 55));
  });

  it('publica un comentario nuevo al escribir y hacer click en Comentar', async () => {
    (apiService.getComments as any).mockResolvedValue([]);
    (apiService.createComment as any).mockResolvedValue({
      id: 2, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Nuevo comentario', created_at: '2026-09-23T10:00:00Z', updated_at: '2026-09-23T10:00:00Z'
    });

    render(<CommentsThread entityType="task" entityId={55} />);
    await waitFor(() => expect(apiService.getComments).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/escribí un comentario/i);
    await userEvent.type(input, 'Nuevo comentario');
    await userEvent.click(screen.getByRole('button', { name: /comentar/i }));

    expect(apiService.createComment).toHaveBeenCalledWith('task', 55, 'Nuevo comentario');
    expect(await screen.findByText('Nuevo comentario')).toBeInTheDocument();
  });

  it('solo muestra los botones de editar/borrar en los comentarios propios', async () => {
    (apiService.getComments as any).mockResolvedValue([
      { id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Mio', created_at: 'x', updated_at: 'x' },
      { id: 2, entity_type: 'task', entity_id: 55, user_id: 9, author_name: 'Dev Uno', content: 'Ajeno', created_at: 'x', updated_at: 'x' }
    ]);

    render(<CommentsThread entityType="task" entityId={55} />);
    await screen.findByText('Mio');
    await screen.findByText('Ajeno');

    expect(screen.getAllByRole('button', { name: /editar comentario/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /eliminar comentario/i })).toHaveLength(1);
  });

  it('elimina un comentario propio al confirmar', async () => {
    (apiService.getComments as any).mockResolvedValue([
      { id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Mio', created_at: 'x', updated_at: 'x' }
    ]);
    (apiService.deleteComment as any).mockResolvedValue({ success: true });

    render(<CommentsThread entityType="task" entityId={55} />);
    await screen.findByText('Mio');

    await userEvent.click(screen.getByRole('button', { name: /eliminar comentario/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(apiService.deleteComment).toHaveBeenCalledWith('task', 55, 1));
  });
});
