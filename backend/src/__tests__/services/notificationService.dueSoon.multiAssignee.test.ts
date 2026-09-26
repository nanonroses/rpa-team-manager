jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { NotificationService } from '../../services/notificationService';

describe('NotificationService - task_due_soon llega a cualquier co-responsable via task_assignees', () => {
    it('checkLoginReminders busca tareas por pertenencia a task_assignees, no solo assignee_id', async () => {
        (db.query as jest.Mock).mockResolvedValueOnce([]);
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const service = new NotificationService();

        await service.checkLoginReminders(9, 0);

        const [sql] = (db.query as jest.Mock).mock.calls[0];
        expect(sql).toContain('EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id AND ta.user_id = ?)');
    });
});
