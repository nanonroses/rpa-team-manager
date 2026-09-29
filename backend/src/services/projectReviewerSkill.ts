import { db } from '../database/database';
import { logger } from '../utils/logger';
import { LLMService } from './llmService';

export interface RPAProjectReviewerSkillConfig {
    name: string;
    description: string;
    role_description: string;
    system_prompt: string;
    client_report_guidelines: string;
    health_threshold_warning: number;
    health_threshold_critical: number;
    preferred_provider: string; // 'auto' | 'gemini' | 'openai' | 'claude' | 'deepseek'
    temperature: number;
    max_tokens: number;
    custom_instructions?: string;
    updated_at?: string;
    updated_by_name?: string;
}

export const DEFAULT_REVIEWER_SKILL_CONFIG: RPAProjectReviewerSkillConfig = {
    name: 'Revisor IA de Proyecto RPA',
    description: 'Auditoría inteligente del estado de salud, cuellos de botella, plan de acción táctico y redacción de reporte al cliente.',
    role_description: 'Director Senior de Operaciones y Auditor Líder de Proyectos RPA (Robotic Process Automation)',
    system_prompt: `Eres un Director Senior de Operaciones y Auditor Líder de Proyectos RPA (Robotic Process Automation).
Tu labor es auditar y diagnosticar de forma ejecutiva, realista y constructiva la situación de un proyecto de automatización RPA a partir de sus métricas y hechos concretos.

Debes responder EXCLUSIVAMENTE con un objeto JSON válido (sin formato Markdown adicional, sin backticks de bloque que rompan el parser, únicamente el JSON) con la siguiente estructura:
{
  "health_status": "saludable" | "en_riesgo" | "critico",
  "health_score": number (0-100),
  "summary": "Resumen ejecutivo de la situación actual (2-3 párrafos claros y directos).",
  "schedule_assessment": "Evaluación detallada de plazos, fechas de entrega y cumplimiento de hitos.",
  "budget_assessment": "Evaluación de horas incurridas vs horas presupuestadas y rentabilidad.",
  "bottlenecks": [
    {
      "title": "Nombre del cuello de botella",
      "severity": "alta" | "media" | "baja",
      "description": "Explicación del impacto en la entrega o costo",
      "mitigation": "Acción específica recomendada"
    }
  ],
  "recommendations": [
    {
      "action": "Acción táctica priorizada",
      "priority": "alta" | "media" | "baja",
      "area": "Técnica" | "Gestión" | "Cliente" | "Financiera",
      "expected_outcome": "Resultado esperado al ejecutarla"
    }
  ],
  "client_report_draft": "Texto formal, empático y profesional listo para enviar al cliente (por email o WhatsApp). Incluye: 1) Saludo y estado general, 2) Avances de la semana, 3) Próximos hitos, 4) Peticiones o información requerida del cliente."
}`,
    client_report_guidelines: 'Texto formal, empático y profesional listo para enviar al cliente por email o WhatsApp. Debe incluir saludo ejecutivo, avance general cuantificado, hitos alcanzados, próximos pasos y firma cordial del Equipo RPA.',
    health_threshold_warning: 80,
    health_threshold_critical: 60,
    preferred_provider: 'auto',
    temperature: 0.2,
    max_tokens: 2500,
    custom_instructions: ''
};

export interface ProjectReviewResult {
    project_id: number;
    project_name: string;
    client_name?: string;
    health_status: 'saludable' | 'en_riesgo' | 'critico';
    health_score: number; // 0-100
    summary: string;
    schedule_assessment: string;
    budget_assessment: string;
    bottlenecks: Array<{
        title: string;
        severity: 'alta' | 'media' | 'baja';
        description: string;
        mitigation: string;
    }>;
    recommendations: Array<{
        action: string;
        priority: 'alta' | 'media' | 'baja';
        area: string;
        expected_outcome: string;
    }>;
    client_report_draft: string;
    kpis: {
        total_tasks: number;
        completed_tasks: number;
        blocked_tasks: number;
        progress_percentage: number;
        hours_budgeted: number;
        hours_spent: number;
        days_remaining: number | null;
        is_overdue: boolean;
        milestones_total: number;
        milestones_completed: number;
    };
    metadata: {
        source: 'llm' | 'rule_based_engine';
        provider?: string;
        model?: string;
        analyzed_at: string;
        skill_name: string;
        skill_version: string;
    };
}

