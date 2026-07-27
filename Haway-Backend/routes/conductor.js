// routes/conductor.js
const express = require('express');
const router = express.Router();
const conductorController = require('../controllers/conductorController');
const verificarAuth = require('../middleware/auth');
const { uploadConductor } = require('../middleware/upload');

/**
 * @openapi
 * /conductor/registro:
 *   post:
 *     summary: Registrar un nuevo conductor con sus documentos y camión (3 pasos)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: 
 *               - nombre
 *               - apellido
 *               - correo
 *               - password
 *               - telefono
 *               - numero_licencia
 *               - fecha_vencimiento
 *               - identidad
 *               - placa
 *               - capacidad_galones
 *               - cv
 *               - licencia
 *               - foto_perfil
 *               - foto_revision
 *               - foto_camion
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: Juan
 *               apellido:
 *                 type: string
 *                 example: Perez
 *               correo:
 *                 type: string
 *                 example: juan.perez@example.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               contrasena:
 *                 type: string
 *                 description: Equivalente a password por compatibilidad
 *                 example: "123456"
 *               telefono:
 *                 type: string
 *                 example: "99887766"
 *               numero_licencia:
 *                 type: string
 *                 example: "LIC-123456"
 *               fecha_vencimiento:
 *                 type: string
 *                 format: date
 *                 example: "2030-12-31"
 *               identidad:
 *                 type: string
 *                 example: "0801199512345"
 *               nombre_empresa:
 *                 type: string
 *                 example: "Transportes Perez S.A."
 *               rtn:
 *                 type: string
 *                 example: "08011995123450"
 *               motivo_solicitud:
 *                 type: string
 *                 example: "Deseo unirme a la red de transporte de agua de Ha'Way."
 *               placa:
 *                 type: string
 *                 example: "AAB1234"
 *               marca:
 *                 type: string
 *                 example: "Hino"
 *               modelo:
 *                 type: string
 *                 example: "500 Series"
 *               anio:
 *                 type: integer
 *                 example: 2018
 *               capacidad_galones:
 *                 type: integer
 *                 example: 5000
 *               color:
 *                 type: string
 *                 example: "Blanco"
 *               revision_tecnica:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-30"
 *               cv:
 *                 type: string
 *                 format: binary
 *                 description: Currículum Vitae (PDF o Imagen)
 *               licencia:
 *                 type: string
 *                 format: binary
 *                 description: Foto de Licencia de Conducir (PDF o Imagen)
 *               foto_perfil:
 *                 type: string
 *                 format: binary
 *                 description: Foto de perfil del conductor (Imagen)
 *               foto_revision:
 *                 type: string
 *                 format: binary
 *                 description: Foto de revisión técnica (PDF o Imagen)
 *               foto_camion:
 *                 type: string
 *                 format: binary
 *                 description: Foto del camión cisterna (Imagen)
 *     responses:
 *       201:
 *         description: Conductor y camión registrados exitosamente.
 *       400:
 *         description: Faltan campos obligatorios o hay datos duplicados en el sistema (correo, teléfono, identidad, placa).
 *       500:
 *         description: Error interno del servidor.
 */
router.post('/registro', uploadConductor, conductorController.registrarConductor);

// Middleware para verificar que el usuario sea CONDUCTOR (para las demás rutas)
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
