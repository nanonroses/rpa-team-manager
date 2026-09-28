jest.mock('../../database/database', () => ({ db: { get: jest.fn(), run: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ logger: { error: jest.fn() } }));
jest.mock('fs/promises', () => ({ __esModule: true, default: { access: jest.fn().mockResolvedValue(undefined) } }));
jest.mock('fs', () => ({ ...jest.requireActual('fs'), createReadStream: jest.fn(() => require('stream').Readable.from(['sample'])) }));

import express from 'express';
import request from 'supertest';
import { db } from '../../database/database';
import { FileController } from '../../controllers/fileController';

const app = express();
const controller = new FileController();
app.use((req, res, next) => {
  if (!req.headers.authorization) { res.sendStatus(401); return; }
  (req as any).user = { id: 7 }; next();
});
app.get('/files/:id/preview', controller.previewFile);
app.get('/files/:id/download', controller.downloadFile);

describe('Previsualización autenticada', () => {
  beforeEach(() => {
    (db.get as jest.Mock).mockResolvedValue({ file_path: 'sample.pdf', original_filename: 'cotización.pdf', mime_type: 'application/pdf', file_size: 6 });
    (db.run as jest.Mock).mockResolvedValue({});
  });
  it('conserva la consulta de permisos y entrega PDF inline con nombre UTF-8', async () => {
    const result = await request(app).get('/files/9/preview').set('Authorization', 'Bearer test');
    expect(result.status).toBe(200);
    expect(result.headers['content-disposition']).toContain('inline;');
    expect(result.headers['content-disposition']).toContain('cotizaci%C3%B3n.pdf');
    expect(result.headers['content-type']).toContain('application/pdf');
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(db.get).toHaveBeenCalledWith(expect.stringContaining('f.uploaded_by = ?'), ['9', 7, 7, 7, 7, 7, 7]);
    expect(db.run).toHaveBeenCalledWith(expect.stringContaining('file_access_log'), expect.arrayContaining(['preview']));
  });
  it('rechaza accesos sin sesión y archivos fuera de los permisos del usuario', async () => {
    expect((await request(app).get('/files/9/preview')).status).toBe(401);
    expect(db.get).not.toHaveBeenCalled();
    (db.get as jest.Mock).mockResolvedValue(null);
    expect((await request(app).get('/files/9/preview').set('Authorization', 'Bearer test')).status).toBe(404);
    expect(db.run).not.toHaveBeenCalled();
  });
  it('sirve HTML como texto y mantiene la descarga como adjunto', async () => {
    (db.get as jest.Mock).mockResolvedValue({ file_path: 'sample.html', original_filename: 'sample.html', mime_type: 'text/html', file_size: 6 });
    const preview = await request(app).get('/files/9/preview').set('Authorization', 'Bearer test');
    expect(preview.headers['content-type']).toContain('text/plain');
    expect(preview.headers['content-security-policy']).toContain('sandbox');
    const download = await request(app).get('/files/9/download').set('Authorization', 'Bearer test');
    expect(download.headers['content-disposition']).toContain('attachment;');
  });
});
