import { logger } from '../utils/logger';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as fs from 'fs';
import * as path from 'path';

export interface ParsedDocument {
    text: string;
    pageCount?: number;
    metadata?: {
        title?: string;
        author?: string;
        subject?: string;
        keywords?: string;
        creator?: string;
        producer?: string;
        creationDate?: Date;
    };
}

export class DocumentParserService {

    /**
     * Parse PDF document
     */
    async parsePDF(filePath: string): Promise<ParsedDocument> {
        try {
            logger.info(`Parsing PDF file: ${filePath}`);

            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);

            logger.info(`PDF parsed successfully. Pages: ${data.numpages}, Text length: ${data.text.length}`);

            return {
                text: data.text,
                pageCount: data.numpages,
                metadata: {
                    title: data.info?.Title,
                    author: data.info?.Author,
                    subject: data.info?.Subject,
                    keywords: data.info?.Keywords,
                    creator: data.info?.Creator,
                    producer: data.info?.Producer,
                    creationDate: data.info?.CreationDate
                }
            };
        } catch (error) {
            logger.error('Error parsing PDF:', error);
            throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parse DOCX document
     */
    async parseDOCX(filePath: string): Promise<ParsedDocument> {
        try {
            logger.info(`Parsing DOCX file: ${filePath}`);

            const result = await mammoth.extractRawText({ path: filePath });

            logger.info(`DOCX parsed successfully. Text length: ${result.value.length}`);

            if (result.messages.length > 0) {
                logger.warn('DOCX parsing warnings:', result.messages);
            }

            return {
                text: result.value,
                metadata: {}
            };
        } catch (error) {
            logger.error('Error parsing DOCX:', error);
            throw new Error(`Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Main parsing method that detects file type and calls appropriate parser
     */
    async parseDocument(filePath: string, mimeType?: string): Promise<ParsedDocument> {
        try {
            // Validate file exists
            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            // Detect file type
            const ext = path.extname(filePath).toLowerCase();
            const detectedMimeType = mimeType || this.getMimeTypeFromExtension(ext);

            logger.info(`Parsing document: ${filePath}, Type: ${detectedMimeType}, Extension: ${ext}`);

            // Parse based on type
            if (detectedMimeType === 'application/pdf' || ext === '.pdf') {
                return await this.parsePDF(filePath);
            } else if (
                detectedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                ext === '.docx'
            ) {
                return await this.parseDOCX(filePath);
            } else {
                throw new Error(`Unsupported file type: ${detectedMimeType || ext}`);
            }
        } catch (error) {
            logger.error('Error parsing document:', error);
            throw error;
        }
    }

    /**
     * Get MIME type from file extension
     */
    private getMimeTypeFromExtension(ext: string): string {
        const mimeTypes: { [key: string]: string } = {
            '.pdf': 'application/pdf',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.doc': 'application/msword'
        };

        return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * Validate file type
     */
    validateFileType(mimeType: string, filename: string): boolean {
        const allowedMimeTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        const ext = path.extname(filename).toLowerCase();
        const allowedExtensions = ['.pdf', '.docx'];

        return allowedMimeTypes.includes(mimeType) || allowedExtensions.includes(ext);
    }

    /**
     * Clean up uploaded file
     */
    async cleanupFile(filePath: string): Promise<void> {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                logger.info(`Cleaned up file: ${filePath}`);
            }
        } catch (error) {
            logger.error(`Error cleaning up file ${filePath}:`, error);
        }
    }
}
