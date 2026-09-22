import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';

export class NotificationController {
    list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
            const unreadOnly = req.query.unread === 'true';

            const notifications = await notificationService.getForUser(userId, { limit, offset, unreadOnly });
            res.json(notifications);
        } catch (error) {
            logger.error('List notifications error:', error);
            res.status(500).json({ error: 'Failed to list notifications' });
        }
    };

    unreadCount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const count = await notificationService.getUnreadCount(req.user!.id);
            res.json({ count });
        } catch (error) {
            logger.error('Unread count error:', error);
            res.status(500).json({ error: 'Failed to get unread count' });
        }
    };

    markRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            const notificationId = parseInt(req.params.id, 10);
            const found = await notificationService.markRead(notificationId, req.user!.id);
            if (!found) {
                res.status(404).json({ error: 'Notification not found' });
                return;
            }
            res.status(204).send();
        } catch (error) {
            logger.error('Mark notification read error:', error);
            res.status(500).json({ error: 'Failed to mark notification as read' });
        }
    };

    markAllRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        try {
            await notificationService.markAllRead(req.user!.id);
            res.status(204).send();
        } catch (error) {
            logger.error('Mark all notifications read error:', error);
            res.status(500).json({ error: 'Failed to mark notifications as read' });
        }
    };
}