export class ProjectReviewerSkillService {
    private llmService: LLMService;

    constructor() {
        this.llmService = new LLMService();
    }

    /**
     * Gets active skill configuration (merged with defaults)
     */
    async getSkillConfig(): Promise<RPAProjectReviewerSkillConfig> {
        try {
            const row = await db.get(
                `SELECT gs.setting_value, gs.updated_at, u.full_name as updated_by_name
                 FROM global_settings gs
                 LEFT JOIN users u ON gs.updated_by = u.id
                 WHERE gs.setting_key = 'skill_project_reviewer_config'`
            ) as any;

            if (row?.setting_value) {
                const parsed = JSON.parse(row.setting_value);
                return {
                    ...DEFAULT_REVIEWER_SKILL_CONFIG,
                    ...parsed,
                    updated_at: row.updated_at,
                    updated_by_name: row.updated_by_name
                };
            }
        } catch (error) {
            logger.warn('Failed to load project reviewer skill config from DB, using default:', error);
        }
        return { ...DEFAULT_REVIEWER_SKILL_CONFIG };
    }

    /**
     * Updates skill configuration in database
     */
    async updateSkillConfig(
        config: Partial<RPAProjectReviewerSkillConfig>,
        userId: number
    ): Promise<RPAProjectReviewerSkillConfig> {
        const current = await this.getSkillConfig();
        const merged: RPAProjectReviewerSkillConfig = {
            ...current,
            ...config,
            updated_at: new Date().toISOString()
        };

        const existing = await db.get(
            "SELECT setting_key FROM global_settings WHERE setting_key = 'skill_project_reviewer_config'"
        );

        if (existing) {
            await db.run(
                "UPDATE global_settings SET setting_value = ?, updated_by = ?, updated_at = datetime('now') WHERE setting_key = 'skill_project_reviewer_config'",
                [JSON.stringify(merged), userId]
            );
        } else {
            await db.run(
                "INSERT INTO global_settings (setting_key, setting_value, setting_type, description, updated_by, created_at, updated_at) VALUES ('skill_project_reviewer_config', ?, 'string', 'Configuración editable de la Skill Revisor IA de Proyecto RPA', ?, datetime('now'), datetime('now'))",
                [JSON.stringify(merged), userId]
            );
        }

        logger.info(`Project reviewer skill configuration updated by user ${userId}`);
        return merged;
    }

    /**
     * Resets skill configuration to factory defaults
     */
    async resetSkillConfig(userId: number): Promise<RPAProjectReviewerSkillConfig> {
        await db.run(
            "DELETE FROM global_settings WHERE setting_key = 'skill_project_reviewer_config'"
        );
        logger.info(`Project reviewer skill configuration reset to defaults by user ${userId}`);
        return { ...DEFAULT_REVIEWER_SKILL_CONFIG };
    }

    /**
     * Executes the RPA Project Reviewer Skill for a specific project
     */
    async reviewProject(
        projectId: number,
        userId: number,
        requestedProvider?: string
    ): Promise<ProjectReviewResult> {
        logger.info(`Running RPA Project Reviewer Skill for project ${projectId} (requested by user ${userId})`);

        // Load active skill configuration
        const config = await this.getSkillConfig();

        // 1. Gather rich real project facts from database
        const projectData = await this.gatherProjectContext(projectId);
        if (!projectData.project) {
            throw new Error(`Project with ID ${projectId} not found`);
        }

        // 2. Compute foundational KPIs
        const kpis = this.calculateKPIs(projectData);

        // 3. Resolve provider
        const effectiveProvider = (requestedProvider && requestedProvider !== 'auto')
            ? requestedProvider
            : (config.preferred_provider !== 'auto' ? config.preferred_provider : undefined);

        const providerInfo = await this.llmService.getAvailableProvider(userId, effectiveProvider);

        if (providerInfo) {
            try {
                logger.info(`Calling LLM provider ${providerInfo.provider} (${providerInfo.model}) for project review`);
                const llmReview = await this.executeLLMReview(projectData, kpis, userId, providerInfo, config);
                return llmReview;
            } catch (error) {
                logger.warn('LLM review execution failed, falling back to rule-based review engine:', error);
            }
        } else {
            logger.info('No LLM API keys configured. Using rule-based review engine.');
        }

        // Fallback: rule-based diagnostic engine
        return this.executeRuleBasedReview(projectData, kpis, config);
    }

