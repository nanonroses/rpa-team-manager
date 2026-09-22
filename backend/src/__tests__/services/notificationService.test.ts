jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

import { db } from '../../database/database';
import { NotificationService } from '../../services/notificationService';

describe('NotificationService.notify', () => {
    let service: NotificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    it('inserta la fila con los campos dados', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.notify({
            userId: 5, eventKey: 'task_assigned', title: 'Te asignaron una tarea',
            message: 'Tarea X', type: 'info', entityType: 'task', entityId: 10,
            senderId: 3, link: '/tasks?taskId=10'
        });

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO notifications'),
            [5, 'Te asignaron una tarea', 'Tarea X', 'info', 'task', 10, 3, '/tasks?taskId=10', 'task_assigned']
        );
    });

    it('usa type=info y valores null por defecto para los campos opcionales', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.notify({ userId: 5, eventKey: 'task_assigned', title: 'Título' });

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO notifications'),
            [5, 'Título', null, 'info', null, null, null, null, 'task_assigned']
        );
    });

    it('nunca lanza si el insert falla (error solo se loguea)', async () => {
        (db.run as jest.Mock).mockRejectedValue(new Error('disk full'));

        await expect(
            service.notify({ userId: 5, eventKey: 'task_assigned', title: 'Título' })
        ).resolves.toBeUndefined();
    });

    it('con dedupe=true, no inserta si ya existe una notificación no leída con mismo user_id+event_key+entity_id', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 99 });

        await service.notify({
            userId: 5, eventKey: 'task_due_soon', title: 'Título', entityId: 10, dedupe: true
        });

        expect(db.get).toHaveBeenCalledWith(
            expect.stringContaining('is_read = 0'),
            [5, 'task_due_soon', 10]
        );
        expect(db.run).not.toHaveBeenCalled();
    });

    it('con dedupe=true, sí inserta si no existe ninguna no leída con esa combinación', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.notify({
            userId: 5, eventKey: 'task_due_soon', title: 'Título', entityId: 10, dedupe: true
        });

        expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notifications'), expect.any(Array));
    });

    it('con dedupe=true sin entityId, usa entity_id IS ? con parámetro null', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        (db.run as jest.Mock).mockResolvedValue({ id: 1, changes: 1 });

        await service.notify({
            userId: 5, eventKey: 'task_assigned', title: 'Título', dedupe: true
        });

        expect(db.get).toHaveBeenCalledWith(
            expect.stringContaining('entity_id IS ?'),
            [5, 'task_assigned', null]
        );
        expect(db.run).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO notifications'), expect.any(Array));
    });

    it('con dedupe=true sin entityId, no inserta si ya existe un duplicado con entity_id IS NULL', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 99 });

        await service.notify({
            userId: 5, eventKey: 'task_assigned', title: 'Título', dedupe: true
        });

        expect(db.get).toHaveBeenCalledWith(
            expect.stringContaining('entity_id IS ?'),
            [5, 'task_assigned', null]
        );
        expect(db.run).not.toHaveBeenCalled();
    });

    it('con dedupe=true, nunca lanza si db.get() falla durante dedupe check (error solo se loguea)', async () => {
        (db.get as jest.Mock).mockRejectedValue(new Error('db connection lost'));

        await expect(
            service.notify({ userId: 5, eventKey: 'task_assigned', title: 'Título', dedupe: true })
        ).resolves.toBeUndefined();
    });
});

describe('NotificationService.getForUser', () => {
    let service: NotificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    it('consulta las notificaciones del usuario, ordenadas por fecha descendente, con paginación', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { id: 2, user_id: 5, title: 'B', is_read: 0, created_at: '2026-09-20T10:00:00Z' }
        ]);

        const result = await service.getForUser(5, { limit: 10, offset: 0 });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY n.created_at DESC, n.id DESC'),
            [5, 10, 0]
        );
        expect(result).toHaveLength(1);
    });

    it('con unreadOnly=true agrega el filtro is_read=0', async () => {
        (db.query as jest.Mock).mockResolvedValue([]);

        await service.getForUser(5, { limit: 10, offset: 0, unreadOnly: true });

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('n.is_read = 0'),
            [5, 10, 0]
        );
    });
});

describe('NotificationService.getUnreadCount', () => {
    it('devuelve el conteo de la fila', async () => {
        (db.get as jest.Mock).mockResolvedValue({ count: 4 });
        const service = new NotificationService();

        await expect(service.getUnreadCount(5)).resolves.toBe(4);
    });

    it('devuelve 0 si la query no trae fila', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        const service = new NotificationService();

        await expect(service.getUnreadCount(5)).resolves.toBe(0);
    });
});

describe('NotificationService.markRead', () => {
    let service: NotificationService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new NotificationService();
    });

    it('devuelve true y marca leída si la notificación pertenece al usuario', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

        await expect(service.markRead(7, 5)).resolves.toBe(true);
        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notifications SET is_read = 1'),
            [7, 5]
        );
    });

    it('devuelve false si no existe o pertenece a otro usuario', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 0 });

        await expect(service.markRead(7, 5)).resolves.toBe(false);
    });
});

describe('NotificationService.markAllRead', () => {
    it('marca todas las no leídas del usuario', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 3 });
        const service = new NotificationService();

        await service.markAllRead(5);

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE notifications SET is_read = 1'),
            [5]
        );
    });
});
