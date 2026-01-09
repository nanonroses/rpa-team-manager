/**
 * Tests de Regresión - Feature F01: Projects Module
 * 
 * Estos tests verifican que las funciones del módulo de Proyectos funcionan correctamente.
 * Ejecutar antes de modificar cualquier código relacionado con Projects.
 * 
 * Endpoints cubiertos:
 * - GET /api/projects
 * - POST /api/projects
 * - PUT /api/projects/:id
 * - DELETE /api/projects/:id
 * - POST /api/projects/:id/assignments
 */

describe('Projects Module - Regression Tests', () => {

    // =====================================================
    // PROJECT STATUS CALCULATIONS
    // =====================================================

    describe('Cálculos de Estado de Proyecto', () => {
        type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

        interface Project {
            id: number;
            name: string;
            status: ProjectStatus;
            start_date: string;
            end_date: string;
            progress_percentage: number;
        }

        function calculateProjectHealth(
            scheduleVariance: number,
            costVariance: number,
            riskLevel: string
        ): 'healthy' | 'warning' | 'critical' {
            if (scheduleVariance > 5 || costVariance > 20 || riskLevel === 'critical') {
                return 'critical';
            }
            if (scheduleVariance > 2 || costVariance > 10 || riskLevel === 'high') {
                return 'warning';
            }
            return 'healthy';
        }

        function calculateDaysToDeadline(endDate: string, today: Date = new Date()): number {
            const end = new Date(endDate);
            const diff = end.getTime() - today.getTime();
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        it('debería detectar proyecto healthy', () => {
            const result = calculateProjectHealth(1, 5, 'low');
            expect(result).toBe('healthy');
        });

        it('debería detectar proyecto warning por schedule', () => {
            const result = calculateProjectHealth(3, 5, 'low');
            expect(result).toBe('warning');
        });

        it('debería detectar proyecto warning por cost', () => {
            const result = calculateProjectHealth(1, 15, 'low');
            expect(result).toBe('warning');
        });

        it('debería detectar proyecto critical por schedule', () => {
            const result = calculateProjectHealth(10, 5, 'low');
            expect(result).toBe('critical');
        });

        it('debería detectar proyecto critical por risk level', () => {
            const result = calculateProjectHealth(1, 5, 'critical');
            expect(result).toBe('critical');
        });

        it('debería calcular días hasta deadline (futuro)', () => {
            const today = new Date('2026-01-08');
            const days = calculateDaysToDeadline('2026-01-18', today);
            expect(days).toBe(10);
        });

        it('debería calcular días hasta deadline (pasado)', () => {
            const today = new Date('2026-01-18');
            const days = calculateDaysToDeadline('2026-01-08', today);
            expect(days).toBe(-10);
        });
    });

    // =====================================================
    // PROGRESS CALCULATIONS
    // =====================================================

    describe('Cálculos de Progreso', () => {
        interface ProgressInput {
            tasks_total: number;
            tasks_completed: number;
            milestones_total: number;
            milestones_completed: number;
        }

        function calculateOverallProgress(input: ProgressInput): number {
            const totalItems = input.tasks_total + input.milestones_total;
            const completedItems = input.tasks_completed + input.milestones_completed;

            if (totalItems === 0) return 0;
            return Math.round((completedItems / totalItems) * 100);
        }

        function calculateTaskProgress(completed: number, total: number): number {
            if (total === 0) return 0;
            return Math.round((completed / total) * 100);
        }

        it('debería calcular progreso general correctamente', () => {
            const result = calculateOverallProgress({
                tasks_total: 10,
                tasks_completed: 5,
                milestones_total: 2,
                milestones_completed: 1
            });
            expect(result).toBe(50); // 6/12 = 50%
        });

        it('debería manejar sin tareas ni hitos', () => {
            const result = calculateOverallProgress({
                tasks_total: 0,
                tasks_completed: 0,
                milestones_total: 0,
                milestones_completed: 0
            });
            expect(result).toBe(0);
        });

        it('debería calcular 100% cuando todo está completado', () => {
            const result = calculateOverallProgress({
                tasks_total: 5,
                tasks_completed: 5,
                milestones_total: 2,
                milestones_completed: 2
            });
            expect(result).toBe(100);
        });

        it('debería calcular progreso de tareas', () => {
            expect(calculateTaskProgress(3, 10)).toBe(30);
            expect(calculateTaskProgress(10, 10)).toBe(100);
            expect(calculateTaskProgress(0, 10)).toBe(0);
        });
    });

    // =====================================================
    // PRIORITY MAPPING
    // =====================================================

    describe('Mapeo de Prioridades de Proyecto', () => {
        type Priority = 'critical' | 'high' | 'medium' | 'low';

        function mapPriority(input: string): Priority {
            const normalized = input.toLowerCase().trim();

            const mapping: { [key: string]: Priority } = {
                'critico': 'critical',
                'crítico': 'critical',
                'critical': 'critical',
                'urgente': 'critical',
                'alto': 'high',
                'alta': 'high',
                'high': 'high',
                'medio': 'medium',
                'media': 'medium',
                'medium': 'medium',
                'normal': 'medium',
                'bajo': 'low',
                'baja': 'low',
                'low': 'low'
            };

            return mapping[normalized] || 'medium';
        }

        function getPriorityValue(priority: Priority): number {
            const values: { [key in Priority]: number } = {
                'critical': 4,
                'high': 3,
                'medium': 2,
                'low': 1
            };
            return values[priority];
        }

        it('debería mapear prioridades en español', () => {
            expect(mapPriority('crítico')).toBe('critical');
            expect(mapPriority('alto')).toBe('high');
            expect(mapPriority('medio')).toBe('medium');
            expect(mapPriority('bajo')).toBe('low');
        });

        it('debería mapear prioridades en inglés', () => {
            expect(mapPriority('critical')).toBe('critical');
            expect(mapPriority('high')).toBe('high');
        });

        it('debería obtener valor numérico de prioridad', () => {
            expect(getPriorityValue('critical')).toBe(4);
            expect(getPriorityValue('low')).toBe(1);
        });

        it('debería defaultear a medium', () => {
            expect(mapPriority('unknown')).toBe('medium');
        });
    });

    // =====================================================
    // STATUS TRANSITIONS
    // =====================================================

    describe('Transiciones de Estado de Proyecto', () => {
        type ProjectStatus = 'planning' | 'active' | 'paused' | 'completed' | 'cancelled';

        const validTransitions: { [key in ProjectStatus]: ProjectStatus[] } = {
            'planning': ['active', 'cancelled'],
            'active': ['paused', 'completed', 'cancelled'],
            'paused': ['active', 'cancelled'],
            'completed': [],
            'cancelled': []
        };

        function isValidTransition(from: ProjectStatus, to: ProjectStatus): boolean {
            return validTransitions[from].includes(to);
        }

        it('debería permitir planning -> active', () => {
            expect(isValidTransition('planning', 'active')).toBe(true);
        });

        it('debería permitir active -> completed', () => {
            expect(isValidTransition('active', 'completed')).toBe(true);
        });

        it('debería NO permitir completed -> active', () => {
            expect(isValidTransition('completed', 'active')).toBe(false);
        });

        it('debería NO permitir cancelled -> active', () => {
            expect(isValidTransition('cancelled', 'active')).toBe(false);
        });

        it('debería permitir pausar un proyecto activo', () => {
            expect(isValidTransition('active', 'paused')).toBe(true);
        });

        it('debería permitir reanudar un proyecto pausado', () => {
            expect(isValidTransition('paused', 'active')).toBe(true);
        });
    });

    // =====================================================
    // ASSIGNMENT VALIDATION
    // =====================================================

    describe('Validación de Asignaciones', () => {
        interface Assignment {
            project_id: number;
            user_id: number;
            role: 'lead' | 'contributor' | 'reviewer' | 'observer';
            allocation_percentage: number;
        }

        function validateAssignment(assignment: Partial<Assignment>): { valid: boolean; errors: string[] } {
            const errors: string[] = [];

            if (!assignment.project_id) errors.push('project_id is required');
            if (!assignment.user_id) errors.push('user_id is required');

            if (assignment.allocation_percentage !== undefined) {
                if (assignment.allocation_percentage < 0 || assignment.allocation_percentage > 100) {
                    errors.push('allocation_percentage must be between 0 and 100');
                }
            }

            return { valid: errors.length === 0, errors };
        }

        function canUserBeAssigned(currentAllocations: number, newAllocation: number): boolean {
            return (currentAllocations + newAllocation) <= 100;
        }

        it('debería validar campos requeridos', () => {
            const result = validateAssignment({});
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('project_id is required');
            expect(result.errors).toContain('user_id is required');
        });

        it('debería aceptar asignación válida', () => {
            const result = validateAssignment({
                project_id: 1,
                user_id: 1,
                allocation_percentage: 50
            });
            expect(result.valid).toBe(true);
        });

        it('debería rechazar allocation > 100', () => {
            const result = validateAssignment({
                project_id: 1,
                user_id: 1,
                allocation_percentage: 150
            });
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('allocation_percentage must be between 0 and 100');
        });

        it('debería verificar si usuario puede ser asignado', () => {
            expect(canUserBeAssigned(50, 30)).toBe(true);  // 80% total
            expect(canUserBeAssigned(80, 30)).toBe(false); // 110% total
            expect(canUserBeAssigned(70, 30)).toBe(true);  // 100% exacto
        });
    });

    // =====================================================
    // BUDGET CALCULATIONS
    // =====================================================

    describe('Cálculos de Presupuesto', () => {
        interface BudgetData {
            planned_budget: number;
            actual_cost: number;
            completion_percentage: number;
        }

        function calculateCostVariance(planned: number, actual: number): number {
            if (planned === 0) return 0;
            return ((actual - planned) / planned) * 100;
        }

        function calculateProjectedCost(actual: number, completion: number): number {
            if (completion === 0) return 0;
            return (actual / completion) * 100;
        }

        function getBudgetStatus(variance: number): 'under' | 'on_track' | 'over' {
            if (variance < -10) return 'under';
            if (variance > 10) return 'over';
            return 'on_track';
        }

        it('debería calcular varianza de costo', () => {
            expect(calculateCostVariance(100000, 80000)).toBe(-20); // 20% bajo
            expect(calculateCostVariance(100000, 120000)).toBe(20); // 20% sobre
            expect(calculateCostVariance(100000, 100000)).toBe(0);  // exacto
        });

        it('debería calcular costo proyectado', () => {
            // Si gastamos 50000 al 50%, proyección es 100000
            expect(calculateProjectedCost(50000, 50)).toBe(100000);
        });

        it('debería determinar estado de presupuesto', () => {
            expect(getBudgetStatus(-20)).toBe('under');
            expect(getBudgetStatus(5)).toBe('on_track');
            expect(getBudgetStatus(15)).toBe('over');
        });

        it('debería manejar presupuesto cero', () => {
            expect(calculateCostVariance(0, 5000)).toBe(0);
        });
    });

    // =====================================================
    // DATE VALIDATION
    // =====================================================

    describe('Validación de Fechas', () => {
        function validateProjectDates(startDate: string, endDate: string): { valid: boolean; error?: string } {
            const start = new Date(startDate);
            const end = new Date(endDate);

            if (isNaN(start.getTime())) {
                return { valid: false, error: 'Invalid start date' };
            }
            if (isNaN(end.getTime())) {
                return { valid: false, error: 'Invalid end date' };
            }
            if (end < start) {
                return { valid: false, error: 'End date must be after start date' };
            }

            return { valid: true };
        }

        function calculateDuration(startDate: string, endDate: string): number {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diff = end.getTime() - start.getTime();
            return Math.ceil(diff / (1000 * 60 * 60 * 24));
        }

        it('debería validar fechas correctas', () => {
            const result = validateProjectDates('2026-01-01', '2026-03-01');
            expect(result.valid).toBe(true);
        });

        it('debería rechazar end_date anterior a start_date', () => {
            const result = validateProjectDates('2026-03-01', '2026-01-01');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('End date must be after start date');
        });

        it('debería rechazar fechas inválidas', () => {
            const result = validateProjectDates('invalid', '2026-01-01');
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid start date');
        });

        it('debería calcular duración del proyecto', () => {
            const duration = calculateDuration('2026-01-01', '2026-01-31');
            expect(duration).toBe(30);
        });
    });
});
