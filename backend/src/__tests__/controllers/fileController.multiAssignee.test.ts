import fs from 'fs';
import path from 'path';

describe('fileController - acceso multi-asignado (sin ejecutar controller, chequeo estatico de la migracion)', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '../../controllers/fileController.ts'),
        'utf-8'
    );

    it('no queda ningun chequeo de acceso residual con el criterio viejo (t.assignee_id = ? dentro de un OR de acceso)', () => {
        expect(source).not.toMatch(/t\.assignee_id = \? OR p\.assigned_to = \?/);
    });

    it('los 4 sitios de acceso a tareas usan EXISTS contra task_assignees', () => {
        const matches = source.match(/EXISTS \(SELECT 1 FROM task_assignees ta WHERE ta\.task_id = t\.id AND ta\.user_id = \?\)/g) || [];
        expect(matches.length).toBe(4);
    });
});
