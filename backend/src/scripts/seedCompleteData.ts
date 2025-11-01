import { db } from '../database/database';
import { logger } from '../utils/logger';

/**
 * Complete seed script for populating the database with 5 realistic RPA projects
 *
 * Projects to create:
 * 1. AGROSUPER - Toma de Control
 * 2. CAMANCHACA - RPA San Jose
 * 3. COAGRA - BOT Conciliación
 * 4. RAM - Conciliación
 * 5. PROMET - Housekeeping
 */

async function seedCompleteData() {
    try {
        await db.connect();
        logger.info('Starting complete data seeding...');

        // 1. First, verify users exist
        const users = await db.query('SELECT id, username, role FROM users ORDER BY id');
        logger.info(`Found ${users.length} users:`, users.map(u => u.username));

        if (users.length < 5) {
            logger.error('Not enough users in database. Need at least 5 users.');
            return;
        }

        // Define user IDs
        const adminId = users.find(u => u.role === 'team_lead')?.id || 1;
        const dev1Id = users.find(u => u.username === 'dev1')?.id || 2;
        const dev2Id = users.find(u => u.username === 'dev2')?.id || 3;
        const opsId = users.find(u => u.username === 'ops')?.id || 4;
        const supportId = users.find(u => u.username === 'itsupport')?.id || 5;

        logger.info(`User IDs - Admin: ${adminId}, Dev1: ${dev1Id}, Dev2: ${dev2Id}, Ops: ${opsId}, Support: ${supportId}`);

        // Define project data
        const today = new Date();
        const projects = [
            {
                name: 'AGROSUPER - Toma de Control',
                description: 'Automatización del proceso de toma de control de inventarios y producción en plantas de AGROSUPER. Incluye integración con SAP y generación automática de reportes.',
                status: 'active',
                priority: 'high',
                budget: 85000.00,
                start_date: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                actual_start_date: new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress_percentage: 65,
                created_by: adminId,
                assigned_to: dev1Id
            },
            {
                name: 'CAMANCHACA - RPA San Jose',
                description: 'Bot de automatización para procesamiento de órdenes de compra y facturación en planta San Jose. Integración con sistemas de pesca y ERP.',
                status: 'active',
                priority: 'critical',
                budget: 120000.00,
                start_date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                actual_start_date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress_percentage: 45,
                created_by: adminId,
                assigned_to: dev2Id
            },
            {
                name: 'COAGRA - BOT Conciliación',
                description: 'Automatización de conciliación bancaria y contable para COAGRA. Procesamiento de extractos bancarios y generación de asientos contables automáticos.',
                status: 'active',
                priority: 'medium',
                budget: 65000.00,
                start_date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date(today.getTime() + 105 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                actual_start_date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress_percentage: 15,
                created_by: adminId,
                assigned_to: dev1Id
            },
            {
                name: 'RAM - Conciliación Financiera',
                description: 'Sistema RPA para conciliación financiera automatizada. Reconciliación de cuentas por cobrar y pagar, validación de pagos y alertas de discrepancias.',
                status: 'completed',
                priority: 'medium',
                budget: 55000.00,
                start_date: new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                actual_start_date: new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                actual_end_date: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress_percentage: 100,
                created_by: adminId,
                assigned_to: opsId
            },
            {
                name: 'PROMET - Housekeeping Automatizado',
                description: 'Bot de limpieza y mantenimiento automático de bases de datos. Archivado de registros antiguos, optimización de índices y generación de reportes de salud del sistema.',
                status: 'on_hold',
                priority: 'low',
                budget: 35000.00,
                start_date: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end_date: new Date(today.getTime() + 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                actual_start_date: new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                progress_percentage: 25,
                created_by: adminId,
                assigned_to: supportId
            }
        ];

        // Insert projects
        const projectIds: number[] = [];
        for (const project of projects) {
            const result = await db.run(
                `INSERT INTO projects (name, description, status, priority, budget, start_date, end_date, actual_start_date, actual_end_date, progress_percentage, created_by, assigned_to)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    project.name,
                    project.description,
                    project.status,
                    project.priority,
                    project.budget,
                    project.start_date,
                    project.end_date,
                    project.actual_start_date || null,
                    project.actual_end_date || null,
                    project.progress_percentage,
                    project.created_by,
                    project.assigned_to
                ]
            );
            if (result.id) {
                projectIds.push(result.id);
                logger.info(`Created project: ${project.name} (ID: ${result.id})`);
            }
        }

        // 2. Create task boards for each project
        const boardIds: number[] = [];
        for (const projectId of projectIds) {
            const projectName = projects[projectIds.indexOf(projectId)].name;
            const result = await db.run(
                `INSERT INTO task_boards (project_id, name, description, board_type, is_default)
                 VALUES (?, ?, ?, ?, ?)`,
                [projectId, `${projectName} - Kanban Board`, 'Main kanban board for project', 'kanban', 1]
            );
            if (result.id) {
                boardIds.push(result.id);
                logger.info(`Created board for project ${projectId} (Board ID: ${result.id})`);
            }
        }

        // 3. Create columns for each board
        const columns = ['Backlog', 'To Do', 'In Progress', 'Review', 'Testing', 'Done'];
        const columnColors = ['#gray', '#blue', '#yellow', '#orange', '#purple', '#green'];
        const columnIds: Record<number, number[]> = {};

        for (let i = 0; i < boardIds.length; i++) {
            const boardId = boardIds[i];
            columnIds[boardId] = [];

            for (let j = 0; j < columns.length; j++) {
                const result = await db.run(
                    `INSERT INTO task_columns (board_id, name, position, color, is_done_column, wip_limit)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [boardId, columns[j], j + 1, columnColors[j], j === 5 ? 1 : 0, j === 2 ? 3 : null]
                );
                if (result.id) {
                    columnIds[boardId].push(result.id);
                }
            }
            logger.info(`Created ${columns.length} columns for board ${boardId}`);
        }

        // 4. Create tasks for each project
        const taskTemplates = [
            // Common tasks for all RPA projects
            { title: 'Análisis de proceso actual', description: 'Documentar el proceso manual existente y puntos de mejora', type: 'task', priority: 'high', hours: 16, points: 8, column: 5 }, // Done
            { title: 'Diseño de arquitectura RPA', description: 'Definir arquitectura técnica del bot y componentes', type: 'task', priority: 'high', hours: 20, points: 13, column: 5 }, // Done
            { title: 'Setup de ambiente de desarrollo', description: 'Configurar UiPath Studio y entornos de prueba', type: 'task', priority: 'medium', hours: 8, points: 5, column: 5 }, // Done
            { title: 'Desarrollo del bot principal', description: 'Implementar lógica principal del proceso automatizado', type: 'feature', priority: 'critical', hours: 40, points: 21, column: 2 }, // In Progress
            { title: 'Integración con sistemas externos', description: 'Conectar con SAP/ERP y otros sistemas', type: 'feature', priority: 'high', hours: 32, points: 13, column: 2 }, // In Progress
            { title: 'Manejo de excepciones', description: 'Implementar lógica de manejo de errores y reintentos', type: 'task', priority: 'high', hours: 24, points: 13, column: 1 }, // To Do
            { title: 'Logging y monitoreo', description: 'Configurar sistema de logs y alertas', type: 'task', priority: 'medium', hours: 12, points: 5, column: 1 }, // To Do
            { title: 'Testing unitario', description: 'Crear y ejecutar casos de prueba unitarios', type: 'task', priority: 'medium', hours: 16, points: 8, column: 0 }, // Backlog
            { title: 'Testing de integración', description: 'Pruebas end-to-end del proceso completo', type: 'task', priority: 'high', hours: 20, points: 13, column: 3 }, // Review
            { title: 'Documentación técnica', description: 'Generar documentación de arquitectura y operación', type: 'documentation', priority: 'medium', hours: 12, points: 5, column: 0 }, // Backlog
            { title: 'UAT con cliente', description: 'Pruebas de aceptación de usuario con stakeholders', type: 'task', priority: 'critical', hours: 16, points: 8, column: 4 }, // Testing
            { title: 'Despliegue a producción', description: 'Deploy del bot a ambiente productivo', type: 'task', priority: 'critical', hours: 8, points: 5, column: 0 }, // Backlog
            { title: 'Capacitación a usuarios', description: 'Training a equipo operativo del cliente', type: 'task', priority: 'medium', hours: 8, points: 3, column: 0 }, // Backlog
        ];

        let totalTasksCreated = 0;
        const userPool = [dev1Id, dev2Id, opsId, supportId];

        for (let i = 0; i < boardIds.length; i++) {
            const boardId = boardIds[i];
            const projectId = projectIds[i];
            const projectStatus = projects[i].status;

            // Adjust tasks based on project status
            let tasksToCreate = taskTemplates;
            if (projectStatus === 'completed') {
                // All tasks in Done
                tasksToCreate = taskTemplates.map(t => ({ ...t, column: 5 }));
            } else if (projectStatus === 'on_hold') {
                // Most tasks in Backlog/To Do
                tasksToCreate = taskTemplates.map(t => ({ ...t, column: t.column > 2 ? 1 : t.column }));
            }

            for (let j = 0; j < tasksToCreate.length; j++) {
                const task = tasksToCreate[j];
                const assigneeId = userPool[j % userPool.length];
                const columnId = columnIds[boardId][task.column];

                const dueDate = new Date(today.getTime() + (Math.random() * 60 - 30) * 24 * 60 * 60 * 1000);

                // Map column to valid task status
                const statusMap: Record<number, string> = {
                    0: 'todo',        // Backlog
                    1: 'todo',        // To Do
                    2: 'in_progress', // In Progress
                    3: 'review',      // Review
                    4: 'testing',     // Testing
                    5: 'done'         // Done
                };

                await db.run(
                    `INSERT INTO tasks (board_id, column_id, title, description, task_type, status, priority, assignee_id, reporter_id, story_points, estimated_hours, position, due_date)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        boardId,
                        columnId,
                        task.title,
                        task.description,
                        task.type,
                        statusMap[task.column] || 'todo',
                        task.priority,
                        assigneeId,
                        adminId,
                        task.points,
                        task.hours,
                        j + 1,
                        dueDate.toISOString().split('T')[0]
                    ]
                );
                totalTasksCreated++;
            }
            logger.info(`Created ${tasksToCreate.length} tasks for project ${projectId}`);
        }

        // 5. Create milestones for each project
        const milestoneTemplates = [
            { name: 'Kick-off del proyecto', type: 'checkpoint', daysOffset: -40, status: 'completed' },
            { name: 'Entrega de diseño técnico', type: 'delivery', daysOffset: -25, status: 'completed' },
            { name: 'Aprobación de diseño por cliente', type: 'review', daysOffset: -20, status: 'completed' },
            { name: 'Desarrollo completado', type: 'checkpoint', daysOffset: 10, status: 'in_progress' },
            { name: 'Testing y QA', type: 'checkpoint', daysOffset: 25, status: 'pending' },
            { name: 'Demo a stakeholders', type: 'demo', daysOffset: 35, status: 'pending' },
            { name: 'UAT y aprobación final', type: 'review', daysOffset: 50, status: 'pending' },
            { name: 'Go-live en producción', type: 'go_live', daysOffset: 60, status: 'pending' },
        ];

        let totalMilestonesCreated = 0;
        for (const projectId of projectIds) {
            const projectData = projects[projectIds.indexOf(projectId)];
            const projectStartDate = new Date(projectData.start_date);

            for (const milestone of milestoneTemplates) {
                const plannedDate = new Date(projectStartDate.getTime() + milestone.daysOffset * 24 * 60 * 60 * 1000);
                const actualDate = milestone.status === 'completed' ? plannedDate : null;

                await db.run(
                    `INSERT INTO project_milestones (project_id, name, description, milestone_type, planned_date, actual_date, status, priority, responsible_user_id, completion_percentage)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        projectId,
                        milestone.name,
                        `Milestone: ${milestone.name} para ${projectData.name}`,
                        milestone.type,
                        plannedDate.toISOString().split('T')[0],
                        actualDate ? actualDate.toISOString().split('T')[0] : null,
                        milestone.status,
                        milestone.type === 'go_live' || milestone.type === 'review' ? 'critical' : 'high',
                        projectData.assigned_to,
                        milestone.status === 'completed' ? 100 : (milestone.status === 'in_progress' ? 60 : 0)
                    ]
                );
                totalMilestonesCreated++;
            }
            logger.info(`Created ${milestoneTemplates.length} milestones for project ${projectId}`);
        }

        // 6. Create project financials
        let totalFinancialsCreated = 0;
        for (let i = 0; i < projectIds.length; i++) {
            const projectId = projectIds[i];
            const project = projects[i];
            const budget = project.budget;

            // Calculate realistic financial data
            const progressPct = project.progress_percentage / 100;
            const budgetedHours = budget / 45; // Assuming $45/hour sale price
            const actualCost = budgetedHours * progressPct * 38; // Internal cost $38/hour average
            const roi = budget > 0 && actualCost > 0 ? ((budget - actualCost) / actualCost) * 100 : 0;
            const efficiency = progressPct > 0.8 ? 95 : (progressPct > 0.5 ? 85 : 75);

            await db.run(
                `INSERT INTO project_financials (project_id, budgeted_hours, budgeted_cost, sale_price, hourly_rate, actual_cost, roi_percentage, profit_margin, efficiency_percentage, cost_per_hour, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    projectId,
                    budgetedHours,
                    budget,
                    budget,
                    45.00,
                    actualCost,
                    roi,
                    budget - actualCost,
                    efficiency,
                    38.00,
                    adminId
                ]
            );
            totalFinancialsCreated++;
        }
        logger.info(`Created ${totalFinancialsCreated} project financial records`);

        // 7. Create ideas (if table exists)
        let totalIdeasCreated = 0;
        try {
            // Check if ideas table exists
            const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='ideas'");

            if (tables.length > 0) {
                const ideasData = [
                    {
                        title: 'Automatizar reporte mensual de KPIs',
                        description: 'Bot que genere automáticamente el dashboard mensual de KPIs del equipo RPA, consolidando datos de todos los proyectos activos.',
                        category: 'automation',
                        status: 'approved',
                        impact_score: 4,
                        effort_score: 2,
                        created_by: dev1Id,
                        assigned_to: dev2Id,
                        votes: 8
                    },
                    {
                        title: 'Implementar sistema de alertas proactivas',
                        description: 'Sistema que detecte anomalías en bots productivos y envíe alertas antes de que fallen, usando machine learning.',
                        category: 'process_improvement',
                        status: 'under_review',
                        impact_score: 5,
                        effort_score: 4,
                        created_by: opsId,
                        assigned_to: null,
                        votes: 12
                    },
                    {
                        title: 'Reducir costos de licencias UiPath',
                        description: 'Optimizar el uso de licencias unattended identificando bots que pueden ejecutarse en horarios de menor costo.',
                        category: 'cost_reduction',
                        status: 'in_progress',
                        impact_score: 5,
                        effort_score: 3,
                        created_by: adminId,
                        assigned_to: adminId,
                        votes: 15
                    },
                    {
                        title: 'Portal de autoservicio para clientes',
                        description: 'Desarrollar portal web donde clientes puedan ver estado de sus bots, métricas y solicitar cambios sin email.',
                        category: 'productivity',
                        status: 'draft',
                        impact_score: 4,
                        effort_score: 5,
                        created_by: supportId,
                        assigned_to: null,
                        votes: 6
                    },
                    {
                        title: 'Template library de componentes RPA reutilizables',
                        description: 'Crear librería de componentes comunes (login SAP, envío emails, lectura PDFs) para acelerar desarrollo.',
                        category: 'productivity',
                        status: 'approved',
                        impact_score: 5,
                        effort_score: 3,
                        created_by: dev2Id,
                        assigned_to: dev1Id,
                        votes: 18
                    }
                ];

                for (const idea of ideasData) {
                    const result = await db.run(
                        `INSERT INTO ideas (title, description, category, status, impact_score, effort_score, votes_count, created_by, assigned_to)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [idea.title, idea.description, idea.category, idea.status, idea.impact_score, idea.effort_score, idea.votes, idea.created_by, idea.assigned_to]
                    );

                    if (result.id) {
                        // Add some votes
                        const voters = [adminId, dev1Id, dev2Id, opsId, supportId];
                        const numVotes = Math.min(idea.votes, voters.length);
                        for (let i = 0; i < numVotes; i++) {
                            try {
                                await db.run(
                                    `INSERT OR IGNORE INTO idea_votes (idea_id, user_id, vote_type)
                                     VALUES (?, ?, ?)`,
                                    [result.id, voters[i], 'up']
                                );
                            } catch (error) {
                                // Ignore duplicate vote errors
                            }
                        }

                        // Add a comment
                        try {
                            await db.run(
                                `INSERT INTO idea_comments (idea_id, user_id, comment)
                                 VALUES (?, ?, ?)`,
                                [result.id, adminId, 'Excelente propuesta. Vamos a priorizar esto para el próximo quarter.']
                            );
                        } catch (error) {
                            // Ignore if idea_comments table doesn't exist
                        }

                        totalIdeasCreated++;
                    }
                }
                logger.info(`Created ${totalIdeasCreated} ideas with votes and comments`);
            } else {
                logger.warn('Ideas table does not exist, skipping ideas creation');
            }
        } catch (error) {
            logger.warn('Error creating ideas (table may not exist):', error);
        }

        // 8. Generate final statistics
        const stats = {
            projects: projectIds.length,
            tasks: totalTasksCreated,
            milestones: totalMilestonesCreated,
            financials: totalFinancialsCreated,
            ideas: totalIdeasCreated
        };

        logger.info('\n========================================');
        logger.info('SEED COMPLETED SUCCESSFULLY!');
        logger.info('========================================');
        logger.info(`Projects created: ${stats.projects}`);
        logger.info(`Tasks created: ${stats.tasks}`);
        logger.info(`Milestones created: ${stats.milestones}`);
        logger.info(`Financial records created: ${stats.financials}`);
        logger.info(`Ideas created: ${stats.ideas}`);
        logger.info('========================================\n');

        return stats;

    } catch (error) {
        logger.error('Error seeding data:', error);
        throw error;
    }
}

// Execute if run directly
if (require.main === module) {
    seedCompleteData()
        .then(() => {
            logger.info('Seed script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            logger.error('Seed script failed:', error);
            process.exit(1);
        });
}

export { seedCompleteData };
