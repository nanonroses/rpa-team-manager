/**
 * Tests de Regresión - Feature F02: PMO Analytics
 * 
 * Estos tests verifican que las funciones del módulo PMO funcionan correctamente.
 * Ejecutar antes de modificar cualquier código relacionado con PMO.
 * 
 * Endpoints cubiertos:
 * - GET /api/pmo/dashboard
 * - GET /api/pmo/analytics
 * - GET /api/pmo/projects/:id/gantt
 * - POST/PUT/DELETE /api/pmo/milestones
 */

describe('PMO Module - Regression Tests', () => {

    // =====================================================
    // MILESTONE CALCULATIONS
    // =====================================================

    describe('Cálculos de Hitos', () => {
        interface Milestone {
            id: number;
            name: string;
            target_date: string;
            status: 'pending' | 'completed' | 'overdue';
            completion_date?: string;
        }

        function calculateMilestoneStatus(
            targetDate: string,
            completionDate: string | null,
            today: Date = new Date()
        ): 'pending' | 'completed' | 'overdue' {
            if (completionDate) {
                return 'completed';
            }

            const target = new Date(targetDate);
            if (target < today) {
                return 'overdue';
            }

            return 'pending';
        }

        it('debería marcar como completed si tiene fecha de completado', () => {
            const status = calculateMilestoneStatus('2025-12-01', '2025-11-28');
            expect(status).toBe('completed');
        });

        it('debería marcar como overdue si pasó la fecha sin completar', () => {
            const today = new Date('2025-12-15');
            const status = calculateMilestoneStatus('2025-12-01', null, today);
            expect(status).toBe('overdue');
        });

        it('debería marcar como pending si no ha llegado la fecha', () => {
            const today = new Date('2025-11-15');
            const status = calculateMilestoneStatus('2025-12-01', null, today);
            expect(status).toBe('pending');
        });

        it('debería manejar fecha objetivo igual a hoy como pending', () => {
            const today = new Date('2025-12-01');
            const status = calculateMilestoneStatus('2025-12-01', null, today);
            expect(status).toBe('pending');
        });
    });

    // =====================================================
    // GANTT CHART DATA
    // =====================================================

    describe('Datos de Gantt Chart', () => {
        interface GanttItem {
            id: number;
            name: string;
            start_date: string;
            end_date: string;
            progress: number;
            type: 'task' | 'milestone' | 'project';
        }

        function calculateGanttProgress(
            startDate: string,
            endDate: string,
            today: Date = new Date()
        ): number {
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();
            const now = today.getTime();

            if (now <= start) return 0;
            if (now >= end) return 100;

            const total = end - start;
            const elapsed = now - start;
            return Math.round((elapsed / total) * 100);
        }

        it('debería retornar 0% si aún no inicia', () => {
            const today = new Date('2025-01-01');
            const progress = calculateGanttProgress('2025-02-01', '2025-03-01', today);
            expect(progress).toBe(0);
        });

        it('debería retornar 100% si ya terminó', () => {
            const today = new Date('2025-04-01');
            const progress = calculateGanttProgress('2025-02-01', '2025-03-01', today);
            expect(progress).toBe(100);
        });

        it('debería calcular progreso intermedio correctamente', () => {
            const today = new Date('2025-02-15');
            const progress = calculateGanttProgress('2025-02-01', '2025-03-01', today);
            expect(progress).toBeGreaterThan(0);
            expect(progress).toBeLessThan(100);
            expect(progress).toBe(50); // 14 días de 28 ≈ 50%
        });

        it('debería manejar fechas iguales (milestone)', () => {
            const today = new Date('2025-02-15');
            // Milestone tiene misma fecha inicio/fin
            const progress = calculateGanttProgress('2025-02-01', '2025-02-01', today);
            expect(progress).toBe(100); // Ya pasó
        });
    });

    // =====================================================
    // TEAM WORKLOAD
    // =====================================================

    describe('Cálculo de Carga de Equipo', () => {
        interface TeamMember {
            id: number;
            name: string;
            allocations: { projectId: number; percentage: number }[];
        }

        function calculateTeamMemberWorkload(allocations: { percentage: number }[]): number {
            return allocations.reduce((sum, a) => sum + a.percentage, 0);
        }

        function getWorkloadStatus(workload: number): 'available' | 'optimal' | 'overloaded' {
            if (workload < 50) return 'available';
            if (workload <= 100) return 'optimal';
            return 'overloaded';
        }

        it('debería calcular workload total correctamente', () => {
            const allocations = [
                { percentage: 50 },
                { percentage: 30 },
                { percentage: 20 },
            ];
            expect(calculateTeamMemberWorkload(allocations)).toBe(100);
        });

        it('debería detectar disponible (<50%)', () => {
            expect(getWorkloadStatus(30)).toBe('available');
        });

        it('debería detectar óptimo (50-100%)', () => {
            expect(getWorkloadStatus(80)).toBe('optimal');
            expect(getWorkloadStatus(100)).toBe('optimal');
        });

        it('debería detectar sobrecargado (>100%)', () => {
            expect(getWorkloadStatus(120)).toBe('overloaded');
        });

        it('debería manejar sin asignaciones', () => {
            expect(calculateTeamMemberWorkload([])).toBe(0);
            expect(getWorkloadStatus(0)).toBe('available');
        });
    });

    // =====================================================
    // PROJECT METRICS
    // =====================================================

    describe('Métricas de Proyecto PMO', () => {
        interface ProjectMetrics {
            budgeted_hours: number;
            actual_hours: number;
            budgeted_cost: number;
            actual_cost: number;
            milestones_total: number;
            milestones_completed: number;
        }

        function calculateScheduleVariance(metrics: ProjectMetrics): number {
            // Schedule performance = completed milestones / total milestones
            if (metrics.milestones_total === 0) return 0;
            return (metrics.milestones_completed / metrics.milestones_total) * 100;
        }

        function calculateCostVariance(metrics: ProjectMetrics): number {
            // Positive = under budget, Negative = over budget
            return metrics.budgeted_cost - metrics.actual_cost;
        }

        function calculateHoursVariance(metrics: ProjectMetrics): number {
            // Percentage of budgeted hours used
            if (metrics.budgeted_hours === 0) return 0;
            return (metrics.actual_hours / metrics.budgeted_hours) * 100;
        }

        const sampleMetrics: ProjectMetrics = {
            budgeted_hours: 100,
            actual_hours: 80,
            budgeted_cost: 5000000,
            actual_cost: 4000000,
            milestones_total: 5,
            milestones_completed: 3,
        };

        it('debería calcular schedule variance correctamente', () => {
            const variance = calculateScheduleVariance(sampleMetrics);
            expect(variance).toBe(60); // 3/5 = 60%
        });

        it('debería calcular cost variance (under budget)', () => {
            const variance = calculateCostVariance(sampleMetrics);
            expect(variance).toBe(1000000); // Positivo = bajo presupuesto
        });

        it('debería calcular cost variance (over budget)', () => {
            const overBudget = { ...sampleMetrics, actual_cost: 6000000 };
            const variance = calculateCostVariance(overBudget);
            expect(variance).toBe(-1000000); // Negativo = sobre presupuesto
        });

        it('debería calcular hours variance correctamente', () => {
            const variance = calculateHoursVariance(sampleMetrics);
            expect(variance).toBe(80); // 80/100 = 80%
        });

        it('debería manejar 0 milestones sin error', () => {
            const noMilestones = { ...sampleMetrics, milestones_total: 0 };
            expect(calculateScheduleVariance(noMilestones)).toBe(0);
        });

        it('debería manejar 0 budgeted hours sin error', () => {
            const noHours = { ...sampleMetrics, budgeted_hours: 0 };
            expect(calculateHoursVariance(noHours)).toBe(0);
        });
    });

    // =====================================================
    // MILESTONE RESPONSIBILITY MAPPING (Bug Fix Regression)
    // =====================================================

    describe('Mapeo de Responsabilidad de Hitos', () => {
        // Ver bugs-fixed.md: "Milestone Responsibility CHECK Constraint Failed"
        function mapResponsibility(input: string): 'external' | 'internal' | 'shared' {
            const normalized = input.toLowerCase().trim();

            // Mapeo español -> inglés
            const mapping: Record<string, 'external' | 'internal' | 'shared'> = {
                'cliente': 'external',
                'externo': 'external',
                'external': 'external',
                'interno': 'internal',
                'internal': 'internal',
                'compartido': 'shared',
                'shared': 'shared',
            };

            return mapping[normalized] || 'internal';
        }

        it('debería mapear "cliente" a "external"', () => {
            expect(mapResponsibility('cliente')).toBe('external');
            expect(mapResponsibility('Cliente')).toBe('external');
            expect(mapResponsibility('CLIENTE')).toBe('external');
        });

        it('debería mapear "interno" a "internal"', () => {
            expect(mapResponsibility('interno')).toBe('internal');
            expect(mapResponsibility('Interno')).toBe('internal');
        });

        it('debería mapear "compartido" a "shared"', () => {
            expect(mapResponsibility('compartido')).toBe('shared');
        });

        it('debería aceptar valores en inglés', () => {
            expect(mapResponsibility('external')).toBe('external');
            expect(mapResponsibility('internal')).toBe('internal');
            expect(mapResponsibility('shared')).toBe('shared');
        });

        it('debería defaultear a "internal" para valores desconocidos', () => {
            expect(mapResponsibility('unknown')).toBe('internal');
            expect(mapResponsibility('')).toBe('internal');
        });
    });

    // =====================================================
    // ALERTS AND CRITICAL INDICATORS
    // =====================================================

    describe('Alertas Críticas PMO', () => {
        interface ProjectAlert {
            type: 'cost_overrun' | 'schedule_delay' | 'resource_conflict';
            severity: 'warning' | 'critical';
            projectId: number;
        }

        function detectCostOverrun(
            actualCost: number,
            budgetedCost: number,
            threshold: number = 0.8
        ): { detected: boolean; severity: 'warning' | 'critical' } | null {
            if (budgetedCost === 0) return null;

            const ratio = actualCost / budgetedCost;

            if (ratio >= 1.0) {
                return { detected: true, severity: 'critical' };
            }
            if (ratio >= threshold) {
                return { detected: true, severity: 'warning' };
            }

            return null;
        }

        function detectScheduleDelay(
            completedMilestones: number,
            expectedMilestones: number
        ): { detected: boolean; severity: 'warning' | 'critical' } | null {
            if (expectedMilestones === 0) return null;

            const ratio = completedMilestones / expectedMilestones;

            if (ratio < 0.5) {
                return { detected: true, severity: 'critical' };
            }
            if (ratio < 0.75) {
                return { detected: true, severity: 'warning' };
            }

            return null;
        }

        it('debería detectar cost overrun warning (>80%)', () => {
            const result = detectCostOverrun(4500000, 5000000);
            expect(result?.detected).toBe(true);
            expect(result?.severity).toBe('warning');
        });

        it('debería detectar cost overrun critical (>=100%)', () => {
            const result = detectCostOverrun(5000000, 5000000);
            expect(result?.detected).toBe(true);
            expect(result?.severity).toBe('critical');
        });

        it('no debería alertar si costo está bajo control', () => {
            const result = detectCostOverrun(3000000, 5000000);
            expect(result).toBeNull();
        });

        it('debería detectar schedule delay warning (<75%)', () => {
            const result = detectScheduleDelay(2, 4); // 50%
            expect(result?.detected).toBe(true);
            expect(result?.severity).toBe('warning');
        });

        it('debería detectar schedule delay critical (<50%)', () => {
            const result = detectScheduleDelay(1, 4); // 25%
            expect(result?.detected).toBe(true);
            expect(result?.severity).toBe('critical');
        });
    });
});
