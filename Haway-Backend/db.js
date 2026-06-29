require('dotenv').config();
const { Pool } = require('pg');

// Neon requiere SSL para conexiones externas por seguridad
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Permite la conexión SSL segura con Neon
  }
});

// Probar la conexión al iniciar
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error al conectar con la base de datos de Neon:', err.stack);
  } else {
    console.log('Conexión exitosa a Neon establecida en:', res.rows[0].now);
  }
});

module.exports = pool;
