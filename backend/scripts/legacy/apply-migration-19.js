const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');

console.log('🔧 Applying migration 19: project_milestones columns\n');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Database connected\n');
});

db.run('PRAGMA foreign_keys = ON');

function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
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

async function applyMigration19() {
  try {
    // Check if migration already applied
    const migrationExists = await getRow(
      'SELECT version FROM schema_migrations WHERE version = 19'
    );

    if (migrationExists) {
      console.log('✅ Migration 19 already applied!\n');
      return;
    }

    console.log('📋 Applying migration 19...\n');

    // Add columns one by one
    const columns = [
      { name: 'impact_on_timeline', sql: 'ALTER TABLE project_milestones ADD COLUMN impact_on_timeline INTEGER DEFAULT 0' },
      { name: 'responsibility', sql: `ALTER TABLE project_milestones ADD COLUMN responsibility VARCHAR(20) DEFAULT 'internal' CHECK (responsibility IN ('internal', 'client', 'external', 'shared'))` },
      { name: 'blocking_reason', sql: 'ALTER TABLE project_milestones ADD COLUMN blocking_reason TEXT' },
      { name: 'delay_justification', sql: 'ALTER TABLE project_milestones ADD COLUMN delay_justification TEXT' },
      { name: 'external_contact', sql: 'ALTER TABLE project_milestones ADD COLUMN external_contact VARCHAR(200)' },
      { name: 'estimated_delay_days', sql: 'ALTER TABLE project_milestones ADD COLUMN estimated_delay_days INTEGER DEFAULT 0' },
      { name: 'financial_impact', sql: 'ALTER TABLE project_milestones ADD COLUMN financial_impact DECIMAL(10,2) DEFAULT 0' },
      { name: 'created_by', sql: 'ALTER TABLE project_milestones ADD COLUMN created_by INTEGER REFERENCES users(id)' }
    ];

    for (const column of columns) {
      try {
        await runQuery(column.sql);
        console.log(`   ✅ Added column: ${column.name}`);
      } catch (error) {
        if (error.message.includes('duplicate column')) {
          console.log(`   ⏭️  Column already exists: ${column.name}`);
        } else {
          console.error(`   ❌ Error adding ${column.name}:`, error.message);
          throw error;
        }
      }
    }

    // Mark migration as applied
    await runQuery(
      'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
      [19, 'Agregar columnas faltantes a project_milestones para tracking de delays']
    );

    console.log('\n✅ Migration 19 applied successfully!');

    // Verify the columns exist
    console.log('\n📊 Verifying project_milestones schema...');
    const tableInfo = await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(project_milestones)', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const expectedColumns = [
      'estimated_delay_days',
      'responsibility',
      'financial_impact',
      'blocking_reason',
      'created_by'
    ];

    let allPresent = true;
    for (const colName of expectedColumns) {
      const found = tableInfo.some(col => col.name === colName);
      if (found) {
        console.log(`   ✅ ${colName}`);
      } else {
        console.log(`   ❌ ${colName} - MISSING!`);
        allPresent = false;
      }
    }

    if (allPresent) {
      console.log('\n✅ All required columns are present!');
    } else {
      console.log('\n⚠️  Some columns are missing!');
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    throw error;
  }
}

applyMigration19()
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
