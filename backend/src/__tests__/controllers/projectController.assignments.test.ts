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
    return { user, body, params } as unknown as AuthenticatedRequest;
}

describe('ProjectController - asignaciones de equipo (SQLite real)', () => {
    let testDb: RealTestDb;
    let users: TestUsers;
    let controller: ProjectController;
    let projectId: number;
    let lead: { id: number; role: string };

    beforeAll(async () => {
        testDb = await createRealTestDb();
        realDbHolder.current = testDb;
        users = await seedBasicUsers(testDb);
        lead = { id: users.lead, role: 'team_lead' };
        controller = new ProjectController();
        const project = await testDb.run(`INSERT INTO projects (name, created_by, assigned_to) VALUES ('P', ?, ?)`, [users.lead, users.dev]);
        projectId = project.id!;
        await testDb.run(
            `INSERT INTO user_cost_rates (user_id, monthly_cost, hourly_rate, effective_from, is_active, created_by) VALUES (?, 1760000, 10000, '2026-09-01', 1, ?)`,
            [users.dev, users.lead]
        );
    });

    afterAll(async () => {
        realDbHolder.current = null;
        await testDb.close();
    });

    async function post(body: any): Promise<Response> {
        const res = mockRes();
        await controller.addProjectAssignments(makeReq(lead, body, { id: String(projectId) }), res);
        return res;
    }

    async function activeRows(): Promise<any[]> {
        return testDb.query(
            'SELECT user_id, role, allocation_percentage, assigned_by, start_date FROM project_assignments WHERE project_id = ? AND is_active = 1 ORDER BY user_id',
            [projectId]
        );
    }

    it('guarda dos asignaciones con rol, dedicación, fecha y assigned_by = quien asigna', async () => {
        const res = await post({ user_assignments: [
            { user_id: users.dev, role: 'lead', allocation_percentage: 50, start_date: '2026-10-01' },
            { user_id: users.ops, allocation_percentage: 100 }
        ] });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(await activeRows()).toEqual([
            { user_id: users.dev, role: 'lead', allocation_percentage: 50, assigned_by: users.lead, start_date: '2026-10-01' },
            { user_id: users.ops, role: 'contributor', allocation_percentage: 100, assigned_by: users.lead, start_date: null }
        ]);
    });

    it('rechaza con 400 el rol "member" y deja intacto el equipo existente', async () => {
        const res = await post({ user_assignments: [{ user_id: users.dev, role: 'member' }] });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(await activeRows()).toHaveLength(2);
    });

    it('rechaza con 400 una dedicación fuera de 0-100', async () => {
        const res = await post({ user_assignments: [{ user_id: users.dev, allocation_percentage: 150 }] });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(await activeRows()).toHaveLength(2);
    });

    it('rechaza con 400 un usuario inexistente o repetido', async () => {
        const missing = await post({ user_assignments: [{ user_id: 9999 }] });
        expect(missing.status).toHaveBeenCalledWith(400);

        const duplicated = await post({ user_assignments: [{ user_id: users.dev }, { user_id: users.dev }] });
        expect(duplicated.status).toHaveBeenCalledWith(400);
        expect(await activeRows()).toHaveLength(2);
    });

    it('responde 404 si el proyecto no existe', async () => {
        const res = mockRes();
        await controller.addProjectAssignments(makeReq(lead, { user_assignments: [{ user_id: users.dev }] }, { id: '99999' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('volver a guardar reemplaza el equipo anterior', async () => {
        const res = await post({ user_assignments: [{ user_id: users.dev, role: 'lead' }] });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(await activeRows()).toEqual([
            { user_id: users.dev, role: 'lead', allocation_percentage: 100, assigned_by: users.lead, start_date: null }
        ]);
    });

    it('getProjectAssignments oculta monthly_cost/hourly_rate a un rpa_developer y los muestra a team_lead', async () => {
        const resDev = mockRes();
        await controller.getProjectAssignments(makeReq({ id: users.dev, role: 'rpa_developer' }, {}, { id: String(projectId) }), resDev);
        const devRows = (resDev.json as jest.Mock).mock.calls[0][0];
        expect(devRows[0]).not.toHaveProperty('monthly_cost');
        expect(devRows[0]).not.toHaveProperty('hourly_rate');

        const resLead = mockRes();
        await controller.getProjectAssignments(makeReq(lead, {}, { id: String(projectId) }), resLead);
        expect((resLead.json as jest.Mock).mock.calls[0][0][0]).toMatchObject({ monthly_cost: 1760000, hourly_rate: 10000 });
    });
    it('guarda el responsable del resumen junto al equipo y permite cambiarlo', async () => {
        const assignments = [
            { user_id: users.dev, role: 'lead', allocation_percentage: 100 },
            { user_id: users.ops, role: 'contributor', allocation_percentage: 50 }
        ];
        const response = await post({ user_assignments: assignments, responsible_user_id: users.ops });
        expect(response.status).toHaveBeenCalledWith(201);
        expect(await testDb.get('SELECT assigned_to FROM projects WHERE id = ?', [projectId])).toEqual({ assigned_to: users.ops });
        const invalid = await post({ user_assignments: assignments, responsible_user_id: users.lead });
        expect(invalid.status).toHaveBeenCalledWith(400);
        expect(await testDb.get('SELECT assigned_to FROM projects WHERE id = ?', [projectId])).toEqual({ assigned_to: users.ops });
        await post({ user_assignments: assignments, responsible_user_id: users.dev });
        expect(await testDb.get('SELECT assigned_to FROM projects WHERE id = ?', [projectId])).toEqual({ assigned_to: users.dev });
    });

});
