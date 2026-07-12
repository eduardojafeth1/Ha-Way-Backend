// routes/cliente.js
const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');
const verificarAuth = require('../middleware/auth');

// Middleware para verificar que el usuario sea CLIENTE
const esCliente = (req, res, next) => {
  if (req.usuario && req.usuario.rol === 'CLIENTE') {
    return next();
  }
  return res.status(403).json({ error: 'Acceso denegado. Se requiere el rol CLIENTE.' });
};

// Aplicar autenticación y rol a todas las rutas del cliente
router.use(verificarAuth, esCliente);

/**
 * @openapi
 * /cliente/solicitudes:
 *   post:
 *     summary: Crear una nueva solicitud de transporte (Solo Cliente)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cantidad, unidad_medida]
 *             properties:
 *               id_direccion:
 *                 type: integer
 *                 description: ID de la dirección. Si no se envía, se usará la dirección principal del cliente.
 *                 example: 1
 *               cantidad:
 *                 type: number
 *                 format: float
 *                 description: Cantidad a transportar
 *                 example: 500.50
 *               unidad_medida:
 *                 type: string
 *                 enum: [BARRILES, GALONES, CISTERNA]
 *                 example: GALONES
 *               fecha_programada:
 *                 type: string
 *                 format: date
 *                 description: Fecha programada (YYYY-MM-DD)
 *                 example: "2026-07-20"
 *               hora_programada:
 *                 type: string
 *                 description: Hora programada (HH:MM:SS)
 *                 example: "14:30:00"
 *               descripcion:
 *                 type: string
 *                 description: Descripción del pedido
 *                 example: "Carga de combustible regular para estación"
 *     responses:
 *       201:
 *         description: Solicitud creada y publicada con éxito.
 *       400:
 *         description: Datos inválidos o dirección principal faltante.
 *       403:
 *         description: La dirección provista no pertenece al cliente o no tiene permisos.
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/solicitudes', clienteController.createSolicitud);

/**
 * @openapi
 * /cliente/solicitudes:
 *   get:
 *     summary: Listar todas las solicitudes creadas por el cliente autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de solicitudes del cliente.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/solicitudes', clienteController.getSolicitudes);

/**
 * @openapi
 * /cliente/solicitudes/{id}/cancelar:
 *   put:
 *     summary: Cancelar una solicitud del cliente (Solo si está en estado PUBLICADA o RECIBIENDO_OFERTAS)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la solicitud
 *     responses:
 *       200:
 *         description: Solicitud cancelada con éxito.
 *       400:
 *         description: La solicitud no se puede cancelar por su estado actual.
 *       404:
 *         description: Solicitud no encontrada.
 *       500:
 *         description: Error interno del servidor.
 */
router.put('/solicitudes/:id/cancelar', clienteController.cancelSolicitud);

/**
 * @openapi
 * /cliente/solicitudes/{id_solicitud}/ofertas:
 *   get:
 *     summary: Obtener todas las ofertas recibidas para una solicitud específica del cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_solicitud
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la solicitud
 *     responses:
 *       200:
 *         description: Lista de ofertas activas para la solicitud.
 *       404:
 *         description: Solicitud no encontrada.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/solicitudes/:id_solicitud/ofertas', clienteController.getOfertasForSolicitud);

/**
 * @openapi
 * /cliente/ofertas/{id_oferta}/aceptar:
 *   put:
 *     summary: Aceptar una oferta (genera pedido, genera pago pendiente, rechaza las demás ofertas)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_oferta
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la oferta a aceptar
 *     responses:
 *       200:
 *         description: Oferta aceptada con éxito. Pedido y pago generados.
 *       400:
 *         description: La oferta o la solicitud no están en estados válidos para aceptar.
 *       403:
 *         description: La solicitud no pertenece al cliente.
 *       404:
 *         description: Oferta no encontrada.
 *       500:
 *         description: Error interno del servidor.
 */
router.put('/ofertas/:id_oferta/aceptar', clienteController.aceptarOferta);

/**
 * @openapi
 * /cliente/pedidos:
 *   get:
 *     summary: Listar todos los pedidos (entregas) del cliente autenticado
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de pedidos del cliente.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/pedidos', clienteController.getPedidos);

/**
 * @openapi
 * /cliente/pedidos/{id}:
 *   get:
 *     summary: Obtener los detalles y el historial de seguimientos de un pedido del cliente
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
 *         description: Pedido no encontrado.
 *       500:
 *         description: Error interno del servidor.
 */
router.get('/pedidos/:id', clienteController.getPedidoById);

module.exports = router;
