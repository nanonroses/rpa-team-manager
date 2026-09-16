const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

async function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function checkSchema() {
  console.log('Checking support_companies table schema...\n');

  try {
    // Check if table exists
    const tables = await runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='support_companies'");
    console.log('Table exists:', tables.length > 0 ? 'YES' : 'NO');

    if (tables.length > 0) {
      // Get column info
      const columns = await runQuery('PRAGMA table_info(support_companies)');
      console.log('\nColumns in support_companies table:');
      columns.forEach(col => {
        console.log(`  - ${col.name} (${col.type}${col.notnull ? ', NOT NULL' : ''}${col.dflt_value ? `, DEFAULT ${col.dflt_value}` : ''})`);
      });
    }

    console.log('\n\nChecking support_tickets table schema...\n');
    const ticketTables = await runQuery("SELECT name FROM sqlite_master WHERE type='table' AND name='support_tickets'");
    console.log('Table exists:', ticketTables.length > 0 ? 'YES' : 'NO');

    if (ticketTables.length > 0) {
      const ticketColumns = await runQuery('PRAGMA table_info(support_tickets)');
      console.log('\nColumns in support_tickets table:');
      ticketColumns.forEach(col => {
        console.log(`  - ${col.name} (${col.type}${col.notnull ? ', NOT NULL' : ''}${col.dflt_value ? `, DEFAULT ${col.dflt_value}` : ''})`);
      });
    }

  } catch (error) {
    console.error('Error checking schema:', error);
  } finally {
    db.close();
  }
}

checkSchema();
