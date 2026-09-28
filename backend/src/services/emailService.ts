import { logger } from '../utils/logger';

export interface SendEmailOptions {
    to: string | string[];
    subject: string;
    text: string;
    html?: string;
}

export class EmailService {
    private isConfigured = false;
    private transporter: any = null;

    constructor() {
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (host && port) {
            try {
                // Intentar carga dinámica si nodemailer existe en el entorno
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const nodemailer = require('nodemailer');
                this.transporter = nodemailer.createTransport({
                    host,
                    port: Number(port),
                    secure: Number(port) === 465,
                    auth: user && pass ? { user, pass } : undefined
                });
                this.isConfigured = true;
            } catch {
                this.isConfigured = false;
            }
        }
    }

    async sendEmail(options: SendEmailOptions): Promise<boolean> {
        try {
            const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
            const from = process.env.SMTP_FROM || 'noreply@rpateam.local';

            if (this.isConfigured && this.transporter) {
                await this.transporter.sendMail({
                    from,
                    to: options.to,
                    subject: options.subject,
                    text: options.text,
                    html: options.html
                });
                logger.info(`Email sent successfully to ${recipients}: "${options.subject}"`);
                return true;
            } else {
                logger.info(`[EmailService] (Simulado/Fallback) To: ${recipients} | Subject: "${options.subject}" | Content: ${options.text}`);
                return true;
            }
        } catch (error) {
            logger.warn(`EmailService: Error al enviar correo:`, error);
            return false;
        }
    }
}

export const emailService = new EmailService();
