const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const backupPath = path.join(__dirname, 'backups', 'database-backup-2025-08-27T04-30-32-638Z-manual.sqlite');

console.log('\n=== ANÁLISIS DEL ARCHIVO DE BACKUP ===\n');
console.log(`Archivo: ${backupPath}\n`);

// Verificar que el archivo existe
if (!fs.existsSync(backupPath)) {
  console.error('ERROR: El archivo de backup NO existe');
  process.exit(1);
}

const stats = fs.statSync(backupPath);
console.log(`Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
console.log(`Fecha de modificación: ${stats.mtime}\n`);

const db = new sqlite3.Database(backupPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('ERROR al abrir backup:', err.message);
    process.exit(1);
  }

  analyzeBackup();
});

function analyzeBackup() {
  // Contar proyectos
  db.get(`SELECT COUNT(*) as count FROM projects`, (err, result) => {
    if (err) {
      console.log(`ERROR al contar proyectos: ${err.message}`);
    } else {
      console.log(`PROYECTOS EN EL BACKUP: ${result.count}`);
    }

    // Contar tareas
    db.get(`SELECT COUNT(*) as count FROM tasks`, (err, result) => {
      if (err) {
        console.log(`ERROR al contar tareas: ${err.message}`);
      } else {
        console.log(`TAREAS EN EL BACKUP: ${result.count}`);
      }

      // Contar task_boards
      db.get(`SELECT COUNT(*) as count FROM task_boards`, (err, result) => {
        if (err) {
          console.log(`ERROR al contar boards: ${err.message}`);
        } else {
          console.log(`TASK BOARDS EN EL BACKUP: ${result.count}`);
        }

        // Contar milestones
        db.get(`SELECT COUNT(*) as count FROM project_milestones`, (err, result) => {
          if (err) {
            console.log(`ERROR al contar milestones: ${err.message}`);
          } else {
            console.log(`MILESTONES EN EL BACKUP: ${result.count}`);
          }

          // Listar proyectos
          listProjects();
        });
      });
    });
  });
}

function listProjects() {
  console.log('\n=== PROYECTOS EN EL BACKUP ===\n');
  db.all(`SELECT id, name, status, start_date, end_date FROM projects`, (err, projects) => {
    if (err) {
      console.log(`ERROR: ${err.message}`);
    } else if (projects.length > 0) {
      projects.forEach(p => {
        console.log(`ID: ${p.id} | ${p.name}`);
        console.log(`  Status: ${p.status} | Inicio: ${p.start_date || 'N/A'} | Fin: ${p.end_date || 'N/A'}\n`);
      });
    } else {
      console.log('NO HAY PROYECTOS');
    }

    db.close();
    console.log('=== FIN DEL ANÁLISIS ===');
  });
}
