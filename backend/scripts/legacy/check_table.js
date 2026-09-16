const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

console.log('\n=== Estructura de llm_api_keys ===');
db.all("PRAGMA table_info(llm_api_keys)", (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.table(rows);
  }

  console.log('\n=== Estructura de projects ===');
  db.all("PRAGMA table_info(projects)", (err, rows) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.table(rows);
    }
    db.close();
  });
});
