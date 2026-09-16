const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

db.all(`
  SELECT
    t.id,
    t.title,
    t.board_id,
    t.column_id,
    tb.project_id,
    tc.name as column_name
  FROM tasks t
  LEFT JOIN task_boards tb ON t.board_id = tb.id
  LEFT JOIN task_columns tc ON t.column_id = tc.id
  ORDER BY tb.project_id, t.id
`, (err, rows) => {
  if (err) {
    console.error(err);
    db.close();
    return;
  }

  console.log('Total tasks:', rows.length);
  console.log('\nBreakdown by project:');

  const byProject = {};
  rows.forEach(r => {
    if (!byProject[r.project_id]) byProject[r.project_id] = [];
    byProject[r.project_id].push(r);
  });

  Object.keys(byProject).forEach(pid => {
    console.log(`\nProject ${pid}: ${byProject[pid].length} tasks`);
    byProject[pid].forEach(t => {
      console.log(`  - Task ${t.id}: ${t.title} (board_id: ${t.board_id}, column: ${t.column_name})`);
    });
  });

  db.close();
});
