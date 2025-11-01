// Type definitions for pdf-parse/node
declare module 'pdf-parse/node' {
    interface PdfParseResult {
        numpages: number;
        numrender: number;
        info: {
            Title?: string;
            Author?: string;
            Subject?: string;
            Keywords?: string;
            Creator?: string;
            Producer?: string;
            CreationDate?: Date;
        };
        metadata: any;
        version: string;
        text: string;
    }

    interface PdfParseOptions {
        pagerender?: (pageData: any) => string | Promise<string>;
        max?: number;
        version?: string;
    }

    function pdfParse(
        dataBuffer: Buffer,
        options?: PdfParseOptions
    ): Promise<PdfParseResult>;

    export = pdfParse;
}
