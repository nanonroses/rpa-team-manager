jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/financeService', () => ({
    financeService: { getMonthlyHours: jest.fn().mockResolvedValue(160) }
}));

import { db } from '../../database/database';
import { TimesheetService } from '../../services/timesheetService';

describe('TimesheetService - estimatedByPerson cuenta horas completas para cada co-responsable', () => {
    it('el query de horas estimadas por persona usa task_assignees, una tarea con 2 responsables aporta horas completas a cada uno', async () => {
        (db.query as jest.Mock)
            .mockResolvedValueOnce([]) // realByPerson
            .mockResolvedValueOnce([
                { user_id: 5, estimated_hours: 8 },
                { user_id: 9, estimated_hours: 8 }
            ]) // estimatedByPerson (misma tarea de 8h, 2 responsables -> 8h para cada uno)
            .mockResolvedValueOnce([]); // byTaskRows

        const service = new TimesheetService();
        await service.getEffectivenessMetrics('2026-01-01', '2026-01-31');

        const estimatedCall = (db.query as jest.Mock).mock.calls[1];
        expect(estimatedCall[0]).toContain('FROM task_assignees ta');
        expect(estimatedCall[0]).toContain('JOIN tasks t ON t.id = ta.task_id');
        expect(estimatedCall[0]).toContain('GROUP BY ta.user_id');
    });
});
