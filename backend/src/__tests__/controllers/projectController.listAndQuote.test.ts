// eslint-disable-next-line @typescript-eslint/no-var-requires
jest.mock('../../database/database', () => ({ db: require('../helpers/realTestDb').realDbProxy }));

import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ProjectController } from '../../controllers/projectController';
import { createRealTestDb, realDbHolder, seedBasicUsers, RealTestDb, TestUsers } from '../helpers/realTestDb';

function mockRes(): Response {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
}

function makeReq(user: { id: number; role: string }, body: any = {}, params: any = {}): AuthenticatedRequest {
    return { user, body, params, query: {} } as unknown as AuthenticatedRequest;
}

describe('ProjectController - listado y creación desde cotización (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        controller = new ProjectController();
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    it('getProjects no multiplica tareas por horas y solo suma horas aprobadas', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('Conteo', ?)`, [users.lead]);
        const board = await testDb.run(`INSERT INTO task_boards (project_id, name) VALUES (?, 'B')`, [project.id]);
        const column = await testDb.run(`INSERT INTO task_columns (board_id, name, position) VALUES (?, 'To Do', 1)`, [board.id]);
        for (const status of ['todo', 'in_progress', 'done']) {
            await testDb.run(
                `INSERT INTO tasks (board_id, column_id, title, reporter_id, status) VALUES (?, ?, ?, ?, ?)`,
                [board.id, column.id, `T-${status}`, users.lead, status]
            );
        }
        await testDb.run(`INSERT INTO time_entries (user_id, project_id, hours, date, approval_status) VALUES (?, ?, 4, '2026-09-21', 'approved')`, [users.dev, project.id]);
        await testDb.run(`INSERT INTO time_entries (user_id, project_id, hours, date, approval_status) VALUES (?, ?, 6, '2026-09-22', 'approved')`, [users.dev, project.id]);
        await testDb.run(`INSERT INTO time_entries (user_id, project_id, hours, date, approval_status) VALUES (?, ?, 5, '2026-09-23', 'draft')`, [users.dev, project.id]);

        const res = mockRes();
        await controller.getProjects(makeReq({ id: users.lead, role: 'team_lead' }), res);

        const rows = (res.json as jest.Mock).mock.calls[0][0];
        const row = rows.find((p: any) => p.id === project.id);
        expect(row).toMatchObject({ total_tasks: 3, completed_tasks: 1, progress_percentage: 33, total_hours_logged: 10 });
    });

    it('getProjects devuelve 0 horas y 0% para un proyecto sin tareas ni horas', async () => {
        const project = await testDb.run(`INSERT INTO projects (name, created_by) VALUES ('Vacío', ?)`, [users.lead]);

        const res = mockRes();
        await controller.getProjects(makeReq({ id: users.lead, role: 'team_lead' }), res);

        const row = (res.json as jest.Mock).mock.calls[0][0].find((p: any) => p.id === project.id);
        expect(row).toMatchObject({ total_tasks: 0, completed_tasks: 0, progress_percentage: 0, total_hours_logged: 0 });
    });

    it('createProjectFromQuote crea proyecto activo, tareas con reporter y hitos con planned_date (con fallback)', async () => {
        const res = mockRes();
        await controller.createProjectFromQuote(makeReq({ id: users.lead, role: 'team_lead' }, {
            quote_data: {
                project_name: 'Desde cotización',
                description: 'Automatización',
                client_name: 'Cliente Y',
                estimated_start_date: '2026-10-01',
                estimated_end_date: '2026-12-15',
                expected_revenue: 9000000,
                tasks: [{ title: 'Levantamiento', estimated_hours: 8 }, { title: 'Desarrollo' }],
                milestones: [{ name: 'PDD aprobado', target_date: '2026-10-20' }, { name: 'Go-live' }]
            }
        }), res);

        expect(res.status).toHaveBeenCalledWith(201);
        const projectId = (res.json as jest.Mock).mock.calls[0][0].project.id;

        const project = await testDb.get('SELECT status FROM projects WHERE id = ?', [projectId]);
        expect(project.status).toBe('active');

        const tasks = await testDb.query(
            `SELECT t.title, t.reporter_id FROM tasks t JOIN task_boards tb ON t.board_id = tb.id WHERE tb.project_id = ? ORDER BY t.position`,
            [projectId]
        );
        expect(tasks).toEqual([
            { title: 'Levantamiento', reporter_id: users.lead },
            { title: 'Desarrollo', reporter_id: users.lead }
        ]);

        const milestones = await testDb.query('SELECT name, planned_date FROM project_milestones WHERE project_id = ? ORDER BY id', [projectId]);
        expect(milestones).toEqual([
            { name: 'PDD aprobado', planned_date: '2026-10-20' },
            { name: 'Go-live', planned_date: '2026-12-15' }
        ]);
    });
});
