const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
console.log('=== ANÁLISIS FORENSE DE BASE DE DATOS ===\n');
console.log(`Archivo: ${dbPath}\n`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('ERROR CRÍTICO AL ABRIR LA BASE DE DATOS:');
    console.error(err.message);
    process.exit(1);
  }

  performAnalysis();
});

function performAnalysis() {
  // 1. Listar todas las tablas
  db.all(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`, (err, tables) => {
    if (err) {
      console.error('ERROR al listar tablas:', err.message);
      db.close();
      return;
    }

    console.log('1. TABLAS EN LA BASE DE DATOS:');
    console.log(`Total de tablas: ${tables.length}`);
    tables.forEach(t => console.log(`  - ${t.name}`));

    // 2. Contar registros en tablas clave
    checkCriticalTables();
  });
}

function checkCriticalTables() {
  console.log('\n2. CONTEO DE REGISTROS EN TABLAS PRINCIPALES:');

  const criticalTables = ['users', 'projects', 'tasks', 'task_boards', 'task_columns',
                          'project_phases', 'project_milestones', 'support_companies',
                          'support_tickets', 'llm_api_keys'];

  let completed = 0;

  criticalTables.forEach(tableName => {
    db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, result) => {
      if (err) {
        console.log(`  ${tableName}: ERROR - ${err.message}`);
      } else {
        console.log(`  ${tableName}: ${result.count} registros`);
      }

      completed++;
      if (completed === criticalTables.length) {
        checkUsers();
      }
    });
  });
}

function checkUsers() {
  console.log('\n3. USUARIOS EN LA BASE DE DATOS:');
  db.all(`SELECT id, username, email, full_name, role, is_active FROM users`, (err, users) => {
    if (err) {
      console.log(`  ERROR al leer usuarios: ${err.message}`);
    } else if (users.length > 0) {
      users.forEach(u => {
        console.log(`  ID: ${u.id} | ${u.email} | ${u.full_name} | Role: ${u.role} | Activo: ${u.is_active}`);
      });
    } else {
      console.log('  ⚠️ NO HAY USUARIOS REGISTRADOS');
    }
    checkProjects();
  });
}

function checkProjects() {
  console.log('\n4. PROYECTOS EN LA BASE DE DATOS:');
  db.all(`SELECT id, name, status, start_date, end_date FROM projects LIMIT 10`, (err, projects) => {
    if (err) {
      console.log(`  ERROR al leer proyectos: ${err.message}`);
    } else if (projects.length > 0) {
      projects.forEach(p => {
        console.log(`  ID: ${p.id} | ${p.name} | Status: ${p.status} | Inicio: ${p.start_date || 'N/A'}`);
      });
    } else {
      console.log('  ⚠️ NO HAY PROYECTOS REGISTRADOS');
    }
    checkMigrations();
  });
}

function checkMigrations() {
  console.log('\n5. VERSIÓN DE MIGRACIONES:');
  db.all(`SELECT version, description, applied_at FROM migrations ORDER BY version DESC LIMIT 5`, (err, migrations) => {
    if (err) {
      console.log(`  Tabla migrations no existe o error: ${err.message}`);
    } else if (migrations.length > 0) {
      console.log('  Últimas migraciones aplicadas:');
      migrations.forEach(m => {
        console.log(`    v${m.version}: ${m.description} - ${m.applied_at}`);
      });
    } else {
      console.log('  ⚠️ NO HAY REGISTRO DE MIGRACIONES');
    }
    checkProjectsSchema();
  });
}

function checkProjectsSchema() {
  console.log('\n6. COLUMNAS EN TABLA PROJECTS:');
  db.all(`PRAGMA table_info(projects)`, (err, columns) => {
    if (err) {
      console.log(`  ERROR: ${err.message}`);
    } else {
      console.log(`  Total columnas: ${columns.length}`);
      columns.forEach(col => {
        console.log(`    - ${col.name} (${col.type})`);
      });
    }

    db.close();
    console.log('\n=== FIN DEL ANÁLISIS ===');
  });
}
