const db = require('./db');

async function createTable() {
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS notificaciones (
                id_notificacion SERIAL PRIMARY KEY,
                id_usuario INT REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
                titulo VARCHAR(255) NOT NULL,
                mensaje TEXT NOT NULL,
                tipo VARCHAR(50),
                leida BOOLEAN DEFAULT false,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tabla notificaciones creada exitosamente.");
    } catch (err) {
        console.error("Error creando tabla:", err);
    } finally {
        process.exit();
    }
}

createTable();
