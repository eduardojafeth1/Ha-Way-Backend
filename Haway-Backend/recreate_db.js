const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function recreateDB() {
  const client = await pool.connect();
  try {
    // Drop existing public schema to start fresh
    console.log("Dropping existing public schema...");
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    
    // Read schema.sql
    const sqlPath = path.join(__dirname, 'schema.sql');
    let sql = fs.readFileSync(sqlPath, 'utf-8');
    
    // Split by statement
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    console.log(`Executing schema.sql (${statements.length} statements)...`);
    for (const stmt of statements) {
      try {
         await client.query(stmt);
      } catch (err) {
         if (err.code === '42P07') {
           // relation already exists (e.g. duplicate index creation), ignore safely
           console.log(`Ignoring duplicate relation: ${err.message}`);
         } else {
           console.error(`Error executing statement: ${stmt.substring(0, 50)}...`);
           throw err;
         }
      }
    }
    
    console.log("Database recreated successfully.");
  } catch (error) {
    console.error("Error recreating database:", error);
  } finally {
    client.release();
    pool.end();
  }
}

recreateDB();