    /**
     * Gathers all operational, financial and milestone context of the project
     */
    private async gatherProjectContext(projectId: number) {
        // Project general data
        const project = (await db.get(
            `SELECT p.*, c.name as client_name,
                    u_assigned.full_name as assigned_to_name,
                    u_lead.full_name as created_by_name
             FROM projects p
             LEFT JOIN clients c ON p.client_id = c.id
             LEFT JOIN users u_assigned ON p.assigned_to = u_assigned.id
             LEFT JOIN users u_lead ON p.created_by = u_lead.id
             WHERE p.id = ?`,
            [projectId]
        )) as any;

        // Tasks in project boards
        const tasks = ((await db.query(
            `SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date,
                    t.estimated_hours, u.full_name as assignee_name, tb.name as board_name
             FROM tasks t
             JOIN task_boards tb ON t.board_id = tb.id
             LEFT JOIN users u ON t.assignee_id = u.id
             WHERE tb.project_id = ?
             ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`,
            [projectId]
        )) as any[]) || [];

        // Project milestones
        const milestones = ((await db.query(
            `SELECT id, name, description, status, planned_date, actual_date
             FROM project_milestones
             WHERE project_id = ?
             ORDER BY planned_date ASC, id ASC`,
            [projectId]
        )) as any[]) || [];

        // Timesheet total hours
        const timesheet = ((await db.query(
            `SELECT SUM(hours) as total_hours, COUNT(DISTINCT user_id) as contributors_count
             FROM time_entries
             WHERE project_id = ?`,
            [projectId]
        )) as any[]) || [];

        // Commercial / registered documents
        const documents = ((await db.query(
            `SELECT fa.association_type, f.original_filename, f.file_size, f.upload_date
             FROM file_associations fa
             JOIN files f ON fa.file_id = f.id
             WHERE fa.entity_type = 'project' AND fa.entity_id = ?`,
            [projectId]
        )) as any[]) || [];

        return {
            project,
            tasks,
            milestones,
            hoursSpent: Number(timesheet[0]?.total_hours || 0),
            contributorsCount: Number(timesheet[0]?.contributors_count || 0),
            documents
        };
    }

