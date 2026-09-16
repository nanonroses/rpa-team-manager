const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');

console.log('🔧 Applying database fixes...\n');
console.log('This script will:');
console.log('  1. Remove duplicate projects');
console.log('  2. Apply migration 18 (project_assignments table)');
console.log('  3. Populate project_assignments from existing data\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Database connected\n');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAllRows(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getRow(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function main() {
  try {
    // ========================================
    // STEP 1: Remove duplicate projects
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 1: Removing Duplicate Projects');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const duplicates = await getAllRows(`
      SELECT name, GROUP_CONCAT(id) as ids, COUNT(*) as count
      FROM projects
      GROUP BY name
      HAVING count > 1
      ORDER BY name
    `);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate projects found!\n');
    } else {
      console.log(`Found ${duplicates.length} duplicate project groups:\n`);

      for (const dup of duplicates) {
        const ids = dup.ids.split(',').map(id => parseInt(id));
        const keepId = Math.min(...ids);
        const deleteIds = ids.filter(id => id !== keepId);

        console.log(`📁 ${dup.name}:`);
        console.log(`   - Keeping ID: ${keepId}`);
        console.log(`   - Deleting: ${deleteIds.join(', ')}`);

        for (const deleteId of deleteIds) {
          await runQuery('DELETE FROM projects WHERE id = ?', [deleteId]);
        }
      }

      const remainingProjects = await getAllRows('SELECT id, name FROM projects ORDER BY id');
      console.log(`\n✅ ${remainingProjects.length} unique projects remaining.\n`);
    }

    // ========================================
    // STEP 2: Check and apply migration 18
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 2: Applying Migration 18');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const migrationApplied = await getRow(
      'SELECT version FROM schema_migrations WHERE version = 18'
    );

    if (migrationApplied) {
      console.log('✅ Migration 18 already applied!\n');
    } else {
      console.log('📋 Applying migration 18: project_assignments table...\n');

      // Create project_assignments table
      await runQuery(`
        CREATE TABLE IF NOT EXISTS project_assignments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          role VARCHAR(50) DEFAULT 'contributor' CHECK (role IN ('lead', 'contributor', 'reviewer', 'observer')),
          allocation_percentage INTEGER DEFAULT 100 CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
          start_date DATE,
          end_date DATE,
          is_active BOOLEAN DEFAULT 1,
          notes TEXT,
          assigned_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (assigned_by) REFERENCES users(id)
        )
      `);
      console.log('   ✅ Created project_assignments table');

      // Create indexes
      await runQuery('CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON project_assignments(project_id)');
      await runQuery('CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id)');
      await runQuery('CREATE INDEX IF NOT EXISTS idx_project_assignments_active ON project_assignments(is_active)');
      console.log('   ✅ Created indexes');

      // Create trigger
      await runQuery(`
        CREATE TRIGGER IF NOT EXISTS update_project_assignments_timestamp
          AFTER UPDATE ON project_assignments
          BEGIN
            UPDATE project_assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
          END
      `);
      console.log('   ✅ Created trigger');

      // Mark migration as applied
      await runQuery(
        'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
        [18, 'Crear tabla project_assignments para gestión de múltiples usuarios por proyecto']
      );
      console.log('   ✅ Marked migration 18 as applied\n');
    }

    // ========================================
    // STEP 3: Populate project_assignments
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 3: Populating project_assignments');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Get projects with assigned_to
    const projectsWithAssignments = await getAllRows(`
      SELECT id, name, assigned_to, created_by, start_date
      FROM projects
      WHERE assigned_to IS NOT NULL
    `);

    if (projectsWithAssignments.length === 0) {
      console.log('ℹ️  No projects with assigned_to found.\n');
    } else {
      console.log(`Found ${projectsWithAssignments.length} projects with assignments:\n`);

      for (const project of projectsWithAssignments) {
        // Check if assignment already exists
        const existingAssignment = await getRow(
          'SELECT id FROM project_assignments WHERE project_id = ? AND user_id = ? AND is_active = 1',
          [project.id, project.assigned_to]
        );

        if (existingAssignment) {
          console.log(`   ⏭️  [${project.id}] ${project.name} - Assignment already exists`);
        } else {
          await runQuery(`
            INSERT INTO project_assignments (
              project_id, user_id, role, allocation_percentage,
              start_date, is_active, assigned_by
            ) VALUES (?, ?, 'lead', 100, ?, 1, ?)
          `, [project.id, project.assigned_to, project.start_date, project.created_by]);

          console.log(`   ✅ [${project.id}] ${project.name} - Created assignment`);
        }
      }

      console.log(`\n✅ Project assignments populated!\n`);
    }

    // ========================================
    // STEP 4: Verification
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STEP 4: Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check tables exist
    const tables = await getAllRows(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('projects', 'project_assignments')
      ORDER BY name
    `);
    console.log('✅ Tables verified:');
    tables.forEach(t => console.log(`   - ${t.name}`));

    // Count projects
    const projectCount = await getRow('SELECT COUNT(*) as count FROM projects');
    console.log(`\n✅ Total projects: ${projectCount.count}`);

    // Count assignments
    const assignmentCount = await getRow('SELECT COUNT(*) as count FROM project_assignments WHERE is_active = 1');
    console.log(`✅ Active assignments: ${assignmentCount.count}`);

    // Check for duplicates
    const remainingDuplicates = await getAllRows(`
      SELECT name, COUNT(*) as count
      FROM projects
      GROUP BY name
      HAVING count > 1
    `);

    if (remainingDuplicates.length === 0) {
      console.log('✅ No duplicate projects remain');
    } else {
      console.log('⚠️  Warning: Duplicates still exist!');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL FIXES APPLIED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Next steps:');
    console.log('  1. Restart the backend server to load the new migration');
    console.log('  2. Test the ROI endpoint: GET /api/financial/project-roi/:projectId');
    console.log('  3. Verify no duplicate projects in the UI\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Run the script
main()
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
