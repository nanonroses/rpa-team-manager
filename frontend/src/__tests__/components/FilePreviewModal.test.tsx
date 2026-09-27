import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { FilePreviewModal } from '@/components/files/FilePreviewModal';
import { fileService } from '@/services/fileService';

vi.mock('@/services/fileService', () => ({ fileService: { previewFile: vi.fn(), getFile: vi.fn(), downloadFile: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview-test');
  URL.revokeObjectURL = vi.fn();
});
afterEach(cleanup);

it('carga el PDF y libera el recurso al cerrar', async () => {
  vi.mocked(fileService.previewFile).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  const { rerender } = render(<FilePreviewModal fileId={9} filename="Informe.pdf" onClose={() => {}} />);
  expect(screen.getByRole('status')).toHaveAccessibleName('Cargando previsualización');
  expect(await screen.findByTitle('Documento PDF: Informe.pdf')).toHaveAttribute('src', 'blob:preview-test');
  const signal = vi.mocked(fileService.previewFile).mock.calls[0][1];
  rerender(<FilePreviewModal fileId={null} onClose={() => {}} />);
  await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-test'));
  expect(signal?.aborted).toBe(true);
});

it('muestra un error recuperable sin descargar automáticamente', async () => {
  vi.mocked(fileService.previewFile).mockRejectedValueOnce(new Error('403')).mockResolvedValueOnce(new Blob(['zip'], { type: 'application/octet-stream' }));
  render(<FilePreviewModal fileId={9} filename="Archivo.zip" onClose={() => {}} />);
  await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
  expect(await screen.findByText(/Este formato no tiene previsualización/)).toBeInTheDocument();
  expect(fileService.downloadFile).not.toHaveBeenCalled();
});

it('no expone una respuesta tardía cuando el usuario cambia de archivo', async () => {
  let resolveFirst: (value: Blob) => void = () => {};
  vi.mocked(fileService.previewFile).mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }))
    .mockResolvedValueOnce(new Blob(['image'], { type: 'image/png' }));
  const { rerender } = render(<FilePreviewModal fileId={1} filename="Primero.pdf" onClose={() => {}} />);
  rerender(<FilePreviewModal fileId={2} filename="Segundo.png" onClose={() => {}} />);
  await screen.findByAltText('Segundo.png');
  resolveFirst(new Blob(['old'], { type: 'application/pdf' }));
  await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledTimes(1));
  expect(screen.queryByTitle('Documento PDF: Primero.pdf')).not.toBeInTheDocument();
});
