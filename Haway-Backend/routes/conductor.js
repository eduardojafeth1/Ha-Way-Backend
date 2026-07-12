// routes/conductor.js
const express = require('express');
const router = express.Router();
const conductorController = require('../controllers/conductorController');
const verificarAuth = require('../middleware/auth');

// Middleware para verificar que el usuario sea CONDUCTOR
const esConductor = (req, res, next) => {
  if (req.usuario && req.usuario.rol === 'CONDUCTOR') {
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado. Se requiere el rol CONDUCTOR.' });
};

// Aplicar autenticación y rol a todas las rutas del conductor
router.use(verificarAuth, esConductor);

/**
 * @openapi
 * /conductor/solicitudes/disponibles:
 *   get:
 *     summary: Obtener todas las solicitudes de transporte disponibles para ofertar (PUBLICADA o RECIBIENDO_OFERTAS)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de solicitudes disponibles.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/solicitudes/disponibles', conductorController.getSolicitudesDisponibles);

/**
 * @openapi
 * /conductor/ofertas:
 *   post:
 *     summary: Crear/enviar una oferta sobre una solicitud de transporte (Solo Conductor)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id_solicitud, id_camion, precio, tiempo_estimado]
 *             properties:
 *               id_solicitud:
 *                 type: integer
 *                 example: 1
 *               id_camion:
 *                 type: integer
 *                 example: 1
 *               precio:
 *                 type: number
 *                 format: float
 *                 example: 1500.00
 *               tiempo_estimado:
 *                 type: integer
 *                 description: Tiempo estimado en minutos
 *                 example: 120
 *               distancia:
 *                 type: number
 *                 format: float
 *                 description: Distancia estimada en kilómetros
 *                 example: 25.5
 *               mensaje:
 *                 type: string
 *                 description: Mensaje u observaciones para el cliente
 *                 example: "Tengo disponibilidad inmediata y cuento con cisterna limpia"
 *     responses:
 *       201:
 *         description: Oferta enviada con éxito.
 *       400:
 *         description: Parámetros inválidos, el camión no está activo, o ya tienes una oferta en esta solicitud.
 *       403:
 *         description: El camión provisto no te pertenece.
 *       404:
 *         description: Solicitud o conductor no encontrados.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/ofertas', conductorController.createOferta);

/**
 * @openapi
 * /conductor/ofertas:
 *   get:
 *     summary: Obtener todas las ofertas enviadas por el conductor autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de ofertas enviadas.
 *       404:
 *         description: Conductor no encontrado.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/ofertas', conductorController.getOfertas);

/**
 * @openapi
 * /conductor/ofertas/{id}/cancelar:
 *   put:
 *     summary: Cancelar o retirar una oferta enviada (Solo si está en estado PENDIENTE)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la oferta
 *     responses:
 *       200:
 *         description: Oferta cancelada/retirada con éxito.
 *       400:
 *         description: La oferta no se puede cancelar por su estado actual.
 *       404:
 *         description: Oferta o conductor no encontrados.
 *       500:
 *         description: Error interno del servidor.
 */
router.put('/ofertas/:id/cancelar', conductorController.cancelarOferta);

/**
 * @openapi
 * /conductor/pedidos:
 *   get:
 *     summary: Listar todos los pedidos (entregas) asignados al conductor autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pedidos asignados.
 *       404:
 *         description: Conductor no encontrado.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/pedidos', conductorController.getPedidos);

/**
 * @openapi
 * /conductor/pedidos/{id}:
 *   get:
 *     summary: Obtener los detalles y el historial de seguimientos de un pedido asignado al conductor
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del pedido
 *     responses:
 *       200:
 *         description: Detalles del pedido y su historial de seguimientos.
 *       404:
 *         description: Pedido o conductor no encontrados.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/pedidos/:id', conductorController.getPedidoById);

/**
 * @openapi
 * /conductor/pedidos/{id}/estado:
 *   put:
 *     summary: Actualizar el estado de la entrega/pedido (Solo Conductor)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del pedido
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [estado]
 *             properties:
 *               estado:
 *                 type: string
 *                 enum: [PENDIENTE, PREPARANDO, EN_CAMINO, LLEGO, ENTREGADO, CANCELADO]
 *                 example: PREPARANDO
 *               descripcion:
 *                 type: string
 *                 description: Comentario o descripción para el seguimiento
 *                 example: "Cargando el camión cisterna en la planta principal"
 *               latitud:
 *                 type: number
 *                 format: float
 *                 description: Latitud actual del camión
 *                 example: 14.0934
 *               longitud:
 *                 type: number
 *                 format: float
 *                 description: Longitud actual del camión
 *                 example: -87.2065
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente.
 *       400:
 *         description: Transición de estado no permitida o pedido ya finalizado.
 *       403:
 *         description: No tienes permisos para actualizar este pedido.
 *       404:
 *         description: Pedido o conductor no encontrados.
 *       500:
 *         description: Error interno del servidor.
 */
router.put('/pedidos/:id/estado', conductorController.updatePedidoEstado);

module.exports = router;
