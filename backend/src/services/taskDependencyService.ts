import { db } from '../database/database';

export class TaskDependencyError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = 'TaskDependencyError';
        this.status = status;
    }
}

export interface TaskDependencyRow {
    id: number;
    predecessor_id: number;
    successor_id: number;
    dependency_type: string;
    lag_days: number;
    created_at: string;
}

export interface DependencyTaskSummary {
    dependency_id: number;
    task_id: number;
    title: string;
    status: string;
    dependency_type: string;
    lag_days: number;
}

interface DependencyEdge {
    predecessor_id: number;
    successor_id: number;
}

export class TaskDependencyService {

    async createDependency(
        taskId: number,
        dependsOnTaskId: number,
        dependencyType: string = 'finish_to_start',
        lagDays: number = 0
    ): Promise<TaskDependencyRow> {
        if (taskId === dependsOnTaskId) {
            throw new TaskDependencyError('Una tarea no puede depender de si misma', 400);
        }

        const tasks = await db.query(`
            SELECT t.id, tb.project_id
            FROM tasks t
            LEFT JOIN task_boards tb ON t.board_id = tb.id
            WHERE t.id IN (?, ?)
        `, [taskId, dependsOnTaskId]);

        const taskRow = tasks.find((t: any) => t.id === taskId);
        const dependsOnRow = tasks.find((t: any) => t.id === dependsOnTaskId);

        if (!taskRow || !dependsOnRow) {
            throw new TaskDependencyError('Task not found', 404);
        }

        if (taskRow.project_id !== dependsOnRow.project_id) {
            throw new TaskDependencyError('Las dos tareas deben pertenecer al mismo proyecto', 400);
        }

        const edges: DependencyEdge[] = await db.query(`
            SELECT predecessor_id, successor_id FROM task_dependencies
        `);

        const isDuplicate = edges.some((e) => e.predecessor_id === dependsOnTaskId && e.successor_id === taskId);
        if (isDuplicate) {
            throw new TaskDependencyError('Esta dependencia ya existe', 409);
        }

        if (this.hasPath(edges, taskId, dependsOnTaskId)) {
            throw new TaskDependencyError('Esta dependencia generaria un ciclo entre tareas', 400);
        }

        let result;
        try {
            result = await db.run(`
                INSERT INTO task_dependencies (predecessor_id, successor_id, dependency_type, lag_days)
                VALUES (?, ?, ?, ?)
            `, [dependsOnTaskId, taskId, dependencyType, lagDays]);
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT' || error.message?.includes('UNIQUE constraint failed')) {
                throw new TaskDependencyError('Esta dependencia ya existe', 409);
            }
            throw error;
        }

        return db.get(`
            SELECT id, predecessor_id, successor_id, dependency_type, lag_days, created_at
            FROM task_dependencies WHERE id = ?
        `, [result.id]);
    }

    async getDependenciesForTask(taskId: number): Promise<{ depends_on: DependencyTaskSummary[]; blocks: DependencyTaskSummary[] }> {
        const dependsOn = await db.query(`
            SELECT td.id as dependency_id, t.id as task_id, t.title, t.status, td.dependency_type, td.lag_days
            FROM task_dependencies td
            JOIN tasks t ON t.id = td.predecessor_id
            WHERE td.successor_id = ?
            ORDER BY td.id ASC
        `, [taskId]);

        const blocks = await db.query(`
            SELECT td.id as dependency_id, t.id as task_id, t.title, t.status, td.dependency_type, td.lag_days
            FROM task_dependencies td
            JOIN tasks t ON t.id = td.successor_id
            WHERE td.predecessor_id = ?
            ORDER BY td.id ASC
        `, [taskId]);

        return { depends_on: dependsOn, blocks };
    }

    async deleteDependency(taskId: number, dependencyId: number): Promise<void> {
        const result = await db.run(`
            DELETE FROM task_dependencies WHERE id = ? AND (predecessor_id = ? OR successor_id = ?)
        `, [dependencyId, taskId, taskId]);

        if (result.changes === 0) {
            throw new TaskDependencyError('Dependency not found', 404);
        }
    }

    private hasPath(edges: DependencyEdge[], fromId: number, toId: number): boolean {
        const adjacency = new Map<number, number[]>();
        for (const edge of edges) {
            const list = adjacency.get(edge.predecessor_id) || [];
            list.push(edge.successor_id);
            adjacency.set(edge.predecessor_id, list);
        }

        const visited = new Set<number>();
        const queue: number[] = [fromId];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (current === toId) {
                return true;
            }
            if (visited.has(current)) continue;
            visited.add(current);
            queue.push(...(adjacency.get(current) || []));
        }

        return false;
    }
}

export const taskDependencyService = new TaskDependencyService();
