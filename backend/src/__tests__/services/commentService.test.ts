jest.mock('../../database/database', () => ({
    db: { get: jest.fn(), run: jest.fn(), query: jest.fn() }
}));
jest.mock('../../services/notificationService', () => ({
    notificationService: { notify: jest.fn() }
}));

import { db } from '../../database/database';
import { notificationService } from '../../services/notificationService';
import { CommentService } from '../../services/commentService';

describe('CommentService.getForEntity', () => {
    let service: CommentService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new CommentService();
    });

    it('devuelve los comentarios de la entidad ordenados por fecha ascendente', async () => {
        (db.query as jest.Mock).mockResolvedValue([
            { id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola', created_at: '2026-09-20', updated_at: '2026-09-20' }
        ]);

        const result = await service.getForEntity('task', 55);

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('ORDER BY c.created_at ASC, c.id ASC'),
            ['task', 55]
        );
        expect(result).toHaveLength(1);
    });
});

describe('CommentService.create', () => {
    let service: CommentService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new CommentService();
    });

    it('inserta el comentario y devuelve la fila creada', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 10, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 10, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola equipo', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            return Promise.resolve(undefined);
        });

        const result = await service.create('task', 55, 3, 'Hola equipo');

        expect(db.run).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO comments'),
            ['task', 55, 3, 'Hola equipo']
        );
        expect(result.id).toBe(10);
    });

    it('recorta espacios del contenido antes de insertar', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 11, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 11, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            return Promise.resolve(undefined);
        });

        await service.create('task', 55, 3, '  Hola  ');

        expect(db.run).toHaveBeenCalledWith(expect.any(String), ['task', 55, 3, 'Hola']);
    });

    it('notifica a un usuario mencionado activo que SI tiene acceso a la tarea, excluyendo al autor', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 12, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 12, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola @dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            if (sql.includes('FROM tasks t')) {
                return Promise.resolve({ assignee_id: 9, assigned_to: null, created_by: null });
            }
            return Promise.resolve(undefined);
        });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('username IN')) return Promise.resolve([{ id: 9 }]);
            if (sql.includes('id IN')) return Promise.resolve([{ id: 9 }]);
            return Promise.resolve([]);
        });

        await service.create('task', 55, 3, 'Hola @dev1');

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('username IN (?)'),
            ['dev1']
        );
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({
            userId: 9, eventKey: 'comment_mention', entityType: 'task', entityId: 55, senderId: 3,
            link: '/tasks?taskId=55'
        }));
    });

    it('NO notifica a un usuario mencionado que no tiene acceso a la tarea', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 19, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 19, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola @dev2', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            if (sql.includes('FROM tasks t')) {
                // solo el usuario 9 (assignee) tiene acceso a esta tarea
                return Promise.resolve({ assignee_id: 9, assigned_to: null, created_by: null });
            }
            return Promise.resolve(undefined);
        });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('username IN')) return Promise.resolve([{ id: 20 }]); // @dev2 resuelve al usuario 20, SIN acceso
            if (sql.includes('id IN')) return Promise.resolve([{ id: 9 }]); // el unico id accesible (9) esta activo
            return Promise.resolve([]);
        });

        await service.create('task', 55, 3, 'Hola @dev2');

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('no se auto-notifica si el autor se menciona a sí mismo', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 13, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 13, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@ana nota para mi', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            return Promise.resolve(undefined);
        });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('username IN')) return Promise.resolve([{ id: 3 }]);
            return Promise.resolve([]);
        });

        await service.create('task', 55, 3, '@ana nota para mi');

        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('menciona al mismo usuario dos veces en el mismo comentario y solo notifica una vez', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 14, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 14, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@dev1 y de nuevo @dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            if (sql.includes('FROM tasks t')) {
                return Promise.resolve({ assignee_id: 9, assigned_to: null, created_by: null });
            }
            return Promise.resolve(undefined);
        });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('username IN')) return Promise.resolve([{ id: 9 }]);
            if (sql.includes('id IN')) return Promise.resolve([{ id: 9 }]);
            return Promise.resolve([]);
        });

        await service.create('task', 55, 3, '@dev1 y de nuevo @dev1');

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('username IN'), ['dev1']);
        expect(notificationService.notify).toHaveBeenCalledTimes(1);
    });

    it('un @usuario que no existe no rompe el guardado ni bloquea notificar a otros mencionados válidos y con acceso', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 15, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 15, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@noexiste y @dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            if (sql.includes('FROM tasks t')) {
                return Promise.resolve({ assignee_id: 9, assigned_to: null, created_by: null });
            }
            return Promise.resolve(undefined);
        });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('username IN')) return Promise.resolve([{ id: 9 }]); // solo dev1 resuelve
            if (sql.includes('id IN')) return Promise.resolve([{ id: 9 }]);
            return Promise.resolve([]);
        });

        const result = await service.create('task', 55, 3, '@noexiste y @dev1');

        expect(result.id).toBe(15);
        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 9, eventKey: 'comment_mention' }));
    });

    it('un comentario sin @menciones no consulta usuarios ni notifica', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 16, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 16, entity_type: 'project', entity_id: 7, user_id: 3, author_name: 'Ana', content: 'Sin menciones', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            return Promise.resolve(undefined);
        });

        await service.create('project', 7, 3, 'Sin menciones');

        expect(db.query).not.toHaveBeenCalled();
        expect(notificationService.notify).not.toHaveBeenCalled();
    });

    it('usa el link de proyecto cuando entityType es project, notificando solo a mencionados con acceso', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 17, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 17, entity_type: 'project', entity_id: 7, user_id: 3, author_name: 'Ana', content: '@dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            if (sql.includes('FROM projects')) {
                return Promise.resolve({ assigned_to: 9, created_by: 1 });
            }
            return Promise.resolve(undefined);
        });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('username IN')) return Promise.resolve([{ id: 9 }]);
            if (sql.includes('role IN')) return Promise.resolve([]);
            if (sql.includes('id IN')) return Promise.resolve([{ id: 9 }]);
            return Promise.resolve([]);
        });

        await service.create('project', 7, 3, '@dev1');

        expect(notificationService.notify).toHaveBeenCalledWith(expect.objectContaining({ link: '/projects/7' }));
    });

    it('nunca lanza si falla la resolución/notificación de menciones (el comentario ya se guardó)', async () => {
        (db.run as jest.Mock).mockResolvedValue({ id: 18, changes: 1 });
        (db.get as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('FROM comments')) {
                return Promise.resolve({ id: 18, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: '@dev1', created_at: '2026-09-23', updated_at: '2026-09-23' });
            }
            return Promise.reject(new Error('db down'));
        });
        (db.query as jest.Mock).mockRejectedValue(new Error('db down'));

        await expect(service.create('task', 55, 3, '@dev1')).resolves.toMatchObject({ id: 18 });
    });
});

