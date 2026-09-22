jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('bcryptjs', () => ({ compare: jest.fn() }));
jest.mock('../../services/notificationService', () => ({
    notificationService: { checkLoginReminders: jest.fn() }
}));
jest.mock('../../services/timesheetService', () => ({
    timesheetService: { getPendingReminders: jest.fn() }
}));

import bcrypt from 'bcryptjs';
import { db } from '../../database/database';
import { notificationService } from '../../services/notificationService';
import { timesheetService } from '../../services/timesheetService';
import { AuthService } from '../../services/authService';

describe('AuthService.login', () => {
    let authService: AuthService;

    beforeEach(() => {
        jest.clearAllMocks();
        authService = new AuthService();
        (db.get as jest.Mock).mockResolvedValue({
            id: 5, email: 'ana@x.com', password_hash: 'hash', is_active: 1, role: 'rpa_developer', full_name: 'Ana'
        });
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        (timesheetService.getPendingReminders as jest.Mock).mockResolvedValue({ missing_dates: [], open_period: null });
    });

    it('llama a checkLoginReminders con el conteo de días faltantes tras un login exitoso', async () => {
        (timesheetService.getPendingReminders as jest.Mock).mockResolvedValue({
            missing_dates: ['2026-09-15', '2026-09-16'], open_period: null
        });

        await authService.login({ email: 'ana@x.com', password: 'secret' });

        expect(notificationService.checkLoginReminders).toHaveBeenCalledWith(5, 2);
    });

    it('el login sigue devolviendo el resultado aunque checkLoginReminders falle', async () => {
        (notificationService.checkLoginReminders as jest.Mock).mockRejectedValue(new Error('boom'));

        const result = await authService.login({ email: 'ana@x.com', password: 'secret' });

        expect(result.user.email).toBe('ana@x.com');
    });

    it('no llama a checkLoginReminders si las credenciales son inválidas', async () => {
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(authService.login({ email: 'ana@x.com', password: 'mala' })).rejects.toThrow('Invalid credentials');
        expect(notificationService.checkLoginReminders).not.toHaveBeenCalled();
    });
});
