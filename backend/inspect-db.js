const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

// Get all tables
db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", [], (err, tables) => {
  if (err) {
    console.error('Error listing tables:', err);
    db.close();
    process.exit(1);
  }

  console.log('\n=== DATABASE TABLES ===');
  tables.forEach(table => console.log(`  - ${table.name}`));

  // Check for project_assignments table
  const hasProjectAssignments = tables.some(t => t.name === 'project_assignments');
  console.log(`\nproject_assignments table exists: ${hasProjectAssignments}`);

  // Count projects
  db.get("SELECT COUNT(*) as count FROM projects", [], (err, result) => {
    if (err) {
      console.error('Error counting projects:', err);
    } else {
      console.log(`\nTotal projects: ${result.count}`);
    }

    // Get project names
    db.all("SELECT id, name FROM projects ORDER BY id", [], (err, projects) => {
      if (err) {
        console.error('Error listing projects:', err);
      } else {
        console.log('\n=== PROJECTS ===');
        projects.forEach(p => console.log(`  [${p.id}] ${p.name}`));

        // Check for duplicates
        db.all(`
          SELECT name, COUNT(*) as count
          FROM projects
          GROUP BY name
          HAVING count > 1
        `, [], (err, duplicates) => {
          if (err) {
            console.error('Error checking duplicates:', err);
          } else if (duplicates.length > 0) {
            console.log('\n=== DUPLICATE PROJECTS ===');
            duplicates.forEach(d => console.log(`  ${d.name}: ${d.count} copies`));
          } else {
            console.log('\nNo duplicate projects found.');
          }

          db.close();
        });
      }
    });
  });
});
