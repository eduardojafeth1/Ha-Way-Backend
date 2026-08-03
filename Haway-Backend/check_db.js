const db = require('./db');

async function main() {
    try {
        await db.query(`UPDATE notificaciones SET id_referencia = 12 WHERE id_referencia IS NULL AND tipo IN ('CAMBIO_ESTADO', 'OFERTA_ACEPTADA')`);
        console.log('updated');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

main();
