const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

// Check for tasks with column_ids that don't match their board's columns
db.all(`
  SELECT
    t.id as task_id,
    t.title,
    t.board_id,
    t.column_id,
    tc.id as actual_column_id,
    tc.name as column_name,
    tc.board_id as column_board_id
  FROM tasks t
  LEFT JOIN task_columns tc ON t.column_id = tc.id
  ORDER BY t.board_id, t.id
`, (err, rows) => {
  if (err) {
    console.error(err);
    db.close();
    return;
  }

  console.log('Checking for column/board mismatches...\n');

  let mismatches = 0;
  let orphans = 0;

  rows.forEach(row => {
    // Check if column exists
    if (!row.actual_column_id) {
      console.log(`❌ ORPHAN TASK: Task ${row.task_id} "${row.title}" references column_id ${row.column_id} which DOES NOT EXIST!`);
      orphans++;
      return;
    }

    // Check if column belongs to correct board
    if (row.board_id !== row.column_board_id) {
      console.log(`❌ MISMATCH: Task ${row.task_id} "${row.title}"`);
      console.log(`   Task board_id: ${row.board_id}`);
      console.log(`   Column "${row.column_name}" board_id: ${row.column_board_id}`);
      console.log(`   This task will NOT appear in the UI!`);
      mismatches++;
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total tasks checked: ${rows.length}`);
  console.log(`Orphaned tasks (invalid column_id): ${orphans}`);
  console.log(`Mismatched tasks (column from wrong board): ${mismatches}`);

  if (orphans === 0 && mismatches === 0) {
    console.log('✅ All tasks have valid column references!');
  } else {
    console.log(`❌ FOUND ${orphans + mismatches} PROBLEMS that will prevent tasks from showing!`);
  }

  db.close();
});
