const db = require('./db');

async function fixDb() {
    try {
        await db.query(`ALTER TABLE notificaciones ADD COLUMN IF NOT EXISTS id_referencia INT;`);
        console.log("Column id_referencia added.");
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

fixDb();
