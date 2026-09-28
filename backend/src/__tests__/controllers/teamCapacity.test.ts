jest.mock('../../database/database', () => ({
    db: {
        get: jest.fn(),
        run: jest.fn(),
        query: jest.fn()
    }
}));

jest.mock('../../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }
}));

jest.mock('../../services/activityLogService', () => ({
    activityLogService: {
        logActivity: jest.fn().mockResolvedValue(undefined)
    }
}));

import { db } from '../../database/database';
import { commercialController } from '../../controllers/commercialController';

function mockRes() {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('CommercialController - Carga FTE del equipo (Fase 6F)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getTeamCapacity', () => {
        it('calcula la carga total FTE de cada usuario y categoriza correctamente (overallocated, optimal, available)', async () => {
            const req: any = {
                user: { id: 1, role: 'team_lead' }
            };
            const res = mockRes();

            const mockUsers = [
                { id: 10, full_name: 'Dev Overallocated', username: 'dev1', email: 'd1@x.com', role: 'rpa_developer', avatar_url: null },
                { id: 11, full_name: 'Dev Optimal', username: 'dev2', email: 'd2@x.com', role: 'rpa_developer', avatar_url: null },
                { id: 12, full_name: 'Dev Available', username: 'dev3', email: 'd3@x.com', role: 'rpa_developer', avatar_url: null }
            ];

            const mockAssignments = [
                // Dev 10: 60% en P1 + 50% en P2 = 110% (1.1 FTE -> overallocated)
                { user_id: 10, project_id: 1, project_name: 'P1', project_status: 'active', assignment_role: 'developer', allocation_percentage: 60, budgeted_hours: 80, actual_hours: 50 },
                { user_id: 10, project_id: 2, project_name: 'P2', project_status: 'active', assignment_role: 'developer', allocation_percentage: 50, budgeted_hours: 60, actual_hours: 40 },
                // Dev 11: 100% en P1 = 100% (1.0 FTE -> optimal)
                { user_id: 11, project_id: 1, project_name: 'P1', project_status: 'active', assignment_role: 'lead', allocation_percentage: 100, budgeted_hours: 120, actual_hours: 100 },
                // Dev 12: 40% en P2 = 40% (0.4 FTE -> available)
                { user_id: 12, project_id: 2, project_name: 'P2', project_status: 'active', assignment_role: 'developer', allocation_percentage: 40, budgeted_hours: 50, actual_hours: 20 }
            ];

            (db.query as jest.Mock)
                .mockResolvedValueOnce(mockUsers)
                .mockResolvedValueOnce(mockAssignments);

            await commercialController.getTeamCapacity(req, res);

            expect(res.json).toHaveBeenCalled();
            const responseData = res.json.mock.calls[0][0];

            expect(responseData.data).toHaveLength(3);

            const dev10 = responseData.data.find((d: any) => d.user_id === 10);
            expect(dev10.total_fte).toBe(1.1);
            expect(dev10.status).toBe('overallocated');
            expect(dev10.total_budgeted_hours).toBe(140);
            expect(dev10.projects).toHaveLength(2);

            const dev11 = responseData.data.find((d: any) => d.user_id === 11);
            expect(dev11.total_fte).toBe(1.0);
            expect(dev11.status).toBe('optimal');

            const dev12 = responseData.data.find((d: any) => d.user_id === 12);
            expect(dev12.total_fte).toBe(0.4);
            expect(dev12.status).toBe('available');

            expect(responseData.summary).toEqual({
                total_team_members: 3,
                overallocated_count: 1,
                optimal_count: 1,
                available_count: 1,
                average_fte: 0.83
            });
        });

        it('rechaza con 403 a roles sin permiso de gestión', async () => {
            const req: any = { user: { id: 5, role: 'rpa_developer' } };
            const res = mockRes();

            await commercialController.getTeamCapacity(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('No tienes permiso') }));
        });
    });

    describe('saveCapacity', () => {
        it('crea una nueva asignación de capacidad si no existía', async () => {
            const req: any = {
                user: { id: 1, role: 'team_lead' },
                params: { projectId: '2' },
                body: {
                    user_id: 10,
                    role: 'contributor',
                    allocation_percentage: 50,
                    budgeted_hours: 80,
                    start_date: '2026-03-01',
                    end_date: '2026-04-30'
                }
            };
            const res = mockRes();

            // projectExists
            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 2 }) // projectExists
                .mockResolvedValueOnce(null) // existing assignment -> null
                .mockResolvedValueOnce({ // saved row
                    user_id: 10,
                    full_name: 'Dev Test',
                    role: 'contributor',
                    allocation_percentage: 50,
                    budgeted_hours: 80,
                    start_date: '2026-03-01',
                    end_date: '2026-04-30',
                    is_active: 1,
                    actual_hours: 0
                });

            (db.run as jest.Mock).mockResolvedValueOnce({ id: 99, changes: 1 });

            await commercialController.saveCapacity(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO project_assignments'),
                expect.arrayContaining([2, 10, 'contributor', 50, 80])
            );
            expect(res.json).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    user_id: 10,
                    allocation_percentage: 50,
                    planned_fte: 0.5
                })
            });
        });

        it('actualiza la asignación de capacidad si ya existía', async () => {
            const req: any = {
                user: { id: 1, role: 'team_lead' },
                params: { projectId: '2' },
                body: {
                    user_id: 10,
                    role: 'contributor',
                    allocation_percentage: 80,
                    budgeted_hours: 120
                }
            };
            const res = mockRes();

            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 2 }) // projectExists
                .mockResolvedValueOnce({ id: 50, project_id: 2, user_id: 10, allocation_percentage: 50, role: 'contributor' }) // existing assignment
                .mockResolvedValueOnce({
                    user_id: 10,
                    full_name: 'Dev Test',
                    role: 'contributor',
                    allocation_percentage: 80,
                    budgeted_hours: 120,
                    actual_hours: 10
                });

            (db.run as jest.Mock).mockResolvedValueOnce({ id: 50, changes: 1 });

            await commercialController.saveCapacity(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE project_assignments'),
                expect.arrayContaining([80, 120, 50])
            );
            expect(res.json).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    allocation_percentage: 80,
                    planned_fte: 0.8
                })
            });
        });
    });

    describe('deleteCapacity', () => {
        it('hace soft delete si el usuario tiene horas registradas', async () => {
            const req: any = {
                user: { id: 1, role: 'team_lead' },
                params: { projectId: '2', userId: '10' }
            };
            const res = mockRes();

            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 77, project_id: 2, user_id: 10 }) // existing
                .mockResolvedValueOnce({ count: 5 }); // has hours

            (db.run as jest.Mock).mockResolvedValueOnce({ changes: 1 });

            await commercialController.deleteCapacity(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE project_assignments SET is_active = 0'),
                expect.arrayContaining([77])
            );
            expect(res.json).toHaveBeenCalledWith({ message: 'Asignación eliminada correctamente' });
        });

        it('elimina el registro si no tiene horas registradas', async () => {
            const req: any = {
                user: { id: 1, role: 'team_lead' },
                params: { projectId: '2', userId: '10' }
            };
            const res = mockRes();

            (db.get as jest.Mock)
                .mockResolvedValueOnce({ id: 77, project_id: 2, user_id: 10 }) // existing
                .mockResolvedValueOnce({ count: 0 }); // no hours

            (db.run as jest.Mock).mockResolvedValueOnce({ changes: 1 });

            await commercialController.deleteCapacity(req, res);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM project_assignments WHERE id = ?'),
                expect.arrayContaining([77])
            );
            expect(res.json).toHaveBeenCalledWith({ message: 'Asignación eliminada correctamente' });
        });
    });
});
