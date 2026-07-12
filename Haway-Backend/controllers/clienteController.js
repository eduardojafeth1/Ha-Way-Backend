// controllers/clienteController.js
const db = require('../db');

// 1. Crear una solicitud de transporte
exports.createSolicitud = async (req, res) => {
  const id_cliente = req.usuario.id_usuario;
  const { 
    id_direccion, 
    cantidad, 
    unidad_medida, 
    fecha_programada, 
    hora_programada, 
    descripcion 
  } = req.body;

  if (!cantidad || !unidad_medida) {
    return res.status(400).json({ error: 'La cantidad y la unidad de medida son campos obligatorios.' });
  }

  const cantidadNum = parseFloat(cantidad);
  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un número mayor a cero.' });
  }

  const unidadUpper = unidad_medida.toUpperCase();
  if (unidadUpper !== 'BARRILES' && unidadUpper !== 'GALONES' && unidadUpper !== 'CISTERNA') {
    return res.status(400).json({ error: 'La unidad de medida debe ser "BARRILES", "GALONES" o "CISTERNA".' });
  }

  try {
    let finalDireccionId = id_direccion;

    // Si no se provee dirección, buscar la predeterminada/principal del cliente
    if (!finalDireccionId) {
      const dirQuery = await db.query(
        'SELECT id_direccion FROM direcciones WHERE id_usuario = $1 ORDER BY principal DESC, id_direccion ASC LIMIT 1',
        [id_cliente]
      );
      if (dirQuery.rows.length === 0) {
        return res.status(400).json({ 
          error: 'No se especificó id_direccion y no tienes direcciones registradas. Agrega una dirección a tu perfil primero.' 
        });
      }
      finalDireccionId = dirQuery.rows[0].id_direccion;
    } else {
      // Validar que la dirección pertenezca al cliente
      const valDir = await db.query(
        'SELECT id_direccion FROM direcciones WHERE id_direccion = $1 AND id_usuario = $2',
        [finalDireccionId, id_cliente]
      );
      if (valDir.rows.length === 0) {
        return res.status(403).json({ error: 'La dirección especificada no pertenece a tu cuenta.' });
      }
    }

    const insertQuery = `
      INSERT INTO solicitudes (id_cliente, id_direccion, cantidad, unidad_medida, fecha_programada, hora_programada, descripcion, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PUBLICADA')
      RETURNING *;
    `;
    const result = await db.query(insertQuery, [
      id_cliente,
      finalDireccionId,
      cantidadNum,
      unidadUpper,
      fecha_programada || null,
      hora_programada || null,
      descripcion || null
    ]);

    res.status(201).json({
      message: 'Solicitud publicada exitosamente.',
      solicitud: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor al crear la solicitud.' });
  }
};

// 2. Obtener solicitudes del cliente autenticado
exports.getSolicitudes = async (req, res) => {
  const id_cliente = req.usuario.id_usuario;

  try {
    const query = `
      SELECT s.*, d.direccion, d.referencia, d.latitud, d.longitud, d.nombre AS nombre_direccion,
             (SELECT COUNT(*) FROM ofertas o WHERE o.id_solicitud = s.id_solicitud) AS total_ofertas
      FROM solicitudes s
      JOIN direcciones d ON s.id_direccion = d.id_direccion
      WHERE s.id_cliente = $1
      ORDER BY s.fecha_publicacion DESC;
    `;
    const result = await db.query(query, [id_cliente]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor al obtener las solicitudes.' });
  }
};

// 3. Cancelar una solicitud
exports.cancelSolicitud = async (req, res) => {
  const id_cliente = req.usuario.id_usuario;
  const { id } = req.params;

  try {
    // Verificar propiedad y estado de la solicitud
    const solQuery = await db.query(
      'SELECT id_solicitud, estado FROM solicitudes WHERE id_solicitud = $1 AND id_cliente = $2',
      [id, id_cliente]
    );

    if (solQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada o no pertenece a tu cuenta.' });
    }

    const solicitud = solQuery.rows[0];
    if (solicitud.estado !== 'PUBLICADA' && solicitud.estado !== 'RECIBIENDO_OFERTAS') {
      return res.status(400).json({ 
        error: `No se puede cancelar una solicitud en estado: ${solicitud.estado}.` 
      });
    }

    // Cancelar la solicitud
    const cancelQuery = `
      UPDATE solicitudes
      SET estado = 'CANCELADA'
      WHERE id_solicitud = $1
      RETURNING *;
    `;
    const result = await db.query(cancelQuery, [id]);

    res.json({
      message: 'Solicitud cancelada exitosamente.',
      solicitud: result.rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al cancelar la solicitud.' });
  }
};

// 4. Obtener ofertas para una solicitud específica del cliente
exports.getOfertasForSolicitud = async (req, res) => {
  const id_cliente = req.usuario.id_usuario;
  const { id_solicitud } = req.params;

  try {
    // Validar propiedad de la solicitud
    const solQuery = await db.query(
      'SELECT id_solicitud FROM solicitudes WHERE id_solicitud = $1 AND id_cliente = $2',
      [id_solicitud, id_cliente]
    );

    if (solQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada o no pertenece a tu cuenta.' });
    }

    const query = `
      SELECT o.*, 
             u.nombre AS conductor_nombre, u.apellido AS conductor_apellido, u.foto AS conductor_foto,
             c.calificacion, c.viajes_realizados,
             cam.placa, cam.marca, cam.modelo, cam.capacidad_galones, cam.foto AS camion_foto
      FROM ofertas o
      JOIN conductores c ON o.id_conductor = c.id_conductor
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      JOIN camiones cam ON o.id_camion = cam.id_camion
      WHERE o.id_solicitud = $1 AND o.estado != 'CANCELADA'
      ORDER BY o.precio ASC;
    `;
    const result = await db.query(query, [id_solicitud]);
    res.json(result.rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al obtener las ofertas.' });
  }
};

// 5. Aceptar una oferta
exports.aceptarOferta = async (req, res) => {
  const id_cliente = req.usuario.id_usuario;
  const { id_oferta } = req.params;

  try {
    await db.query('BEGIN');

    // 1. Obtener y validar la oferta
    const ofQuery = `
      SELECT o.*, s.id_cliente, s.estado AS solicitud_estado
      FROM ofertas o
      JOIN solicitudes s ON o.id_solicitud = s.id_solicitud
      WHERE o.id_oferta = $1;
    `;
    const ofResult = await db.query(ofQuery, [id_oferta]);

    if (ofResult.rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ error: 'Oferta no encontrada.' });
    }

    const oferta = ofResult.rows[0];

    if (oferta.id_cliente !== id_cliente) {
      await db.query('ROLLBACK');
      return res.status(403).json({ error: 'No tienes permiso sobre esta solicitud.' });
    }

    if (oferta.estado !== 'PENDIENTE') {
      await db.query('ROLLBACK');
      return res.status(400).json({ error: `La oferta ya no está pendiente (estado actual: ${oferta.estado}).` });
    }

    if (oferta.solicitud_estado !== 'PUBLICADA' && oferta.solicitud_estado !== 'RECIBIENDO_OFERTAS') {
      await db.query('ROLLBACK');
      return res.status(400).json({ 
        error: `La solicitud ya no acepta ofertas (estado actual: ${oferta.solicitud_estado}).` 
      });
    }

    // 2. Marcar la oferta como ACEPTADA
    await db.query(
      "UPDATE ofertas SET estado = 'ACEPTADA' WHERE id_oferta = $1",
      [id_oferta]
    );

    // 3. Rechazar las otras ofertas pendientes de la misma solicitud
    await db.query(
      "UPDATE ofertas SET estado = 'RECHAZADA' WHERE id_solicitud = $1 AND id_oferta != $2 AND estado = 'PENDIENTE'",
      [oferta.id_solicitud, id_oferta]
    );

    // 4. Actualizar estado de la solicitud
    await db.query(
      "UPDATE solicitudes SET estado = 'OFERTA_ACEPTADA' WHERE id_solicitud = $1",
      [oferta.id_solicitud]
    );

    // 5. Crear el Pedido
    const createPedidoQuery = `
      INSERT INTO pedidos (id_solicitud, id_oferta, estado)
      VALUES ($1, $2, 'PENDIENTE')
      RETURNING *;
    `;
    const pedResult = await db.query(createPedidoQuery, [oferta.id_solicitud, id_oferta]);
    const nuevoPedido = pedResult.rows[0];

    // 6. Crear el Pago (por defecto en EFECTIVO y estado PENDIENTE)
    const createPagoQuery = `
      INSERT INTO pagos (id_pedido, metodo, subtotal, total, estado)
      VALUES ($1, 'EFECTIVO', $2, $2, 'PENDIENTE')
      RETURNING *;
    `;
    const pagResult = await db.query(createPagoQuery, [nuevoPedido.id_pedido, oferta.precio]);
    const nuevoPago = pagResult.rows[0];

    // 7. Insertar el seguimiento inicial (PEDIDO_CONFIRMADO)
    const createSeguimientoQuery = `
      INSERT INTO seguimientos (id_pedido, estado, descripcion)
      VALUES ($1, 'PEDIDO_CONFIRMADO', 'Pedido creado exitosamente, en espera de preparación por el conductor.')
    `;
    await db.query(createSeguimientoQuery, [nuevoPedido.id_pedido]);

    await db.query('COMMIT');

    res.json({
      message: 'Oferta aceptada y pedido generado.',
      pedido: nuevoPedido,
      pago: nuevoPago
    });

  } catch (err) {
    await db.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor al aceptar la oferta.' });
  }
};

// 6. Obtener pedidos del cliente
exports.getPedidos = async (req, res) => {
  const id_cliente = req.usuario.id_usuario;

  try {
    const query = `
      SELECT p.*, o.precio, o.tiempo_estimado, s.cantidad, s.unidad_medida, s.descripcion AS solicitud_descripcion,
             u_cond.nombre AS conductor_nombre, u_cond.apellido AS conductor_apellido, cond.calificacion AS conductor_calificacion,
             cam.placa AS camion_placa, cam.marca AS camion_marca, cam.modelo AS camion_modelo,
             pag.total AS pago_total, pag.estado AS pago_estado, pag.metodo AS pago_metodo
      FROM pedidos p
      JOIN solicitudes s ON p.id_solicitud = s.id_solicitud
      JOIN ofertas o ON p.id_oferta = o.id_oferta
      JOIN conductores cond ON o.id_conductor = cond.id_conductor
      JOIN usuarios u_cond ON cond.id_usuario = u_cond.id_usuario
      JOIN camiones cam ON o.id_camion = cam.id_camion
      LEFT JOIN pagos pag ON p.id_pedido = pag.id_pedido
      WHERE s.id_cliente = $1
      ORDER BY p.fecha_inicio DESC;
    `;
    const result = await db.query(query, [id_cliente]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al obtener los pedidos.' });
  }
};

// 7. Obtener detalles de un pedido y su historial de seguimientos
exports.getPedidoById = async (req, res) => {
  const id_cliente = req.usuario.id_usuario;
  const { id } = req.params;

  try {
    // Consultar detalles principales del pedido
    const pedQuery = `
      SELECT p.*, o.precio, o.tiempo_estimado, 
             s.cantidad, s.unidad_medida, s.descripcion AS solicitud_descripcion,
             d.direccion, d.referencia, d.latitud AS dest_latitud, d.longitud AS dest_longitud,
             u_cond.nombre AS conductor_nombre, u_cond.apellido AS conductor_apellido, 
             u_cond.telefono AS conductor_telefono, u_cond.foto AS conductor_foto,
             cond.calificacion AS conductor_calificacion, cond.viajes_realizados AS conductor_viajes,
             cam.placa AS camion_placa, cam.marca AS camion_marca, cam.modelo AS camion_modelo, cam.color AS camion_color,
             pag.total AS pago_total, pag.estado AS pago_estado, pag.metodo AS pago_metodo
      FROM pedidos p
      JOIN solicitudes s ON p.id_solicitud = s.id_solicitud
      JOIN direcciones d ON s.id_direccion = d.id_direccion
      JOIN ofertas o ON p.id_oferta = o.id_oferta
      JOIN conductores cond ON o.id_conductor = cond.id_conductor
      JOIN usuarios u_cond ON cond.id_usuario = u_cond.id_usuario
      JOIN camiones cam ON o.id_camion = cam.id_camion
      LEFT JOIN pagos pag ON p.id_pedido = pag.id_pedido
      WHERE p.id_pedido = $1 AND s.id_cliente = $2;
    `;
    const pedResult = await db.query(pedQuery, [id, id_cliente]);

    if (pedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido no encontrado o no pertenece a tu cuenta.' });
    }

    // Consultar el historial de seguimiento
    const segQuery = `
      SELECT id_seguimiento, estado, descripcion, latitud, longitud, fecha
      FROM seguimientos
      WHERE id_pedido = $1
      ORDER BY fecha DESC;
    `;
    const segResult = await db.query(segQuery, [id]);

    res.json({
      pedido: pedResult.rows[0],
      historial_seguimiento: segResult.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno al obtener los detalles del pedido.' });
  }
};
