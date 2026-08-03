const db = require('../db');
const notificationEmitter = require('./notificationEmitter');

/**
 * Inserta una notificación en la base de datos y la emite vía SSE.
 * @param {number} id_usuario - ID del usuario (cliente o conductor) que recibe la notificación
 * @param {string} titulo - Título corto
 * @param {string} mensaje - Mensaje detallado
 * @param {string} tipo - Tipo de evento (ej. 'NUEVA_OFERTA', 'OFERTA_ACEPTADA', 'CAMBIO_ESTADO')
 */
const enviarNotificacion = async (id_usuario, titulo, mensaje, tipo, id_referencia = null) => {
  try {
    const query = `
      INSERT INTO notificaciones (id_usuario, titulo, mensaje, tipo, leida, id_referencia)
      VALUES ($1, $2, $3, $4, false, $5)
      RETURNING *;
    `;
    const result = await db.query(query, [id_usuario, titulo, mensaje, tipo, id_referencia]);
    const notificacion = result.rows[0];

    // Emitir el evento a los listeners de SSE
    notificationEmitter.emit('nueva_notificacion', notificacion);

    return notificacion;
  } catch (error) {
    console.error('Error al enviar notificación:', error);
  }
};

module.exports = { enviarNotificacion };
