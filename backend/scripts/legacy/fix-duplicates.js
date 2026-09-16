const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');

console.log('🔧 Starting duplicate project cleanup...\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Database connected\n');
});

// Function to execute a query
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Function to fetch all rows
function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function removeDuplicateProjects() {
  try {
    console.log('📊 Analyzing duplicate projects...\n');

    // Get all projects grouped by name
    const duplicates = await getAllRows(`
      SELECT name, GROUP_CONCAT(id) as ids, COUNT(*) as count
      FROM projects
      GROUP BY name
      HAVING count > 1
      ORDER BY name
    `);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate projects found!');
      return;
    }

    console.log(`Found ${duplicates.length} duplicate project groups:\n`);

    for (const dup of duplicates) {
      const ids = dup.ids.split(',').map(id => parseInt(id));
      const keepId = Math.min(...ids); // Keep the oldest (lowest ID)
      const deleteIds = ids.filter(id => id !== keepId);

      console.log(`📁 ${dup.name}:`);
      console.log(`   - ${dup.count} copies found (IDs: ${dup.ids})`);
      console.log(`   - Keeping ID: ${keepId}`);
      console.log(`   - Deleting IDs: ${deleteIds.join(', ')}`);

      // Delete duplicate projects
      for (const deleteId of deleteIds) {
        await runQuery('DELETE FROM projects WHERE id = ?', [deleteId]);
        console.log(`   ✅ Deleted project ID ${deleteId}`);
      }
      console.log();
    }

    // Get final project count
    const finalProjects = await getAllRows('SELECT id, name FROM projects ORDER BY id');

    console.log('\n📋 Remaining projects:');
    finalProjects.forEach(p => {
      console.log(`   [${p.id}] ${p.name}`);
    });

    console.log(`\n✅ Cleanup complete! ${finalProjects.length} unique projects remaining.`);

    // Verify no duplicates remain
    const remainingDuplicates = await getAllRows(`
      SELECT name, COUNT(*) as count
      FROM projects
      GROUP BY name
      HAVING count > 1
    `);

    if (remainingDuplicates.length === 0) {
      console.log('✅ Verification: No duplicates remain!\n');
    } else {
      console.log('⚠️  Warning: Some duplicates still exist:\n');
      remainingDuplicates.forEach(d => {
        console.log(`   - ${d.name}: ${d.count} copies`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
removeDuplicateProjects()
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
