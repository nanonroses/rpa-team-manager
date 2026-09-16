const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }

  db.all(`SELECT * FROM schema_migrations ORDER BY version`, (err, migrations) => {
    if (err) {
      console.error('ERROR al leer schema_migrations:', err.message);
    } else {
      console.log('\n=== MIGRACIONES APLICADAS ===\n');
      console.log(`Total: ${migrations.length} migraciones\n`);
      migrations.forEach(m => {
        console.log(`v${m.version}: ${m.description}`);
        console.log(`  Aplicada: ${m.applied_at}\n`);
      });
    }
    db.close();
  });
});
