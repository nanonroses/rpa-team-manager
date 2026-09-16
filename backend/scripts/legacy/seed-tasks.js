const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');

console.log('🌱 Starting tasks seeding process...\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Database connected\n');
});

// Helper function to run async queries
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function getAllQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Main seeding function
async function seedTasks() {
  try {
    // Get all existing projects
    const projects = await getAllQuery('SELECT id, name FROM projects ORDER BY id');
    console.log(`📋 Found ${projects.length} projects\n`);

    if (projects.length === 0) {
      console.log('⚠️  No projects found. Please seed projects first.');
      return;
    }

    // Get a user to assign as reporter (use first user)
    const user = await getQuery('SELECT id FROM users LIMIT 1');
    const reporterId = user ? user.id : 1;

    let totalBoardsCreated = 0;
    let totalTasksCreated = 0;

    for (const project of projects) {
      console.log(`🎯 Processing project: ${project.name} (ID: ${project.id})`);

      // Check if board already exists for this project
      const existingBoard = await getQuery(
        'SELECT id FROM task_boards WHERE project_id = ?',
        [project.id]
      );

      let boardId;

      if (existingBoard) {
        boardId = existingBoard.id;
        console.log(`   ℹ️  Board already exists (ID: ${boardId})`);
      } else {
        // Create task board for this project
        const boardResult = await runQuery(`
          INSERT INTO task_boards (project_id, name, description, board_type, is_default)
          VALUES (?, ?, ?, 'kanban', 1)
        `, [
          project.id,
          `${project.name} - Kanban Board`,
          `Main task board for ${project.name}`,
        ]);

        boardId = boardResult.id;
        totalBoardsCreated++;
        console.log(`   ✅ Created board (ID: ${boardId})`);

        // Create default columns for the board
        const columns = [
          { name: 'To Do', position: 1, color: '#f5f5f5', is_done: 0 },
          { name: 'In Progress', position: 2, color: '#e6f7ff', is_done: 0 },
          { name: 'Review', position: 3, color: '#fff2e6', is_done: 0 },
          { name: 'Done', position: 4, color: '#f6ffed', is_done: 1 }
        ];

        for (const column of columns) {
          await runQuery(`
            INSERT INTO task_columns (board_id, name, position, color, is_done_column)
            VALUES (?, ?, ?, ?, ?)
          `, [boardId, column.name, column.position, column.color, column.is_done]);
        }
        console.log(`   ✅ Created 4 default columns`);
      }

      // Get columns for this board
      const columns = await getAllQuery(
        'SELECT id, name FROM task_columns WHERE board_id = ? ORDER BY position',
        [boardId]
      );

      // Check if tasks already exist for this board
      const existingTasks = await getQuery(
        'SELECT COUNT(*) as count FROM tasks WHERE board_id = ?',
        [boardId]
      );

      if (existingTasks.count > 0) {
        console.log(`   ℹ️  Board already has ${existingTasks.count} tasks, skipping task creation\n`);
        continue;
      }

      // Create tasks based on project name
      const tasks = generateProjectTasks(project.name, columns, reporterId);

      for (const task of tasks) {
        await runQuery(`
          INSERT INTO tasks (
            board_id, column_id, title, description, task_type, priority,
            assignee_id, reporter_id, estimated_hours, story_points,
            start_date, due_date, position
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          boardId,
          task.column_id,
          task.title,
          task.description,
          task.task_type,
          task.priority,
          task.assignee_id,
          reporterId,
          task.estimated_hours,
          task.story_points,
          task.start_date,
          task.due_date,
          task.position
        ]);
        totalTasksCreated++;
      }

      console.log(`   ✅ Created ${tasks.length} tasks\n`);
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ Seeding completed successfully!`);
    console.log(`   📊 Boards created: ${totalBoardsCreated}`);
    console.log(`   ✅ Tasks created: ${totalTasksCreated}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    throw error;
  }
}

// Generate realistic tasks based on project type
function generateProjectTasks(projectName, columns, reporterId) {
  const tasks = [];
  const todoCol = columns.find(c => c.name === 'To Do')?.id;
  const inProgressCol = columns.find(c => c.name === 'In Progress')?.id;
  const reviewCol = columns.find(c => c.name === 'Review')?.id;
  const doneCol = columns.find(c => c.name === 'Done')?.id;

  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Common RPA tasks based on project type
  if (projectName.includes('Conciliación') || projectName.includes('Financiera')) {
    // Financial reconciliation project
    tasks.push(
      {
        column_id: doneCol,
        title: 'Configurar conexión SAP',
        description: 'Establecer conexión con SAP para extracción de datos financieros',
        task_type: 'task',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 8,
        story_points: 5,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: inProgressCol,
        title: 'Desarrollar proceso de descarga de reportes',
        description: 'Automatizar la descarga de reportes bancarios desde portal web',
        task_type: 'feature',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 16,
        story_points: 8,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: inProgressCol,
        title: 'Implementar lógica de conciliación',
        description: 'Desarrollar algoritmo para comparar datos SAP vs datos bancarios',
        task_type: 'feature',
        priority: 'critical',
        assignee_id: null,
        estimated_hours: 24,
        story_points: 13,
        start_date: today,
        due_date: nextWeek,
        position: 2
      },
      {
        column_id: todoCol,
        title: 'Crear reporte de excepciones',
        description: 'Generar Excel con diferencias encontradas en conciliación',
        task_type: 'task',
        priority: 'medium',
        assignee_id: null,
        estimated_hours: 8,
        story_points: 5,
        start_date: null,
        due_date: null,
        position: 1
      },
      {
        column_id: todoCol,
        title: 'Configurar envío de correos',
        description: 'Automatizar envío de reportes a usuarios finales',
        task_type: 'task',
        priority: 'medium',
        assignee_id: null,
        estimated_hours: 4,
        story_points: 3,
        start_date: null,
        due_date: null,
        position: 2
      }
    );
  } else if (projectName.includes('Housekeeping') || projectName.includes('PROMET')) {
    // Housekeeping automation
    tasks.push(
      {
        column_id: doneCol,
        title: 'Análisis de proceso actual',
        description: 'Documentar proceso manual de housekeeping actual',
        task_type: 'research',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 16,
        story_points: 8,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: inProgressCol,
        title: 'Desarrollar bot de limpieza de carpetas',
        description: 'Crear proceso para eliminar archivos temporales antiguos',
        task_type: 'feature',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 12,
        story_points: 8,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: todoCol,
        title: 'Implementar reglas de retención',
        description: 'Configurar políticas de retención de archivos por tipo',
        task_type: 'task',
        priority: 'medium',
        assignee_id: null,
        estimated_hours: 8,
        story_points: 5,
        start_date: null,
        due_date: null,
        position: 1
      },
      {
        column_id: todoCol,
        title: 'Crear logs de auditoría',
        description: 'Generar registro detallado de archivos eliminados',
        task_type: 'task',
        priority: 'medium',
        assignee_id: null,
        estimated_hours: 6,
        story_points: 3,
        start_date: null,
        due_date: null,
        position: 2
      }
    );
  } else if (projectName.includes('Control') || projectName.includes('AGROSUPER')) {
    // Control/monitoring automation
    tasks.push(
      {
        column_id: doneCol,
        title: 'Definir indicadores a monitorear',
        description: 'Especificar KPIs y métricas de control',
        task_type: 'research',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 8,
        story_points: 5,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: reviewCol,
        title: 'Desarrollar scraping de sistemas',
        description: 'Extraer datos de múltiples sistemas para consolidación',
        task_type: 'feature',
        priority: 'critical',
        assignee_id: null,
        estimated_hours: 20,
        story_points: 13,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: inProgressCol,
        title: 'Implementar alertas automáticas',
        description: 'Configurar notificaciones cuando se detecten anomalías',
        task_type: 'feature',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 12,
        story_points: 8,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: todoCol,
        title: 'Crear dashboard de control',
        description: 'Desarrollar panel visual con indicadores en tiempo real',
        task_type: 'task',
        priority: 'medium',
        assignee_id: null,
        estimated_hours: 16,
        story_points: 8,
        start_date: null,
        due_date: null,
        position: 1
      }
    );
  } else {
    // Generic RPA project tasks
    tasks.push(
      {
        column_id: doneCol,
        title: 'Análisis de requerimientos',
        description: 'Recopilar y documentar requisitos del cliente',
        task_type: 'research',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 12,
        story_points: 8,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: inProgressCol,
        title: 'Desarrollo del proceso principal',
        description: 'Implementar flujo principal de automatización',
        task_type: 'feature',
        priority: 'critical',
        assignee_id: null,
        estimated_hours: 32,
        story_points: 13,
        start_date: today,
        due_date: nextWeek,
        position: 1
      },
      {
        column_id: todoCol,
        title: 'Manejo de excepciones',
        description: 'Implementar control de errores y excepciones',
        task_type: 'task',
        priority: 'high',
        assignee_id: null,
        estimated_hours: 16,
        story_points: 8,
        start_date: null,
        due_date: null,
        position: 1
      },
      {
        column_id: todoCol,
        title: 'Pruebas de UAT',
        description: 'Coordinar y ejecutar pruebas con usuarios finales',
        task_type: 'task',
        priority: 'medium',
        assignee_id: null,
        estimated_hours: 12,
        story_points: 5,
        start_date: null,
        due_date: null,
        position: 2
      }
    );
  }

  return tasks;
}

// Run seeding
seedTasks()
  .then(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      console.log('Database closed.');
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    db.close();
    process.exit(1);
  });
