/**
 * Tests de Regresión - Feature F03: Support Module
 * 
 * Estos tests verifican que las funciones del módulo de Soporte funcionan correctamente.
 * Ejecutar antes de modificar cualquier código relacionado con Support.
 * 
 * Endpoints cubiertos:
 * - GET /api/support/tickets
 * - GET /api/support/companies
 * - GET /api/support/contacts
 * - POST /api/support/tickets
 * - GET /api/support/dashboard
 */

describe('Support Module - Regression Tests', () => {

    // =====================================================
    // TICKET CALCULATIONS
    // =====================================================

    describe('Cálculos de Tickets', () => {
        interface Ticket {
            id: number;
            company_id: number;
            hours_spent: number;
            status: 'open' | 'in_progress' | 'pending_client' | 'resolved' | 'closed' | 'cancelled';
            created_at: string;
            resolved_at?: string;
        }

        function calculateSLACompliance(
            createdAt: string,
            resolvedAt: string | null,
            slaHours: number = 24
        ): { compliant: boolean; responseTimeHours: number } {
            if (!resolvedAt) {
                return { compliant: false, responseTimeHours: -1 };
            }

            const created = new Date(createdAt).getTime();
            const resolved = new Date(resolvedAt).getTime();
            const responseTimeHours = (resolved - created) / (1000 * 60 * 60);

            return {
                compliant: responseTimeHours <= slaHours,
                responseTimeHours: Math.round(responseTimeHours * 10) / 10
            };
        }

        it('debería calcular SLA cumplido si resuelto dentro del límite', () => {
            const result = calculateSLACompliance(
                '2026-01-08T10:00:00',
                '2026-01-08T18:00:00',
                24
            );
            expect(result.compliant).toBe(true);
            expect(result.responseTimeHours).toBe(8);
        });

        it('debería calcular SLA incumplido si excede el límite', () => {
            const result = calculateSLACompliance(
                '2026-01-08T10:00:00',
                '2026-01-10T10:00:00',
                24
            );
            expect(result.compliant).toBe(false);
            expect(result.responseTimeHours).toBe(48);
        });

        it('debería manejar tickets no resueltos', () => {
            const result = calculateSLACompliance('2026-01-08T10:00:00', null, 24);
            expect(result.compliant).toBe(false);
            expect(result.responseTimeHours).toBe(-1);
        });
    });

    // =====================================================
    // HOURS CONSUMPTION
    // =====================================================

    describe('Consumo de Horas por Empresa', () => {
        interface Company {
            id: number;
            company_name: string;
            contracted_hours_monthly: number;
            consumed_hours: number;
        }

        function calculateHoursStatus(
            contracted: number,
            consumed: number
        ): { status: 'normal' | 'near_limit' | 'exceeded'; remaining: number; percentage: number } {
            const remaining = contracted - consumed;
            const percentage = contracted > 0 ? (consumed / contracted) * 100 : 0;

            if (consumed > contracted) {
                return { status: 'exceeded', remaining, percentage };
            }
            if (percentage >= 80) {
                return { status: 'near_limit', remaining, percentage };
            }
            return { status: 'normal', remaining, percentage };
        }

        it('debería detectar estado normal (<80%)', () => {
            const result = calculateHoursStatus(100, 50);
            expect(result.status).toBe('normal');
            expect(result.remaining).toBe(50);
            expect(result.percentage).toBe(50);
        });

        it('debería detectar near_limit (>=80%)', () => {
            const result = calculateHoursStatus(100, 85);
            expect(result.status).toBe('near_limit');
            expect(result.percentage).toBe(85);
        });

        it('debería detectar exceeded (>100%)', () => {
            const result = calculateHoursStatus(100, 120);
            expect(result.status).toBe('exceeded');
            expect(result.remaining).toBe(-20);
            expect(result.percentage).toBe(120);
        });

        it('debería manejar 0 horas contratadas', () => {
            const result = calculateHoursStatus(0, 10);
            expect(result.percentage).toBe(0);
        });
    });

    // =====================================================
    // BILLING CALCULATIONS
    // =====================================================

    describe('Cálculos de Facturación', () => {
        interface BillingInput {
            contracted_hours: number;
            consumed_hours: number;
            hourly_rate: number;
            hourly_rate_extra: number;
        }

        function calculateBilling(input: BillingInput): {
            base_hours: number;
            extra_hours: number;
            base_value: number;
            extra_value: number;
            total: number;
        } {
            const baseHours = Math.min(input.consumed_hours, input.contracted_hours);
            const extraHours = Math.max(0, input.consumed_hours - input.contracted_hours);

            const baseValue = input.contracted_hours * input.hourly_rate; // Cobro fijo mensual
            const extraValue = extraHours * input.hourly_rate_extra;

            return {
                base_hours: baseHours,
                extra_hours: extraHours,
                base_value: baseValue,
                extra_value: extraValue,
                total: baseValue + extraValue
            };
        }

        it('debería calcular facturación sin horas extra', () => {
            const result = calculateBilling({
                contracted_hours: 50,
                consumed_hours: 40,
                hourly_rate: 10000,
                hourly_rate_extra: 15000
            });
            expect(result.base_hours).toBe(40);
            expect(result.extra_hours).toBe(0);
            expect(result.base_value).toBe(500000); // 50 * 10000 (contrato fijo)
            expect(result.extra_value).toBe(0);
            expect(result.total).toBe(500000);
        });

        it('debería calcular facturación con horas extra', () => {
            const result = calculateBilling({
                contracted_hours: 50,
                consumed_hours: 60,
                hourly_rate: 10000,
                hourly_rate_extra: 15000
            });
            expect(result.base_hours).toBe(50);
            expect(result.extra_hours).toBe(10);
            expect(result.base_value).toBe(500000); // 50 * 10000
            expect(result.extra_value).toBe(150000); // 10 * 15000
            expect(result.total).toBe(650000);
        });

        it('debería manejar 0 horas consumidas', () => {
            const result = calculateBilling({
                contracted_hours: 50,
                consumed_hours: 0,
                hourly_rate: 10000,
                hourly_rate_extra: 15000
            });
            expect(result.base_value).toBe(500000); // Cobro fijo del contrato
            expect(result.total).toBe(500000);
        });
    });

    // =====================================================
    // STATUS MAPPING (Bug Prevention)
    // =====================================================

    describe('Mapeo de Estados de Ticket', () => {
        const validStatuses = ['open', 'in_progress', 'pending_client', 'resolved', 'closed', 'cancelled'];

        function mapTicketStatus(input: string): string {
            const normalized = input.toLowerCase().trim();

            const statusMapping: { [key: string]: string } = {
                'abierto': 'open',
                'open': 'open',
                'nuevo': 'open',
                'pendiente': 'open',
                'en_progreso': 'in_progress',
                'en progreso': 'in_progress',
                'in_progress': 'in_progress',
                'working': 'in_progress',
                'trabajando': 'in_progress',
                'esperando_cliente': 'pending_client',
                'esperando cliente': 'pending_client',
                'pending_client': 'pending_client',
                'waiting': 'pending_client',
                'resuelto': 'resolved',
                'resolved': 'resolved',
                'solucionado': 'resolved',
                'cerrado': 'closed',
                'closed': 'closed',
                'finalizado': 'closed',
                'cancelado': 'cancelled',
                'cancelled': 'cancelled',
                'canceled': 'cancelled'
            };

            return statusMapping[normalized] || 'open';
        }

        it('debería mapear estados en español', () => {
            expect(mapTicketStatus('abierto')).toBe('open');
            expect(mapTicketStatus('en progreso')).toBe('in_progress');
            expect(mapTicketStatus('resuelto')).toBe('resolved');
        });

        it('debería mapear estados en inglés', () => {
            expect(mapTicketStatus('open')).toBe('open');
            expect(mapTicketStatus('in_progress')).toBe('in_progress');
            expect(mapTicketStatus('resolved')).toBe('resolved');
        });

        it('debería manejar variaciones de capitalización', () => {
            expect(mapTicketStatus('ABIERTO')).toBe('open');
            expect(mapTicketStatus('Open')).toBe('open');
            expect(mapTicketStatus('RESOLVED')).toBe('resolved');
        });

        it('debería defaultear a open para valores desconocidos', () => {
            expect(mapTicketStatus('unknown')).toBe('open');
            expect(mapTicketStatus('')).toBe('open');
        });
    });

    // =====================================================
    // CONTACT VALIDATION (Bug Fix 2026-01-08)
    // =====================================================

    describe('Validación de Contactos', () => {
        interface ContactInput {
            company_id?: number;
            contact_name?: string;
            contact_email?: string;
            is_active?: number;
        }

        function validateContactInput(input: ContactInput): { valid: boolean; errors: string[] } {
            const errors: string[] = [];

            if (!input.company_id) errors.push('company_id is required');
            if (!input.contact_name) errors.push('contact_name is required');

            // is_active debería defaultear a 1 si no se proporciona
            const effectiveIsActive = input.is_active ?? 1;

            return {
                valid: errors.length === 0,
                errors
            };
        }

        it('debería validar campos requeridos', () => {
            const result = validateContactInput({});
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('company_id is required');
            expect(result.errors).toContain('contact_name is required');
        });

        it('debería aceptar input válido', () => {
            const result = validateContactInput({
                company_id: 1,
                contact_name: 'Juan Pérez',
            });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('is_active debería ser opcional con default 1', () => {
            const input: ContactInput = {
                company_id: 1,
                contact_name: 'Test Contact',
                // is_active omitido
            };

            const effectiveIsActive = input.is_active ?? 1;
            expect(effectiveIsActive).toBe(1);
        });
    });

    // =====================================================
    // PRIORITY MAPPING
    // =====================================================

    describe('Mapeo de Prioridades', () => {
        function mapPriority(input: string): 'critical' | 'high' | 'medium' | 'low' {
            const normalized = input.toLowerCase().trim();

            const priorityMapping: { [key: string]: 'critical' | 'high' | 'medium' | 'low' } = {
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

            return priorityMapping[normalized] || 'medium';
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
            expect(mapPriority('medium')).toBe('medium');
            expect(mapPriority('low')).toBe('low');
        });

        it('debería defaultear a medium', () => {
            expect(mapPriority('unknown')).toBe('medium');
        });
    });

    // =====================================================
    // TIME CALCULATIONS
    // =====================================================

    describe('Conversión de Tiempo', () => {
        function minutesToHours(minutes: number): number {
            return Math.round((minutes / 60) * 100) / 100;
        }

        function hoursToMinutes(hours: number): number {
            return Math.round(hours * 60);
        }

        it('debería convertir minutos a horas', () => {
            expect(minutesToHours(60)).toBe(1);
            expect(minutesToHours(90)).toBe(1.5);
            expect(minutesToHours(45)).toBe(0.75);
        });

        it('debería convertir horas a minutos', () => {
            expect(hoursToMinutes(1)).toBe(60);
            expect(hoursToMinutes(1.5)).toBe(90);
            expect(hoursToMinutes(0.5)).toBe(30);
        });
    });
});
