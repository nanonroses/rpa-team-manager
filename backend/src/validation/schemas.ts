import { z } from 'zod';

// User validation schemas
// Note: password length/complexity is enforced at creation/change time (createUserSchema),
// not at login - existing accounts must not be locked out by a stricter login policy.
export const loginSchema = z.object({
    email: z.string().email('Invalid email format').max(100),
    password: z.string().min(1, 'Password is required').max(128)
});

export const createUserSchema = z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
    email: z.string().email('Invalid email format').max(100),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    full_name: z.string().min(2).max(100),
    role: z.enum(['team_lead', 'rpa_developer', 'rpa_operations', 'it_support'])
});

// Project validation schemas
export const createProjectSchema = z.object({
    name: z.string().min(1, 'Project name is required').max(200),
    description: z.string().max(1000).optional(),
    status: z.enum(['planning', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    budget: z.number().positive('Budget must be positive').max(999999999.99).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    assigned_to: z.number().int().positive().optional().nullable()
});

export const updateProjectSchema = createProjectSchema.extend({
    actual_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    actual_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    progress_percentage: z.number().int().min(0).max(100).optional()
}).partial();

// Support validation schemas
export const createSupportCompanySchema = z.object({
    company_name: z.string().min(1, 'Company name is required').max(200),
    contact_person: z.string().max(100).optional(),
    email: z.string().email('Invalid email format').max(100).optional(),
    phone: z.string().max(20).regex(/^[\+]?[0-9\-\s\(\)]+$/, 'Invalid phone format').optional(),
    contracted_hours_monthly: z.number().int().min(0).max(999),
    hourly_rate: z.number().positive('Hourly rate must be positive').max(9999.99),
    hourly_rate_extra: z.number().min(0).max(9999.99).optional(),
    hourly_rate_currency: z.enum(['USD', 'UF', 'CLP']),
    status: z.enum(['active', 'inactive', 'suspended']).optional(),
    address: z.string().max(500).optional(),
    notes: z.string().max(2000).optional(),
    contract_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    contract_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional()
});

export const updateSupportCompanySchema = createSupportCompanySchema.partial();

// PMO validation schemas
export const createMilestoneSchema = z.object({
    project_id: z.number().int().positive('Valid project ID required'),
    name: z.string().min(1, 'Milestone name is required').max(200),
    description: z.string().max(500).optional(),
    milestone_type: z.enum(['delivery', 'review', 'approval', 'testing', 'deployment']).optional(),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
    actual_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    responsible_user_id: z.number().int().positive().optional(),
    impact_on_timeline: z.number().int().min(-365).max(365).optional(),
    responsibility: z.string().max(50).optional(),
    blocking_reason: z.string().max(1000).optional(),
    delay_justification: z.string().max(1000).optional(),
    external_contact: z.string().max(200).optional(),
    estimated_delay_days: z.number().int().optional(),
    financial_impact: z.number().optional(),
    status: z.string().max(50).optional()
});

// Task validation schemas
export const createTaskSchema = z.object({
    board_id: z.number().int().positive('Valid board ID required'),
    column_id: z.number().int().positive('Valid column ID required'),
    title: z.string().min(1, 'Task title is required').max(255),
    description: z.string().max(2000).optional(),
    task_type: z.enum(['task', 'bug', 'feature', 'research', 'documentation']).optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    assignee_id: z.number().int().positive().optional(),
    assignee_ids: z.array(z.number().int().positive()).optional(),
    story_points: z.number().int().min(0).max(100).optional(),
    estimated_hours: z.number().positive().max(9999.99).optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Date must be in YYYY-MM-DD format').optional().nullable()
});

// ID parameter validation
export const idParamSchema = z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a positive integer').transform(Number)
});

// Query parameter validation
export const paginationSchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).refine(val => !val || val <= 100, 'Limit cannot exceed 100').optional()
});

export const dateRangeSchema = z.object({
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional()
});

// File upload validation
export const fileUploadSchema = z.object({
    filename: z.string().min(1).max(255).refine(
        (name) => /^[a-zA-Z0-9._-]+$/.test(name),
        'Filename contains invalid characters'
    ),
    mimetype: z.string().refine(
        (type) => ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(type),
        'File type not allowed'
    ),
    size: z.number().max(10 * 1024 * 1024, 'File size cannot exceed 10MB')
});

// Time entry validation
// Note: user_id is derived server-side from the authenticated session, never from the client body.
export const createTimeEntrySchema = z.object({
    project_id: z.number().int().positive('Valid project ID required'),
    task_id: z.number().int().positive('Valid task ID required').optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    hours: z.number().positive('Hours must be positive').max(24, 'Hours cannot exceed 24 per day'),
    description: z.string().max(500).optional(),
    start_time: z.string().max(20).optional(),
    end_time: z.string().max(20).optional(),
    is_billable: z.boolean().optional()
});

// Billing / Payment Milestones validation schemas (Fase 2)
export const createPaymentMilestoneSchema = z.object({
    project_id: z.number().int().positive('Valid project ID required'),
    project_milestone_id: z.number().int().positive().optional().nullable(),
    name: z.string().min(1, 'Milestone name is required').max(200),
    description: z.string().max(1000).optional(),
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['CLP', 'USD', 'UF']),
    trigger_type: z.enum(['date', 'progress_pct', 'deliverable_approved']),
    trigger_value: z.number().min(0).max(100).optional().nullable(),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    sort_order: z.number().int().optional()
}).refine(
    (data) => data.trigger_type !== 'progress_pct' || (data.trigger_value !== null && data.trigger_value !== undefined),
    { message: 'trigger_value is required when trigger_type is progress_pct', path: ['trigger_value'] }
).refine(
    (data) => (data.trigger_type !== 'progress_pct' && data.trigger_type !== 'deliverable_approved') || !!data.project_milestone_id,
    { message: 'project_milestone_id is required for progress_pct and deliverable_approved triggers', path: ['project_milestone_id'] }
).refine(
    (data) => data.trigger_type !== 'date' || !!data.planned_date,
    { message: 'planned_date is required when trigger_type is date', path: ['planned_date'] }
);

export const updatePaymentMilestoneSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    amount: z.number().positive().optional(),
    currency: z.enum(['CLP', 'USD', 'UF']).optional(),
    planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional().nullable(),
    trigger_value: z.number().min(0).max(100).optional().nullable(),
    sort_order: z.number().int().optional()
});

export const createInvoiceSchema = z.object({
    project_id: z.number().int().positive('Valid project ID required'),
    invoice_number: z.string().min(1, 'Invoice number is required').max(50),
    issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    payment_milestone_ids: z.array(z.number().int().positive()).min(1, 'At least one payment milestone is required'),
    notes: z.string().max(2000).optional()
});

export const createPaymentSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
    currency: z.enum(['CLP', 'USD', 'UF']),
    payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    method: z.string().max(50).optional(),
    reference: z.string().max(100).optional(),
    notes: z.string().max(1000).optional()
});

// Timesheet validation schemas (Fase 3)
export const saveWeekEntrySchema = z.object({
    id: z.number().int().positive().optional(),
    project_id: z.number().int().positive('Valid project ID required'),
    task_id: z.number().int().positive().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    hours: z.number().min(0.01, 'Hours must be greater than 0').max(24, 'Hours must be 24 or less'),
    is_billable: z.boolean().optional()
});

export const saveWeekSchema = z.object({
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    entries: z.array(saveWeekEntrySchema)
});

export const submitWeekSchema = z.object({
    week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
});

export const rejectWeekSchema = z.object({
    reason: z.string().min(1, 'A rejection reason is required').max(500)
});