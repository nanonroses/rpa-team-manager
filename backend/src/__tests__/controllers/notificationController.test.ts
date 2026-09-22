jest.mock('../../services/notificationService', () => ({
    notificationService: {
        getForUser: jest.fn(),
        getUnreadCount: jest.fn(),
        markRead: jest.fn(),
        markAllRead: jest.fn()
    }
}));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { notificationService } from '../../services/notificationService';
import { NotificationController } from '../../controllers/notificationController';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

describe('NotificationController', () => {
    let controller: NotificationController;

    beforeEach(() => {
        jest.clearAllMocks();
        controller = new NotificationController();
    });

    it('GET /notifications lista las notificaciones de req.user.id, nunca de un id externo', async () => {
        (notificationService.getForUser as jest.Mock).mockResolvedValue([{ id: 1 }]);
        const req = { user: { id: 5 }, query: {} } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.list(req, res);

        expect(notificationService.getForUser).toHaveBeenCalledWith(5, { limit: 20, offset: 0, unreadOnly: false });
        expect(res.json).toHaveBeenCalledWith([{ id: 1 }]);
    });

    it('GET /notifications respeta ?unread=true y los query params de paginación', async () => {
        (notificationService.getForUser as jest.Mock).mockResolvedValue([]);
        const req = { user: { id: 5 }, query: { unread: 'true', limit: '5', offset: '10' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.list(req, res);

        expect(notificationService.getForUser).toHaveBeenCalledWith(5, { limit: 5, offset: 10, unreadOnly: true });
    });

    it('GET /notifications/unread-count devuelve { count }', async () => {
        (notificationService.getUnreadCount as jest.Mock).mockResolvedValue(4);
        const req = { user: { id: 5 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.unreadCount(req, res);

        expect(res.json).toHaveBeenCalledWith({ count: 4 });
    });

    it('PATCH /notifications/:id/read marca leída y responde 204', async () => {
        (notificationService.markRead as jest.Mock).mockResolvedValue(true);
        const req = { user: { id: 5 }, params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.markRead(req, res);

        expect(notificationService.markRead).toHaveBeenCalledWith(7, 5);
        expect(res.status).toHaveBeenCalledWith(204);
    });

    it('PATCH /notifications/:id/read devuelve 404 si no pertenece al usuario', async () => {
        (notificationService.markRead as jest.Mock).mockResolvedValue(false);
        const req = { user: { id: 5 }, params: { id: '7' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.markRead(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('PATCH /notifications/read-all marca todas leídas de req.user.id y responde 204', async () => {
        (notificationService.markAllRead as jest.Mock).mockResolvedValue(undefined);
        const req = { user: { id: 5 } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.markAllRead(req, res);

        expect(notificationService.markAllRead).toHaveBeenCalledWith(5);
        expect(res.status).toHaveBeenCalledWith(204);
    });

    it('GET /notifications?limit=abc devuelve 400 con error de validación', async () => {
        const req = { user: { id: 5 }, query: { limit: 'abc' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.list(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid limit or offset parameter' });
    });

    it('GET /notifications?offset=xyz devuelve 400 con error de validación', async () => {
        const req = { user: { id: 5 }, query: { offset: 'xyz' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.list(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid limit or offset parameter' });
    });

    it('PATCH /notifications/abc/read devuelve 400 con error de validación', async () => {
        const req = { user: { id: 5 }, params: { id: 'abc' } } as unknown as AuthenticatedRequest;
        const res = mockRes();

        await controller.markRead(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid notification id' });
    });
});
