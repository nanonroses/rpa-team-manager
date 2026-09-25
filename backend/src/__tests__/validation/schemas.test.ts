import { validate } from '../../middleware/validation';
import { createTaskSchema } from '../../validation/schemas';

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
