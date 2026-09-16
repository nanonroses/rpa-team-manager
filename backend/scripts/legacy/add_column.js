const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new Database(dbPath);

try {
  // Add selected_model column to llm_api_keys table
  db.exec('ALTER TABLE llm_api_keys ADD COLUMN selected_model VARCHAR(50)');
  console.log('✅ Column selected_model added successfully');

  // Verify the column was added
  const info = db.prepare('PRAGMA table_info(llm_api_keys)').all();
  console.log('\nTable structure:');
  info.forEach(col => {
    console.log(`  ${col.name} (${col.type})`);
  });
} catch (error) {
  if (error.message.includes('duplicate column name')) {
    console.log('❌ Column already exists');
  } else {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
} finally {
  db.close();
}
