/**
 * Tests de Regresión - Feature F03: ROI y Finanzas
 * 
 * Estos tests verifican que los cálculos financieros funcionan correctamente.
 * Ejecutar antes de modificar cualquier código relacionado con finanzas.
 */

describe('ROI Calculations - Regression Tests', () => {

    describe('Cálculo de Costo por Usuario', () => {
        const MONTHLY_HOURS = 176; // Horas laborales mensuales Chile

        function calculateHourlyCost(monthlySalary: number): number {
            return monthlySalary / MONTHLY_HOURS;
        }

        it('debería calcular costo por hora correctamente', () => {
            const monthlySalary = 2500000; // CLP
            const expected = 2500000 / 176;
            expect(calculateHourlyCost(monthlySalary)).toBeCloseTo(expected, 2);
        });

        it('debería manejar salarios en diferentes rangos', () => {
            const salaries = [1500000, 2000000, 3000000, 4500000];
            salaries.forEach(salary => {
                const hourly = calculateHourlyCost(salary);
                expect(hourly).toBeGreaterThan(0);
                expect(hourly).toBeLessThan(salary);
            });
        });
    });

    describe('Cálculo de Costo Multi-Usuario', () => {
        interface UserAssignment {
            userId: number;
            hourlyCost: number;
            allocationPercentage: number;
        }

        function calculateProjectCost(
            assignments: UserAssignment[],
            projectHours: number
        ): number {
            return assignments.reduce((total, assignment) => {
                const userCost = assignment.hourlyCost *
                    (assignment.allocationPercentage / 100) *
                    projectHours;
                return total + userCost;
            }, 0);
        }

        it('debería calcular costo con un solo usuario al 100%', () => {
            const assignments = [
                { userId: 1, hourlyCost: 14204, allocationPercentage: 100 }
            ];
            const cost = calculateProjectCost(assignments, 100);
            expect(cost).toBeCloseTo(1420400, 0);
        });

        it('debería calcular costo con múltiples usuarios', () => {
            const assignments = [
                { userId: 1, hourlyCost: 14204, allocationPercentage: 50 },  // Team Lead 50%
                { userId: 2, hourlyCost: 11364, allocationPercentage: 100 }, // Dev 100%
                { userId: 3, hourlyCost: 11364, allocationPercentage: 75 },  // Dev 75%
            ];
            const projectHours = 100;

            // Cálculo manual:
            // User 1: 14204 * 0.50 * 100 = 710,200
            // User 2: 11364 * 1.00 * 100 = 1,136,400
            // User 3: 11364 * 0.75 * 100 = 852,300
            // Total: 2,698,900

            const cost = calculateProjectCost(assignments, projectHours);
            expect(cost).toBeCloseTo(2698900, 0);
        });

        it('debería retornar 0 si no hay asignaciones', () => {
            const cost = calculateProjectCost([], 100);
            expect(cost).toBe(0);
        });
    });

    describe('Cálculo de ROI', () => {
        function calculateROI(salePrice: number, actualCost: number): number {
            if (actualCost === 0) return 0;
            return ((salePrice - actualCost) / actualCost) * 100;
        }

        it('debería calcular ROI positivo correctamente', () => {
            const salePrice = 5000000;
            const actualCost = 2500000;
            const roi = calculateROI(salePrice, actualCost);
            expect(roi).toBe(100); // 100% ROI
        });

        it('debería calcular ROI negativo (pérdida)', () => {
            const salePrice = 2000000;
            const actualCost = 3000000;
            const roi = calculateROI(salePrice, actualCost);
            expect(roi).toBeCloseTo(-33.33, 1);
        });

        it('debería manejar costo cero', () => {
            const roi = calculateROI(5000000, 0);
            expect(roi).toBe(0);
        });
    });

    describe('Alertas de ROI', () => {
        function shouldTriggerAlert(
            costPercentage: number,
            roiPercentage: number
        ): { costAlert: boolean; roiAlert: boolean } {
            return {
                costAlert: costPercentage > 80,
                roiAlert: roiPercentage < 20
            };
        }

        it('debería alertar cuando costo supera 80%', () => {
            const alerts = shouldTriggerAlert(85, 50);
            expect(alerts.costAlert).toBe(true);
            expect(alerts.roiAlert).toBe(false);
        });

        it('debería alertar cuando ROI es menor a 20%', () => {
            const alerts = shouldTriggerAlert(50, 15);
            expect(alerts.costAlert).toBe(false);
            expect(alerts.roiAlert).toBe(true);
        });

        it('debería alertar ambos cuando aplica', () => {
            const alerts = shouldTriggerAlert(90, 10);
            expect(alerts.costAlert).toBe(true);
            expect(alerts.roiAlert).toBe(true);
        });

        it('no debería alertar en condiciones normales', () => {
            const alerts = shouldTriggerAlert(60, 45);
            expect(alerts.costAlert).toBe(false);
            expect(alerts.roiAlert).toBe(false);
        });
    });
});