    /**
     * Computes numeric project KPIs
     */
    private calculateKPIs(context: any) {
        const { project, tasks, milestones, hoursSpent } = context;

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t: any) => t.status === 'completed' || t.status === 'done').length;
        const blockedTasks = tasks.filter((t: any) => t.status === 'blocked').length;

        const progressPercentage = totalTasks > 0
            ? Math.round((completedTasks / totalTasks) * 100)
            : Number(project.progress_percentage || 0);

        const hoursBudgeted = Number(project.hours_budgeted || project.budgeted_hours || 0);

        let daysRemaining: number | null = null;
        let isOverdue = false;

        if (project.end_date) {
            const endDate = new Date(project.end_date);
            const now = new Date();
            const diffTime = endDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isOverdue = daysRemaining < 0 && project.status !== 'completed';
        }

        const milestonesCompleted = milestones.filter((m: any) => m.status === 'completed').length;

        return {
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            blocked_tasks: blockedTasks,
            progress_percentage: progressPercentage,
            hours_budgeted: hoursBudgeted,
            hours_spent: Math.round(hoursSpent * 10) / 10,
            days_remaining: daysRemaining,
            is_overdue: isOverdue,
            milestones_total: milestones.length,
            milestones_completed: milestonesCompleted
        };
    }

    /**
     * Executes the LLM with the standardized RPA Project Reviewer Skill prompt
     */
    private async executeLLMReview(
        context: any,
        kpis: any,
        userId: number,
        providerInfo: { provider: string; model: string },
        config: RPAProjectReviewerSkillConfig
    ): Promise<ProjectReviewResult> {
        const { project, tasks, milestones, documents } = context;

        const blockedList = tasks
            .filter((t: any) => t.status === 'blocked')
            .map((t: any) => `- [${t.priority.toUpperCase()}] "${t.title}" (Asignado a: ${t.assignee_name || 'Sin asignar'})`)
            .join('\n');

        const milestonesList = milestones
            .map((m: any) => `- Hito "${m.name}": Estado: ${m.status}, Fecha planificada: ${m.planned_date || 'Sin fecha'}`)
            .join('\n');

        const docsList = documents
            .map((d: any) => `- ${d.association_type}: ${d.original_filename}`)
            .join('\n');

        let systemPrompt = config.system_prompt;
        if (config.custom_instructions && config.custom_instructions.trim()) {
            systemPrompt += `\n\nDIRECTIVAS PERSONALIZADAS DEL EQUIPO:\n${config.custom_instructions.trim()}`;
        }
        if (config.client_report_guidelines && config.client_report_guidelines.trim()) {
            systemPrompt += `\n\nGUÍA PARA EL REPORTE AL CLIENTE:\n${config.client_report_guidelines.trim()}`;
        }

        const userPrompt = `AUDITORÍA DE PROYECTO RPA:
- Nombre del Proyecto: "${project.name}"
- Cliente: "${project.client_name || 'Cliente interno'}"
- Estado actual: ${project.status} | Prioridad: ${project.priority} | Tipo: ${project.project_type || 'Comercial'}
- Responsable: ${project.assigned_to_name || 'No asignado'} (Líder: ${project.created_by_name || 'Team Lead'})
- Plazo: Inicio ${project.start_date || 'No definido'} -> Fin ${project.end_date || 'No definido'} (Días restantes: ${kpis.days_remaining !== null ? kpis.days_remaining + ' días' : 'Sin fecha límite fija'}${kpis.is_overdue ? ' [¡PLAZO VENCIDO!]' : ''})
- Horas: ${kpis.hours_spent}h registradas de ${kpis.hours_budgeted > 0 ? kpis.hours_budgeted + 'h presupuestadas' : 'presupuesto no definido'}
- Avance de tareas: ${kpis.completed_tasks} completadas de ${kpis.total_tasks} totales (${kpis.progress_percentage}% completado)
- Tareas bloqueadas (${kpis.blocked_tasks}):
${blockedList || '(No hay tareas con status bloqueado)'}
- Hitos del proyecto (${kpis.milestones_total}):
${milestonesList || '(No hay hitos registrados)'}
- Documentos cargados (${documents.length}):
${docsList || '(No hay documentos adjuntos)'}

Genera el diagnóstico exhaustivo y estructurado en JSON según las instrucciones del sistema.`;

        const response = await this.llmService.generateCompletion(userPrompt, userId, {
            provider: providerInfo.provider,
            systemPrompt,
            temperature: config.temperature ?? 0.2,
            maxTokens: config.max_tokens ?? 2500,
            responseFormat: 'json'
        });

        // Parse JSON response
        let cleanedContent = response.content.trim();
        if (cleanedContent.startsWith('```json')) {
            cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanedContent.startsWith('```')) {
            cleanedContent = cleanedContent.replace(/```\n?/g, '');
        }

        const parsed = JSON.parse(cleanedContent);

        return {
            project_id: project.id,
            project_name: project.name,
            client_name: project.client_name,
            health_status: parsed.health_status || (kpis.blocked_tasks > 0 ? 'en_riesgo' : 'saludable'),
            health_score: Number(parsed.health_score) || 80,
            summary: parsed.summary || 'Diagnóstico generado exitosamente.',
            schedule_assessment: parsed.schedule_assessment || 'Evaluación de cronograma completada.',
            budget_assessment: parsed.budget_assessment || 'Evaluación de horas completada.',
            bottlenecks: Array.isArray(parsed.bottlenecks) ? parsed.bottlenecks : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            client_report_draft: parsed.client_report_draft || '',
            kpis,
            metadata: {
                source: 'llm',
                provider: response.provider,
                model: response.model,
                analyzed_at: new Date().toISOString(),
                skill_name: config.name,
                skill_version: '1.1.0'
            }
        };
    }

    /**
     * Fallback: generates a high quality deterministic audit using actual project facts
     */
    private executeRuleBasedReview(
        context: any,
        kpis: any,
        config: RPAProjectReviewerSkillConfig
    ): ProjectReviewResult {
        const { project, tasks, milestones } = context;

        let healthStatus: 'saludable' | 'en_riesgo' | 'critico' = 'saludable';
        let healthScore = 90;

        const warningThreshold = config.health_threshold_warning || 80;
        const criticalThreshold = config.health_threshold_critical || 60;

        if (kpis.is_overdue || kpis.blocked_tasks >= 3 || (kpis.hours_budgeted > 0 && kpis.hours_spent > kpis.hours_budgeted * 1.15)) {
            healthStatus = 'critico';
            healthScore = Math.min(criticalThreshold - 10, 40);
        } else if (kpis.blocked_tasks > 0 || (kpis.days_remaining !== null && kpis.days_remaining < 7 && kpis.progress_percentage < 70) || (kpis.hours_budgeted > 0 && kpis.hours_spent > kpis.hours_budgeted * 0.9)) {
            healthStatus = 'en_riesgo';
            healthScore = Math.round((warningThreshold + criticalThreshold) / 2);
        }

        // Summary
        const summary = `El proyecto "${project.name}" se encuentra actualmente en estado ${healthStatus.toUpperCase()} (puntaje de salud: ${healthScore}/100). Cuenta con un avance general del ${kpis.progress_percentage}% con ${kpis.completed_tasks} de ${kpis.total_tasks} tareas completadas. Se han invertido ${kpis.hours_spent}h de trabajo.${kpis.blocked_tasks > 0 ? ` Se identifican ${kpis.blocked_tasks} tarea(s) en estado bloqueado que requieren atención inmediata del equipo.` : ' No se registran bloqueos activos en el tablero de trabajo.'}`;

        // Schedule
        let scheduleAssessment = '';
        if (project.end_date) {
            if (kpis.is_overdue) {
                scheduleAssessment = `La fecha límite comprometida (${project.end_date}) ya fue superada. Se requiere acordar una prórroga formal con ${project.client_name || 'el cliente'} y redefinir la fecha de entrega final.`;
            } else {
                scheduleAssessment = `Quedan ${kpis.days_remaining} días hasta la fecha de entrega (${project.end_date}). Con ${kpis.total_tasks - kpis.completed_tasks} tareas pendientes, el ritmo actual de ejecución ${kpis.days_remaining < 10 && kpis.progress_percentage < 60 ? 'es ajustado y requiere priorizar entregables críticos' : 'se encuentra dentro de parámetros normales'}.`;
            }
        } else {
            scheduleAssessment = 'El proyecto no cuenta con una fecha límite de entrega establecida. Se recomienda definir la fecha de término para poder medir desvíos temporales de manera cuantitativa.';
        }

        // Budget / Hours
        let budgetAssessment = '';
        if (kpis.hours_budgeted > 0) {
            const usagePercent = Math.round((kpis.hours_spent / kpis.hours_budgeted) * 100);
            budgetAssessment = `Se han consumido ${kpis.hours_spent}h de las ${kpis.hours_budgeted}h presupuestadas (${usagePercent}% de utilización). El margen de esfuerzo ${usagePercent > 90 ? 'está en zona de alerta o sobregiro' : 'permanece bajo control con capacidad disponible'}.`;
        } else {
            budgetAssessment = `Se han registrado ${kpis.hours_spent}h efectivas de trabajo por el equipo. Se recomienda registrar el presupuesto de horas objetivo para monitorear el margen de rentabilidad.`;
        }

        // Bottlenecks
        const bottlenecks: ProjectReviewResult['bottlenecks'] = [];
        const blockedTasks = tasks.filter((t: any) => t.status === 'blocked');

        for (const t of blockedTasks) {
            bottlenecks.push({
                title: `Tarea bloqueada: "${t.title}"`,
                severity: t.priority === 'urgent' || t.priority === 'high' ? 'alta' : 'media',
                description: `Impedimento en tablero "${t.board_name || 'General'}" asignado a ${t.assignee_name || 'Sin asignar'}. Detiene el avance de componentes vinculados.`,
                mitigation: `Contactar inmediatamente a ${t.assignee_name || 'los responsables'} en la daily de hoy para clarificar dependencias técnicas o accesos bloqueantes.`
            });
        }

        if (kpis.is_overdue) {
            bottlenecks.push({
                title: 'Plazo límite comprometido superado',
                severity: 'alta',
                description: `El proyecto debió entregarse el ${project.end_date}. Riesgo directo de insatisfacción del cliente y costos operativos extra.`,
                mitigation: 'Reunión de emergencia con el Sponsor/Cliente para sincronicar alcance y formalizar nueva fecha hito.'
            });
        }

        // Recommendations
        const recommendations: ProjectReviewResult['recommendations'] = [];

        if (blockedTasks.length > 0) {
            recommendations.push({
                action: 'Desbloquear tareas críticas en daily meeting técnica.',
                priority: 'alta',
                area: 'Técnica',
                expected_outcome: 'Reanudar flujo de desarrollo de bots y eliminar cuellos de botella.'
            });
        } else {
            recommendations.push({
                action: 'Mantener la cadencia diaria de standup para anticipar impedimentos técnicos en los bots.',
                priority: 'media',
                area: 'Gestión',
                expected_outcome: 'Eliminar tiempos muertos y asegurar flujo continuo de desarrollo.'
            });
        }

        if (kpis.milestones_total > 0 && kpis.milestones_completed < kpis.milestones_total) {
            recommendations.push({
                action: 'Validar criterios de aceptación del próximo hito de entrega con el Product Owner / Cliente.',
                priority: 'alta',
                area: 'Técnica',
                expected_outcome: 'Garantizar que los entregables cumplan con la expectativa del cliente al primer intento.'
            });
        }

        recommendations.push({
            action: 'Revisar horas registradas en timesheet para asegurar facturación puntual del periodo.',
            priority: 'media',
            area: 'Financiera',
            expected_outcome: 'Trazabilidad fidedigna del costo real del proyecto.'
        });

        // Client Report Draft
        const clientReportDraft = `Estimado equipo de ${project.client_name || 'la empresa'},\n\nLes compartimos el resumen de avance del proyecto "${project.name}":\n\n📌 Estado General:\n- Progreso actual: ${kpis.progress_percentage}% (${kpis.completed_tasks} de ${kpis.total_tasks} componentes concluidos).\n- Hitos alcanzados: ${kpis.milestones_completed} de ${kpis.milestones_total}.\n\n🚀 Principales Avances:\n- Se ha trabajado en la configuración y desarrollo de los flujos de automatización programados.\n- El equipo técnico mantiene el plan de ejecución según la planificación coordinada.\n\n${kpis.blocked_tasks > 0 ? `⚠️ Puntos de Atención:\n- Tenemos ${kpis.blocked_tasks} punto(s) pendiente(s) de confirmación/accesos que estamos gestionando para no comprometer los tiempos.\n\n` : ''}📅 Próximos Pasos:\n- Continuar con el ciclo de pruebas y validación de componentes.\n- Preparar la siguiente entrega correspondiente al cronograma.\n\nQuedamos atentos a cualquier duda o consulta.\n\nSaludos cordiales,\nEquipo RPA`;

        return {
            project_id: project.id,
            project_name: project.name,
            client_name: project.client_name,
            health_status: healthStatus,
            health_score: healthScore,
            summary,
            schedule_assessment: scheduleAssessment,
            budget_assessment: budgetAssessment,
            bottlenecks,
            recommendations,
            client_report_draft: clientReportDraft,
            kpis,
            metadata: {
                source: 'rule_based_engine',
                analyzed_at: new Date().toISOString(),
                skill_name: config.name,
                skill_version: '1.1.0'
            }
        };
    }
}

export const projectReviewerSkill = new ProjectReviewerSkillService();