describe('CommentService.getMentionableUsers', () => {
    let service: CommentService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new CommentService();
    });

    it('para una tarea, devuelve assignee + dueños del proyecto, activos y sin duplicados', async () => {
        (db.get as jest.Mock).mockResolvedValue({ assignee_id: 9, assigned_to: 9, created_by: 1 });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('id IN')) {
                return Promise.resolve([
                    { id: 9, username: 'dev1', full_name: 'Dev Uno' },
                    { id: 1, username: 'admin', full_name: 'Admin' }
                ]);
            }
            return Promise.resolve([]);
        });

        const result = await service.getMentionableUsers('task', 55);

        expect(db.get).toHaveBeenCalledWith(expect.stringContaining('FROM tasks t'), [55]);
        expect(result).toEqual([
            { id: 9, username: 'dev1', full_name: 'Dev Uno' },
            { id: 1, username: 'admin', full_name: 'Admin' }
        ]);
    });

    it('para una tarea sin assignee ni proyecto asociado, devuelve lista vacía sin consultar usuarios', async () => {
        (db.get as jest.Mock).mockResolvedValue({ assignee_id: null, assigned_to: null, created_by: null });

        const result = await service.getMentionableUsers('task', 55);

        expect(result).toEqual([]);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('devuelve lista vacía si la tarea no existe', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);

        const result = await service.getMentionableUsers('task', 999);

        expect(result).toEqual([]);
    });

    it('para un proyecto, incluye team_lead/rpa_operations/it_support activos mas assigned_to/created_by', async () => {
        (db.get as jest.Mock).mockResolvedValue({ assigned_to: 9, created_by: 1 });
        (db.query as jest.Mock).mockImplementation((sql: string) => {
            if (sql.includes('role IN')) return Promise.resolve([{ id: 1 }, { id: 4 }]);
            if (sql.includes('id IN')) return Promise.resolve([{ id: 1, username: 'admin', full_name: 'Admin' }, { id: 4, username: 'ops', full_name: 'Ops' }, { id: 9, username: 'dev1', full_name: 'Dev Uno' }]);
            return Promise.resolve([]);
        });

        const result = await service.getMentionableUsers('project', 7);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining("role IN ('team_lead', 'rpa_operations', 'it_support')"), []);
        expect(result).toHaveLength(3);
    });

    it('devuelve lista vacía si el proyecto no existe', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);

        const result = await service.getMentionableUsers('project', 999);

        expect(result).toEqual([]);
    });
});

describe('CommentService.findById', () => {
    it('devuelve la fila con author_name', async () => {
        (db.get as jest.Mock).mockResolvedValue({ id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Hola', created_at: 'x', updated_at: 'x' });
        const service = new CommentService();

        const result = await service.findById(1);

        expect(result?.author_name).toBe('Ana');
    });

    it('devuelve undefined si no existe', async () => {
        (db.get as jest.Mock).mockResolvedValue(undefined);
        const service = new CommentService();

        await expect(service.findById(999)).resolves.toBeUndefined();
    });
});

describe('CommentService.update', () => {
    it('actualiza el contenido (recortado) y devuelve la fila actualizada', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        (db.get as jest.Mock).mockResolvedValue({ id: 1, entity_type: 'task', entity_id: 55, user_id: 3, author_name: 'Ana', content: 'Editado', created_at: 'x', updated_at: 'y' });
        const service = new CommentService();

        const result = await service.update(1, '  Editado  ');

        expect(db.run).toHaveBeenCalledWith(expect.stringContaining('UPDATE comments SET content = ?'), ['Editado', 1]);
        expect(result.content).toBe('Editado');
    });
});

describe('CommentService.delete', () => {
    it('borra el comentario por id', async () => {
        (db.run as jest.Mock).mockResolvedValue({ changes: 1 });
        const service = new CommentService();

        await service.delete(1);

        expect(db.run).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM comments WHERE id = ?'), [1]);
    });
});
