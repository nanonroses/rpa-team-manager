import { validate } from '../../middleware/validation';
import { createTaskSchema, createProjectSchema, updateProjectSchema } from '../../validation/schemas';

function mockRes(): any {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

describe('createTaskSchema - assignee_ids', () => {
    // Regresion: POST /tasks corre `validate({ body: createTaskSchema })` ANTES de llegar al
    // controller, y esa validacion REEMPLAZA req.body por el resultado de zod (ver
    // middleware/validation.ts: `req.body = await schemas.body.parseAsync(req.body)`). Como
    // zod hace "strip" por defecto de cualquier campo que el schema no declare, si el schema
    // no conoce assignee_ids, el campo desaparece silenciosamente antes de que TaskController
    // lo vea: la tarea se crea con assignee_id = NULL y ninguna fila en task_assignees, sin
    // error visible para el caller. Un test que solo llame a TaskController.createTask
    // directamente (saltandose el middleware) no detecta este bug.
    it('createTaskSchema.parseAsync conserva assignee_ids en vez de descartarlo', async () => {
        const parsed = await createTaskSchema.parseAsync({
            board_id: 1, column_id: 2, title: 'x', assignee_ids: [5, 9]
        });

        expect(parsed).toMatchObject({ assignee_ids: [5, 9] });
    });

    it('el middleware validate({ body: createTaskSchema }) conserva assignee_ids en req.body tras parsear', async () => {
        const middleware = validate({ body: createTaskSchema });
        const req: any = {
            body: { board_id: 1, column_id: 2, title: 'x', assignee_ids: [5, 9] }
        };
        const res = mockRes();
        const next = jest.fn();

        await middleware(req, res, next);

        expect(next).toHaveBeenCalledWith(); // sin error de validacion
        expect(req.body.assignee_ids).toEqual([5, 9]);
    });

    it('rechaza assignee_ids con elementos invalidos (no enteros positivos)', async () => {
        await expect(createTaskSchema.parseAsync({
            board_id: 1, column_id: 2, title: 'x', assignee_ids: [5, -1]
        })).rejects.toThrow();
    });

    it('sigue aceptando el legacy assignee_id (unico) sin assignee_ids', async () => {
        const parsed = await createTaskSchema.parseAsync({
            board_id: 1, column_id: 2, title: 'x', assignee_id: 5
        });

        expect(parsed).toMatchObject({ assignee_id: 5 });
        expect(parsed.assignee_ids).toBeUndefined();
    });
});

describe('createProjectSchema / updateProjectSchema - campos financieros y v27', () => {
    it('conserva sale_price, hours_budgeted y los campos de v27 en vez de descartarlos', async () => {
        const parsed = await createProjectSchema.parseAsync({
            name: 'P', sale_price: 12000000, sale_price_currency: 'CLP', hours_budgeted: 300,
            client_id: 4, area_id: 1, pm_user_id: 2, project_type: 'commercial', currency: 'UF'
        });
        expect(parsed).toMatchObject({
            sale_price: 12000000, sale_price_currency: 'CLP', hours_budgeted: 300,
            client_id: 4, area_id: 1, pm_user_id: 2, project_type: 'commercial', currency: 'UF'
        });
    });

    it('rechaza el estado planning, que no existe en la BD', async () => {
        await expect(createProjectSchema.parseAsync({ name: 'P', status: 'planning' })).rejects.toThrow();
    });

    it('acepta budget y sale_price en null (campo borrado en el formulario)', async () => {
        const parsed = await updateProjectSchema.parseAsync({ budget: null, sale_price: null });
        expect(parsed).toMatchObject({ budget: null, sale_price: null });
    });
});
