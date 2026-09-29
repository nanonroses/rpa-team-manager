import { useEffect, useState } from 'react';
import { Alert, App, Button, Empty, Modal, Skeleton, Space } from 'antd';
import { fileService } from '@/services/fileService';

export function previewKind(type: string): 'pdf' | 'image' | 'text' | 'video' | 'audio' | 'unsupported' {
  const mime = type.split(';')[0].toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/avif'].includes(mime)) return 'image';
  if (mime === 'text/plain') return 'text';
  if (['video/mp4', 'video/webm'].includes(mime)) return 'video';
  if (['audio/mpeg', 'audio/wav', 'audio/ogg'].includes(mime)) return 'audio';
  return 'unsupported';
}

interface Props { fileId: number | null; filename?: string; onClose: () => void; }
interface Preview { fileId: number; url: string; kind: ReturnType<typeof previewKind>; text?: string; truncated?: boolean; }

export function FilePreviewModal({ fileId, filename, onClose }: Props) {
  const { message } = App.useApp();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [resolvedName, setResolvedName] = useState(filename);
  useEffect(() => {
    setPreview(null);
    setError('');
    setResolvedName(filename);
    if (fileId === null) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const blob = await fileService.previewFile(fileId, controller.signal);
        const kind = previewKind(blob.type);
        const text = kind === 'text' ? await blob.slice(0, 512 * 1024).text() : undefined;
        if (controller.signal.aborted) return;
        objectUrl = kind !== 'text' && kind !== 'unsupported' ? URL.createObjectURL(blob) : '';
        setPreview({ fileId, url: objectUrl, kind, text, truncated: kind === 'text' && blob.size > 512 * 1024 });
      } catch {
        if (!controller.signal.aborted) setError('No se pudo previsualizar el archivo. Puede que ya no esté disponible o que no tengas acceso.');
      }
    })();
    if (!filename) void fileService.getFile(fileId).then((file) => {
      if (!controller.signal.aborted) setResolvedName(file.original_filename);
    }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileId, filename, retry]);

  const download = async () => {
    if (fileId === null) return;
    setDownloading(true);
    try {
      const blob = await fileService.downloadFile(fileId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = resolvedName || `archivo-${fileId}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { message.error('No se pudo descargar el archivo'); }
    finally { setDownloading(false); }
  };
  const current = preview?.fileId === fileId ? preview : null;
  return <Modal open={fileId !== null} onCancel={onClose} title={`Previsualización · ${resolvedName || 'Documento'}`}
    className="file-preview-modal" width={1100} footer={<Space wrap>
      <Button onClick={() => void download()} loading={downloading}>Descargar</Button>
      <Button type="primary" onClick={onClose}>Cerrar</Button>
    </Space>}>
    {error ? <Alert type="error" showIcon message={error} action={<Button onClick={() => setRetry((n) => n + 1)}>Reintentar</Button>} />
      : !current ? <div aria-label="Cargando previsualización" role="status"><Skeleton active paragraph={{ rows: 8 }} /></div>
        : <div className="file-preview-content">
          {current.kind === 'pdf' && <iframe src={current.url} title={`Documento PDF: ${resolvedName || 'archivo'}`} className="file-preview-frame" />}
          {current.kind === 'image' && <img src={current.url} alt={resolvedName || 'Imagen adjunta'} onError={() => setError('El navegador no pudo mostrar esta imagen. Puedes descargarla para abrirla.')} />}
          {current.kind === 'text' && <>{current.truncated && <Alert type="info" message="Se muestran los primeros 512 KB. Descarga el archivo para ver el contenido completo." />}<pre>{current.text}</pre></>}
          {current.kind === 'video' && <video controls src={current.url} onError={() => setError('El navegador no admite este video. Puedes descargarlo.')} />}
          {current.kind === 'audio' && <audio controls src={current.url} onError={() => setError('El navegador no admite este audio. Puedes descargarlo.')} />}
          {current.kind === 'unsupported' && <Empty description="Este formato no tiene previsualización en el navegador. Descarga el archivo para abrirlo en su aplicación." />}
        </div>}
  </Modal>;
}

export function AuthenticatedImage({ fileId, alt, onClick }: { fileId: number; alt: string; onClick: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    setUrl('');
    void fileService.previewFile(fileId, controller.signal).then((blob) => {
      if (!controller.signal.aborted && previewKind(blob.type) === 'image') {
        objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
      }
    }).catch(() => {});
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [fileId]);
  return <button type="button" className="evidence-thumbnail" aria-label={`Previsualizar ${alt}`} onClick={onClick}>
    {url ? <img src={url} alt={alt} /> : <span>Ver imagen</span>}
  </button>;
}
