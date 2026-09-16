const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

console.log('\n=== ANÁLISIS CRÍTICO DE COLUMN IDs ===\n');

async function checkBoard(boardId, boardName) {
  return new Promise((resolve) => {
    console.log(`\n📋 Board ${boardId} (${boardName}):`);

    db.all(`SELECT id, name FROM task_columns WHERE board_id = ?`, [boardId], (err, cols) => {
      if (err) {
        console.error('Error loading columns:', err);
        resolve();
        return;
      }

      console.log('  Columnas disponibles:');
      cols.forEach(c => console.log(`    Column ID: ${c.id} | Nombre: ${c.name}`));

      db.all(`SELECT id, column_id, title FROM tasks WHERE board_id = ?`, [boardId], (err, tasks) => {
        if (err) {
          console.error('Error loading tasks:', err);
          resolve();
          return;
        }

        console.log(`\n  Tareas encontradas: ${tasks.length}`);

        if (tasks.length > 0) {
          // Group by column_id
          const byColumn = {};
          tasks.forEach(t => {
            if (!byColumn[t.column_id]) byColumn[t.column_id] = [];
            byColumn[t.column_id].push(t);
          });

          console.log('\n  Tareas por column_id:');
          Object.keys(byColumn).forEach(colId => {
            const count = byColumn[colId].length;
            const colExists = cols.find(c => c.id === parseInt(colId));
            const status = colExists ? '✅' : '❌ NO EXISTE';
            console.log(`    column_id ${colId}: ${count} tareas ${status}`);
            if (!colExists) {
              byColumn[colId].forEach(t => {
                console.log(`      - Task ${t.id}: "${t.title}"`);
              });
            }
          });
        }

        resolve();
      });
    });
  });
}

async function main() {
  await checkBoard(3, 'COAGRA');
  await checkBoard(4, 'RAM');
  await checkBoard(5, 'PROMET');
  await checkBoard(31, 'AGROSUPER');
  await checkBoard(32, 'CAMANCHACA');

  db.close();
}

main();
