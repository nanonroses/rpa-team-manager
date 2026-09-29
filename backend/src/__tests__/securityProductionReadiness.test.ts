import { AuthController } from '../controllers/authController';
import { AuthService } from '../services/authService';
import { LLMConfigService } from '../services/llmConfigService';

describe('production security readiness', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('never resets or returns a password from the public reset endpoint', async () => {
        const controller = new AuthController();
        const resetPassword = jest.fn();
        (controller as any).authService = { resetPassword };
        const json = jest.fn();
        const status = jest.fn(() => ({ json }));

        await controller.resetPassword(
            { body: { email: 'admin@example.com' } } as any,
            { json, status } as any
        );

        expect(resetPassword).not.toHaveBeenCalled();
        expect(status).not.toHaveBeenCalled();
        expect(json).toHaveBeenCalledWith({
            message: 'Si el correo electrónico está registrado, se han procesado las instrucciones para restablecer la contraseña.'
        });
        expect(JSON.stringify(json.mock.calls)).not.toContain('tempPassword');
    });

    it('rejects missing and weak JWT secrets in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.JWT_SECRET;
        expect(() => new AuthService()).toThrow('JWT_SECRET must be set in production environment');

        process.env.JWT_SECRET = 'too-short';
        expect(() => new AuthService()).toThrow('JWT_SECRET must contain at least 32 characters in production');
    });

    it('requires a persistent LLM encryption key in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ENCRYPTION_KEY;
        expect(() => new LLMConfigService()).toThrow('ENCRYPTION_KEY must be set in production');
    });
});
