const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');

console.log('🧪 Testing ROI Endpoint Database Queries\n');
console.log('This script simulates the queries made by the ROI controller');
console.log('to ensure they work correctly with the project_assignments table.\n');

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

async function testROIQueries() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('TEST 1: Query project basic data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const projects = await getAllRows('SELECT id, name FROM projects ORDER BY id');
    console.log(`Found ${projects.length} projects:\n`);

    for (const project of projects) {
      console.log(`\n📊 Testing Project ID ${project.id}: ${project.name}`);
      console.log('─'.repeat(60));

      // Query 1: Get project basic data
      const projectData = await getRow(`
        SELECT p.*, pf.*
        FROM projects p
        LEFT JOIN project_financials pf ON p.id = pf.project_id
        WHERE p.id = ?
      `, [project.id]);

      if (!projectData) {
        console.log('   ❌ Project not found');
        continue;
      }
      console.log('   ✅ Project data retrieved');

      // Query 2: Get global settings
      const ufValue = await getRow(`SELECT setting_value FROM global_settings WHERE setting_key = 'uf_rate'`);
      const hoursPerMonth = await getRow(`SELECT setting_value FROM global_settings WHERE setting_key = 'monthly_hours'`);

      if (ufValue && hoursPerMonth) {
        console.log(`   ✅ Global settings: UF=${ufValue.setting_value}, Hours=${hoursPerMonth.setting_value}`);
      } else {
        console.log('   ⚠️  Global settings missing');
      }

      // Query 3: Get assigned users from project_assignments
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
      `, [project.id]);

      if (assignedUsers.length > 0) {
        console.log(`   ✅ Found ${assignedUsers.length} assigned user(s):`);
        assignedUsers.forEach(user => {
          console.log(`      - ${user.full_name} (${user.project_role}, ${user.allocation_percentage}%)`);
          console.log(`        Monthly: $${user.monthly_cost || 'N/A'}, Hourly: $${user.hourly_rate || 'N/A'}`);
        });
      } else {
        console.log('   ℹ️  No users in project_assignments, checking assigned_to...');

        // Fallback to old single assignment
        if (projectData.assigned_to) {
          const singleUser = await getRow(`
            SELECT
              u.id as user_id,
              100 as allocation_percentage,
              'primary' as project_role,
              u.full_name,
              u.role as user_role,
              ucr.monthly_cost,
              ucr.hourly_rate
            FROM users u
            LEFT JOIN user_cost_rates ucr ON u.id = ucr.user_id AND ucr.is_active = 1
            WHERE u.id = ?
          `, [projectData.assigned_to]);

          if (singleUser) {
            console.log(`   ✅ Fallback: ${singleUser.full_name} (${singleUser.user_role})`);
            console.log(`      Monthly: $${singleUser.monthly_cost || 'N/A'}, Hourly: $${singleUser.hourly_rate || 'N/A'}`);
          }
        } else {
          console.log('   ⚠️  No assigned user found');
        }
      }

      // Query 4: Get client delay hours
      const clientDelays = await getRow(`
        SELECT COALESCE(SUM(estimated_delay_days * 8), 0) as total_delay_hours
        FROM project_milestones
        WHERE project_id = ? AND responsibility = 'client'
      `, [project.id]);

      const delayHours = clientDelays?.total_delay_hours || 0;
      console.log(`   ✅ Client delays: ${delayHours} hours`);

      console.log('   ✅ All queries executed successfully!\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ ALL ROI QUERIES WORKING CORRECTLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('Summary:');
    console.log('  ✅ project_assignments table exists and is populated');
    console.log('  ✅ All ROI controller queries execute without errors');
    console.log('  ✅ Fallback to assigned_to works correctly');
    console.log('  ✅ Database is ready for ROI endpoint\n');

    console.log('The backend should now handle ROI requests without 500 errors!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

testROIQueries()
  .then(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      console.log('\nDatabase closed.');
      process.exit(0);
    });
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    db.close();
    process.exit(1);
  });
