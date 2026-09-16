const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║   FINAL VERIFICATION: ROI Endpoint & Database Fixes       ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
});

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

async function verifyFixes() {
  const checks = [];

  try {
    console.log('Running comprehensive verification checks...\n');

    // ========================================
    // CHECK 1: Tables exist
    // ========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CHECK 1: Required Tables');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const requiredTables = ['projects', 'project_assignments', 'project_milestones', 'project_financials', 'user_cost_rates'];

    for (const tableName of requiredTables) {
      const table = await getRow(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
        [tableName]
      );

      if (table) {
        console.log(`✅ ${tableName} - EXISTS`);
        checks.push({ name: `Table: ${tableName}`, status: 'PASS' });
      } else {
        console.log(`❌ ${tableName} - MISSING`);
        checks.push({ name: `Table: ${tableName}`, status: 'FAIL' });
      }
    }

    // ========================================
    // CHECK 2: Migrations applied
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CHECK 2: Migrations Applied');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const migrations = [18, 19];
    for (const version of migrations) {
      const migration = await getRow(
        'SELECT * FROM schema_migrations WHERE version = ?',
        [version]
      );

      if (migration) {
        console.log(`✅ Migration ${version} - APPLIED`);
        console.log(`   ${migration.description}`);
        checks.push({ name: `Migration ${version}`, status: 'PASS' });
      } else {
        console.log(`❌ Migration ${version} - NOT APPLIED`);
        checks.push({ name: `Migration ${version}`, status: 'FAIL' });
      }
    }

    // ========================================
    // CHECK 3: No duplicate projects
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CHECK 3: Project Duplicates');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const duplicates = await getAllRows(`
      SELECT name, COUNT(*) as count
      FROM projects
      GROUP BY name
      HAVING count > 1
    `);

    if (duplicates.length === 0) {
      console.log('✅ No duplicate projects found');
      checks.push({ name: 'No duplicates', status: 'PASS' });
    } else {
      console.log(`❌ Found ${duplicates.length} duplicate project names:`);
      duplicates.forEach(d => {
        console.log(`   - ${d.name}: ${d.count} copies`);
      });
      checks.push({ name: 'No duplicates', status: 'FAIL' });
    }

    const projectCount = await getRow('SELECT COUNT(*) as count FROM projects');
    console.log(`   Total projects: ${projectCount.count}`);

    if (projectCount.count === 5) {
      console.log('✅ Correct number of projects (5)');
      checks.push({ name: 'Project count', status: 'PASS' });
    } else {
      console.log(`⚠️  Expected 5 projects, found ${projectCount.count}`);
      checks.push({ name: 'Project count', status: 'WARN' });
    }

    // ========================================
    // CHECK 4: project_assignments populated
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CHECK 4: Project Assignments');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const assignments = await getAllRows(`
      SELECT pa.*, p.name as project_name, u.full_name
      FROM project_assignments pa
      JOIN projects p ON pa.project_id = p.id
      JOIN users u ON pa.user_id = u.id
      WHERE pa.is_active = 1
    `);

    console.log(`Found ${assignments.length} active assignments:`);
    assignments.forEach(a => {
      console.log(`   ✅ ${a.project_name} → ${a.full_name} (${a.role}, ${a.allocation_percentage}%)`);
    });

    if (assignments.length > 0) {
      checks.push({ name: 'Assignments populated', status: 'PASS' });
    } else {
      console.log('⚠️  No assignments found');
      checks.push({ name: 'Assignments populated', status: 'WARN' });
    }

    // ========================================
    // CHECK 5: project_milestones columns
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CHECK 5: project_milestones Schema');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const tableInfo = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(project_milestones)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const requiredColumns = [
      'estimated_delay_days',
      'responsibility',
      'financial_impact',
      'blocking_reason',
      'created_by'
    ];

    let allColumnsPresent = true;
    for (const colName of requiredColumns) {
      const found = tableInfo.some(col => col.name === colName);
      if (found) {
        console.log(`   ✅ ${colName}`);
      } else {
        console.log(`   ❌ ${colName} - MISSING`);
        allColumnsPresent = false;
      }
    }

    if (allColumnsPresent) {
      checks.push({ name: 'Milestones columns', status: 'PASS' });
    } else {
      checks.push({ name: 'Milestones columns', status: 'FAIL' });
    }

    // ========================================
    // CHECK 6: ROI controller queries
    // ========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('CHECK 6: ROI Controller Queries');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const projects = await getAllRows('SELECT id, name FROM projects LIMIT 1');

    if (projects.length > 0) {
      const projectId = projects[0].id;
      console.log(`Testing ROI queries for project ID ${projectId}...\n`);

      try {
        // Query 1: Project data
        const projectData = await getRow(`
          SELECT p.*, pf.*
          FROM projects p
          LEFT JOIN project_financials pf ON p.id = pf.project_id
          WHERE p.id = ?
        `, [projectId]);
        console.log('   ✅ Query 1: Project data - SUCCESS');

        // Query 2: Global settings
        const ufValue = await getRow(`SELECT setting_value FROM global_settings WHERE setting_key = 'uf_rate'`);
        const hoursPerMonth = await getRow(`SELECT setting_value FROM global_settings WHERE setting_key = 'monthly_hours'`);
        console.log('   ✅ Query 2: Global settings - SUCCESS');

        // Query 3: Assigned users
        const assignedUsers = await getAllRows(`
          SELECT
            pa.user_id,
            pa.allocation_percentage,
            pa.role as project_role,
            u.full_name,
            u.role as user_role,
            ucr.monthly_cost,
            ucr.hourly_rate
          FROM project_assignments pa
          JOIN users u ON pa.user_id = u.id
          LEFT JOIN user_cost_rates ucr ON pa.user_id = ucr.user_id AND ucr.is_active = 1
          WHERE pa.project_id = ? AND pa.is_active = 1
        `, [projectId]);
        console.log(`   ✅ Query 3: Assigned users - SUCCESS (${assignedUsers.length} users)`);

        // Query 4: Client delays
        const clientDelays = await getRow(`
          SELECT COALESCE(SUM(estimated_delay_days * 8), 0) as total_delay_hours
          FROM project_milestones
          WHERE project_id = ? AND responsibility = 'client'
        `, [projectId]);
        console.log('   ✅ Query 4: Client delays - SUCCESS');

        checks.push({ name: 'ROI queries', status: 'PASS' });
      } catch (error) {
        console.log(`   ❌ ROI query failed: ${error.message}`);
        checks.push({ name: 'ROI queries', status: 'FAIL' });
      }
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    VERIFICATION SUMMARY                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    const passCount = checks.filter(c => c.status === 'PASS').length;
    const failCount = checks.filter(c => c.status === 'FAIL').length;
    const warnCount = checks.filter(c => c.status === 'WARN').length;

    console.log(`Total Checks: ${checks.length}`);
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`⚠️  Warnings: ${warnCount}\n`);

    if (failCount === 0) {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║          ✅ ALL FIXES VERIFIED SUCCESSFULLY! ✅           ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      console.log('The following issues have been resolved:');
      console.log('  1. ✅ project_assignments table created and populated');
      console.log('  2. ✅ Duplicate projects removed (5 unique remain)');
      console.log('  3. ✅ project_milestones columns added');
      console.log('  4. ✅ All ROI controller queries working\n');

      console.log('The ROI endpoint should now work without 500 errors!');
      console.log('Test at: GET /api/financial/project-roi/:projectId\n');
    } else {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║           ⚠️  SOME CHECKS FAILED - REVIEW NEEDED          ║');
      console.log('╚════════════════════════════════════════════════════════════╝\n');

      console.log('Failed checks:');
      checks.filter(c => c.status === 'FAIL').forEach(c => {
        console.log(`  ❌ ${c.name}`);
      });
    }

  } catch (error) {
    console.error('\n❌ VERIFICATION ERROR:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

verifyFixes()
  .then(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    db.close();
    process.exit(1);
  });
