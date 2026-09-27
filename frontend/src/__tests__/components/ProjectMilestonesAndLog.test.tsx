import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/api', () => ({
  apiService: {
    getProjectPMOMetrics: vi.fn(),
    getProjectLogEntries: vi.fn(),
    createProjectLogEntry: vi.fn()
  }
}));

vi.mock('@/services/fileService', () => ({
  fileService: {
    uploadFiles: vi.fn(),
    downloadFile: vi.fn(),
    getFile: vi.fn(),
    getDownloadUrl: vi.fn()
  }
}));

import { apiService } from '@/services/api';
import { fileService } from '@/services/fileService';
import { ProjectMilestonesAndLog } from '@/components/projects/ProjectMilestonesAndLog';

describe('ProjectMilestonesAndLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.getProjectPMOMetrics as any).mockResolvedValue({
      milestones: { list: [{ id: 1, name: 'Entrega v1', status: 'pending', planned_date: '2026-10-01' }] }
    });
  });

  it('muestra el resumen de hitos y las entradas de bitácora existentes', async () => {
    (apiService.getProjectLogEntries as any).mockResolvedValue([
      { id: 1, entry_type: 'decision', description: 'Se decidió posponer', author_name: 'Ana', created_at: '2026-09-27T10:00:00Z', file_id: null }
    ]);

    render(
      <MemoryRouter>
        <ProjectMilestonesAndLog projectId={7} canWriteLog={false} />
      </MemoryRouter>
    );

    expect(await screen.findByText('Entrega v1')).toBeInTheDocument();
    expect(await screen.findByText('Se decidió posponer')).toBeInTheDocument();
  });

  it('no muestra el formulario de alta si canWriteLog es false', async () => {
    (apiService.getProjectLogEntries as any).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <ProjectMilestonesAndLog projectId={7} canWriteLog={false} />
      </MemoryRouter>
    );

    await waitFor(() => expect(apiService.getProjectLogEntries).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /agregar entrada/i })).not.toBeInTheDocument();
  });

  it('permite crear una entrada de bitácora si canWriteLog es true', async () => {
    (apiService.getProjectLogEntries as any).mockResolvedValue([]);
    (apiService.createProjectLogEntry as any).mockResolvedValue({
      id: 2, entry_type: 'incident', description: 'Caída del servicio', author_name: 'Ana', created_at: '2026-09-27T11:00:00Z', file_id: null
    });

    render(
      <MemoryRouter>
        <ProjectMilestonesAndLog projectId={7} canWriteLog={true} />
      </MemoryRouter>
    );
    await waitFor(() => expect(apiService.getProjectLogEntries).toHaveBeenCalled());

    await userEvent.type(screen.getByPlaceholderText(/descripción/i), 'Caída del servicio');
    await userEvent.click(screen.getByRole('button', { name: /agregar entrada/i }));

    await waitFor(() => expect(apiService.createProjectLogEntry).toHaveBeenCalledWith(7, { entry_type: 'technical_milestone', description: 'Caída del servicio', file_id: null }));
    expect(await screen.findByText('Caída del servicio')).toBeInTheDocument();
  });

  it('descarga el adjunto de una entrada usando fileService.downloadFile en vez de un href directo', async () => {
    (apiService.getProjectLogEntries as any).mockResolvedValue([
      { id: 3, entry_type: 'incident', description: 'Falla en producción', author_name: 'Ana', created_at: '2026-09-27T12:00:00Z', file_id: 5 }
    ]);
    const blob = new Blob(['contenido']);
    (fileService.downloadFile as any).mockResolvedValue(blob);
    (fileService.getFile as any).mockResolvedValue({ id: 5, original_filename: 'informe.pdf' });

    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    (global.URL as any).createObjectURL = createObjectURLMock;
    (global.URL as any).revokeObjectURL = revokeObjectURLMock;

    render(
      <MemoryRouter>
        <ProjectMilestonesAndLog projectId={7} canWriteLog={false} />
      </MemoryRouter>
    );

    const downloadButton = await screen.findByRole('button', { name: /descargar adjunto/i });
    await userEvent.click(downloadButton);

    await waitFor(() => expect(fileService.downloadFile).toHaveBeenCalledWith(5));
    expect(fileService.getFile).toHaveBeenCalledWith(5);
  });
});
