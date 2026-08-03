const db = require('./db');

async function fixDb() {
    try {
        await db.query(`ALTER TABLE notificaciones DROP CONSTRAINT ck_tiponotificacion;`);
        console.log("Constraint dropped.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

fixDb();
