jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));

import { db } from '../../database/database';
import { TaskDependencyService, TaskDependencyError } from '../../services/taskDependencyService';

describe('TaskDependencyService', () => {
    let service: TaskDependencyService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new TaskDependencyService();
    });

    describe('createDependency', () => {
        it('crea la dependencia con dependency_type y lag_days por defecto', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([]);
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({
                id: 99, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });

            const result = await service.createDependency(10, 20);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO task_dependencies'),
                [20, 10, 'finish_to_start', 0]
            );
            expect(result).toEqual({
                id: 99, predecessor_id: 20, successor_id: 10, dependency_type: 'finish_to_start', lag_days: 0
            });
        });

        it('crea la dependencia con dependency_type y lag_days explicitos', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([]);
            (db.run as jest.Mock).mockResolvedValue({ id: 99, changes: 1 });
            (db.get as jest.Mock).mockResolvedValue({
                id: 99, predecessor_id: 20, successor_id: 10, dependency_type: 'start_to_start', lag_days: 2
            });

            await service.createDependency(10, 20, 'start_to_start', 2);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO task_dependencies'),
                [20, 10, 'start_to_start', 2]
            );
        });

        it('rechaza la auto-dependencia sin consultar la base de datos', async () => {
            await expect(service.createDependency(10, 10)).rejects.toThrow(TaskDependencyError);
            expect(db.query).not.toHaveBeenCalled();
        });

        it('rechaza si alguna de las dos tareas no existe', async () => {
            (db.query as jest.Mock).mockResolvedValueOnce([{ id: 10, project_id: 1 }]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 404 });
        });

        it('rechaza si las tareas pertenecen a proyectos distintos', async () => {
            (db.query as jest.Mock).mockResolvedValueOnce([
                { id: 10, project_id: 1 }, { id: 20, project_id: 2 }
            ]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 400 });
        });

        it('rechaza una dependencia duplicada sin llegar al INSERT', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([{ predecessor_id: 20, successor_id: 10 }]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 409 });
            expect(db.run).not.toHaveBeenCalled();
        });

        it('rechaza un ciclo directo (la tarea 10 depende de la 20, que ya depende de la 10)', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([{ predecessor_id: 10, successor_id: 20 }]);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({ status: 400 });
            expect(db.run).not.toHaveBeenCalled();
        });

        it('rechaza un ciclo indirecto de 3 tareas (10 depende de 20, 20 depende de 30, se intenta 30 depende de 10)', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 30, project_id: 1 }, { id: 10, project_id: 1 }])
                .mockResolvedValueOnce([
                    { predecessor_id: 20, successor_id: 10 },
                    { predecessor_id: 30, successor_id: 20 }
                ]);

            await expect(service.createDependency(30, 10)).rejects.toMatchObject({ status: 400 });
            expect(db.run).not.toHaveBeenCalled();
        });

        it('traduce violacion de UNIQUE constraint a TaskDependencyError 409 (condicion de carrera)', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([]);
            const uniqueError = Object.assign(
                new Error('UNIQUE constraint failed: task_dependencies.predecessor_id, task_dependencies.successor_id'),
                { code: 'SQLITE_CONSTRAINT' }
            );
            (db.run as jest.Mock).mockRejectedValue(uniqueError);

            await expect(service.createDependency(10, 20)).rejects.toMatchObject({
                message: 'Esta dependencia ya existe',
                status: 409
            });
        });

        it('rechaza un dependency_type invalido sin llegar al INSERT', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([]);

            await expect(service.createDependency(10, 20, 'tipo-invalido')).rejects.toMatchObject({
                message: 'dependency_type invalido',
                status: 400
            });
            expect(db.run).not.toHaveBeenCalled();
        });

        it('propaga sin traducir un error de CHECK constraint en el INSERT (no deberia ser alcanzable en la practica)', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ id: 10, project_id: 1 }, { id: 20, project_id: 1 }])
                .mockResolvedValueOnce([]);
            const checkError = Object.assign(
                new Error('SQLITE_CONSTRAINT: CHECK constraint failed: task_dependencies'),
                { code: 'SQLITE_CONSTRAINT' }
            );
            (db.run as jest.Mock).mockRejectedValue(checkError);

            await expect(service.createDependency(10, 20)).rejects.toBe(checkError);
        });
    });

    describe('getDependenciesForTask', () => {
        it('devuelve depends_on y blocks por separado', async () => {
            (db.query as jest.Mock)
                .mockResolvedValueOnce([{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }])
                .mockResolvedValueOnce([{ dependency_id: 2, task_id: 30, title: 'C', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }]);

            const result = await service.getDependenciesForTask(10);

            expect(db.query).toHaveBeenNthCalledWith(1, expect.stringContaining('td.successor_id = ?'), [10]);
            expect(db.query).toHaveBeenNthCalledWith(2, expect.stringContaining('td.predecessor_id = ?'), [10]);
            expect(result).toEqual({
                depends_on: [{ dependency_id: 1, task_id: 20, title: 'B', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }],
                blocks: [{ dependency_id: 2, task_id: 30, title: 'C', status: 'todo', dependency_type: 'finish_to_start', lag_days: 0 }]
            });
        });
    });

    describe('deleteDependency', () => {
        it('borra la dependencia cuando la tarea es predecesora o sucesora', async () => {
            (db.run as jest.Mock).mockResolvedValue({ changes: 1 });

            await service.deleteDependency(10, 99);

            expect(db.run).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM task_dependencies'),
                [99, 10, 10]
            );
        });

        it('lanza 404 si no borro ninguna fila (el dependencyId no involucra a esa tarea)', async () => {
            (db.run as jest.Mock).mockResolvedValue({ changes: 0 });

            await expect(service.deleteDependency(10, 99)).rejects.toMatchObject({ status: 404 });
        });
    });
});
