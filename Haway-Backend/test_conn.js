const db = require('./db');

async function testConnection() {
  try {
    const res = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables in public schema:");
    res.rows.forEach(row => console.log("- " + row.table_name));
    
    if (res.rows.length === 0) {
      console.log("No tables found in public schema.");
    }
  } catch (error) {
    console.error("Error querying database:", error.message);
  } finally {
    db.end();
  }
}

testConnection();
