const db = require('./db');

async function testNotificacion() {
    try {
        const users = await db.query('SELECT id_usuario FROM usuarios');
        for (let user of users.rows) {
            await db.query(`
                INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, leida)
                VALUES ($1, $2, $3, $4, false)
            `, [user.id_usuario, 'Notificación de Prueba', 'Esta es una prueba para verificar que el sistema de notificaciones en el frontend funciona correctamente.', 'PRUEBA']);
        }
        console.log("Notificaciones de prueba insertadas para todos los usuarios.");
    } catch (err) {
        console.error("Error insertando notificación:", err);
    } finally {
        process.exit();
    }
}

testNotificacion();
