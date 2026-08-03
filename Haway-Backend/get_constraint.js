const db = require('./db');

async function getConstraint() {
    try {
        const res = await db.query(`
            SELECT pg_get_constraintdef(c.oid) AS constraint_def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            WHERE t.relname = 'notificaciones' AND c.conname = 'ck_tiponotificacion';
        `);
        console.log("Constraint definition:", res.rows[0].constraint_def);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit();
    }
}

getConstraint();
