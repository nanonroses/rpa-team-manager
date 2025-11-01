const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

// Test with user ID 1 (Team Lead - should see all projects)
const testUserId = 1;
const boardIdsToTest = [3, 4, 5, 31, 32];

async function testBoardAccess(boardId, userId) {
  return new Promise((resolve, reject) => {
    // This is the EXACT query from getBoard controller
    db.get(`
      SELECT tb.*, p.name as project_name
      FROM task_boards tb
      LEFT JOIN projects p ON tb.project_id = p.id
      WHERE tb.id = ? AND (p.assigned_to = ? OR p.created_by = ?)
    `, [boardId, userId, userId], (err, board) => {
      if (err) {
        reject(err);
        return;
      }

      if (!board) {
        resolve({ hasAccess: false, board: null, columns: [], tasks: [] });
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

        // Get tasks - EXACT query from controller
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

          resolve({ hasAccess: true, board, columns, tasks });
        });
      });
    });
  });
}

async function runTests() {
  console.log(`Testing board access for User ID: ${testUserId}`);
  console.log('='.repeat(60));

  let totalTasksFound = 0;

  for (const boardId of boardIdsToTest) {
    const result = await testBoardAccess(boardId, testUserId);

    if (!result.hasAccess) {
      console.log(`\n❌ Board ${boardId}: ACCESS DENIED`);
      continue;
    }

    console.log(`\n✅ Board ${boardId}: ${result.board.name}`);
    console.log(`   Project: ${result.board.project_name}`);
    console.log(`   Columns: ${result.columns.length}`);
    console.log(`   Tasks: ${result.tasks.length}`);

    totalTasksFound += result.tasks.length;

    if (result.tasks.length > 0) {
      result.tasks.forEach(t => {
        console.log(`      - Task ${t.id}: "${t.title}" (column_id: ${t.column_id}, position: ${t.position})`);
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`TOTAL TASKS ACCESSIBLE: ${totalTasksFound} / 22`);

  if (totalTasksFound === 22) {
    console.log('✅ SUCCESS: All tasks are accessible!');
  } else {
    console.log(`❌ PROBLEM: Missing ${22 - totalTasksFound} tasks!`);
  }

  db.close();
}

runTests().catch(err => {
  console.error('Error:', err);
  db.close();
});
