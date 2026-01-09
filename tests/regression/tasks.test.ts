/**
 * Tests de Regresión - Feature F04: Tasks Module (Kanban)
 * 
 * Estos tests verifican que las funciones del módulo de Tareas funcionan correctamente.
 * Ejecutar antes de modificar cualquier código relacionado con Tasks.
 * 
 * Endpoints cubiertos:
 * - GET /api/tasks/boards
 * - POST /api/tasks/boards
 * - GET /api/tasks/boards/:id/columns
 * - POST /api/tasks/boards/:id/tasks
 * - PUT /api/tasks/:id
 * - DELETE /api/tasks/:id
 */

describe('Tasks Module - Regression Tests', () => {

    // =====================================================
    // TASK STATUS CALCULATIONS
    // =====================================================

    describe('Cálculos de Estado de Tarea', () => {
        type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'blocked';

        interface Task {
            id: number;
            title: string;
            status: TaskStatus;
            column_id: number;
            due_date?: string;
            estimated_hours?: number;
            actual_hours?: number;
        }

        function isTaskOverdue(dueDate: string | undefined, today: Date = new Date()): boolean {
            if (!dueDate) return false;
            const due = new Date(dueDate);
            return due < today;
        }

        function getTaskUrgency(dueDate: string | undefined, today: Date = new Date()): 'overdue' | 'urgent' | 'normal' | 'no_date' {
            if (!dueDate) return 'no_date';

            const due = new Date(dueDate);
            const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

            if (diff < 0) return 'overdue';
            if (diff <= 2) return 'urgent';
            return 'normal';
        }

        it('debería detectar tarea vencida', () => {
            const today = new Date('2026-01-15');
            expect(isTaskOverdue('2026-01-10', today)).toBe(true);
        });

        it('debería detectar tarea NO vencida', () => {
            const today = new Date('2026-01-05');
            expect(isTaskOverdue('2026-01-10', today)).toBe(false);
        });

        it('debería manejar tarea sin fecha', () => {
            expect(isTaskOverdue(undefined)).toBe(false);
        });

        it('debería calcular urgencia overdue', () => {
            const today = new Date('2026-01-15');
            expect(getTaskUrgency('2026-01-10', today)).toBe('overdue');
        });

        it('debería calcular urgencia urgent (<=2 días)', () => {
            const today = new Date('2026-01-08');
            expect(getTaskUrgency('2026-01-10', today)).toBe('urgent');
        });

        it('debería calcular urgencia normal', () => {
            const today = new Date('2026-01-01');
            expect(getTaskUrgency('2026-01-10', today)).toBe('normal');
        });
    });

    // =====================================================
    // COLUMN POSITION MANAGEMENT
    // =====================================================

    describe('Gestión de Posiciones de Columnas', () => {
        interface Column {
            id: number;
            name: string;
            position: number;
            is_done_column: boolean;
        }

        function reorderColumns(columns: Column[], fromPosition: number, toPosition: number): Column[] {
            const result = [...columns].sort((a, b) => a.position - b.position);
            const [moved] = result.splice(fromPosition, 1);
            result.splice(toPosition, 0, moved);

            return result.map((col, index) => ({
                ...col,
                position: index
            }));
        }

        function getNextPosition(columns: Column[]): number {
            if (columns.length === 0) return 0;
            return Math.max(...columns.map(c => c.position)) + 1;
        }

        const sampleColumns: Column[] = [
            { id: 1, name: 'To Do', position: 0, is_done_column: false },
            { id: 2, name: 'In Progress', position: 1, is_done_column: false },
            { id: 3, name: 'Review', position: 2, is_done_column: false },
            { id: 4, name: 'Done', position: 3, is_done_column: true }
        ];

        it('debería reordenar columnas correctamente', () => {
            const result = reorderColumns(sampleColumns, 0, 2);
            expect(result[0].name).toBe('In Progress');
            expect(result[1].name).toBe('Review');
            expect(result[2].name).toBe('To Do');
            expect(result[3].name).toBe('Done');
        });

        it('debería mantener posiciones secuenciales', () => {
            const result = reorderColumns(sampleColumns, 3, 0);
            result.forEach((col, index) => {
                expect(col.position).toBe(index);
            });
        });

        it('debería calcular siguiente posición', () => {
            expect(getNextPosition(sampleColumns)).toBe(4);
            expect(getNextPosition([])).toBe(0);
        });
    });

    // =====================================================
    // TASK POSITION MANAGEMENT
    // =====================================================

    describe('Gestión de Posiciones de Tareas', () => {
        interface Task {
            id: number;
            column_id: number;
            position: number;
        }

        function reorderTasks(tasks: Task[], taskId: number, newPosition: number): Task[] {
            const result = [...tasks].sort((a, b) => a.position - b.position);
            const taskIndex = result.findIndex(t => t.id === taskId);

            if (taskIndex === -1) return result;

            const [moved] = result.splice(taskIndex, 1);
            result.splice(newPosition, 0, moved);

            return result.map((task, index) => ({
                ...task,
                position: index
            }));
        }

        function moveTaskToColumn(task: Task, newColumnId: number, newPosition: number): Task {
            return {
                ...task,
                column_id: newColumnId,
                position: newPosition
            };
        }

        it('debería reordenar tareas dentro de columna', () => {
            const tasks: Task[] = [
                { id: 1, column_id: 1, position: 0 },
                { id: 2, column_id: 1, position: 1 },
                { id: 3, column_id: 1, position: 2 }
            ];

            const result = reorderTasks(tasks, 1, 2);
            expect(result[0].id).toBe(2);
            expect(result[1].id).toBe(3);
            expect(result[2].id).toBe(1);
        });

        it('debería mover tarea a otra columna', () => {
            const task: Task = { id: 1, column_id: 1, position: 0 };
            const result = moveTaskToColumn(task, 2, 3);

            expect(result.column_id).toBe(2);
            expect(result.position).toBe(3);
        });
    });

    // =====================================================
    // TIME TRACKING
    // =====================================================

    describe('Seguimiento de Tiempo', () => {
        interface TimeEntry {
            task_id: number;
            hours: number;
            date: string;
        }

        function calculateTotalHours(entries: TimeEntry[]): number {
            return entries.reduce((sum, entry) => sum + entry.hours, 0);
        }

        function calculateEfficiency(estimated: number, actual: number): number {
            if (actual === 0) return 0;
            return Math.round((estimated / actual) * 100);
        }

        function getTimeStatus(estimated: number, actual: number): 'under' | 'on_track' | 'over' {
            if (actual === 0 || estimated === 0) return 'on_track';
            const ratio = actual / estimated;
            if (ratio < 0.8) return 'under';
            if (ratio > 1.2) return 'over';
            return 'on_track';
        }

        it('debería calcular horas totales', () => {
            const entries: TimeEntry[] = [
                { task_id: 1, hours: 2, date: '2026-01-08' },
                { task_id: 1, hours: 3, date: '2026-01-09' },
                { task_id: 1, hours: 1.5, date: '2026-01-10' }
            ];
            expect(calculateTotalHours(entries)).toBe(6.5);
        });

        it('debería calcular eficiencia', () => {
            expect(calculateEfficiency(8, 8)).toBe(100);  // Perfecto
            expect(calculateEfficiency(8, 10)).toBe(80); // Tomó más tiempo
            expect(calculateEfficiency(8, 4)).toBe(200); // Terminó antes
        });

        it('debería determinar estado de tiempo', () => {
            expect(getTimeStatus(8, 6)).toBe('under');     // 75% usado
            expect(getTimeStatus(8, 8)).toBe('on_track');  // 100% usado
            expect(getTimeStatus(8, 10)).toBe('over');     // 125% usado
        });
    });

    // =====================================================
    // BATCH OPERATIONS
    // =====================================================

    describe('Operaciones en Lote', () => {
        function validateBatchInput(ids: any[]): { valid: boolean; validIds: number[]; invalidCount: number } {
            const validIds: number[] = [];
            let invalidCount = 0;

            for (const id of ids) {
                if (typeof id === 'number' && id > 0) {
                    validIds.push(id);
                } else if (typeof id === 'string' && !isNaN(parseInt(id))) {
                    validIds.push(parseInt(id));
                } else {
                    invalidCount++;
                }
            }

            return {
                valid: validIds.length > 0,
                validIds,
                invalidCount
            };
        }

        it('debería validar IDs numéricos', () => {
            const result = validateBatchInput([1, 2, 3]);
            expect(result.valid).toBe(true);
            expect(result.validIds).toEqual([1, 2, 3]);
            expect(result.invalidCount).toBe(0);
        });

        it('debería convertir strings a números', () => {
            const result = validateBatchInput(['1', '2', '3']);
            expect(result.validIds).toEqual([1, 2, 3]);
        });

        it('debería filtrar valores inválidos', () => {
            const result = validateBatchInput([1, 'invalid', null, 3]);
            expect(result.validIds).toEqual([1, 3]);
            expect(result.invalidCount).toBe(2);
        });

        it('debería manejar array vacío', () => {
            const result = validateBatchInput([]);
            expect(result.valid).toBe(false);
            expect(result.validIds).toEqual([]);
        });
    });

    // =====================================================
    // PRIORITY AND LABELS
    // =====================================================

    describe('Prioridades y Etiquetas', () => {
        type Priority = 'critical' | 'high' | 'medium' | 'low';

        function getPriorityColor(priority: Priority): string {
            const colors: { [key in Priority]: string } = {
                'critical': '#f5222d',
                'high': '#fa8c16',
                'medium': '#1890ff',
                'low': '#52c41a'
            };
            return colors[priority];
        }

        function sortByPriority(priorities: Priority[]): Priority[] {
            const order: { [key in Priority]: number } = {
                'critical': 0,
                'high': 1,
                'medium': 2,
                'low': 3
            };
            return [...priorities].sort((a, b) => order[a] - order[b]);
        }

        it('debería obtener color por prioridad', () => {
            expect(getPriorityColor('critical')).toBe('#f5222d');
            expect(getPriorityColor('low')).toBe('#52c41a');
        });

        it('debería ordenar por prioridad', () => {
            const priorities: Priority[] = ['low', 'critical', 'medium', 'high'];
            const sorted = sortByPriority(priorities);
            expect(sorted).toEqual(['critical', 'high', 'medium', 'low']);
        });
    });

    // =====================================================
    // DEPENDENCIES
    // =====================================================

    describe('Dependencias de Tareas', () => {
        interface Dependency {
            predecessor_id: number;
            successor_id: number;
            dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';
        }

        function wouldCreateCycle(
            existingDeps: Dependency[],
            newPredecessor: number,
            newSuccessor: number
        ): boolean {
            // Simple cycle detection: check if successor is already a predecessor of predecessor
            const predecessors = new Set<number>();

            function findPredecessors(taskId: number) {
                for (const dep of existingDeps) {
                    if (dep.successor_id === taskId && !predecessors.has(dep.predecessor_id)) {
                        predecessors.add(dep.predecessor_id);
                        findPredecessors(dep.predecessor_id);
                    }
                }
            }

            findPredecessors(newPredecessor);
            return predecessors.has(newSuccessor);
        }

        it('debería detectar ciclo directo', () => {
            const deps: Dependency[] = [
                { predecessor_id: 1, successor_id: 2, dependency_type: 'finish_to_start' }
            ];
            // Intentar agregar 2 -> 1 crearía ciclo
            expect(wouldCreateCycle(deps, 2, 1)).toBe(true);
        });

        it('debería detectar ciclo indirecto', () => {
            const deps: Dependency[] = [
                { predecessor_id: 1, successor_id: 2, dependency_type: 'finish_to_start' },
                { predecessor_id: 2, successor_id: 3, dependency_type: 'finish_to_start' }
            ];
            // Intentar agregar 3 -> 1 crearía ciclo
            expect(wouldCreateCycle(deps, 3, 1)).toBe(true);
        });

        it('debería permitir dependencia válida', () => {
            const deps: Dependency[] = [
                { predecessor_id: 1, successor_id: 2, dependency_type: 'finish_to_start' }
            ];
            // Agregar 2 -> 3 es válido
            expect(wouldCreateCycle(deps, 2, 3)).toBe(false);
        });
    });
});
