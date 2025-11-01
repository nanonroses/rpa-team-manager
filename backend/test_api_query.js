const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

// Test the exact query used by the getBoard API endpoint
const boardIds = [3, 4, 5, 31, 32];

async function testBoard(boardId) {
  return new Promise((resolve, reject) => {
    // First, get the board info
    db.get(`
      SELECT tb.*, p.name as project_name
      FROM task_boards tb
      LEFT JOIN projects p ON tb.project_id = p.id
      WHERE tb.id = ?
    `, [boardId], (err, board) => {
      if (err) {
        reject(err);
        return;
      }

      // Get columns
      db.all(`
        SELECT * FROM task_columns
        WHERE board_id = ?
        ORDER BY position ASC
      `, [boardId], (err, columns) => {
        if (err) {
          reject(err);
          return;
        }

        // Get tasks - using the EXACT query from the controller
        db.all(`
          SELECT
            t.*,
            u_assignee.full_name as assignee_name,
            u_assignee.avatar_url as assignee_avatar,
            u_reporter.full_name as reporter_name,
            te.total_hours,
            te.total_value
          FROM tasks t
          LEFT JOIN users u_assignee ON t.assignee_id = u_assignee.id
          LEFT JOIN users u_reporter ON t.reporter_id = u_reporter.id
          LEFT JOIN (
            SELECT
              task_id,
              SUM(hours) as total_hours,
              SUM(hours * hourly_rate) as total_value
            FROM time_entries
            WHERE task_id IS NOT NULL
            GROUP BY task_id
          ) te ON t.id = te.task_id
          WHERE t.board_id = ?
          ORDER BY t.position ASC
        `, [boardId], (err, tasks) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({ board, columns, tasks });
        });
      });
    });
  });
}

async function runTests() {
  for (const boardId of boardIds) {
    const result = await testBoard(boardId);
    console.log(`\n========================================`);
    console.log(`Board ID: ${boardId}`);
    console.log(`Board Name: ${result.board?.name || 'NOT FOUND'}`);
    console.log(`Project: ${result.board?.project_name || 'N/A'} (ID: ${result.board?.project_id})`);
    console.log(`Columns: ${result.columns.length}`);
    console.log(`Tasks: ${result.tasks.length}`);

    if (result.tasks.length > 0) {
      console.log(`\nTasks in this board:`);
      result.tasks.forEach(t => {
        console.log(`  - [${t.id}] ${t.title} (column_id: ${t.column_id})`);
      });
    }
  }

  db.close();
}

runTests().catch(err => {
  console.error('Error:', err);
  db.close();
});
