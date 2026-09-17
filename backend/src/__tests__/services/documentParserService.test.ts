import * as fs from 'fs';

const getTextMock = jest.fn();
const getInfoMock = jest.fn();
const destroyMock = jest.fn();
const pdfParseConstructorMock = jest.fn();

jest.mock('pdf-parse', () => ({
    PDFParse: jest.fn().mockImplementation((options) => {
        pdfParseConstructorMock(options);
        return {
            getText: getTextMock,
            getInfo: getInfoMock,
            destroy: destroyMock
        };
    })
}));

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    readFileSync: jest.fn()
}));

import { DocumentParserService } from '../../services/documentParserService';

describe('DocumentParserService.parsePDF', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('%PDF-1.4 fake content'));
    });

    it('usa la API de clase PDFParse (pdf-parse v2) en secuencia y mapea el resultado', async () => {
        let resolveGetText: (value: unknown) => void = () => undefined;
        getTextMock.mockReturnValue(new Promise((resolve) => { resolveGetText = resolve; }));
        getInfoMock.mockResolvedValue({
            info: {
                Title: 'Cotizacion',
                Author: 'RPA Team',
                Subject: 'Subject',
                Keywords: 'kw',
                Creator: 'Creator',
                Producer: 'Producer',
                CreationDate: new Date('2026-01-01')
            }
        });

        const service = new DocumentParserService();
        const resultPromise = service.parsePDF('/tmp/fake.pdf');

        // Mientras getText() esta pendiente, getInfo() NO debe haberse invocado todavia:
        // ambas llamadas comparten el mismo ArrayBuffer transferible y dispararlas en
        // paralelo (Promise.all) provoca un DataCloneError al transferirlo dos veces.
        await Promise.resolve();
        await Promise.resolve();
        expect(getInfoMock).not.toHaveBeenCalled();

        resolveGetText({ text: 'Contenido extraido', total: 3 });
        const result = await resultPromise;

        expect(pdfParseConstructorMock).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.any(Uint8Array) })
        );
        expect(getInfoMock).toHaveBeenCalledTimes(1);
        expect(destroyMock).toHaveBeenCalledTimes(1);

        expect(result.text).toBe('Contenido extraido');
        expect(result.pageCount).toBe(3);
        expect(result.metadata?.title).toBe('Cotizacion');
        expect(result.metadata?.author).toBe('RPA Team');
    });

    it('libera el parser (destroy) incluso si getText falla', async () => {
        getTextMock.mockRejectedValue(new Error('boom'));
        getInfoMock.mockResolvedValue({ info: {} });

        const service = new DocumentParserService();

        await expect(service.parsePDF('/tmp/fake.pdf')).rejects.toThrow('Failed to parse PDF');
        expect(destroyMock).toHaveBeenCalledTimes(1);
    });
});
